import path = require('path')
import fs = require('fs')
import util = require('util')
import { crc32, md5 } from './util'
import { existDir, existFile, writeFileAsync } from '../common/util'
const openAsync = util.promisify(fs.open)
const readAsync = util.promisify(fs.read)
const writeAsync = util.promisify(fs.write)
const readFileAsync = util.promisify(fs.readFile)

const META = 'Meta'
const MAGIC = 0x125e591
const VERSION = 1
const HeaderConfig: Field[] = [
	{
		field: 'magic',
		type: 'int',
		len: 32,
	},
	{
		field: 'version',
		type: 'int',
		len: 32,
	},
	{
		field: 'checksum',
		type: 'int',
		len: 32,
	},
	{
		field: 'count',
		type: 'int',
		len: 32,
	},
]
const SectionHeaderConfig: Field[] = [
	{
		field: 'checksum',
		type: 'int',
		len: 32,
	},
	{
		field: 'id',
		type: 'int',
		len: 32,
	},
	{
		field: 'fid',
		type: 'int',
		len: 32,
	},
	{
		field: 'offset',
		type: 'int',
		len: 32,
	},
	{
		field: 'size',
		type: 'int',
		len: 16,
	},
	{
		field: 'hash',
		type: 'hex',
		len: 128,
	},
	{
		field: 'timestamp',
		type: 'int',
		len: 64,
	},
]
interface DbOptions {
	dbDir: string
	filename: string
}
export default class Db {
	private dbDir: string
	private filename: string
	private headerPath: string
	private filePath: string
	public fds: number[] = [-1, -1]
	public buffer: Buffer = Buffer.alloc(0)
	public header: Header | null = null
	public sectionHeaders: SectionHeader[] = []
	// public headerFd: number
	constructor(options: DbOptions) {
		this.dbDir = options.dbDir
		this.filename = options.filename
		this.headerPath = path.join(this.dbDir, this.filename + META)
		this.filePath = path.join(this.dbDir, this.filename)
	}
	async init(): Promise<void> {
		await existDir(this.dbDir)
		await existFile(this.headerPath)
		await existFile(this.filePath)
		const headerFd = await openAsync(this.headerPath, 'r+')
		const dataFd = await openAsync(this.filePath, 'r+')
		this.fds = [headerFd, dataFd]

		const buffer = await readFileAsync(this.headerPath)
		this.buffer = buffer
		await this._init()
	}
	async _init(): Promise<void> {
		const buffer = this.buffer
		let header: Header
		const sectionHeaders: SectionHeader[] = []
		if (!buffer.length) {
			const count = 0
			header = {
				magic: MAGIC,
				version: VERSION,
				checksum: crc32(Buffer.alloc(4)),
				count,
			}
			await writeFileAsync(this.headerPath, convertToBuffer(header, HeaderConfig))
		} else {
			const headerLen = getLen(HeaderConfig)
			const headerBuf = buffer.slice(0, headerLen)
			header = convertToObj<Header>(headerBuf, HeaderConfig)

			// header = {
			//     magic: buffer.slice(0, 4).readInt32BE(),
			//     version: buffer.slice(4, 8).readInt32BE(),
			//     checksum: buffer.slice(8, 12).readInt32BE(),
			//     count: buffer.slice(12, 16).readInt32BE()
			// }
			const sectionHeadersBuf = buffer.slice(headerLen)
			const len = getLen(SectionHeaderConfig)
			for (let i = 0; i < sectionHeadersBuf.length / len; i++) {
				const buf = sectionHeadersBuf.slice(i * len, (i + 1) * len)

				sectionHeaders.push(convertToObj<SectionHeader>(buf, SectionHeaderConfig))
			}
		}
		this.header = header
		this.sectionHeaders = sectionHeaders
	}
	async read(id: number): Promise<string> {
		const sectionHeader = this.sectionHeaders.find((v) => v.id === id)
		if (sectionHeader) {
			const buf = Buffer.alloc(sectionHeader.size)
			await readAsync(this.fds[1], buf, 0, buf.length, sectionHeader.offset)
			return buf.toString('utf8')
		}
		return ''
	}
	async add(question: string, id: number, fid: number): Promise<void> {
		if (this.sectionHeaders.find((v) => v.id === id)) {
			return
		}
		const buffer = Buffer.from(question)
		const count = (this.header as Header).count
		const last = count > 0 ? this.sectionHeaders[count - 1] : { offset: 0, size: 0 }
		const offset = last.offset + last.size
		const size = buffer.length
		const hash = md5(buffer)
		const partialSecHeader = {
			id,
			fid,
			offset,
			size,
			hash,
			timestamp: Date.now(),
		}
		const config = SectionHeaderConfig.slice(1)
		const partialSecHeaderBuf = convertToBuffer(partialSecHeader, config)
		const checksum = crc32(partialSecHeaderBuf)
		const sectionHeader = {
			checksum,
			...partialSecHeader,
		}
		this.sectionHeaders[count] = sectionHeader

		const secHeaderBuf = convertToBuffer(sectionHeader, SectionHeaderConfig)

		;(this.header as Header).count++
		;(this.header as Header).checksum = crc32(convertToBuffer(this.sectionHeaders, SectionHeaderConfig))
		const headerBuf = convertToBuffer(this.header, HeaderConfig)
		const headerLen = getLen(HeaderConfig)
		const secHeaderLen = getLen(SectionHeaderConfig)
		const secOffset = headerLen + count * secHeaderLen
		await Promise.all([
			writeAsync(this.fds[0], secHeaderBuf, 0, secHeaderBuf.length, secOffset),
			writeAsync(this.fds[0], headerBuf, 0, headerBuf.length, 0),
			writeAsync(this.fds[1], buffer, 0, buffer.length, offset),
		])
	}
}
interface Header {
	magic: number
	version: number
	checksum: number
	count: number
}
interface SectionHeader {
	checksum: number
	id: number
	fid: number
	offset: number
	size: number
	hash: string
	timestamp: number
}
type FieldType = 'int' | 'hex'
export interface Field {
	field: string
	type: FieldType
	len: number
}

export function convertToObj<T>(buffer: Buffer, config: Field[]): T {
	let i = 0
	const obj: Partial<T> = {}
	for (const field of config) {
		obj[field.field] = read(buffer, i, field)
		i += field.len / 8
	}
	return obj as T
}
export function convertToBuffer<T>(obj: T[] | T, config: Field[]): Buffer {
	if (Array.isArray(obj)) {
		return Buffer.concat(obj.map((v) => convertToBuffer(v, config)))
	}
	let i = 0
	const len = getLen(config)
	const buf = Buffer.alloc(len)

	for (const field of config) {
		write(obj[field.field], buf, i, field)
		i += field.len / 8
	}
	return buf
}

function getLen(config: Field[]) {
	return config.reduce((prev, cur) => prev + cur.len / 8, 0)
}

function read(buffer: Buffer, offset: number, field: Field) {
	const mapFun = {
		int: (buffer: Buffer) => {
			const byteLen = field.len / 8
			if (byteLen === 8) {
				try {
					const a = Number(buffer.readBigUInt64BE(offset))
					return a
				} catch (err) {
					console.log(buffer)
				}
			} else {
				return buffer.readUIntBE(offset, field.len / 8)
			}
		},

		hex: (buffer: Buffer) => buffer.slice(offset, offset + field.len / 8).toString('hex'),
	}
	const fun = mapFun[field.type]
	return fun(buffer)
}
function write(value: number | string, buffer: Buffer, offset: number, field: Field) {
	const mapFunc = {
		int: () => {
			const byteLen = field.len / 8
			if (byteLen === 8) {
				buffer.writeBigInt64BE(BigInt(value as number), offset)
			} else {
				buffer.writeUIntBE(value as number, offset, field.len / 8)
			}
		},
		hex: () => Buffer.from(value as string, 'hex').copy(buffer, offset),
	}
	const fun = mapFunc[field.type]
	return fun()
}

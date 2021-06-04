import * as assert from 'assert'

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
// import * as myExtension from '../../extension';
import { crc32 } from '../../fileStorage/util'
import { convertToObj, convertToBuffer, Field } from '../../fileStorage/db'
interface FieldData {
	v: number
	h: string
}
suite('test file storage', () => {
	test('test crc32', () => {
		const data = Buffer.from([0x61, 0x62, 0x63])

		const result = crc32(data)
		assert.equal(result, 0x352441c2)
	})
	test('test convertToObj', () => {
		const config: Field[] = [
			{
				field: 'v',
				type: 'int',
				len: 16,
			},
			{
				field: 'h',
				type: 'hex',
				len: 32,
			},
		]
		const buffer = Buffer.from([0x00, 0x11, 0x00, 0x12, 0xab, 0xcd])
		const result = convertToObj<FieldData>(buffer, config)
		assert.equal(result.v, 17)
		assert.equal(result.h, '0012abcd')
	})
	test('test convertToBuffer', () => {
		const config: Field[] = [
			{
				field: 'v',
				type: 'int',
				len: 16,
			},
			{
				field: 'h',
				type: 'hex',
				len: 32,
			},
		]
		const obj: FieldData = {
			v: 17,
			h: '0012abcd',
		}
		const buffer = Buffer.from([0x00, 0x11, 0x00, 0x12, 0xab, 0xcd])
		const result = convertToBuffer(obj, config)
		assert.deepEqual(result, buffer)
	})
})

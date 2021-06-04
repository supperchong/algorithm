import crypto = require('crypto')
import crc32_table from './crc32_table'
export function md5(data: crypto.BinaryLike): string {
	const hash = crypto.createHash('md5')
	return hash.update(data).digest('hex')
}

/**
 * Reference:https://docs.microsoft.com/en-us/openspecs/office_protocols/ms-abs/06966aa2-70da-4bf9-8448-3355f277cd77?redirectedfrom=MSDN
 * @param buffer
 */
export function crc32(buffer: Buffer): number {
	let crc = 0xffffffff
	let i = 0
	while (i < buffer.length) {
		crc = crc32_table[(crc & 0xff) ^ buffer[i]] ^ ((crc >= 0 ? crc : 2 ** 32 + crc) / 256)
		i++
	}
	crc = crc ^ 0xffffffff
	return crc >= 0 ? crc : 2 ** 32 + crc
}
export function verify(data: Buffer, checksum: number) {
	return crc32(data) === checksum
}

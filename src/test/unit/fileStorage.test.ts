import * as assert from 'assert'

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
// import * as myExtension from '../../extension';
import { getTestCaseList } from '../../common/util'
import { crc32 } from '../../fileStorage/util'
import { convertToObj, convertToBuffer, Field } from '../../fileStorage/db'
suite('test file storage', () => {
	test('test crc32', () => {
		let data = Buffer.from([0x61, 0x62, 0x63])

		const result = crc32(data)
		assert.equal(result, 0x352441c2)
	})
	test('test convertToObj', () => {
		let config: Field[] = [
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
		let buffer = Buffer.from([0x00, 0x11, 0x00, 0x12, 0xab, 0xcd])
		const result = convertToObj<any>(buffer, config)
		assert.equal(result.v, 17)
		assert.equal(result.h, '0012abcd')
	})
	test('test convertToBuffer', () => {
		let config: Field[] = [
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
		let obj = {
			v: 17,
			h: '0012abcd',
		}
		let buffer = Buffer.from([0x00, 0x11, 0x00, 0x12, 0xab, 0xcd])
		let result = convertToBuffer(obj, config)
		assert.deepEqual(result, buffer)
	})
})

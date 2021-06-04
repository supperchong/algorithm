import cp = require('child_process')

import path = require('path')
import { config } from './config'
import { window } from 'vscode'
import { TestOptions } from './common/lang'
const notFoundReg = /node: not found/
export function execTestChildProcess(options: TestOptions): Promise<string> {
	return new Promise((resolve) => {
		const { nodeBinPath } = config
		const cmd = cp.spawn(nodeBinPath, [path.join(__dirname, './child_process/execTestCode.js')])
		let msg = ''
		cmd.stdout.on('data', (data) => {
			console.log('data', data)
			msg += data
		})
		cmd.stdin.setDefaultEncoding('utf8')
		cmd.stdin.write(JSON.stringify(options))
		cmd.stdin.end()
		// cmd.send(JSON.stringify(options))
		cmd.stderr.on('data', (message) => {
			console.log('err', message.toString())
			if (notFoundReg.test(message)) {
				window.showErrorMessage(message + ',please set the path of  the nodejs')
			} else {
				window.showErrorMessage(message)
			}
		})
		cmd.on('close', () => {
			resolve(msg)
			console.log('child process close')
			console.log('msg', msg)
		})
	})
}

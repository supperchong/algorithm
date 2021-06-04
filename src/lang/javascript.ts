import { CaseList, getFuncNames, readFileAsync } from '../common/util'
import { config } from '../config'
import * as vscode from 'vscode'
import { BaseLang } from './base'
import { execTestChildProcess } from '../execTestCode'
import { TestOptions, LanguageMetaData, DebugOptions } from '../common/lang'
import { main } from '../debugTask/index'
import path = require('path')
import { outBoundArrayPlugin } from '../babelPlugin'
import babel = require('@babel/core')
import virtual = require('@rollup/plugin-virtual')
import rollup = require('rollup')
import resolve from '@rollup/plugin-node-resolve'
import rollupBabelPlugin from '@rollup/plugin-babel'
import { window } from 'vscode'
import { addComment } from '../common/transformCode'

export class JavascriptParse extends BaseLang {
	static getPreImport() {
		return ''
	}
	funcRegExp = /^(?:(\s*function)|(.*=\s*function))/
	testRegExp = /\/\/\s*@test\(((?:"(?:\\.|[^"])*"|[^)])*)\)/

	async runMultiple(caseList: CaseList, originCode: string, _funcName: string) {
		const metaData = (await this.getQuestionMeta()) as LanguageMetaData | undefined
		if (!metaData) {
			throw new Error('question meta not found')
		}
		const options: TestOptions = {
			caseList,
			originCode,
			filePath: this.filePath,
			metaData: metaData,
		}
		return await execTestChildProcess(options)
	}

	shouldRemoveInBuild(_line: string): boolean {
		return false
	}

	async runInNewContext(_args: string[], _originCode: string, _funcName: string) {
		return ''
	}
	async handlePreImport() {
		return
	}
	async buildCode() {
		try {
			const filePath = this.filePath
			const text = this.text!
			const dir = path.parse(filePath).dir
			const { funcNames, questionMeta } = getFuncNames(text, filePath)
			const funcRunStr = 'console.log(' + funcNames.map((f) => f + '()').join('+') + ')'
			// The rollup will not transform code in virtual entry
			const entry: babel.BabelFileResult | null = await babel.transformAsync(text, {
				comments: false,
				compact: false,
				plugins: [outBoundArrayPlugin],
			})
			const entryCode = entry?.code + `\n${funcRunStr}`
			const bundle = await rollup.rollup({
				input: 'entry',

				treeshake: true,
				plugins: [
					// It use virtual entry because treeshake will remove unuse code.
					virtual({
						entry: entryCode,
					}),
					resolve({ rootDir: dir }),
					rollupBabelPlugin({
						babelHelpers: 'bundled',
						comments: false,
						shouldPrintComment: () => false,
					}),
				],
			})
			const { output } = await bundle.generate({})
			let code = output[0].code
			code = code.replace(funcRunStr, '').replace(/;\s*$/, '')
			return {
				code,
				questionMeta,
			}
		} catch (err) {
			console.log('err:', err)
			window.showInformationMessage(`parse params err: ${err}`)
			return {
				code: '',
				questionMeta: {},
			}
		}
	}
	// do some thing before debug,eg. get testcase
	async beforeDebug(breaks: vscode.SourceBreakpoint[]) {
		const args = await this.resolveArgsFromBreaks(breaks)
		const metaData = (await this.getQuestionMeta()) as LanguageMetaData | undefined
		if (!metaData) {
			throw new Error('question meta not found')
		}
		const originCode = await readFileAsync(this.filePath, {
			encoding: 'utf8',
		})
		const options: DebugOptions = {
			originCode,
			filePath: this.filePath,
			metaData: metaData,
		}
		await this.writeTestCase(options, args)
	}
	async writeTestCase(options: DebugOptions, args: string[]) {
		return main(options, args)
	}
	getDebugConfig() {
		const { nodeBinPath } = config

		return {
			type: 'node',
			request: 'launch',
			name: 'debug question',
			skipFiles: ['<node_internals>/**'],
			program: '${workspaceFolder}/out/code.js',
			outFiles: ['${workspaceFolder}/out/*.js'],
			runtimeVersion: 'default',
			runtimeExecutable: nodeBinPath,
			sourceMaps: true,
			args: ['${file}'],
			// "preLaunchTask": "algorithm: build"
		}
	}
	public addComment(text: string, comment: string, funcName: string) {
		return addComment(text, comment, funcName)
	}
}

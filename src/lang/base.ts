import { readFileAsync, TestCase, TestCaseParam, CaseList } from '../common/util'
import { getFuncNames, parseTestCase, TestResult, handleMsg } from '../common/util'
import { log } from '../config'
import { api } from '../api/index'
import { resolve } from 'path'
import { OutputChannel } from 'vscode'
import * as vscode from 'vscode'
import { tranfromToCustomBreakpoint } from '../debug/launch'
import { getFileComment } from '../common/langConfig'
import { parseCommentTest } from '../common/util'
import { LanguageMetaData, MetaData } from '../common/lang'

export abstract class BaseLang {
	public log: OutputChannel
	public originCode?: string
	public commentToken: '#' | '//'
	public abstract funcRegExp: RegExp
	public abstract testRegExp: RegExp
	public abstract runInNewContext(args: string[], originCode: string, funcName: string): Promise<string>
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public abstract getDebugConfig(breaks?: vscode.SourceBreakpoint[]): any
	public abstract beforeDebug(breaks: vscode.SourceBreakpoint[]): Promise<void>
	public abstract handlePreImport(): void
	public abstract shouldRemoveInBuild(line: string): boolean
	constructor(public filePath: string, public text?: string) {
		this.log = log
		if (!filePath) {
			throw new Error('filePath must not empty')
		}
		if (text) {
			this.originCode = text
		}
		this.commentToken = getFileComment(filePath)
	}
	async getOriginCode() {
		if (this.originCode) {
			return this.originCode
		}
		const originCode = await readFileAsync(this.filePath, {
			encoding: 'utf8',
		})
		this.originCode = originCode
		return this.originCode
	}
	public async getQuestionMeta(): Promise<MetaData | undefined> {
		const originCode = await this.getOriginCode()
		const { questionMeta } = getFuncNames(originCode, this.filePath)
		const id = questionMeta.id
		if (!id) {
			this.log.appendLine('id is null')
			return
		}
		const question = await api.fetchQuestionDetailById(id)
		if (!question) {
			this.log.appendLine('question not found')
			return
		}
		const metaData: MetaData = JSON.parse(question.metaData)
		return metaData
	}
	async resolveArgsFromBreaks(breaks: vscode.SourceBreakpoint[]): Promise<string[]> {
		const filePath = this.filePath
		const customBreakpoints = tranfromToCustomBreakpoint(breaks)
		const customBreakPoint = customBreakpoints.find((c) => c.path === filePath)
		if (!customBreakPoint) {
			throw new Error('breakpoint not found, please set breakpoint first')
		}
		const originCode = await this.getOriginCode()
		const questionMeta = (await this.getQuestionMeta()) as LanguageMetaData | undefined
		if (!questionMeta) {
			throw new Error('questionMeta not found ')
		}
		const codeLines = originCode.split('\n')

		const lines = customBreakPoint.lines
		const line = lines.find((num) => this.testRegExp.test(codeLines[num]))
		if (!Number.isInteger(line)) {
			throw new Error('please select the test case')
		}
		const { args } = parseCommentTest(codeLines[line as number])
		return args
	}
	handleResult(stdout: string, caseList) {
		const testResultList: TestResult[] = caseList.map((v) => {
			return {
				args: v.args,
				expect: v.result,
			}
		})
		const regexp = /resultabc(\d+):(.+?)resultend/g
		let r
		while ((r = regexp.exec(stdout))) {
			const index = r[1]
			const result = r[2]
			testResultList[index].result = result
		}
		return testResultList
	}
	async runMultiple(caseList: CaseList, originCode: string, funcName: string): Promise<string | undefined> {
		const testResultList: TestResult[] = []

		for (const { args, result: expect } of caseList) {
			try {
				const result = await this.runInNewContext(args, originCode, funcName)
				testResultList.push({
					args: args.join(','),
					expect: expect,
					result,
				})
			} catch (err) {
				const msg = `× @test(${args.join(',')})\n`
				resolve(msg + err.stderr)
				return
			}
		}
		return handleMsg(testResultList)
	}
	public async execTest(testCase: TestCase) {
		const filePath = this.filePath
		const caseList = parseTestCase(testCase)
		const originCode = await readFileAsync(filePath, { encoding: 'utf8' })
		const { questionMeta } = getFuncNames(originCode, filePath)
		const id = questionMeta.id
		if (!id) {
			log.appendLine('id is null')
			return
		}
		const question = await api.fetchQuestionDetailById(id)
		if (!question) {
			log.appendLine('question not found')
			return
		}
		const metaData: LanguageMetaData = JSON.parse(question.metaData)
		const funcName = metaData.name
		if (!caseList.length) {
			return
		}
		return this.runMultiple(caseList, originCode, funcName)
	}

	public getTestCaseList(text: string) {
		const testRegExp =
			this.commentToken === '#'
				? /#\s*@test\(((?:"(?:\\.|[^"])*"|[^)])*)\)/
				: /\/\/\s*@test\(((?:"(?:\\.|[^"])*"|[^)])*)\)/
		const funcRegExp = this.funcRegExp
		const testCase: TestCase = []
		const lines = text.split(/\n/)

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i]
			if (testRegExp.test(line)) {
				testCase.push(line)
			} else if (funcRegExp.test(line)) {
				const testCaseList: TestCaseParam[] = [
					{
						line: i,
						testCase,
						funcName: '',
						paramsTypes: [],
						resultType: '',
					},
				]
				return testCaseList
			}
		}
		return []
	}

	async debugCodeCommand(folder: vscode.WorkspaceFolder, breaks: vscode.SourceBreakpoint[]) {
		try {
			await this.beforeDebug(breaks)
		} catch (err) {
			log.appendLine(err.message)
			log.show()
			return
		}

		const debugConfiguration = await this.getDebugConfig(breaks)

		vscode.debug.startDebugging(folder, debugConfiguration)
	}
	public async buildCode() {
		const originCode = await this.getOriginCode()
		const { questionMeta } = getFuncNames(originCode, this.filePath)
		const commentToken = getFileComment(this.filePath)

		const code = originCode
			.split('\n')
			.filter((line) => !isComment(line, commentToken) && !this.shouldRemoveInBuild(line))
			.join('\n')
		return {
			code,
			questionMeta,
		}
	}
	public addComment(text: string, comment: string, _funcName: string) {
		const lines = text.split('\n')
		const n = lines.length
		for (let i = n - 1; i >= 0; i--) {
			if (this.testRegExp.test(lines[i])) {
				const newLine = this.commentToken + comment
				return [...lines.slice(0, i + 1), newLine, ...lines.slice(i + 1)].join('\n')
			}
		}
		for (let i = 0; i < n; i++) {
			if (this.funcRegExp.test(lines[i])) {
				const newLine = this.commentToken + comment
				return [...lines.slice(0, i + 1), newLine, ...lines.slice(i + 1)].join('\n')
			}
		}
	}
}

function isComment(line: string, commentToken: '#' | '//') {
	return line.trimLeft().startsWith(commentToken)
}

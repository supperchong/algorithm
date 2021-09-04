import * as cp from 'child_process'
import { pathExists, ensureFile, copy, ensureDir } from 'fs-extra'
import { CaseList, writeFileAsync } from '../common/util'
import { tag } from 'pretty-tag'
import { promisify } from 'util'
import * as vscode from 'vscode'
import * as path from 'path'
import { BaseLang } from './base'
import { platform } from 'os'
import { defaultTimeout, LanguageMetaData } from '../common/lang'

const execFileAsync = promisify(cp.execFile)

export class GoParse extends BaseLang {
	static getPreImport() {
		return 'package main'
	}
	funcRegExp = /^(\s*func)/
	testRegExp = /\/\/\s*@test\(((?:"(?:\\.|[^"])*"|[^)])*)\)/
	private cwd: string
	constructor(public filePath: string, public text?: string) {
		super(filePath, text)
		this.cwd = path.dirname(filePath)
	}

	handleParam(index: number, paramType: string): string {
		const handleConfig = [
			{
				type: 'integer',
				handleFn: 'parseInteger',
			},
			{
				type: 'string',
				handleFn: 'parseString',
			}, {
				type: 'character',
				handleFn: 'parseChar',
			},
			{
				type: 'integer[]',
				handleFn: 'parseIntegerArr',
			},
			{
				type: 'character[]',
				handleFn: 'parseCharArr'
			},
			{
				type: 'character[][]',
				handleFn: 'parseCharArrArr'
			},
			{
				type: 'string[]',
				handleFn: 'parseStringArr',
			},
			{
				type: 'integer[][]',
				handleFn: 'parseIntegerArrArr',
			},
			{
				type: 'double',
				handleFn: 'parseFloat',
			},
			{
				type: 'ListNode',
				handleFn: 'deserializeListNode',
			},
			{
				type: 'TreeNode',
				handleFn: 'deserializeTreeNode',
			},
			{
				type: 'ListNode[]',
				handleFn: 'deserializeListNodeArr',
			},
			{
				type: 'TreeNode[]',
				handleFn: 'deserializeTreeNodeArr',
			},
			{
				type: 'string[][]',
				handleFn: 'parseStringArrArr',
			},
		]
		for (const { type, handleFn } of handleConfig) {
			if (type === paramType) {
				return `arg${index} := ${handleFn}(unitArgs[${index}]);`
			}
		}
		throw new Error(`paramType ${paramType} not support`)
	}
	handleReturn(paramCount: number, funcName: string, returnType: string, firstParamType: string): string {
		const isVoid = returnType === 'void'
		if (isVoid) {
			returnType = firstParamType
		}

		const handleConfig = [
			{
				type: 'integer',
				handleFn: 'serializeInterface',
			},
			{
				type: 'string',
				handleFn: 'serializeInterface',
			},
			{
				type: 'character',
				handleFn: 'serializeChar',
			},
			{
				type: 'double',
				handleFn: 'serializeFloat',
			},
			{
				type: 'boolean',
				handleFn: 'serializeInterface',
			},
			{
				type: 'ListNode',
				handleFn: 'serializeListNode',
			},
			{
				type: 'TreeNode',
				handleFn: 'serializeTreeNode',
			},
			{
				type: 'integer[]',
				handleFn: 'serializeInterface',
			},
			{
				type: 'list<integer>',
				handleFn: 'serializeInterface',
			},
			{
				type: 'string[]',
				handleFn: 'serializeInterface',
			},
			{
				type: 'list<string>',
				handleFn: 'serializeInterface',
			},
			{
				type: 'ListNode[]',
				handleFn: 'serializeListNodeArr',
			},
			{
				type: 'TreeNode[]',
				handleFn: 'serializeTreeNodeArr',
			},
			{
				type: 'integer[][]',
				handleFn: 'serializeInterface',
			},
			{
				type: 'list<list<integer>>',
				handleFn: 'serializeInterface',
			},
			{
				type: 'character[][]',
				handleFn: 'serializeCharArrArr',
			},
			{
				type: 'string[][]',
				handleFn: 'serializeInterface',
			},
			{
				type: 'list<list<string>>',
				handleFn: 'serializeInterface',
			}, {
				type: 'character[]',
				handleFn: 'serializeCharArr'
			}
		]
		const argStr = Array(paramCount)
			.fill(0)
			.map((_v, i) => `arg${i}`)
			.join(',')

		for (const { type, handleFn } of handleConfig) {
			if (type === returnType) {
				if (!isVoid) {
					const funcExpression = tag`
                    result := ${funcName}(${argStr});
                    resultabc :=${handleFn}(result);
                    `
					return funcExpression
				} else {
					const funcExpression = tag`
                    ${funcName}(${argStr})
                    resultabc := ${handleFn}(arg0);
                    `
					return funcExpression
				}
			}
		}
		throw new Error(`returnType ${returnType} not support`)
	}
	async handleArgsType(argsStr: string) {
		const meta = (await this.getQuestionMeta()) as LanguageMetaData | undefined
		if (!meta) {
			throw new Error('question meta not found')
		}
		const params = meta.params || []
		const rt = meta.return.type
		const funcName = meta.name
		const argExpressions: string[] = []
		const paramCount = params.length
		for (let i = 0; i < paramCount; i++) {
			const { type } = params[i]
			argExpressions[i] = this.handleParam(i, type)
		}

		const argExpression = argExpressions.join('\n')
		const rtExpression = this.handleReturn(paramCount, funcName, rt, params[0].type)

		return tag`
            package main
            import "fmt"
            func main(){
                str := "${argsStr}"
                arr := parseStringArrArr(str)
                for i:=0;i<len(arr);i++ {
                    unitArgs:=arr[i]
                    ${argExpression}
                    ${rtExpression}
                    fmt.Printf("resultabc%d:%sresultend", i,resultabc)
                }
            }
            `
	}

	private getExecProgram() {
		const cwd = this.cwd
		return path.join(cwd, 'main')
	}
	async runMultiple(caseList: CaseList, _originCode: string, _funcName: string) {
		const argsArr = caseList.map((v) => v.args)
		const argsStr = JSON.stringify(argsArr)
		await this.buildMainFile(argsStr)
		const mainFile = this.getExecProgram()
		const cwd = this.cwd

		const p = execFileAsync(mainFile, {
			cwd: cwd,
			timeout: defaultTimeout
		})
		return this.waitExecTest(p, caseList)
	}
	private async ensureModFile() {
		const cwd = this.cwd
		const modName = 'lc' + path.parse(cwd).name
		const modPath = path.join(cwd, 'go.mod')
		const isExist = await pathExists(modPath)
		const goPath = 'go'

		if (!isExist) {
			await ensureDir(cwd)
			try {
				await execFileAsync(goPath, ['mod', 'init', modName], {
					cwd: cwd,
					shell: true,
				})
			} catch (err) {
				console.log(err)
			}
		}
	}
	async ensureCommonModuleFile() {
		const algmDir = this.cwd
		const sourceDir = path.resolve(__dirname, '..', '..', 'template', 'golang')
		const names = ['algm.go']

		await Promise.all(
			names.map(async (name) => {
				const src = path.join(sourceDir, name)
				const dst = path.join(algmDir, name)
				const isExist = await pathExists(dst)
				if (!isExist) {
					return copy(src, dst)
				}
			})
		)
	}
	async buildMainFile(argsStr: string) {
		await this.writeTestCase(argsStr)
		const goPath = 'go'
		const cwd = this.cwd
		let outFile = 'main'
		if (platform() === 'win32') {
			outFile = 'main.exe'
		}
		await execFileAsync(goPath, ['build', '-o', outFile, '.'], {
			cwd: cwd,
			shell: true,
		})
	}
	async runInNewContext(_args: string[], _originCode: string, _funcName: string) {
		return ''
	}
	async handlePreImport() {
		await this.ensureModFile()
		await this.ensureCommonModuleFile()
		return
	}
	// do some thing before debug,eg. get testcase
	async beforeDebug(breaks: vscode.SourceBreakpoint[]) {
		const args = await this.resolveArgsFromBreaks(breaks)
		const str = JSON.stringify([args])
		await this.writeTestCase(str)
	}
	getTestFilePath() {
		const cwd = this.cwd
		return path.join(cwd, 'main.go')
	}
	async writeTestCase(argsStr: string) {
		argsStr = argsStr.replace(/\\|"/g, (s) => `\\${s}`)
		const finalCode = await this.handleArgsType(argsStr)
		const testFilePath = this.getTestFilePath()
		await ensureFile(testFilePath)
		await writeFileAsync(testFilePath, finalCode)
	}

	getDebugConfig() {
		const dir = path.parse(this.filePath).dir
		return {
			name: 'Launch Package',
			type: 'go',
			request: 'launch',
			mode: 'debug',
			program: dir,
		}
	}
	shouldRemoveInBuild(line: string): boolean {
		const preImportStr = GoParse.getPreImport()
		return line.trim().startsWith(preImportStr)
	}
}

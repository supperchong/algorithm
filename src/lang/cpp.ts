import * as cp from 'child_process'
import { pathExists, ensureFile, copy } from 'fs-extra'
import { CaseList, writeFileAsync } from '../common/util'
import { tag } from 'pretty-tag'
import { promisify } from 'util'
import * as vscode from 'vscode'
import * as path from 'path'
import { BaseLang } from './base'
import { defaultTimeout, LanguageMetaData } from '../common/lang'
const execFileAsync = promisify(cp.execFile)
const GCC = 'g++'
let hasCopy = false
const langTypeMap: Record<string, string> = {
	integer: 'int',
	string: 'string',
	boolean: 'bool',
	'integer[]': 'vector<int>',
	'string[]': 'vector<string>',
	'integer[][]': 'vector<vector<int>>',
	double: 'double',
	ListNode: 'ListNode *',
	TreeNode: 'TreeNode *',
	'ListNode[]': 'vector<ListNode *>',
	'TreeNode[]': 'vector<TreeNode *>',
	'character[][]': 'vector<vector<char>>',
	'string[][]': 'vector<vector<string>>',
	'list<integer>': 'vector<int>',
	'list<string>': 'vector<string>',
	'list<list<integer>>': 'vector<vector<int>>',
	'list<list<string>>': 'vector<vector<string>>',
	'list<ListNode>': 'vector<ListNode *>',
	'list<TreeNode>': 'vector<TreeNode *>',
	'character': 'char',
	'character[]': 'vector<char>',
	'long': 'int',
	'long[]': 'vector<int>',
	'long[][]': 'vector<vector<int>>'
}

export class CppParse extends BaseLang {
	// static preImport: string = 'package main'
	static getPreImport() {
		return tag`
        #include <iostream>
        #include <vector>
        #include <string>
        #include "algm/algm.h"
        using namespace std;
        `
	}
	funcRegExp = /^(\s*class Solution)/
	testRegExp = /\/\/\s*@test\(((?:"(?:\\.|[^"])*"|[^)])*)\)/
	private cwd: string
	private mainFilePath: string
	constructor(public filePath: string, public text?: string) {
		super(filePath, text)
		this.cwd = path.join(filePath, '..', '..')
		this.mainFilePath = path.join('main', 'main.cpp')
	}
	handleParam(index: number, paramType: string): string {
		const langType = langTypeMap[paramType]
		if (!langType) {
			throw new Error('not support param type:' + paramType)
		}
		const handleConfig = [
			{
				type: 'integer',
				handleFn: 'parseInteger',
			},
			{
				type: 'string',
				handleFn: 'parseString',
			},
			{
				type: 'integer[]',
				handleFn: 'parseIntegerArr',
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
				handleFn: 'parseListNode',
			},
			{
				type: 'TreeNode',
				handleFn: 'parseTreeNode',
			},
			{
				type: 'ListNode[]',
				handleFn: 'parseListNodeArr',
			},
			{
				type: 'TreeNode[]',
				handleFn: 'parseTreeNodeArr',
			},

			{
				type: 'string[][]',
				handleFn: 'parseStringArrArr',
			},
			{
				type: 'list<string>',
				handleFn: 'parseStringArr',
			},
			{
				type: 'list<list<string>>',
				handleFn: 'parseStringArrArr',
			},
			{
				type: 'list<integer>',
				handleFn: 'parseIntegerArr',
			},
			{
				type: 'list<list<integer>>',
				handleFn: 'parseIntegerArrArr',
			},
			{
				type: 'character',
				handleFn: 'parseChar'
			}, {
				type: 'character[]',
				handleFn: 'parseCharArr'
			},
			{
				type: 'character[][]',
				handleFn: 'parseCharArrArr',
			},
		]
		for (const { type, handleFn } of handleConfig) {
			if (type === paramType) {
				return `${langType} arg${index} = ${handleFn}(args[${index}]);`
			}
		}
		throw new Error(`paramType ${paramType} not support`)
	}
	handleReturn(paramCount: number, funcName: string, returnType: string, firstParamType: string): string {
		const isVoid = returnType === 'void'
		if (isVoid) {
			returnType = firstParamType
		}
		const langType = langTypeMap[returnType]
		if (!langType) {
			throw new Error('not support return type:' + returnType)
		}
		const handleConfig = [
			{
				type: 'integer',
				handleFn: 'serializeInteger',
			},
			{
				type: 'string',
				handleFn: 'serializeString',
			},
			{
				type: 'double',
				handleFn: 'serializeFloat',
			},
			{
				type: 'boolean',
				handleFn: 'serializeBool',
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
				handleFn: 'serializeIntegerArr',
			},
			{
				type: 'list<integer>',
				handleFn: 'serializeIntegerArr',
			},
			{
				type: 'string[]',
				handleFn: 'serializeStringArr',
			},
			{
				type: 'list<string>',
				handleFn: 'serializeStringArr',
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
				handleFn: 'serializeIntegerArrArr',
			},
			{
				type: 'list<list<integer>>',
				handleFn: 'serializeIntegerArrArr',
			},
			{
				type: 'string[][]',
				handleFn: 'serializeStringArrArr',
			},
			{
				type: 'list<list<string>>',
				handleFn: 'serializeStringArrArr',
			},
			{
				type: 'character',
				handleFn: 'serializeChar',
			}, {
				type: 'character[]',
				handleFn: 'serializeCharArr'
			}, {
				type: 'character[][]',
				handleFn: 'serializeCharArrArr'
			}, {
				type: 'long',
				handleFn: 'serializeInteger'
			}, {
				type: 'long[]',
				handleFn: 'serializeIntegerArr'
			}, {
				type: 'long[][]',
				handleFn: 'serializeIntegerArrArr',
			}
		]
		const argStr = Array(paramCount)
			.fill(0)
			.map((_, i) => `arg${i}`)
			.join(',')

		for (const { type, handleFn } of handleConfig) {
			if (type === returnType) {
				if (!isVoid) {
					const funcExpression = tag`
                    ${langType} result=s->${funcName}(${argStr});
                    string resultabc =${handleFn}(result);
                    `
					return funcExpression
				} else {
					const funcExpression = tag`
                    s->${funcName}(${argStr});
                    string resultabc =${handleFn}(arg0);
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

		const name = path.parse(this.filePath).name
		const argExpression = argExpressions.join('\n')
		const rtExpression = this.handleReturn(paramCount, funcName, rt, params[0].type)

		return tag`
        #include "question/${name}.cpp"
        #include "regex"
        #include "algm/parse.h"
        int main(int argc, char *argv[])
        {
            string str = "${argsStr}";
            vector<vector<string>> arr = parseStringArrArr(str);
            for (int i = 0; i < arr.size(); i++)
            {
              vector<string> args = arr[i];
              Solution *s = new Solution();
              ${argExpression}
              ${rtExpression}
              cout << "resultabc"+to_string(i)+":" << resultabc <<"resultend"<< endl;
            }
            return 0;
        } 
            `
	}

	private async ensureCommonModuleFile() {
		// const dir = config.
		const algmDir = path.resolve(this.filePath, '..', '..', 'algm')
		// const files = await readdirAsync(algmDir)
		const sourceDir = path.resolve(__dirname, '..', '..', 'template', 'cpp')
		const names = ['algm.h', 'ListNode.h', 'TreeNode.h', 'parse.h']

		await Promise.all(
			names.map(async (name) => {
				const src = path.join(sourceDir, name)
				const dst = path.join(algmDir, name)
				const isExist = await pathExists(dst)
				if (!hasCopy || !isExist) {
					try {
						await copy(src, dst, { overwrite: true })
					} catch (err) {
						console.log(err)
					}

				}
			})
		)
		hasCopy = true
	}
	private getExecProgram() {
		const cwd = this.cwd
		return path.join(cwd, 'main', 'main')
	}
	async runMultiple(caseList: CaseList, _originCode: string, _funcName: string) {
		const argsArr = caseList.map((v) => v.args)
		const argsStr = JSON.stringify(argsArr)
		await this.buildMainFile(argsStr)
		const cwd = this.cwd

		const execProgram = this.getExecProgram()
		const p = execFileAsync(execProgram, {
			cwd: cwd,
			timeout: defaultTimeout
		})
		return this.waitExecTest(p, caseList)
	}
	async runInNewContext(_args: string[], _originCode: string, _funcName: string) {
		return ''
	}
	async handlePreImport() {
		await this.ensureCommonModuleFile()
		return
	}

	// do some thing before debug,eg. get testcase
	async beforeDebug(breaks: vscode.SourceBreakpoint[]) {
		const args = await this.resolveArgsFromBreaks(breaks)
		const str = JSON.stringify([args])
		await this.buildMainFile(str)
	}
	async buildMainFile(argsStr: string) {
		argsStr = argsStr.replace(/\\|"/g, (s) => `\\${s}`)
		await this.writeTestCase(argsStr)
		const cwd = this.cwd
		const mainFilePath = this.mainFilePath
		await execFileAsync(GCC, ['-I', '.', '-g', mainFilePath, '"-std=c++17"', '-o', 'main/main'], { cwd: cwd, shell: true })
	}
	private getTestFilePath() {
		const cwd = this.cwd
		const testFilePath = path.join(cwd, 'main', 'main.cpp')
		return testFilePath
	}
	async writeTestCase(argsStr: string) {
		await this.ensureCommonModuleFile()
		const finalCode = await this.handleArgsType(argsStr)
		const testFilePath = this.getTestFilePath()
		await ensureFile(testFilePath)
		await writeFileAsync(testFilePath, finalCode)
	}
	async getDebugConfig(_breaks: vscode.SourceBreakpoint[]) {
		const cwd = this.cwd
		const execProgram = this.getExecProgram()
		// for m1
		if (process.platform === 'darwin' && process.arch === 'arm64') {
			return {
				"name": "clang++ - Build and debug active file",
				"type": "lldb",
				"request": "launch",
				"program": execProgram,
				"args": [],
				"stopAtEntry": true,
				"cwd": cwd,
				"environment": [],
				"externalConsole": false,
				"MIMode": "lldb",
			}
		}
		return {
			name: 'g++ - Build and debug active file',
			type: 'cppdbg',
			request: 'launch',
			program: execProgram,
			args: [],
			stopAtEntry: false,
			cwd: cwd,
			environment: [],
			externalConsole: false,
			MIMode: 'gdb',
			setupCommands: [
				{
					description: 'Enable pretty-printing for gdb',
					text: '-enable-pretty-printing',
					ignoreFailures: true,
				},
			],
		}

	}
	shouldRemoveInBuild(line: string): boolean {
		return line.trim().startsWith('#include "algm/algm.h"')
	}
}

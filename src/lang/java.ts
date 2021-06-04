import * as cp from 'child_process'
import { pathExists, ensureFile, ensureDir, copy } from 'fs-extra'
import { CaseList, existFile, readFileAsync, TestCase, TestCaseParam, writeFileAsync } from '../common/util'
import { tag } from 'pretty-tag'
import { getFuncNames, parseTestCase, TestResult, handleMsg } from '../common/util'
import { log, config } from '../config'
import { getDb } from '../db'
import { api } from '../api/index'
import { resolve } from 'path'
import { rejects } from 'assert'
import { runInNewContext } from 'vm'
import { promisify } from 'util'
import { OutputChannel } from 'vscode'
import * as vscode from 'vscode'
import { tranfromToCustomBreakpoint } from '../debug/launch'
import { stdout } from 'process'
import * as path from 'path'
import { ExtraType } from '../common/langConfig'
import { BaseLang } from './base'
import { parseCommentTest } from '../common/util'
import { LanguageMetaData } from '../common/lang'
const execFileAsync = promisify(cp.execFile)
const langTypeMap = {
	integer: 'int',
	string: 'String',
	'integer[]': 'int[]',
	'string[]': 'String[]',
	'integer[][]': 'int[][]',
	double: 'double',
	ListNode: 'ListNode',
	TreeNode: 'TreeNode',
	'ListNode[]': 'ListNode[]',
	'TreeNode[]': 'TreeNode[]',
	'character[][]': 'String[][]',
	'string[][]': 'String[][]',
	'list<integer>': 'List<Integer>',
	'list<string>': 'List<String>',
	'list<list<integer>>': 'List<List<Integer>>',
	'list<list<string>>': 'List<List<String>>',
	'list<ListNode>': 'ListNode[]',
	'list<TreeNode>': 'TreeNode[]',
	boolean: 'boolean',
}

export class JavaParse extends BaseLang {
	// static preImport: string = 'package main'
	static getPreImport(name: string, extraTypeSet: Set<ExtraType>) {
		let importStr = ''
		if (extraTypeSet.size) {
			importStr = 'import algm.*;'
		}
		return tag`
        package ${name};
        ${importStr}
        `
	}
	funcRegExp = /^(\s*(public)? class Solution)/
	testRegExp = /\/\/\s*@test\(((?:"(?:\\.|[^"])*"|[^)])*)\)/
	private cwd: string
	constructor(public filePath: string, public text?: string) {
		super(filePath, text)
		this.cwd = path.join(filePath, '..', '..')
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
				type: 'character[][]',
				handleFn: 'parseStringArrArr',
			},
			{
				type: 'string[][]',
				handleFn: 'parseStringArrArr',
			},
			{
				type: 'list<integer>',
				handleFn: 'parseIntegerList',
			},
			{
				type: 'list<list<integer>>',
				handleFn: 'parseIntegerListList',
			},
			{
				type: 'list<string>',
				handleFn: 'parseStringList',
			},
			{
				type: 'list<list<string>>',
				handleFn: 'parseStringListList',
			},
		]
		for (const { type, handleFn } of handleConfig) {
			if (type === paramType) {
				return `${langType} arg${index} = Util.${handleFn}(unitArgs[${index}]);`
			}
		}
		throw new Error(`paramType ${paramType} not support`)
	}
	handleReturn(paramCount: number, funcName: string, returnType: string, firstParamType: string): string {
		let isVoid = returnType === 'void'
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
				handleFn: 'serializeIntegerList',
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
				handleFn: 'serializeIntegerListList',
			},
			{
				type: 'character[][]',
				handleFn: 'serializeStringArrArr',
			},
			{
				type: 'string[][]',
				handleFn: 'serializeStringArrArr',
			},
			{
				type: 'list<string>',
				handleFn: 'serializeStringList',
			},
			{
				type: 'list<list<string>>',
				handleFn: 'serializeStringListList',
			},
		]
		const argStr = Array(paramCount)
			.fill(0)
			.map((v, i) => `arg${i}`)
			.join(',')

		for (const { type, handleFn } of handleConfig) {
			if (type === returnType) {
				if (!isVoid) {
					const funcExpression = tag`
                    ${langType} result=s.${funcName}(${argStr});
                    String resultabc =Util.${handleFn}(result);
                    `
					return funcExpression
				} else {
					const funcExpression = tag`
                    s.${funcName}(${argStr});
                    String resultabc =Util.${handleFn}(arg0);
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
		let rt = meta.return.type
		const funcName = meta.name
		const argExpressions: string[] = []
		const paramCount = params.length
		for (let i = 0; i < paramCount; i++) {
			const { name, type } = params[i]
			argExpressions[i] = this.handleParam(i, type)
		}
		const dir = path.parse(path.parse(this.filePath).dir).name

		const argExpression = argExpressions.join('\n')
		const rtExpression = this.handleReturn(paramCount, funcName, rt, params[0].type)

		return tag`
            package test;
            import ${dir}.*;
            import algm.*;
            import java.util.List;
            public class Test {
                public static void main(String[] args){
                    String str="${argsStr}";
                    String[][] arr = Util.parseStringArrArr(str);
                  
                    for(int i=0;i<arr.length;i++){
                        String[] unitArgs=arr[i];
                        Solution s=new Solution();
                        ${argExpression}
                        ${rtExpression}
                        System.out.print("resultabc"+Integer.toString(i)+":"+resultabc+"resultend");
                    }
                }
            }   
            `
	}

	private async ensureCommonModuleFile() {
		// const dir = config.
		const algmDir = path.resolve(this.filePath, '..', '..', 'algm')
		// const files = await readdirAsync(algmDir)
		const sourceDir = path.resolve(__dirname, '..', '..', 'template', 'java')
		const names = ['ListNode.java', 'TreeNode.java', 'Util.java']

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
	async runMultiple(caseList: CaseList, originCode: string, funcName: string) {
		const argsArr = caseList.map((v) => v.args)
		const argsStr = JSON.stringify(argsArr)
		await this.buildMainFile(argsStr)
		const javaPath = config.javaPath
		const cwd = this.cwd
		try {
			const { stdout, stderr } = await execFileAsync(javaPath, [`test/Test`], {
				cwd: cwd,
				shell: true,
			})
			let testResultList = this.handleResult(stdout, caseList)
			return handleMsg(testResultList)
		} catch (err) {
			log.appendLine(err)
		}
	}
	async runInNewContext(args: string[], originCode: string, funcName: string) {
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
		await this.writeTestCase(str)
	}
	private getTestFilePath() {
		const cwd = this.cwd
		const testFilePath = path.join(cwd, 'test', 'Test.java')
		return testFilePath
	}
	async writeTestCase(argsStr: string) {
		argsStr = argsStr.replace(/\\|"/g, (s) => `\\${s}`)
		await this.ensureCommonModuleFile()
		const finalCode = await this.handleArgsType(argsStr)
		const testFilePath = this.getTestFilePath()
		await ensureFile(testFilePath)
		await writeFileAsync(testFilePath, finalCode)
	}
	async buildMainFile(argsStr: string) {
		await this.writeTestCase(argsStr)
		const javacPath = config.javacPath
		const cwd = this.cwd
		await execFileAsync(javacPath, [`test/Test.java`], {
			cwd: cwd,
			shell: true,
		})
	}
	async getDebugConfig(breaks: vscode.SourceBreakpoint[]) {
		const testFilePath = this.getTestFilePath()
		const cwd = this.cwd
		return {
			type: 'java',
			name: 'Launch Current File',
			request: 'launch',
			mainClass: testFilePath,
			cwd: cwd,
			args: '',
		}
	}
	shouldRemoveInBuild(line: string): boolean {
		line = line.trim()
		return line.startsWith('package') || line.startsWith('import algm')
	}
}

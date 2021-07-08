import * as cp from 'child_process'
import { pathExists, ensureFile } from 'fs-extra'
import { CaseList, writeFileAsync } from '../common/util'
import { tag } from 'pretty-tag'
import { config } from '../config'
import { promisify } from 'util'
import * as vscode from 'vscode'
import * as path from 'path'
import { BaseLang } from './base'
import { platform } from 'os'
import { LanguageMetaData, defaultTimeout } from '../common/lang'
const execFileAsync = promisify(cp.execFile)

export class PythonParse extends BaseLang {
	static getPreImport() {
		const lang = config.lang
		const codeLang = config.codeLang

		return `from ${lang}.${codeLang}.mod.preImport import *`
	}
	private cwd: string
	funcRegExp = /^(\s*class Solution)/
	testRegExp = /#\s*@test\(((?:"(?:\\.|[^"])*"|[^)])*)\)/
	handleTypeCode = tag`
    class TreeNode:
        def __init__(self, val=0, left=None, right=None):
            self.val = val
            self.left = left
            self.right = right
    class ListNode:
        def __init__(self, val=0, next=None):
            self.val = val
            self.next = next
    def serializeListNode(head:ListNode):
        if(head==None):
            return []
        node=head
        arr=[]
        while(node!=None):
            arr.append(str(node.val))
            node=node.next
        return '['+','.join(arr)+']'
    def parseListNode(arr)->ListNode:
        header=ListNode()
        node=header
        for num in arr:
            node.next=ListNode(num)
            node=node.next
        return header.next

    def serializeTreeNode(root:TreeNode):
        if(root==None):
            return []
        arr=[]
        queue=[root]
        while(len(queue)>0):
            node=queue.pop(0)
            if node!=None:
                arr.append(str(node.val))
                queue.append(node.left)
                queue.append(node.right)
            else:
                arr.append("null")
        i=len(arr)-1
        while(arr[i]=="null"):
            i=i-1
            arr.pop()
        return '['+','.join(arr)+']'
    def parseTreeNode(arr)->TreeNode:
        if(len(arr)==0):
            return None
        val=arr.pop(0)
        root=TreeNode(val)
        queue=[root]
        while(queue):
            node=queue.pop(0)
            if len(arr)==0:
                return root
            leftVal=arr.pop(0)
            if leftVal!=None:
                left=TreeNode(leftVal)
                node.left=left
                queue.append(left)
            if len(arr)==0:
                return root
            rightVal=arr.pop(0)
            if  rightVal!=None:
                right=TreeNode(rightVal)
                node.right=right
                queue.append(right)
        return root
    def parseTreeNodeArr(arr):
        out=[]
        for item in arr:
            treeNode=parseTreeNode(item)
            out.append(treeNode)
        return out
    def serializeTreeNodeArr(arr):
        treeNodeStrArr=[]
        for item in arr:
            treeNodeStrArr.append(serializeTreeNode(item))
        return '['+','.join(treeNodeStrArr)+']'
    def parseListNodeArr(arr):
        out=[]
        for item in arr:
            listNode=parseListNode(item)
            out.append(listNode)
        return out
    def serializeListNodeArr(arr):
        listNodeStrArr=[]
        for item in arr:
            listNodeStrArr.append(serializeListNode(item))
        return '['+','.join(listNodeStrArr)+']'
    def serializeFloat(param):
        r=str(param)
        arr=r.split(".")
        if len(arr)==1:
            return r+".00000"
        else:
            decimalStr=arr[1]+"00000"
            return arr[0]+"."+decimalStr[0:5]
    `

	constructor(public filePath: string, public text?: string) {
		super(filePath, text)
		this.cwd = path.join(config.algDir, 'Python3')
	}

	handleParam(index: number, paramType: string): string {
		const handleConfig = [
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
		]
		const jsonType = [
			'integer',
			'string',
			'integer[]',
			'string[]',
			'integer[][]',
			'string[][]',
			'list<string>',
			'list<integer>',
			'list<list<integer>>',
			'list<list<string>>',
			'character[][]',
			'boolean',
			'double',
		]
		if (jsonType.includes(paramType)) {
			return `arg${index} = unitArgs[${index}]`
		} else {
			for (const { type, handleFn } of handleConfig) {
				if (type === paramType) {
					return `arg${index} =${handleFn}(unitArgs[${index}])`
				}
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
				type: 'ListNode',
				handleFn: 'serializeListNode',
			},
			{
				type: 'TreeNode',
				handleFn: 'serializeTreeNode',
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
				type: 'double',
				handleFn: 'serializeFloat',
			},
		]
		const jsonType = [
			'integer',
			'string',
			'integer[]',
			'string[]',
			'integer[][]',
			'string[][]',
			'list<string>',
			'list<integer>',
			'list<list<integer>>',
			'list<list<string>>',
			'character[][]',
			'boolean',
		]

		const argStr = Array(paramCount)
			.fill(0)
			.map((_v, i) => `arg${i}`)
			.join(',')
		if (jsonType.includes(returnType)) {
			if (!isVoid) {
				const funcExpression = tag`
                result=s.${funcName}(${argStr})
                resultabc =json.dumps(result,separators=(',', ':'))
                `
				return funcExpression
			} else {
				const funcExpression = tag`
                s.${funcName}(${argStr})
                resultabc =json.dumps(arg0,separators=(',', ':'))
                `
				return funcExpression
			}
		} else {
			for (const { type, handleFn } of handleConfig) {
				if (type === returnType) {
					if (!isVoid) {
						const funcExpression = tag`
                        result=s.${funcName}(${argStr})
                        resultabc =${handleFn}(result)
                        `
						return funcExpression
					} else {
						const funcExpression = tag`
                        s.${funcName}(${argStr})
                        resultabc =${handleFn}(arg0)
                        `
						return funcExpression
					}
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
		const filePathParse = path.parse(this.filePath)

		const name = filePathParse.name
		const argExpression = argExpressions.join('\n')
		const rtExpression = this.handleReturn(paramCount, funcName, rt, params[0].type)
		const cwd = this.cwd.replace(/\\/g, '\\\\')
		const baseDir = config.baseDir.replace(/\\/g, '\\\\')
		return tag`
        import sys
        import json
        sys.path.append("${cwd}")
        sys.path.append("${baseDir}")
        a = __import__('${name}')
        ${this.handleTypeCode}
       

        arr=json.loads("${argsStr}")
        for i in range(len(arr)):
            unitArgs=arr[i]
            s=a.Solution()
            ${argExpression}
            ${rtExpression}
            print("resultabc"+str(i)+":"+resultabc+"resultend") 
        `
	}
	async runMultiple(caseList: CaseList, _originCode: string, _funcName: string) {
		const argsArr = caseList.map((v) => v.args.map((str) => JSON.parse(str)))
		const argsStr = JSON.stringify(argsArr)
		await this.buildMainFile(argsStr)
		let pythonPath = 'python3'
		if (platform() === 'win32') {
			pythonPath = 'python'
		}
		const testFilePath = this.getTestFilePath()
		const cwd = this.cwd

		const p = execFileAsync(pythonPath, [testFilePath], {
			cwd: cwd,
			timeout: defaultTimeout
		})
		return this.waitExecTest(p, caseList)
	}
	async buildMainFile(argsStr: string) {
		await this.writeTestCase(argsStr)
	}
	shouldRemoveInBuild(line: string): boolean {
		const preImportStr = PythonParse.getPreImport()
		return line.trimLeft().startsWith(preImportStr)
	}

	async runInNewContext(_args: string[], _originCode: string, _funcName: string) {
		return ''
	}
	async handlePreImport() {
		const dir = config.questionDir
		const preImportFile = path.join(dir, 'mod', 'preImport.py')
		const exist = await pathExists(preImportFile)
		if (exist) {
			return
		} else {
			await ensureFile(preImportFile)
		}
		const data = tag`
        from typing import List
        class ListNode:
            def __init__(self, val=0, next=None):
                self.val = val
                self.next = next
        class TreeNode:
            def __init__(self, val=0, left=None, right=None):
                self.val = val
                self.left = left
                self.right = right
        `
		if (!exist) {
			await writeFileAsync(preImportFile, data, { encoding: 'utf8' })
		}
	}
	private getTestFilePath() {
		const cwd = this.cwd
		const testFilePath = path.join(cwd, 'out', 'out.py')
		return testFilePath
	}
	// do some thing before debug,eg. get testcase
	async beforeDebug(breaks: vscode.SourceBreakpoint[]) {
		const args = await this.resolveArgsFromBreaks(breaks)
		const str = JSON.stringify([args.map((v) => JSON.parse(v))])
		await this.writeTestCase(str)
	}
	async writeTestCase(argsStr: string) {
		argsStr = argsStr.replace(/\\|"/g, (s) => `\\${s}`)
		const finalCode = await this.handleArgsType(argsStr)
		const testFilePath = this.getTestFilePath()
		await ensureFile(testFilePath)
		await writeFileAsync(testFilePath, finalCode)
	}
	getDebugConfig() {
		const outputFile = path.join(this.cwd, 'out', 'out.py')
		return {
			name: 'Python: Current File (Integrated Terminal)',
			type: 'python',
			request: 'launch',
			program: outputFile,
			console: 'integratedTerminal',
		}
	}
}

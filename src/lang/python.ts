import * as cp from 'child_process'
import { pathExists, ensureFile } from 'fs-extra'
import { existFile, readFileAsync, TestCase, TestCaseParam, writeFileAsync } from '../common/util'
import { tag } from 'pretty-tag'
import { getFuncNames, parseTestCase, TestResult, handleMsg } from '../common/util'
import { log, config } from '../config'
import { getDb } from '../db';
import { api } from '../api/index'
import { MetaData } from '../util'
import { resolve } from 'path'
import { rejects } from 'assert'
import { runInNewContext } from 'vm'
import { promisify } from 'util'
import { OutputChannel } from 'vscode'
import * as vscode from 'vscode'
import { tranfromToCustomBreakpoint } from '../debug/launch'
import { stdout } from 'process'
import * as path from 'path'
import { getFileComment } from '../common/langConfig'
import { BaseLang } from './base'
import { parseCommentTest } from '../common/util'
const testRegExp = /^#\s*@test\([^\)]*\)/;
const funcRegExp = /^(\s*class Solution)/;
const execFileAsync = promisify(cp.execFile)

export class PythonParse extends BaseLang {
    static preImport: string = 'from mod.preImport import *'
    funcRegExp = /^(\s*class Solution)/
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
            arr.append(node.val)
            node=node.next
        return arr
    def deserializeListNode(originData:str)->ListNode:
        arr=json.loads(originData)
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
                arr.append(node.val)
                queue.append(node.left)
                queue.append(node.right)
            else:
                arr.append(None)
        i=len(arr)-1
        while(arr[i]==None):
            i=i-1
            arr.pop()
        return arr
    def deserializeTreeNode(originData:str)->TreeNode:
        arr=json.loads(originData)
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
    `
    async handleArgsType(args: string[], funcName: string) {
        const meta = await this.getQuestionMeta()
        const params = meta?.params || []
        const rt = meta?.return?.type
        for (let i = 0; i < params.length; i++) {
            const { name, type } = params[i]
            if (type === 'TreeNode') {
                args[i] = `deserializeTreeNode("${args[i]}")`
            } else if (type === 'ListNode') {
                args[i] = `deserializeListNode("${args[i]}")`
            }
        }
        const argsStr = args.join(',')
        let funExecExpression = `s.${funcName}(${argsStr})`
        if (rt === 'TreeNode') {
            funExecExpression = `serializeTreeNode(${funExecExpression})`
        } else if (rt === 'ListNode') {
            funExecExpression = `serializeListNode(${funExecExpression})`
        }
        return funExecExpression
    }
    async runInNewContext(args: string[], originCode: string, funcName: string) {

        const importFilePath = path.join(config.algDir, 'Python3')

        const funExecExpression = await this.handleArgsType([...args], funcName)
        const preImport = tag`
        import json
        import sys
        sys.path.append("${importFilePath}")
        ${this.handleTypeCode}
        `
        const finalCode = tag`
                ${preImport}
                ${originCode}
                s=Solution()
                r=${funExecExpression}
                print("resultabc:"+json.dumps(r,separators=(',', ':')))
                `
        const { stdout, stderr } = await execFileAsync("python3", ["-c", finalCode], { timeout: 10000 })
        let resultRegExp = /resultabc:([\s\S]*)/
        let result = ''
        let execResult = resultRegExp.exec(stdout)
        if (execResult) {
            result = execResult[1].trimEnd()
            const innsertResultLine = execResult[0]
            const output = stdout.replace(innsertResultLine, '')
            if (output) {
                this.log.appendLine(output)
            }

        } else if (stdout) {
            this.log.appendLine(stdout)
        }
        return result
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
    // do some thing before debug,eg. get testcase 
    async beforeDebug(breaks: vscode.SourceBreakpoint[]) {
        await this.writeTestCase(breaks, this.filePath)
    }
    async writeTestCase(breaks: vscode.SourceBreakpoint[], filePath: string) {

        const customBreakpoints = tranfromToCustomBreakpoint(breaks)
        const customBreakPoint = customBreakpoints.find(c => c.path === filePath)
        if (!customBreakPoint) {
            throw new Error('breakpoint not found, please set breakpoint first')
        }
        const originCode = await this.getOriginCode()
        const questionMeta = await this.getQuestionMeta()
        if (!questionMeta) {
            throw new Error('questionMeta not found ')
        }
        const funcName = questionMeta.name
        let codeLines = originCode.split('\n')

        const lines = customBreakPoint.lines
        const testRegExp = /#\s*@test\(((?:"(?:\\.|[^"])*"|[^)])*)\)/
        const line = lines.find(num => testRegExp.test(codeLines[num]))
        if (!Number.isInteger(line)) {
            throw new Error('please select the test case')
        }
        const { args } = parseCommentTest(codeLines[(line as number)])
        const funExecExpression = await this.handleArgsType(args, funcName)
        const filePathParse = path.parse(filePath)
        const name = filePathParse.name
        const dir = filePathParse.dir
        const outputFile = path.join(config.baseDir, 'out', 'out.py')
        await writeFileAsync(outputFile, tag`
        import sys
        import json
        sys.path.append("${dir}")
        a = __import__('${name}')
        ${this.handleTypeCode}
        s=a.Solution()
        r=${funExecExpression}
        print("result:"+json.dumps(r,separators=(',', ':')))
        `)

    }
    getDebugConfig() {
        const outputFile = path.join(config.baseDir, 'out', 'out.py')
        return {
            "name": "Python: Current File (Integrated Terminal)",
            "type": "python",
            "request": "launch",
            "program": outputFile,
            "console": "integratedTerminal"
        }
    }

}
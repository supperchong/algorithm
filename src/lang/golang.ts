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
const execFileAsync = promisify(cp.execFile)

export class GoParse extends BaseLang {
    static preImport: string = 'package main'
    funcRegExp = /^(\s*func)/
    testRegExp = /\/\/\s*@test\(((?:"(?:\\.|[^"])*"|[^)])*)\)/

    handleTypeCode = tag`
    package main

    import (
        "encoding/json"
        "fmt"
        "strconv"
        "strings"
    )

    // ListNode Definition for singly-linked list.
    type ListNode struct {
        Val  int
        Next *ListNode
    }

    // TreeNode Definition for a binary tree node.
    type TreeNode struct {
        Val   int
        Left  *TreeNode
        Right *TreeNode
    }

    func serializeInterface(data interface{}) string {
        r2, _ := json.Marshal(data)
        return string(r2)
    }
    
    func deserializeTreeNode(data string) *TreeNode {
        length := len(data)
        if length <= 2 {
            return nil
        }
    
        arr := strings.Split(data[1:length-1], ",")
        val, _ := strconv.Atoi(arr[0])
        arr = arr[1:]
        root := &TreeNode{Val: val}
        queue := []*TreeNode{root}
        for len(queue) > 0 {
            node := queue[0]
            queue = queue[1:]
            if len(arr) == 0 {
                return root
            }
    
            leftVal := arr[0]
            arr = arr[1:]
            if leftVal != "null" {
                val, _ := strconv.Atoi(leftVal)
                left := &TreeNode{Val: val}
                node.Left = left
                queue = append(queue, left)
            }
            if len(arr) == 0 {
                return root
            }
            rightVal := arr[0]
            arr = arr[1:]
            if rightVal != "null" {
                val, _ := strconv.Atoi(rightVal)
                right := &TreeNode{Val: val}
                node.Right = right
                queue = append(queue, right)
            }
    
        }
        return root
    
    }
    func deserializeTreeNodeArr(data string) []*TreeNode {
        length := len(data)
        if length <= 4 {
            return []*TreeNode{}
        }
        str := data[1 : length-1]
        r := []*TreeNode{}
        for i := 0; i < len(str); i++ {
            if str[i:i+1] == "[" {
                flag := false
                j := i + 1
                for ; j < len(str); j++ {
                    if str[j:j+1] == "]" {
                        r = append(r, deserializeTreeNode(str[i:j+1]))
                        flag = true
                        break
                    }
                }
                if !flag {
                    fmt.Print("parse error")
                    return []*TreeNode{}
                }
                i = j
            }
        }
        return r
    
    }
    func serializeTreeNode(root *TreeNode) string {
        if root == nil {
            return "[]"
        }
        var arr []string
        queue := []*TreeNode{root}
        for len(queue) > 0 {
            node := queue[0]
            queue = queue[1:]
            if node != nil {
                arr = append(arr, strconv.Itoa(node.Val))
                queue = append(queue, node.Left)
                queue = append(queue, node.Right)
            } else {
                arr = append(arr, "null")
            }
    
        }
        var i = len(arr) - 1
        for arr[i] == "null" {
            i--
        }
        arr = arr[0 : i+1]
        return "[" + strings.Join(arr, ",") + "]"
    }
    
    func serializeTreeNodeArr(arr []*TreeNode) string {
        strArr := "["
        for i := 0; i < len(arr); i++ {
            strArr += serializeTreeNode(arr[i])
            if i != len(arr)-1 {
                strArr += ","
            }
        }
        strArr += "]"
        return strArr
    }
    
    func deserializeListNode(data string) *ListNode {
        length := len(data)
        if length <= 2 {
            return nil
        }
        arr := strings.Split(data[1:length-1], ",")
    
        c := arr[0]
        arr = arr[1:]
        val, _ := strconv.Atoi(c)
        root := &ListNode{Val: val}
        p := root
        for len(arr) > 0 {
    
            c := arr[0]
            arr = arr[1:]
            val, _ := strconv.Atoi(c)
            node := &ListNode{Val: val}
            p.Next = node
            p = node
        }
        return root
    }
    
    func deserializeListNodeArr(data string) []*ListNode {
        length := len(data)
        if length <= 4 {
            return []*ListNode{}
        }
        str := data[1 : length-1]
        r := []*ListNode{}
        for i := 0; i < len(str); i++ {
            if str[i:i+1] == "[" {
                flag := false
                j := i + 1
                for ; j < len(str); j++ {
                    if str[j:j+1] == "]" {
                        r = append(r, deserializeListNode(str[i:j+1]))
                        flag = true
                        break
                    }
                }
                if !flag {
                    //解析错误
                    fmt.Print("解析错误")
                    return []*ListNode{}
                }
                i = j
            }
        }
        return r
    }
    func serializeListNode(root *ListNode) string {
        var arr []string
        p := root
        for p != nil {
            arr = append(arr, strconv.Itoa(p.Val))
            p = p.Next
        }
        return "[" + strings.Join(arr, ",") + "]"
    }
    func serializeListNodeArr(arr []*ListNode) string {
        newArr := []string{}
        for i := 0; i < len(arr); i++ {
            newArr = append(newArr, serializeListNode(arr[i]))
        }
        return "[" + strings.Join(newArr, ",") + "]"
    }
    
    func parseInteger(param string) int {
        num, err := strconv.Atoi(param)
        if err != nil {
            panic(err)
        }
        return num
    }
    func parseString(param string) string {
        var r string
        json.Unmarshal([]byte(param), &r)
        return r
    }
    func parseFloat(param string) float64 {
        num, err := strconv.ParseFloat(param, 64)
        if err != nil {
            panic(err)
        }
        return num
    }
    func parseIntegerArr(param string) []int {
        var r []int
        json.Unmarshal([]byte(param), &r)
        return r
    }
    func parseStringArr(param string) []string {
        var r []string
        json.Unmarshal([]byte(param), &r)
        return r
    }
    func parseIntegerArrArr(param string) [][]int {
        var r [][]int
        json.Unmarshal([]byte(param), &r)
        return r
    }
    
    func parseStringArrArr(param string) [][]string {
        var r [][]string
        json.Unmarshal([]byte(param), &r)
        return r
    }
    `
    transformParam(param: string, paramType: string): string {
        const handleConfig = [{
            type: 'integer',
            handleFn: 'parseInteger'
        }, {
            type: 'string',
            handleFn: 'parseString'
        }, {
            type: 'integer[]',
            handleFn: 'parseIntegerArr'
        }, {
            type: 'string[]',
            handleFn: 'parseStringArr'
        }, {
            type: 'integer[][]',
            handleFn: 'parseIntegerArrArr'
        }, {
            type: 'double',
            handleFn: 'parseFloat'
        }, {
            type: "ListNode",
            handleFn: "deserializeListNode"
        }, {
            type: "TreeNode",
            handleFn: "deserializeTreeNode"
        }, {
            type: "ListNode[]",
            handleFn: "deserializeListNodeArr"
        }, {
            type: "TreeNode[]",
            handleFn: "deserializeTreeNodeArr"
        }, {
            type: "character[][]",
            handleFn: "parseStringArrArr"
        }, {
            type: "string[][]",
            handleFn: "parseStringArrArr"
        }]
        for (const { type, handleFn } of handleConfig) {
            if (type === paramType) {
                return `${handleFn}(${param})`
            }
        }
        throw new Error(`paramType ${paramType} not support`)
    }
    transformReturnType(returnExpression: string, returnType: string | undefined) {
        const handleConfig = [{
            type: 'integer',
            handleFn: 'serializeInterface'
        }, {
            type: 'string',
            handleFn: 'serializeInterface'
        }, {
            type: 'double',
            handleFn: 'serializeInterface'
        }, {
            type: 'boolean',
            handleFn: 'serializeInterface'
        }, {
            type: "ListNode",
            handleFn: "serializeListNode"
        }, {
            type: "TreeNode",
            handleFn: "serializeTreeNode"
        },
        {
            type: 'integer[]',
            handleFn: 'serializeInterface'
        }, {
            type: 'list<integer>',
            handleFn: 'serializeInterface'
        },
        {
            type: 'string[]',
            handleFn: 'serializeInterface'
        }, {
            type: 'list<string>',
            handleFn: 'serializeInterface'
        },
        {
            type: "ListNode[]",
            handleFn: "serializeListNodeArr"
        }, {
            type: "TreeNode[]",
            handleFn: "serializeTreeNodeArr"
        }, {
            type: 'integer[][]',
            handleFn: 'serializeInterface'
        },
        {
            type: 'list<list<integer>>',
            handleFn: 'serializeInterface'
        },
        {
            type: "character[][]",
            handleFn: "serializeInterface"
        }, {
            type: "string[][]",
            handleFn: "serializeInterface"
        }, {
            type: 'list<list<string>>',
            handleFn: 'serializeInterface'
        }]
        for (const { type, handleFn } of handleConfig) {
            if (type === returnType) {
                return `${handleFn}(${returnExpression})`
            }
        }
        throw new Error(`returnType ${returnType} not support`)
    }
    async handleArgsType(args: string[]) {
        const meta = await this.getQuestionMeta()
        if (!meta) {
            throw new Error('question meta not found')
        }
        const params = meta.params || []
        let rt = meta.return.type
        const funcName = meta.name
        const newArgs: string[] = []

        for (let i = 0; i < params.length; i++) {
            const { name, type } = params[i]
            newArgs[i] = this.transformParam(JSON.stringify(args[i]), type)

        }
        if (rt !== 'void') {
            const argsStr = newArgs.join(',')
            const funExecExpression = `${funcName}(${argsStr})`
            const transformFunExecExpression = this.transformReturnType(funExecExpression, rt)

            return `r:=${transformFunExecExpression}`
        } else {

            rt = params[0]?.type

            const firstArg = newArgs[0]
            const otherArgs = newArgs.slice(1)
            const replaceArgs = ['firstArg', ...otherArgs]
            const argsStr = replaceArgs.join(',')
            const funExecExpression = `${funcName}(${argsStr})`
            const transformFunExecExpression = this.transformReturnType('firstArg', rt)

            return tag`
            firstArg:=${firstArg}
            ${funExecExpression}
            r:=${transformFunExecExpression}
            `

        }

    }
    async runInNewContext(args: string[], originCode: string, funcName: string) {


        const funExecExpression = await this.handleArgsType([...args])
        const finalCode = tag`
        ${this.handleTypeCode}
        func main(){
            ${funExecExpression}
            fmt.Printf("resultabc:%s", r)
        }
        `
        const dir = path.parse(this.filePath).dir
        const filePath = path.join(dir, 'main.go')
        await writeFileAsync(filePath, finalCode)
        const { stdout, stderr } = await execFileAsync("go", ["run", "."], { timeout: 10000, cwd: dir })
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
        return
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
        const line = lines.find(num => this.testRegExp.test(codeLines[num]))
        if (!Number.isInteger(line)) {
            throw new Error('please select the test case')
        }
        const { args } = parseCommentTest(codeLines[(line as number)])
        const funExecExpression = await this.handleArgsType([...args])
        const finalCode = tag`
        ${this.handleTypeCode}
        func main(){
            ${funExecExpression}
            fmt.Printf("result:%s", r)
        }
        `
        const dir = path.parse(this.filePath).dir
        const mainFilePath = path.join(dir, 'main.go')
        await writeFileAsync(mainFilePath, finalCode)

    }
    getDebugConfig() {
        const dir = path.parse(this.filePath).dir
        return {
            "name": "Launch Package",
            "type": "go",
            "request": "launch",
            "mode": "debug",
            "program": dir
        }
    }

}
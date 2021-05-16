import * as cp from 'child_process'
import { pathExists, ensureFile, ensureDir, copy } from 'fs-extra'
import { CaseList, existFile, readFileAsync, TestCase, TestCaseParam, writeFileAsync } from '../common/util'
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
import { ExtraType } from '../common/langConfig'
import { BaseLang } from './base'
import { parseCommentTest } from '../common/util'
const execFileAsync = promisify(cp.execFile)
const langTypeMap = {
    'integer': 'int',
    'string': 'String',
    'integer[]': 'int[]',
    'string[]': 'String[]',
    'integer[][]': 'int[][]',
    'double': 'double',
    'ListNode': 'ListNode',
    'TreeNode': 'TreeNode',
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
    'boolean': 'boolean'
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


    handleParam(index: number, paramType: string): string {
        const langType = langTypeMap[paramType]
        if (!langType) {
            throw new Error("not support param type:" + paramType)
        }
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
            handleFn: "parseListNode"
        }, {
            type: "TreeNode",
            handleFn: "parseTreeNode"
        }, {
            type: "ListNode[]",
            handleFn: "parseListNodeArr"
        }, {
            type: "TreeNode[]",
            handleFn: "parseTreeNodeArr"
        }, {
            type: "character[][]",
            handleFn: "parseStringArrArr"
        }, {
            type: "string[][]",
            handleFn: "parseStringArrArr"
        }, {
            type: 'list<integer>',
            handleFn: 'parseIntegerList'
        }, {
            type: 'list<list<integer>>',
            handleFn: 'parseIntegerListList'
        }, {
            type: 'list<string>',
            handleFn: 'parseStringList'
        }, {
            type: 'list<list<string>>',
            handleFn: 'parseStringListList'
        }]
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
            throw new Error("not support return type:" + returnType)
        }
        const handleConfig = [{
            type: 'integer',
            handleFn: 'serializeInteger',
        }, {
            type: 'string',
            handleFn: 'serializeString',
        }, {
            type: 'double',
            handleFn: 'serializeFloat',
        }, {
            type: 'boolean',
            handleFn: 'serializeBool',
        }, {
            type: "ListNode",
            handleFn: "serializeListNode"
        }, {
            type: "TreeNode",
            handleFn: "serializeTreeNode"
        },
        {
            type: 'integer[]',
            handleFn: 'serializeIntegerArr'
        }, {
            type: 'list<integer>',
            handleFn: 'serializeIntegerList'
        },
        {
            type: 'string[]',
            handleFn: 'serializeStringArr'
        }, {
            type: 'list<string>',
            handleFn: 'serializeStringArr'
        },
        {
            type: "ListNode[]",
            handleFn: "serializeListNodeArr"
        }, {
            type: "TreeNode[]",
            handleFn: "serializeTreeNodeArr"
        }, {
            type: 'integer[][]',
            handleFn: 'serializeIntegerArrArr'
        },
        {
            type: 'list<list<integer>>',
            handleFn: 'serializeIntegerListList'
        },
        {
            type: "character[][]",
            handleFn: "serializeStringArrArr"
        }, {
            type: "string[][]",
            handleFn: "serializeStringArrArr"
        }, {
            type: 'list<string>',
            handleFn: 'serializeStringList'
        }, {
            type: 'list<list<string>>',
            handleFn: 'serializeStringListList'
        }]
        const argStr = Array(paramCount).fill(0).map((v, i) => `arg${i}`).join(',')

        for (const { type, handleFn } of handleConfig) {
            if (type === returnType) {
                if (!isVoid) {
                    const funcExpression = `
                    ${langType} result=s.${funcName}(${argStr});
                    String resultabc =Util.${handleFn}(result);
                    `
                    return funcExpression
                } else {
                    const funcExpression = `
                    s.${funcName}(${argStr})
                    String resultabc =Util.${handleFn}(arg0);
                    `
                    return funcExpression
                }


            }
        }
        throw new Error(`returnType ${returnType} not support`)
    }

    async handleArgsType() {
        const meta = await this.getQuestionMeta()
        // let meta = JSON.parse("{\n  \"name\": \"twoSum\",\n  \"params\": [\n    {\n      \"name\": \"nums\",\n      \"type\": \"integer[]\"\n    },\n    {\n      \"name\": \"target\",\n      \"type\": \"integer\"\n    }\n  ],\n  \"return\": {\n    \"type\": \"integer[]\",\n    \"size\": 2\n  },\n  \"manual\": false\n}")
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
                    String str=args[0];
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

        await Promise.all(names.map(async name => {
            const src = path.join(sourceDir, name)
            const dst = path.join(algmDir, name)
            const isExist = await pathExists(dst)
            if (!isExist) {
                return copy(src, dst)
            }

        }))
    }
    async runMultiple(caseList: CaseList, originCode: string, funcName: string) {
        const argsArr = caseList.map(v => v.args)
        await this.writeTestCase()
        // await this.ensureCommonModuleFile()
        // const finalCode = await this.handleArgsType()
        const dir = path.parse(this.filePath).dir
        const dirParse = path.parse(dir)
        const dirname = 'test'
        // const filePath = path.join(dir, 'Test.java')
        // await writeFileAsync(filePath, finalCode)
        const javaPath = config.javaPath
        const javacPath = config.javacPath
        const cwd = dirParse.dir
        try {
            const { stdout: stdout1, stderr: stderr1 } = await execFileAsync(javacPath, [`${dirname}/Test.java`], { timeout: 10000, cwd: cwd, shell: true })
            const { stdout, stderr } = await execFileAsync(javaPath, [`${dirname}/Test`, JSON.stringify(argsArr).replace(/"|\\|\s/g, (s) => `\\${s}`)], { timeout: 10000, cwd: cwd, shell: true })
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
        await this.writeTestCase()
    }
    private getTestFilePath() {
        const dir = path.parse(this.filePath).dir
        const testDir = path.join(path.parse(dir).dir, 'test')
        const testFilePath = path.join(testDir, 'Test.java')
        return testFilePath
    }
    async writeTestCase() {

        await this.ensureCommonModuleFile()
        const finalCode = await this.handleArgsType()
        const testFilePath = this.getTestFilePath()
        await ensureFile(testFilePath)
        await writeFileAsync(testFilePath, finalCode)
    }
    async getDebugConfig(breaks: vscode.SourceBreakpoint[]) {
        const dir = path.parse(this.filePath).dir
        const testFilePath = this.getTestFilePath()
        const filePath = this.filePath
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
        return {
            "type": "java",
            "name": "Launch Current File",
            "request": "launch",
            "mainClass": testFilePath,
            "cwd": path.parse(dir).dir,
            "args": JSON.stringify([args]).replace(/"|\\|\s/g, (s) => `\\${s}`),
        }
    }
    shouldRemoveInBuild(line: string): boolean {
        line = line.trim()
        return line.startsWith('package') || line.startsWith('import algm')
    }

}
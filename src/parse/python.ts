import * as cp from 'child_process'
import * as fs from 'fs'
import { readFileAsync, TestCase, TestCaseParam, writeFileAsync } from '../common/util'
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
const testRegExp = /^#\s*@test\([^\)]*\)/;
const funcRegExp = /^(\s*class Solution)/;
const execFileAsync = promisify(cp.execFile)

export class PythonParse {
    static async getQuestionMeta(originCode: string, filepath: string) {
        const { questionMeta } = getFuncNames(originCode, filepath)
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
        const metaData: MetaData = JSON.parse(question.metaData)
        return metaData
    }
    static async execTest(testCase: TestCase, filepath: string) {
        const caseList = parseTestCase(testCase)
        const originCode = await readFileAsync(filepath, { encoding: 'utf8' })
        const { questionMeta } = getFuncNames(originCode, filepath)
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
        const metaData: MetaData = JSON.parse(question.metaData)
        const funcName = metaData.name
        if (!caseList.length) return
        let testResultList: TestResult[] = []
        return new Promise(async (resolve, reject) => {
            for (const { args, result: expect } of caseList) {
                try {
                    let result = await PythonParse.runInNewContext(args, originCode, funcName, log)
                    testResultList.push({
                        args: args.join(','),
                        expect: expect,
                        result
                    })
                } catch (err) {
                    let msg = `× @test(${args.join(',')})\n`
                    resolve(msg + err.stderr)
                    return
                }
            }
            resolve(handleMsg(testResultList, caseList))
        })

    }
    static async runInNewContext(args: string[], originCode: string, funcName: string, log: OutputChannel) {
        const argsStr = args.join(',')
        const preImport = tag`
        import json
        `
        const finalCode = tag`
                ${preImport}
                ${originCode}
                s=Solution()
                r=s.${funcName}(${argsStr})
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
                log.appendLine(output)
            }

        } else if (stdout) {
            log.appendLine(stdout)
        }
        return result
    }
    static getTestCaseList(text: string) {

        let testCase: TestCase = [];
        const lines = text.split(/\n/);
        let index: number
        lines.forEach((line, i) => {
            if (testRegExp.test(line)) {
                testCase.push(line)
            } else if (funcRegExp.test(line)) {
                index = i
            }
        })
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i]
            if (testRegExp.test(line)) {
                testCase.push(line)
            } else if (funcRegExp.test(line)) {
                const testCaseList: TestCaseParam[] = [
                    { line: i, testCase, funcName: '', paramsTypes: [], resultType: '' }
                ];
                return testCaseList
            }
        }
        return []

    }
    static async debugCodeCommand(folder: vscode.WorkspaceFolder, filePath: string, breaks: vscode.SourceBreakpoint[]) {
        await PythonParse.getTestCase(breaks, filePath)
        const debugConfiguration = PythonParse.getDebugConfig()

        vscode.debug.startDebugging(folder, debugConfiguration)
    }
    static async getTestCase(breaks: vscode.SourceBreakpoint[], filePath: string) {

        const customBreakpoints = tranfromToCustomBreakpoint(breaks)
        const customBreakPoint = customBreakpoints.find(c => c.path === filePath)
        if (!customBreakPoint) {
            log.appendLine('breakpoint not found, please set breakpoint first')
            return
        }
        const originCode = await readFileAsync(filePath, { encoding: 'utf8' })
        const questionMeta = await PythonParse.getQuestionMeta(originCode, filePath)
        if (!questionMeta) {
            return
        }
        const funcName = questionMeta.name
        let codeLines = originCode.split('\n')

        const lines = customBreakPoint.lines
        const testRegExp = /#\s*@test\(((?:"(?:\\.|[^"])*"|[^)])*)\)/
        const line = lines.find(num => testRegExp.test(codeLines[num]))
        if (!Number.isInteger(line)) {
            log.appendLine('please select the test case')
            return
        }
        let match = codeLines[(line as number)].match(testRegExp)
        const testCase = match![1]
        const filePathParse = path.parse(filePath)
        const name = filePathParse.name
        const dir = filePathParse.dir
        const outputFile = path.join(config.baseDir, 'out', 'out.py')
        await writeFileAsync(outputFile, tag`
        import sys
        import json
        sys.path.append("${dir}")
        a = __import__('${name}')
        
        s=a.Solution()
        r=s.${funcName}(${testCase})
        print("resultabc:"+json.dumps(r,separators=(',', ':')))
        `)

    }
    static getDebugConfig() {
        const outputFile = path.join(config.baseDir, 'out', 'out.py')
        return {
            "name": "Python: Current File (Integrated Terminal)",
            "type": "python",
            "request": "launch",
            "program": outputFile,
            "console": "integratedTerminal"
        }
    }
    static buildCode(text: string, filePath: string) {
        const { questionMeta } = getFuncNames(text, filePath);
        const commentToken = getFileComment(filePath)
        const code = text.split('\n').filter(line => !line.trimLeft().startsWith(commentToken)).join('\n')
        return {
            code,
            questionMeta
        }
    }

}
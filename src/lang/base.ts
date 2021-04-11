import * as cp from 'child_process'
import * as fs from 'fs'
import { readFileAsync, TestCase, TestCaseParam, writeFileAsync, execFileAsync } from '../common/util'
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

export abstract class BaseLang {
    public preImport: string = ''
    public log: OutputChannel
    public originCode?: string
    public commentToken: '#' | '//'
    public abstract funcRegExp: RegExp
    public abstract runInNewContext(args: string[], originCode: string, funcName: string): Promise<string>
    public abstract getDebugConfig(): any
    public abstract beforeDebug(breaks: vscode.SourceBreakpoint[]): Promise<void>
    public abstract handlePreImport(): any
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
        const originCode = await readFileAsync(this.filePath, { encoding: 'utf8' })
        this.originCode = originCode
        return this.originCode
    }
    public async getQuestionMeta() {
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
        const metaData: MetaData = JSON.parse(question.metaData)
        const funcName = metaData.name
        if (!caseList.length) return
        let testResultList: TestResult[] = []
        return new Promise(async (resolve, reject) => {
            for (const { args, result: expect } of caseList) {
                try {
                    let result = await this.runInNewContext(args, originCode, funcName)
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

    public getTestCaseList(text: string) {
        const testRegExp = this.commentToken === '#' ? /#\s*@test\(((?:"(?:\\.|[^"])*"|[^)])*)\)/ : /\/\/\s*@test\(((?:"(?:\\.|[^"])*"|[^)])*)\)/
        const funcRegExp = this.funcRegExp
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

    async debugCodeCommand(folder: vscode.WorkspaceFolder, breaks: vscode.SourceBreakpoint[]) {
        try {
            await this.beforeDebug(breaks)
        } catch (err) {
            log.appendLine(err.message)
            log.show()
            return
        }

        const debugConfiguration = this.getDebugConfig()

        vscode.debug.startDebugging(folder, debugConfiguration)
    }
    public async buildCode(preImport: string) {
        const originCode = await this.getOriginCode()
        const { questionMeta } = getFuncNames(originCode, this.filePath);
        const commentToken = getFileComment(this.filePath)

        const code = originCode.split('\n').filter(line => !isComment(line, commentToken) && !isPreImport(line, preImport)).join('\n')
        return {
            code,
            questionMeta
        }
    }

}

function isComment(line: string, commentToken: "#" | "//") {
    return line.trimLeft().startsWith(commentToken)
}

function isPreImport(line: string, preImport: string) {
    return line.trim().startsWith(preImport)
}
import { EROFS } from "constants";
import { CodeLang, getFileLang, ExtraType } from "../common/langConfig";
import { BaseLang } from "./base";
import { PythonParse } from './python'
import { GoParse } from './golang'
import { JavaParse } from './java'
import { log } from '../config'
import { readFileAsync, TestCase, TestCaseParam, writeFileAsync, execFileAsync } from '../common/util'
import * as vscode from 'vscode'
import * as path from 'path'
import { enableLang } from '../common/langConfig'
const langMap = {
    [CodeLang.Python3]: PythonParse,
    [CodeLang.Go]: GoParse,
    [CodeLang.Java]: JavaParse
}
export class Service {
    public codeLang: CodeLang
    private ctx: BaseLang
    constructor(public filePath: string, public text?: string) {
        this.codeLang = getFileLang(filePath)

        const Parse = langMap[this.codeLang]
        if (!Parse) {
            const fileParse = path.parse(filePath)
            throw new Error('Currently, not support ' + fileParse.ext)
        }
        this.ctx = new Parse(filePath, text)
    }
    static getPreImport(codeLang: CodeLang, name: string, extraTypeSet: Set<ExtraType>): string {
        const Parse = langMap[codeLang]
        if (!Parse) return ''
        return Parse.getPreImport(name, extraTypeSet)
    }
    static handlePreImport(filePath: string) {

        const codeLang = getFileLang(filePath)
        if (['JavaScript', 'TypeScript'].includes(codeLang)) {
            return
        }
        const service = new Service(filePath)
        return service.ctx.handlePreImport()
    }
    public isSupport() {
        return enableLang.includes(this.codeLang)
    }
    public execTest(testCase: TestCase) {
        return this.ctx.execTest(testCase)
    }
    public debugCodeCommand(folder: vscode.WorkspaceFolder, breaks: vscode.SourceBreakpoint[]) {
        return this.ctx.debugCodeCommand(folder, breaks)
    }
    public buildCode() {
        return this.ctx.buildCode()
    }
    public getTestCaseList(text: string) {
        return this.ctx.getTestCaseList(text)
    }
}
import * as vscode from 'vscode';
import { window } from 'vscode';
import { transformAsync } from "@babel/core"
import { generateAddTestCommentPlugin } from './babelPlugin'
import { langMap, LangBase, getFileLang, CodeLang, ExtraType } from './common/langConfig';
import { ParseContent } from './common/parseContent'
import { config, updateConfig, updateEnv, InstallState, log, checkEsbuildDir } from './config'
import { tag } from 'pretty-tag'
import { Question, CodeSnippet } from './model/question.cn';
import { AskForImportState, ConciseQuestion } from './model/common';
import { MemoFile } from './model/memo';
import { Service } from './lang/common'
export async function execWithProgress(promise: Promise<any>, message: string) {
    return window.withProgress({ location: vscode.ProgressLocation.Notification }, (p) => {
        p.report({ message });
        return promise;
    });
}
export async function execWithProgress2(promise: Promise<any>, message: string) {
    return window.withProgress({ location: vscode.ProgressLocation.Window }, (p) => {
        p.report({ message });
        return promise;
    });
}
export async function appendComment(code: string, comment: string, funcName: string) {
    let fileResult = await transformAsync(code, {
        // comments: true,
        // compact: false,
        plugins: [generateAddTestCommentPlugin(funcName, comment)]
    });
    return fileResult?.code
}
interface Param {
    name: string,
    type: string,
}
interface ReturnType {
    type: string
}

const extraTypeValues = [ExtraType.ListNode, ExtraType.TreeNode]
export type MetaData = LanguageMetaData | DataBaseMetaData | ShellMetaData
export interface LanguageMetaData {
    name: string,
    params: Param[],
    return: ReturnType
}
export interface DataBaseMetaData {
    database: true,
    mssql: string[],
    mysql: string[],
    oraclesql: string[]
}
export interface ShellMetaData {
    shell: true
}


export function shouldAskForImport(): boolean {
    return !config.hasAskForImport && config.env.askForImportState === AskForImportState.Later && !config.autoImportAlgm
}
export async function askForImport() {
    config.hasAskForImport = true
    const r = await window.showInformationMessage('Would you like to import the algm module?', AskForImportState.Yes, AskForImportState.No, AskForImportState.Later)
    switch (r) {
        case AskForImportState.Yes: {
            updateConfig('autoImportAlgm', true, true)
            updateEnv('askForImportState', AskForImportState.Yes)
            break
        }
        case AskForImportState.No: {
            updateConfig('autoImportAlgm', false, true)
            updateEnv('askForImportState', AskForImportState.No)
            break
        }
    }


}
function getExtraTypeSet(metaData: LanguageMetaData) {
    const arr: Set<ExtraType> = new Set()
    const params = metaData.params
    const r = metaData.return
    params.forEach(p => {
        extraTypeValues.forEach(e => {
            if (p.type.includes(e)) {
                arr.add(e)
            }
        })
    })
    extraTypeValues.forEach(e => {
        if (r.type.includes(e)) {
            arr.add(e)
        }
    })
    return arr
}
function getImportStr(metaData: LanguageMetaData) {
    const arr = getExtraTypeSet(metaData)
    if (arr.size) {
        return `import { ${[...arr].join(', ')} } from 'algm'`
    }
    return ''

}

function isShellMetaData(metaData: MetaData): metaData is ShellMetaData {
    return ('shell' in metaData) && metaData.shell
}
function isDataBaseMetaData(metaData: MetaData): metaData is DataBaseMetaData {
    return ('database' in metaData) && metaData.database
}
function isLanguageMetaData(metaData: MetaData): metaData is LanguageMetaData {
    return ('name' in metaData)
}
export function preprocessCode({ questionId, codeSnippets, metaData, content, titleSlug, questionSourceContent }: Question, weekname: string = '', codeSnippet: CodeSnippet, name: string) {

    const { codeLang } = config

    let testCases = ParseContent.getTestCases(questionSourceContent || content);
    const langSlug = codeSnippet.langSlug;
    const langConfig = langMap[langSlug];
    const algorithmPath = config.algmModuleDir.replace(/\\/g, '\\\\')
    const weektag = weekname ? `weekname=${weekname}` : ''

    const metaDataParse: MetaData = JSON.parse(metaData);
    const LcComment = tag`
        ${langConfig.comment} @algorithm @lc id=${questionId} lang=${langSlug} ${weektag}
        ${langConfig.comment} @title ${titleSlug}
    `
    if (!isLanguageMetaData(metaDataParse)) {
        return LcComment
    }
    const supportImport = ['JavaScript', 'TypeScript'].includes(langConfig.lang)
    const shouldImport = supportImport && config.autoImportAlgm
    const importStr = shouldImport ? `import * as a from 'algm'\n` + getImportStr(metaDataParse) : ''
    const autoImportStr = config.autoImportStr || ''
    const preImport = Service.getPreImport(langConfig.lang, name, getExtraTypeSet(metaDataParse))
    const flag = tag`
            ${LcComment}
            ${importStr}
            ${autoImportStr}
            ${preImport}
        `;

    let codeTestSnippet = '';
    try {
        codeTestSnippet = testCases.map(testCase => {
            const pa = metaDataParse.params.map((param, i) => {
                const input = testCase.input.find(({ key }) => key === param.name);
                if (input) {
                    return input.value;
                } else {
                    return testCase.input[i].value;
                }
            }
            ).join(',');
            return `${langConfig.comment} @test(${pa})=${testCase.output}\n`;
        }).join('');
    } catch (err) {

        console.log(err);
    }

    let code = codeSnippet.code;
    let newCode = flag + '\n' + codeTestSnippet + code;
    return newCode;
}
export function getDebugConfig() {
    const { nodeBinPath } = config

    return {
        "type": "node",
        "request": "launch",
        "name": "debug question",
        "skipFiles": [
            "<node_internals>/**"
        ],
        "program": "${workspaceFolder}/out/code.js",
        "outFiles": [
            "${workspaceFolder}/out/*.js"
        ],
        "runtimeVersion": "default",
        "runtimeExecutable": nodeBinPath,
        "sourceMaps": true,
        "args": [
            "${file}"
        ],
        "preLaunchTask": "algorithm: build"
    }
}

export function checkBeforeDebug(filePath: string): boolean {
    const lang = getFileLang(filePath)
    if (lang === CodeLang.TypeScript) {
        if (InstallState.installEsbuild || !checkEsbuildDir()) {
            log.appendLine('wait downloading esbuild')
            return false
        }
    }
    return true
}

export function sortFiles(files: MemoFile[]) {
    files.sort((q1, q2) => {
        const fid1: string = q1.name;
        const fid2: string = q2.name;
        const sortOrder = ['LCP', '剑指 Offer', '面试题']
        let weight1 = sortOrder.findIndex(prefix => fid1.startsWith(prefix))
        let weight2 = sortOrder.findIndex(prefix => fid2.startsWith(prefix))
        if (weight1 !== weight2) {
            return weight1 - weight2
        } else {
            if (weight1 !== -1) {
                return fid1.localeCompare(fid2)
            }
            return parseInt(fid1) - parseInt(fid2)
        }
    });
}
export function sortQuestions(questions: ConciseQuestion[]) {
    questions.sort((q1, q2) => {
        const fid1: string = q1.fid;
        const fid2: string = q2.fid;
        const sortOrder = ['LCP', '剑指 Offer', '面试题']
        let weight1 = sortOrder.findIndex(prefix => fid1.startsWith(prefix))
        let weight2 = sortOrder.findIndex(prefix => fid2.startsWith(prefix))
        if (weight1 !== weight2) {
            return weight1 - weight2
        } else {
            if (weight1 !== -1) {
                return fid1.localeCompare(fid2)
            }
            return parseInt(fid1) - parseInt(fid2)
        }
    });
}
export function reRequire(moduleName: string) {
    delete require.cache[moduleName]
    return require(moduleName)
}

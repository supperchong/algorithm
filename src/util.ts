import * as vscode from 'vscode';
import { window } from 'vscode';
import { transformAsync } from "@babel/core"
import { generateAddTestCommentPlugin } from './babelPlugin'
import { langMap, LangBase, getFileLang, CodeLang } from './common/langConfig';
import { ParseContent } from './common/parseContent'
import { config, updateConfig, updateEnv, InstallState, log } from './config'
import { tag } from 'pretty-tag'
import { Question, CodeSnippet } from './model/question.cn';
import { AskForImportState } from './model/common';
import { MemoFile } from './model/memo';

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
interface MetaData {
    name: string,
    params: Param[],
    return: ReturnType
}
// enum MessagePick{
//     Yes='Yes',
//     No='No',
//     Later='Later'
// }

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
export function preprocessCode({ questionId, codeSnippets, metaData, content, titleSlug, questionSourceContent }: Question, weekname: string = '', codeSnippet: CodeSnippet) {

    const { codeLang } = config

    let testCases = ParseContent.getTestCases(questionSourceContent || content);
    const langSlug = codeSnippet.langSlug;
    const langConfig = langMap[langSlug];
    const algorithmPath = config.algmModuleDir.replace(/\\/g, '\\\\')
    const weektag = weekname ? `weekname=${weekname}` : ''
    const supportImport = ['JavaScript', 'TypeScript'].includes(langConfig.lang)
    const shouldImport = supportImport && config.autoImportAlgm
    const importStr = shouldImport ? `import * as a from '${algorithmPath}'` : ''
    const autoImportStr = config.autoImportStr || ''
    const flag = tag`
            ${langConfig.comment} @algorithm @lc id=${questionId} lang=${langSlug} ${weektag}
            ${langConfig.comment} @title ${titleSlug}
            ${importStr}
            ${autoImportStr}
        `;
    const metaDataParse: MetaData = JSON.parse(metaData);
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
        if (InstallState.installEsbuild) {
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
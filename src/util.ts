import * as vscode from 'vscode';
import { window } from 'vscode';
import { transformAsync } from "@babel/core"
import { generateAddTestCommentPlugin } from './babelPlugin'
import { langMap, LangBase } from './common/langConfig';
import { ParseContent } from './common/parseContent'
import { config } from './config'
import { tag } from 'pretty-tag'
import { Question, CodeSnippet } from './model/question.cn';

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
export function preprocessCode({ questionId, codeSnippets, metaData, content, titleSlug, questionSourceContent }: Question, weekname: string = '', codeSnippet: CodeSnippet) {

    const { codeLang } = config

    let testCases = ParseContent.getTestCases(questionSourceContent || content);
    const langSlug = codeSnippet.langSlug;
    const langConfig = langMap[langSlug];
    const algorithmPath = config.algmModuleDir.replace(/\\/g, '\\\\')
    const weektag = weekname ? `weekname=${weekname}` : ''
    const supportImport = config.autoImportAlgm && ['JavaScript', 'TypeScript'].includes(langConfig.lang)
    const importStr = supportImport ? `import * as a from '${algorithmPath}'` : ''
    const autoImportStr = supportImport ? config.autoImportStr : ''
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
import * as path from 'path'
import { parseTestCase, TestCase, TestResult, normalize, getResultType, getFuncNames, deserializeParam, QuestionMeta, retry } from './common/util';
import { appendComment, checkBeforeDebug, execWithProgress, execWithProgress2, getDebugConfig } from './util';
import { log, updateConfig } from './config';
import { window, ExtensionContext } from 'vscode';
import rollup = require('rollup');
import resolve from '@rollup/plugin-node-resolve';
import rollupBabelPlugin from '@rollup/plugin-babel';
import virtual = require('@rollup/plugin-virtual');
import { createPanel } from './webview/buildCodeWebview';
import babel = require('@babel/core');
import { api, freshQuestions } from './api/index'
import * as vscode from 'vscode';
import cp = require('child_process');
import { execTestChildProcess } from './execTestCode';
import { QuestionsProvider, QuestionTree } from './provider/questionsProvider';
import { cache } from './cache';
import { CheckResponse, ErrorStatus, Lang } from './model/common';
import { outBoundArrayPlugin } from './babelPlugin'
import { addComment } from './common/transformCode';
import { config } from './config'
import { githubInput, selectLogin } from './login/input'
import { githubLogin } from './login';
import presetTs = require('@babel/preset-typescript')
import { getQuestionDescription } from './webview/questionPreview';
import { CodeLang, getFileLang, langExtMap } from './common/langConfig';
import { normalizeQuestionLabel, writeFileAsync } from './common/util'
import { MemoFile } from './model/memo'
import { addFolder, addFolderFile, addQuestion } from './memo/index'
import { MemoProvider, MemoTree } from './provider/memoProvider';
import { ResolverParam } from './provider/resolver'
import { Service } from './lang/common'

interface PlainObject {
    [key: string]: any
}
type Requred<T, R extends keyof T> = {
    [key in R]-?: T[key]
} & {
        [key in keyof T]: T[key]
    };
function checkParams<T, R extends keyof T>(obj: T, attrs: R[]): asserts obj is Requred<T, R> {
    let verify = attrs.every(attr => !!obj[attr]);
    if (!verify) {
        throw new Error('options error options:' + JSON.stringify(obj) + ',attrs:' + attrs);
    }
}
export async function testCodeCommand(line: number, testCase: TestCase, funcName: string, paramsTypes: string[], resultType: string, filepath: string) {
    try {
        const codeLang = getFileLang(filepath)
        if (codeLang === CodeLang.JavaScript || codeLang === CodeLang.TypeScript) {
            const promise = execTestChildProcess({
                line, testCase, funcName, paramsTypes, resultType, filepath
            });
            const msg = await execWithProgress(promise, 'wait test');
            log.appendLine(msg);
            log.show()
        } else if (codeLang === CodeLang.Python3) {
            const service = new Service(filepath)
            const promise = service.execTest(testCase)
            const msg = await execWithProgress(promise, 'wait test');
            log.appendLine(msg);
            log.show()
        }

    } catch (err) {
        console.log(err);
        window.showInformationMessage(`parse params err: ${err}`);
    }
}
async function openFolder() {

    const items = ['open questions folder in new window', 'open questions folder in current window', 'add questions folder at the start of workspace folders']

    let uri = vscode.Uri.file(config.baseDir);
    const pickItem = await window.showQuickPick(items)
    if (pickItem === items[0]) {
        let uri = vscode.Uri.file(config.baseDir);
        return vscode.commands.executeCommand('vscode.openFolder', uri, { forceNewWindow: true })
    } else if (pickItem === items[1]) {
        return vscode.commands.executeCommand('vscode.openFolder', uri, { forceNewWindow: false })
    } else if (pickItem === items[2]) {
        return vscode.workspace.updateWorkspaceFolders(0, 0, { uri });
    }
}
export async function debugCodeCommand(filePath: string) {
    const { nodeBinPath } = config
    let uri = vscode.Uri.file(config.baseDir);
    let p = vscode.workspace.getWorkspaceFolder(uri)
    const workspaceFolders = vscode.workspace.workspaceFolders
    if (!workspaceFolders?.find(w => w.uri === p?.uri)) {
        return openFolder()
    }
    console.log(filePath)
    const breaks = vscode.debug.breakpoints as vscode.SourceBreakpoint[]
    if (!breaks.find(b => b?.location?.uri.fsPath === filePath)) {
        console.log('breakpoint not found')
        window.showErrorMessage('please set breakpoint')
        return
    }
    if (!checkBeforeDebug(filePath)) {
        return
    }
    const codeLang = getFileLang(filePath)

    if (codeLang === CodeLang.JavaScript || codeLang === CodeLang.TypeScript) {
        const debugConfiguration = getDebugConfig()

        vscode.debug.startDebugging(p, debugConfiguration)
    } else {
        const service = new Service(filePath)
        service.debugCodeCommand(p!, breaks)
    }


}
export async function buildCodeCommand(context: ExtensionContext, text: string, filePath: string) {
    const { code } = await buildCode(text, filePath)
    createPanel(context, code);
}
export async function submitCommand(questionsProvider: QuestionsProvider, text: string, filePath: string) {
    let message = '';
    try {
        const { result, questionMeta } = await execWithProgress(submitCode(text, filePath), 'wait submit');

        message = result.status_msg;
        if (message === 'Accepted') {
            cache.updateQuestion(parseInt(questionMeta.id), { status: 'ac' });
            questionsProvider.refresh();
        } else {
            if (result.status_code === 11) {
                //'Wrong Answer'
                let inputLength = result?.input_formatted?.length || 0
                const maxLength = 300
                if (inputLength <= maxLength) {
                    let msg = `× @test(${result.input_formatted})  result: ${result.code_output} ,expect: ${result.expected_output}\n`;
                    log.appendLine(msg);
                    log.show()
                    if (questionMeta.id) {
                        const questionDetail = await api.fetchQuestionDetailById(questionMeta.id)
                        try {
                            if (questionDetail) {
                                const metaData = JSON.parse(questionDetail.metaData)
                                const funcName = metaData.name
                                const comment = ` @test(${result.input_formatted})=${result.expected_output}`
                                const newCode = addComment(text, comment, funcName)
                                await writeFileAsync(filePath, newCode)
                            }

                        } catch (err) {
                            console.log('parse questionDetail error', questionDetail)
                        }

                    }
                }


            }
        }
        console.log(result);
        window.showInformationMessage(message);

    } catch (err) {
        if ([ErrorStatus.InvalidCookie, ErrorStatus.Unlogin].includes(err?.response?.status)) {
            return
        }
        console.log(err);
        message = err.message;

    }

    window.showInformationMessage(message);


}
async function submitCode(text: string, filePath: string) {
    const buildResult = await buildCode(text, filePath);

    const code = buildResult.code;
    const questionMeta = buildResult.questionMeta;
    const result = await submitAsync(code, questionMeta);
    return {
        result,
        code,
        questionMeta
    };
}
// TODO
async function submitContest(code: string, questionMeta: QuestionMeta): Promise<any> {
    checkParams(questionMeta, ['titleSlug', 'id', 'weekname']);

    const res = await api.submitContest({
        titleSlug: questionMeta.titleSlug,
        question_id: questionMeta.id,
        typed_code: code,
        weekname: questionMeta.weekname
    });
    if (!res.submission_id) {
        console.log('submit res', res);
        log.appendLine(res as any);

        return Promise.reject(new Error('submit error'));
    }
    let fn = async () => {
        const res2 = await api.checkContest({
            submission_id: res.submission_id,
            titleSlug: questionMeta.titleSlug,
            weekname: questionMeta.weekname
        });
        if (['STARTED', 'SUCCESS', 'PENDING'].includes(res2.state)) {
            return res2;
        } else {
            return Promise.reject(new Error(res2.status_msg));
        }
    };
    let verifyFn = (res: CheckResponse) => res.state === 'SUCCESS';
    const result = await retry({ fn, verifyFn, time: 5 });
    return result;
}
async function submitAsync(code: string, questionMeta: QuestionMeta): Promise<any> {
    checkParams(questionMeta, ['titleSlug', 'id']);
    const { titleSlug, id } = questionMeta;
    const res = await api.submit({
        titleSlug: titleSlug,
        question_id: id,
        typed_code: code,
        lang: questionMeta.lang
    });
    if (!res.submission_id) {
        console.log('submit res', res);
        log.appendLine(res as any);
        log.show()
        return Promise.reject(new Error('submit error'));
    }
    let fn = async () => {
        const res2 = await api.check({
            submission_id: res.submission_id,
            titleSlug: titleSlug
        });
        if (['PENDING', 'STARTED', 'SUCCESS'].includes(res2.state)) {
            return res2;
        } else {
            console.log('check res', res2);
            log.appendLine(JSON.stringify(res2));
            return Promise.reject(new Error('submit error'));
        }
    };
    let verifyFn = (res: CheckResponse) => res.state === 'SUCCESS';
    const result = await retry({ fn, verifyFn, time: 6 });
    return result;
}
interface BuildCode {
    code: string,
    questionMeta: QuestionMeta
}
export async function buildCode(text: string, filePath: string): Promise<BuildCode> {
    const lang = getFileLang(filePath)

    if (lang === CodeLang.JavaScript) {
        return buildJsCode(text, filePath)
    }
    if (lang === CodeLang.TypeScript) {
        return buildTsCode(text, filePath)
    }
    const service = new Service(filePath, text)

    return service.buildCode()
}

export async function buildJsCode(text: string, filePath: string) {
    try {
        const { funcNames, questionMeta } = getFuncNames(text, filePath);
        const funcRunStr = 'console.log(' + funcNames.map(f => f + '()').join('+') + ')';
        // The rollup will not transform code in virtual entry
        let entry: any = await babel.transformAsync(text, {
            comments: false,
            compact: false,
            plugins: [outBoundArrayPlugin]
        });
        entry = entry?.code + `\n${funcRunStr}`;
        const bundle = await rollup.rollup({
            input: 'entry',

            treeshake: true,
            plugins: [
                // It use virtual entry because treeshake will remove unuse code.
                virtual({
                    entry: entry
                }),
                resolve(),
                rollupBabelPlugin({
                    babelHelpers: 'bundled',
                    comments: false,
                    shouldPrintComment: () => false
                },
                )
            ]
        });
        const { output } = await bundle.generate({});
        let code = output[0].code;
        code = code.replace(funcRunStr, '').replace(/;\s*$/, '');
        return {
            code,
            questionMeta
        };
    } catch (err) {
        console.log('err:', err);
        window.showInformationMessage(`parse params err: ${err}`);
        return {
            code: '',
            questionMeta: {}
        };
    }
}
export async function buildTsCode(text: string, filePath: string) {
    try {
        const { funcNames, questionMeta } = getFuncNames(text, filePath);
        const funcRunStr = 'console.log(' + funcNames.map(f => f + '()').join('+') + ')';
        // The rollup will not transform code in virtual entry
        let entry: any = await babel.transformAsync(text, {
            filename: filePath,
            comments: false,
            compact: false,
            presets: [presetTs],
            plugins: [outBoundArrayPlugin]
        });
        entry = entry?.code + `\n${funcRunStr}`;
        const bundle = await rollup.rollup({
            input: 'entry',

            treeshake: true,
            plugins: [
                // It use virtual entry because treeshake will remove unuse code.
                virtual({
                    entry: entry
                }),
                resolve(),
                rollupBabelPlugin({
                    babelHelpers: 'bundled',
                    comments: false,
                    shouldPrintComment: () => false
                },
                )
            ]
        });
        const { output } = await bundle.generate({});
        let code = output[0].code;
        code = code.replace(funcRunStr, '').replace(/;\s*$/, '');
        return {
            code,
            questionMeta
        };

    } catch (err) {
        console.log('err:', err);
        window.showInformationMessage(`parse params err: ${err}`);
        return {
            code: '',
            questionMeta: {}
        };
    }
}

export async function getDescriptionCommand(extensionPath: string, text: string, filePath: string) {
    const { questionMeta } = getFuncNames(text, filePath);
    getQuestionDescription(extensionPath, {
        questionId: questionMeta.id,
        titleSlug: questionMeta.titleSlug,
        weekname: questionMeta.weekname
    })
}

export async function freshCommand(questionsProvider: QuestionsProvider) {
    const promise = freshQuestions();
    await execWithProgress2(promise, '');
    questionsProvider.refresh();
}

export async function signInCommand() {
    try {
        await selectLogin()
    } catch (err) {
        if (err.code !== 2) {
            window.showInformationMessage(err.message)
        }
    }

}

class LangItem implements vscode.QuickPickItem {

    constructor(public label: string, public description: string, public detail: string) {
    }
}
export async function switchEndpointCommand(questionsProvider: QuestionsProvider) {
    const LangConfigs = [{
        lang: Lang.en,
        label: 'Leetcode',
        description: 'leetcode.com',
        detail: 'Enable Leetcode US'
    }, {
        lang: Lang.cn,
        label: '力扣',
        description: 'leetcode-cn.com',
        detail: '启用中国版Leetcode'
    }]
    const items = LangConfigs.map(langConfig => {
        if (langConfig.lang === config.lang) {
            return new LangItem('$(check)' + langConfig.label, langConfig.description, langConfig.detail)
        }
        return new LangItem(langConfig.label, langConfig.description, langConfig.detail)
    })
    const [itemEN, itemCN] = items
    const result = await window.showQuickPick<LangItem>(items);
    if (result === itemEN) {
        updateConfig('lang', Lang.en)
    } else if (result === itemCN) {
        updateConfig('lang', Lang.cn)
    }

}

class CodeLangItem implements vscode.QuickPickItem {

    constructor(public label: string, public description: string) {
    }
}
export async function switchCodeLangCommand(questionsProvider: QuestionsProvider) {
    const langs: CodeLang[] = [CodeLang.JavaScript, CodeLang.TypeScript, CodeLang.Python3]
    const curLang = config.codeLang
    const langLabels = langs.map(lang => {
        if (lang === curLang) {
            return new CodeLangItem(lang, '$(check)')
        }
        return new CodeLangItem(lang, '')
    })
    const pickItem = await window.showQuickPick(langLabels)
    const pickIndex = langLabels.findIndex(v => v === pickItem)
    if (pickIndex !== -1) {
        const pickLang = langs[pickIndex]
        updateConfig('codeLang', pickLang)
    }
}

export async function searchCommand() {
    const questions = await api.getAllQuestions()
    const items = questions.map(v => normalizeQuestionLabel(v))
    const pickItem = await window.showQuickPick(items)
    const index = items.findIndex(item => item === pickItem)
    if (index !== -1) {
        const question = questions[index]
        const param = {
            id: question.id,
            titleSlug: question.slug
        }
        vscode.commands.executeCommand('algorithm.questionPreview', param)
    }
}
export async function addFolderCommand(memoProvider: MemoProvider) {
    const folderName = await window.showInputBox()
    if (folderName) {
        try {
            addFolder(folderName)
            memoProvider.refresh()
        } catch (err) {
            log.appendLine(err)
            log.show()
        }

    }
}

export async function memoFilePreviewCommand(memoFile: MemoFile) {
    if (memoFile.type === 'question') {
        vscode.commands.executeCommand('algorithm.questionPreview', memoFile.param)

    } else if (memoFile.type === 'other') {

    }
}

export async function addMemoFileCommand(memoProvider: MemoProvider, questionTree: QuestionTree) {
    const folderNames = config.env.memo.map(v => v.name)
    const folderName = await window.showQuickPick(folderNames)
    if (folderName) {
        try {
            addQuestion(folderName, questionTree.label, questionTree.param as Partial<ResolverParam>)
            memoProvider.refresh()
        } catch (err) {
            log.appendLine(err)
            log.show()
        }
    }
}

export async function removeMemoFileCommand(memoProvider: MemoProvider, param: MemoTree) {
    const isRemove = await MemoProvider.remove(param)
    if (isRemove) {
        memoProvider.refresh()
    }
}
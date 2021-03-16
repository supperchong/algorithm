
import { parse } from 'pretty-object-string';
import fs = require('fs');
import { promisify } from 'util';
import vm = require('vm');
import { Question, CodeSnippet } from '../model/question.cn';
import { ConciseQuestion } from '../model/common';
import * as path from 'path'
import axios from 'axios'
import * as compressing from "compressing";

const cheerio = require('cheerio');
const access = promisify(fs.access);
const mkdir = promisify(fs.mkdir);
const writeFileAsync = promisify(fs.writeFile);
const rename = promisify(fs.rename)
const rmdir = promisify(fs.rmdir)
const isSpace = (s: string) => /\s/.test(s);
const algorithmToken = '// @algorithm';
const testRegExp = /^\/\/\s*@test\([^\)]*\)/;
const funcRegExp = /^(?:(\s*function)|(.*=\s*function))/;
const paramMetaRegExp = /@param {([^}]+)}/;
const returnRegExp = /@return {([^}]+)}/;
const lcToken = /^\/\/ @algorithm @lc id=(\d+) lang=([\w+#]+)(?:\sweekname=([\w-]+))?/;
const titleSlugToken = /^\/\/ @title ([\w-]+)/;
const funcNameRegExp = /^(?:\s*function\s*([\w]+)\s*|\s*(?:(?:var|let|const)\s+([\w]+)\s*=\s*)?function)/;
export type TestCase = string[];
export { writeFileAsync };
export interface TestCaseParam {
    line: number
    testCase: TestCase
    funcName: string
    paramsTypes: string[]
    resultType: string
}
export interface Args {
    args: string[]
    result: string
}
export async function writeFile(filepath: string, data: any) {
    const dir = path.dirname(filepath)
    await fs.promises.mkdir(dir, { recursive: true })
    return writeFileAsync(filepath, data)
}
export function mkdirSync(dir: string) {
    fs.mkdirSync(dir, { recursive: true })
}
export function writeFileSync(filepath: string, data: any, options: fs.WriteFileOptions) {
    fs.mkdirSync(path.dirname(filepath), { recursive: true })
    fs.writeFileSync(filepath, data, options)
}
export function normalizeQuestionLabel(question: ConciseQuestion) {
    return question.fid + '. ' + question.name
}
export function normalizeQuestions(questions: ConciseQuestion[], type: string) {
    return questions.map(question => {
        const isAC = question.status === 'ac'
        return {
            type: 'Question',
            label: normalizeQuestionLabel(question),
            id: type + question.id,
            isLast: true,
            isAC,
            param: {
                titleSlug: question.slug,
                questionId: question.id,
            }
        }
    }
    );
}
function detectEnableExt(text: string): boolean {
    let point = 0;
    while (isSpace(text[point])) {
        point++;
    }
    for (let i = 0; i < algorithmToken.length; i++) {
        if (text[point++] !== algorithmToken[i]) {
            return false;
        }
    }
    return true;

}
function getTestCaseList(text: string): Array<TestCaseParam> {
    let testCaseList: TestCaseParam[] = [];
    const lines = text.split(/\n/);
    let isTest = false;
    let testCase: TestCase = [];
    let paramsTypes: string[] = [];
    let resultType: string = '';
    for (let i = 0; i < lines.length; i++) {
        if (testRegExp.test(lines[i])) {
            isTest = true;
            testCase.push(lines[i]);
        } else if (funcRegExp.test(lines[i])) {
            if (isTest) {
                let match = lines[i].match(funcNameRegExp);
                if (match) {
                    let funcName = match[1] || match[2];

                    testCaseList.push({
                        line: i,
                        testCase,
                        funcName,
                        paramsTypes: [...paramsTypes],
                        resultType: resultType
                    });
                    paramsTypes = [];
                    resultType = '';
                }

                isTest = false;
                testCase = [];
            }
        } else if (paramMetaRegExp.test(lines[i])) {
            let match = lines[i].match(paramMetaRegExp);
            if (match) {
                paramsTypes.push(match[1]);
            }

        } else if (returnRegExp.test(lines[i])) {
            let match = lines[i].match(returnRegExp);
            if (match) {
                resultType = match[1];
            }
        }
    }
    return testCaseList;
}
export interface QuestionMeta {
    id?: string,
    lang?: string,
    titleSlug?: string,
    weekname?: string
}
interface FunNamesMeta {
    funcNames: string[],
    questionMeta: QuestionMeta
}
function parseCode(text: string): FunNamesMeta {
    const lines = text.split(/\n/);
    const funcNames: string[] = [];
    let questionMeta: QuestionMeta = {};
    for (let i = 0; i < lines.length; i++) {
        if (lcToken.test(lines[i])) {
            const match = lines[i].match(lcToken) as RegExpMatchArray;
            let id = match[1];
            let lang = match[2];
            let weekname = match[3];
            questionMeta.id = id;
            questionMeta.lang = lang;
            questionMeta.weekname = weekname;
        } else if (titleSlugToken.test(lines[i])) {
            const match = lines[i].match(titleSlugToken) as RegExpMatchArray;
            questionMeta.titleSlug = match[1];
        } else {
            const match = lines[i].match(funcNameRegExp);
            if (match) {
                const funcName = match[1] || match[2];
                funcNames.push(funcName);
            }
        }

    }
    return {
        funcNames,
        questionMeta
    };
}

export async function existDir(dir: string): Promise<boolean> {
    try {
        await access(dir, fs.constants.F_OK | fs.constants.W_OK);
        return true;
    } catch (err) {
        if (err.code === 'ENOENT') {
            await mkdir(dir);
            return false;
        }
        throw err;
    }

}
export function existDirSync(dir: string) {
    try {
        fs.accessSync(dir, fs.constants.F_OK | fs.constants.W_OK);
        return true;
    } catch (err) {
        if (err.code === 'ENOENT') {
            fs.mkdirSync(dir);
            return false;
        }
        throw err;
    }
}
export async function existFile(filepath: string): Promise<boolean> {
    try {
        await access(filepath, fs.constants.F_OK | fs.constants.W_OK);
        return true;
    } catch (err) {
        if (err.code === 'ENOENT') {
            await writeFile(filepath, Buffer.alloc(0))
            return true;
        }
        throw err;
    }
}
export function existFileSync() {

}
export async function isExist(filepath: string): Promise<boolean> {
    try {
        await access(filepath, fs.constants.F_OK | fs.constants.W_OK);
        return true;
    } catch (err) {
        if (err.code === 'ENOENT') {
            return false;
        }
        throw err;
    }
}

export function parseHtml(html: string): Question | null {
    const $ = cheerio.load(html, { decodeEntities: false });
    const translatedContent = $('.question-content.default-content').html().trim();
    const content = translatedContent
    let scripts = $("script").filter(function () {
        const text = $(this).html();
        return text.includes("pageData") && text.includes("questionId");
    });
    const questionFrontendId = parseInt($(".question-title h3").html());
    let question = null;
    if (scripts.length === 1) {
        let text = scripts.html();
        const Script = vm.Script;
        const script = new Script(text + ";pageData");

        const result = script.runInNewContext();
        if (result) {
            question = {
                ...result,
                translatedContent,
                questionFrontendId,
                metaData: JSON.stringify(result.metaData),
                title: result.questionTitle || result.translatedTitle,
                translatedTitle: result.questionTitle || result.translatedTitle,
                content,
                titleSlug: result.questionTitleSlug,
                codeSnippets: result.codeDefinition.map((v: any) => ({
                    code: v.defaultCode || v.code,
                    lang: v.text || v.lang,
                    langSlug: v.value || v.langSlug
                }))
            };
        }
    }
    return question;
}
export function escape2html(str: string) {
    let map = { 'lt': '<', 'gt': '>', 'nbsp': ' ', 'amp': '&', 'quot': '"', '#39': "'" };
    return str.replace(/&(lt|gt|nbsp|amp|quot|#39);/g, (_, key) => map[key]);
}
export function combineCodeTest() {

}
async function sleep(ms: number) {
    return new Promise((resolve, reject) => {
        return setTimeout(resolve, ms);
    });

}
export async function retry({ fn, time = 1, delay = 1000, verifyFn }) {
    let count = time | 0;
    while (count > 0) {
        count--;
        await sleep(delay);
        let result = await fn();
        if (verifyFn(result)) {
            return result;
        }

    }
    return Promise.reject(new Error('retry timeout'));

}


function parseTestCase(testCase: TestCase): Args[] {
    let caseList: Args[] = [];
    for (const argsLiteral of testCase) {
        caseList.push(parseCommentTest(argsLiteral));
    }
    return caseList;
}
function parseCommentTest(testComment: string): Args {
    let index = testComment.indexOf("@test") + 4;
    let params: any[] = [];
    let result = '';
    while (testComment[++index]) {
        if (testComment[index] === '(') {
            index++;
            break;
        }
    }
    let { index: pos } = parse(testComment.slice(index), { partialIndex: true });
    while (pos) {
        pos = pos + index;
        let param = testComment.slice(index, pos);
        // param = JSON.parse(param)
        params.push(param);
        if (testComment[pos] === ',') {
            index = pos + 1;
            pos = parse(testComment.slice(index), { partialIndex: true }).index;
        } else if (testComment[pos] === ')') {
            index = pos;
            break;
        } else {
            console.log(testComment.slice(pos - 10, pos));
            throw new Error('parse CommentTest error:' + testComment);
        }

    }
    while (testComment[++index]) {
        if (testComment[index] === '=') {
            index++;
            break;
        }
    }

    pos = parse(testComment.slice(index), { partialIndex: true }).index;
    if (pos) {
        result = testComment.slice(index, pos + index);
    }
    return {
        args: params,
        result
    };


}
export function normalize(result: any, returnType: string) {
    if (['TreeNode', 'ListNode'].includes(returnType)) {
        return result;
    } else {
        return JSON.stringify(result);
    }
}
export function parseLink() {

}
export function deserializeParam(args: string[], paramsTypes: string[]) {
    let hasTree = false;
    let hasList = false;
    for (let i = 0; i < paramsTypes.length; i++) {
        let paramType = paramsTypes[i];
        if (paramType === 'TreeNode') {
            hasTree = true;
            args[i] = `treeNode.deserialize("${args[i]}")`;
        } else if (/TreeNode/.test(args[i])) {
            console.warn('deserialize param meeting problem,args:', args[i]);
        } else if (paramType === 'ListNode') {
            hasList = true;
            args[i] = `listNode.deserialize("${args[i]}")`;
        } else if (/ListNode/.test(args[i])) {
            console.warn('deserialize param meeting problem,args:', args[i]);
        }
    }
    return {
        hasTree,
        hasList

    };
}
export function getResultType(resultType: string): string {
    if (resultType === 'TreeNode') {
        return 'TreeNode';
    } else if (resultType === 'ListNode') {
        return 'ListNode';
    } else if (/TreeNode|ListNode/.test(resultType)) {
        console.warn('deserialize result meeting problem,resultType:', resultType);
    }
    return "";
}
export interface TestResult {
    args: string
    expect: string
    result: string
}
export function setLinePrefix(str: string, prefix: string) {
    return str.split('\n').map(line => prefix + line).join('\n')
}
export async function downloadNpm(name: string, moduleDir: string) {
    const url = 'https://registry.npmjs.org/' + name

    try {
        const randomName = Math.random().toString(32).slice(2)
        const targetDir = path.join(moduleDir, name)
        const tempDir = path.join(moduleDir, '.temp', randomName)
        const res = await axios.request({
            url,
        })
        const data = res.data
        const latestVersion = data["dist-tags"]["latest"]
        const fileUrl = data["versions"][latestVersion]["dist"]["tarball"]

        const res2 = await axios.get(fileUrl, { responseType: 'stream' })
        const stream = res2.data



        await compressing.tgz.uncompress(stream, tempDir)
        await rename(
            path.join(tempDir, "package"),
            path.join(targetDir),
        )
        await rmdir(tempDir)
    } catch (err) {
        console.log(err)
    }
}
export { detectEnableExt, getTestCaseList, parseTestCase, parseCode as getFuncNames };
import { parse } from 'pretty-object-string'
import fs = require('fs')
import fse = require('fs-extra')
import { promisify } from 'util'
import vm = require('vm')
import { SubmissionDetailPageData } from '../model/question'
import { CnContestPageData, CodeDefinition, CommonQuestion, ConciseQuestion } from '../model/common'
import * as path from 'path'
import axios from 'axios'
import * as compressing from 'compressing'
import { getFileComment } from './langConfig'
import * as cp from 'child_process'
import { tag } from 'pretty-tag'
import { LanguageMetaData } from './lang'

import rimraf = require('rimraf')
import cheerio = require('cheerio')
const access = promisify(fs.access)
const mkdir = promisify(fs.mkdir)
const writeFileAsync = promisify(fs.writeFile)
const readFileAsync = promisify(fs.readFile)
const execFileAsync = promisify(cp.execFile)
const isSpace = (s: string) => /\s/.test(s)
const testRegExp = /\/\/\s*@test\(((?:"(?:\\.|[^"])*"|[^)])*)\)/
const funcRegExp = /^(?:(\s*function)|(.*=\s*function))/
const paramMetaRegExp = /@param {([^}]+)}/
const returnRegExp = /@return {([^}]+)}/
export const funcNameRegExp = /^(?:\s*function\s*([\w]+)\s*|\s*(?:(?:var|let|const)\s+([\w]+)\s*=\s*)?function)/
export const tsFunctionRegExp = /function\s+(\w+)\((.*)\)\s*(?::(.+))?{/
export const isTreeNode = (str: string) => /^TreeNode\s*(\|\s*null)?$/.test(str)
export const isListNode = (str: string) => /^ListNode\s*(\|\s*null)?$/.test(str)
export type TestCase = string[]
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
export type CaseList = Args[]
export function isVersionGte(v1: string, v2: string) {
	const arr1 = v1.split('.')
	const arr2 = v2.split('.')
	for (let i = 0; i < arr1.length; i++) {
		if (arr1[i] > arr2[i]) {
			return true
		} else if (arr1[i] < arr2[i]) {
			return false
		}
	}
	return true
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function writeFile(filepath: string, data: any) {
	const dir = path.dirname(filepath)
	await fs.promises.mkdir(dir, { recursive: true })
	return writeFileAsync(filepath, data)
}
export function mkdirSync(dir: string) {
	fs.mkdirSync(dir, { recursive: true })
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function writeFileSync(filepath: string, data: any, options: fs.WriteFileOptions) {
	fs.mkdirSync(path.dirname(filepath), { recursive: true })
	fs.writeFileSync(filepath, data, options)
}
export function normalizeQuestionLabel(question: ConciseQuestion) {
	return question.fid + '. ' + question.name
}
export function normalizeQuestions(questions: ConciseQuestion[], type: string) {
	return questions.map((question) => {
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
			},
		}
	})
}

function detectEnableExt(text: string, filePath: string): boolean {
	const commentToken = getFileComment(filePath)
	const algorithmToken = `${commentToken} @algorithm`
	let point = 0
	while (isSpace(text[point])) {
		point++
	}
	for (let i = 0; i < algorithmToken.length; i++) {
		if (text[point++] !== algorithmToken[i]) {
			return false
		}
	}
	return true
}
function getJsTestCaseList(text: string): Array<TestCaseParam> {
	const testCaseList: TestCaseParam[] = []
	const lines = text.split(/\n/)
	let isTest = false
	let testCase: TestCase = []
	let paramsTypes: string[] = []
	let resultType = ''
	for (let i = 0; i < lines.length; i++) {
		if (testRegExp.test(lines[i])) {
			isTest = true
			testCase.push(lines[i])
		} else if (funcRegExp.test(lines[i])) {
			if (isTest) {
				const match = lines[i].match(funcNameRegExp)
				if (match) {
					const funcName = match[1] || match[2]

					testCaseList.push({
						line: i,
						testCase,
						funcName,
						paramsTypes: [...paramsTypes],
						resultType: resultType,
					})
					paramsTypes = []
					resultType = ''
				}

				isTest = false
				testCase = []
			}
		} else if (paramMetaRegExp.test(lines[i])) {
			const match = lines[i].match(paramMetaRegExp)
			if (match) {
				paramsTypes.push(match[1])
			}
		} else if (returnRegExp.test(lines[i])) {
			const match = lines[i].match(returnRegExp)
			if (match) {
				resultType = match[1]
			}
		}
	}
	return testCaseList
}
function trimParams(param: string) {
	return param
		.split(',')
		.map((v) => v.split(':')[1])
		.map((str) => str && str.trim())
}
function trimResultType(resultType: string | undefined) {
	return resultType && resultType.trim()
}
export function parseTsFunctionType(line: string) {
	const match = line.match(tsFunctionRegExp)
	if (match) {
		return {
			funcName: match[1],
			paramsTypes: trimParams(match[2]),
			resultType: trimResultType(match[3]) || '',
		}
	}
	return null
}
function getTsTestCaseList(text: string) {
	const testCaseList: TestCaseParam[] = []
	let testCase: TestCase = []
	let isTest = false
	const lines = text.split(/\n/)
	for (let i = 0; i < lines.length; i++) {
		if (testRegExp.test(lines[i])) {
			isTest = true
			testCase.push(lines[i])
		} else {
			if (isTest) {
				const tsFunctionType = parseTsFunctionType(lines[i])
				if (tsFunctionType) {
					const { funcName, paramsTypes, resultType } = tsFunctionType
					testCaseList.push({
						line: i,
						testCase,
						funcName,
						paramsTypes: [...paramsTypes],
						resultType: resultType,
					})
					isTest = false
					testCase = []
				}
			}
		}
	}
	return testCaseList
}
export interface QuestionMeta {
	id?: string
	lang?: string
	titleSlug?: string
	weekname?: string
	desc?: string
}
interface FunNamesMeta {
	funcNames: string[]
	questionMeta: QuestionMeta
}
function parseCode(text: string, filePath: string): FunNamesMeta {
	const lines = text.split(/\n/)
	const funcNames: string[] = []
	const comment = getFileComment(filePath)
	const lcToken =
		comment === '//'
			? /^\/\/ @algorithm @lc id=(\d+) lang=([\w+#]+)(?:\sweekname=([\w-]+))?/
			: /^# @algorithm @lc id=(\d+) lang=([\w+#]+)(?:\sweekname=([\w-]+))?/
	const titleSlugToken = comment === '//' ? /^\/\/ @title ([\w-]+)/ : /^# @title ([\w-]+)/
	const descToken = comment === '//' ? /^\/\/ @desc (.+)/ : /^# @desc (.+)/
	const questionMeta: QuestionMeta = {}
	for (let i = 0; i < lines.length; i++) {
		if (lcToken.test(lines[i])) {
			const match = lines[i].match(lcToken) as RegExpMatchArray
			const id = match[1]
			const lang = match[2]
			const weekname = match[3]
			questionMeta.id = id
			questionMeta.lang = lang
			questionMeta.weekname = weekname
		} else if (titleSlugToken.test(lines[i])) {
			const match = lines[i].match(titleSlugToken) as RegExpMatchArray
			questionMeta.titleSlug = match[1]
		} else if (descToken.test(lines[i])) {
			const match = lines[i].match(descToken) as RegExpMatchArray
			questionMeta.desc = match[1]
		} else {
			const match = lines[i].match(funcNameRegExp)
			if (match) {
				const funcName = match[1] || match[2]
				funcNames.push(funcName)
			}
		}
	}
	return {
		funcNames,
		questionMeta,
	}
}

export function getDesc(text: string, filePath: string) {
	const lines = text.split(/\n/)
	const comment = getFileComment(filePath)
	const descToken = comment === '//' ? /^\/\/ @desc (.+)/ : /^# @desc (.+)/

	for (let i = 0; i < lines.length; i++) {
		if (descToken.test(lines[i])) {
			const match = lines[i].match(descToken) as RegExpMatchArray
			return match[1]
		}
	}
}
export async function existDir(dir: string): Promise<boolean> {
	try {
		await access(dir, fs.constants.F_OK | fs.constants.W_OK)
		return true
	} catch (err) {
		if (err.code === 'ENOENT') {
			await mkdir(dir)
			return false
		}
		throw err
	}
}
export function existDirSync(dir: string) {
	try {
		fs.accessSync(dir, fs.constants.F_OK | fs.constants.W_OK)
		return true
	} catch (err) {
		if (err.code === 'ENOENT') {
			fs.mkdirSync(dir)
			return false
		}
		throw err
	}
}
export async function existFile(filepath: string): Promise<boolean> {
	try {
		await access(filepath, fs.constants.F_OK | fs.constants.W_OK)
		return true
	} catch (err) {
		if (err.code === 'ENOENT') {
			await writeFile(filepath, Buffer.alloc(0))
			return true
		}
		throw err
	}
}

export function parseHtml(html: string): CommonQuestion | null {
	const $ = cheerio.load(html, { decodeEntities: false })

	const translatedContent = $('.question-content.default-content').html()?.trim() || ''
	const content = translatedContent || ''
	const scripts = $('script').filter(function () {
		const text = $(this).html()
		return !!(text?.includes('pageData') && text.includes('questionId'))
	})
	const questionFrontendId = parseInt($('.question-title h3').html() || '-1').toString()
	let question: CommonQuestion | null = null
	if (scripts.length === 1) {
		const text = scripts.html()
		const Script = vm.Script
		const script = new Script(text + ';pageData')

		const result: CnContestPageData = script.runInNewContext()
		if (result) {
			question = {
				...result,
				translatedContent,
				questionFrontendId,
				metaData: JSON.stringify(result.metaData),
				title: result.questionSourceTitle,
				translatedTitle: result.questionTitle,
				content,
				titleSlug: result.questionTitleSlug,
				codeSnippets: result.codeDefinition.map((v: CodeDefinition) => ({
					code: v.defaultCode,
					lang: v.text,
					langSlug: v.value,
				})),
			}
		}
	}
	return question
}
export function parseSubmissionDetailHtml(html: string): SubmissionDetailPageData | null {
	const $ = cheerio.load(html, { decodeEntities: false })
	const scripts = $('script').filter(function () {
		const text = $(this).html()
		return !!(text?.includes('pageData') && text.includes('questionId'))
	})
	let pageData: SubmissionDetailPageData | null = null
	if (scripts.length === 1) {
		const text = scripts.html()
		const Script = vm.Script
		const script = new Script(text + ';pageData')
		pageData = script.runInNewContext()
	}
	return pageData
}
export function escape2html(str: string) {
	const map = { lt: '<', gt: '>', nbsp: ' ', amp: '&', quot: '"', '#39': "'" }
	return str.replace(/&(lt|gt|nbsp|amp|quot|#39);/g, (_, key) => map[key])
}

async function sleep(ms: number) {
	return new Promise((resolve) => {
		return setTimeout(resolve, ms)
	})
}
export async function retry<T>({
	fn,
	time = 1,
	delay = 1000,
	verifyFn,
}: {
	fn: () => Promise<T>
	time?: number
	delay?: number
	verifyFn: (arg: T) => boolean
}): Promise<T> {
	let count = time | 0
	while (count > 0) {
		count--
		await sleep(delay)
		const result = await fn()
		if (verifyFn(result)) {
			return result
		}
	}
	return Promise.reject(new Error('retry timeout'))
}

function parseTestCase(testCase: TestCase): CaseList {
	const caseList: CaseList = []
	for (const argsLiteral of testCase) {
		caseList.push(parseCommentTest(argsLiteral))
	}
	return caseList
}
export function parseCommentTest(testComment: string): Args {
	let index = testComment.indexOf('@test') + 4
	const params: string[] = []
	let result = ''
	while (testComment[++index]) {
		if (testComment[index] === '(') {
			index++
			break
		}
	}
	let { index: pos } = parse(testComment.slice(index), { partialIndex: true })
	while (pos) {
		pos = pos + index
		const param = testComment.slice(index, pos)
		// param = JSON.parse(param)
		params.push(param.trim())
		if (testComment[pos] === ',') {
			index = pos + 1
			pos = parse(testComment.slice(index), { partialIndex: true }).index
		} else if (testComment[pos] === ')') {
			index = pos
			break
		} else {
			console.log(testComment.slice(pos - 10, pos))
			throw new Error('parse CommentTest error:' + testComment)
		}
	}
	while (testComment[++index]) {
		if (testComment[index] === '=') {
			index++
			break
		}
	}

	pos = parse(testComment.slice(index), { partialIndex: true }).index
	if (pos) {
		result = testComment.slice(index, pos + index)
	}
	return {
		args: params,
		result,
	}
}
export function normalize(result: any, returnType: string) {
	if (['TreeNode', 'ListNode'].includes(returnType)) {
		return result
	} else {
		return JSON.stringify(result)
	}
}

/**
 *
 * @param args the params of function
 * @param paramsTypes the type of params
 * @param includeFunctionCall whether the building step contains function call
 */
export function deserializeParam(args: string[], paramsTypes: string[], includeFunctionCall: boolean) {
	let hasTree = false
	let hasList = false
	for (let i = 0; i < paramsTypes.length; i++) {
		const paramType = paramsTypes[i]
		if (isTreeNode(paramType)) {
			hasTree = true
			if (includeFunctionCall) {
				args[i] = `a.treeNode.deserialize("${args[i]}")`
			} else {
				args[i] = `treeNode.deserialize("${args[i]}")`
			}
		} else if (/TreeNode/.test(paramType)) {
			console.warn('deserialize param meeting problem,args:', args[i])
		} else if (isListNode(paramType)) {
			hasList = true
			if (includeFunctionCall) {
				args[i] = `a.listNode.deserialize("${args[i]}")`
			} else {
				args[i] = `listNode.deserialize("${args[i]}")`
			}
		} else if (/ListNode/.test(paramType)) {
			console.warn('deserialize param meeting problem,args:', args[i])
		}
	}
	return {
		hasTree,
		hasList,
	}
}
export function getResultType(resultType: string): string {
	if (isTreeNode(resultType)) {
		return 'TreeNode'
	} else if (isListNode(resultType)) {
		return 'ListNode'
	} else if (/TreeNode|ListNode/.test(resultType)) {
		console.warn('deserialize result meeting problem,resultType:', resultType)
	}
	return ''
}
export interface TestResult {
	args: string
	expect: string
	result: string
}
export function setLinePrefix(str: string, prefix: string) {
	return str
		.split('\n')
		.map((line) => prefix + line)
		.join('\n')
}
export async function downloadNpm(name: string, moduleDir: string) {
	const url = 'https://registry.npmjs.org/' + name

	const randomName = Math.random().toString(32).slice(2)
	const targetDir = path.join(moduleDir, name)
	const tempDir = path.join(moduleDir, '.temp', randomName)
	const res = await axios.request({
		url,
	})
	const data = res.data
	const latestVersion = data['dist-tags']['latest']
	const fileUrl = data['versions'][latestVersion]['dist']['tarball']

	const res2 = await axios.get(fileUrl, { responseType: 'stream' })
	const stream = res2.data

	await compressing.tgz.uncompress(stream, tempDir)
	await fse.copy(path.join(tempDir, 'package'), path.join(targetDir))

	rimraf(tempDir, (err) => {
		console.log(err)
	})
}
export function uniqueArrByKey<Obj extends Record<Key, string>, Key extends keyof Obj>(arr: Obj[], key: Key) {
	if (arr.length <= 1) {
		return
	}
	arr.sort((x, y) => x[key].localeCompare(y[key]))
	let i = 0

	for (let j = 1; j < arr.length; j++) {
		if (arr[j][key] !== arr[j - 1][key]) {
			arr[++i] = arr[j]
		}
	}
	arr.length = i + 1
}
export function unionArr<T>(arr1: T[], arr2: T[]) {
	const set = new Set(arr1)
	arr2.forEach((v) => set.add(v))
	return [...set]
}
export function handleMsg(testResultList: TestResult[]) {
	const success = testResultList.every((v) => (v.expect && v.expect.trim()) === (v.result && v.result.trim()))
	let msg = ''
	if (success) {
		msg = `✓ ${testResultList.length} tests complete`
	} else {
		msg =
			testResultList
				.map((v) => {
					if (v.expect === v.result) {
						return `✓ @test(${v.args})\n`
					} else {
						return `× @test(${v.args})  result: ${v.result} ,expect: ${v.expect}\n`
					}
				})
				.join('') + '\n'
	}
	return msg
}

function handleParam(index: number, paramType: string, esbuild = false): string {
	const prefix = esbuild ? 'a.' : ''
	const handleConfig = [
		{
			type: 'ListNode',
			handleFn: prefix + 'listNode.deserialize',
		},
		{
			type: 'TreeNode',
			handleFn: prefix + 'treeNode.deserialize',
		},
		{
			type: 'ListNode[]',
			handleFn: prefix + 'listNode.deserializeArr',
		},
		{
			type: 'TreeNode[]',
			handleFn: prefix + 'treeNode.deserializeArr',
		},
	]
	const jsonType = [
		'integer',
		'string',
		'integer[]',
		'string[]',
		'integer[][]',
		'string[][]',
		'list<string>',
		'list<integer>',
		'list<list<integer>>',
		'list<list<string>>',
		'character[][]"',
		'boolean',
		'double',
	]
	if (jsonType.includes(paramType)) {
		return `const arg${index} =JSON.parse(unitArgs[${index}])`
	} else {
		for (const { type, handleFn } of handleConfig) {
			if (type === paramType) {
				return `const arg${index} =${handleFn}(unitArgs[${index}])`
			}
		}
	}

	throw new Error(`paramType ${paramType} not support`)
}

function handleReturn(
	paramCount: number,
	funcName: string,
	returnType: string,
	firstParamType: string,
	esbuild = false
): string {
	const isVoid = returnType === 'void'
	if (isVoid) {
		returnType = firstParamType
	}
	const prefix = esbuild ? 'a.' : ''
	const handleConfig = [
		{
			type: 'ListNode',
			handleFn: prefix + 'listNode.serialize',
		},
		{
			type: 'TreeNode',
			handleFn: prefix + 'treeNode.serialize',
		},
		{
			type: 'ListNode[]',
			handleFn: prefix + 'listNode.serializeArr',
		},
		{
			type: 'TreeNode[]',
			handleFn: prefix + 'treeNode.serializeArr',
		},
		{
			type: 'double',
			handleFn: `${isVoid ? ';' : ''}(v=>v.toFixed(5))`,
		},
	]
	const jsonType = [
		'integer',
		'string',
		'integer[]',
		'string[]',
		'integer[][]',
		'string[][]',
		'list<string>',
		'list<integer>',
		'list<list<integer>>',
		'list<list<string>>',
		'character[][]"',
		'boolean',
	]

	const argStr = Array(paramCount)
		.fill(0)
		.map((v, i) => `arg${i}`)
		.join(',')
	if (jsonType.includes(returnType)) {
		if (!isVoid) {
			const funcExpression = tag`
            const result=${funcName}(${argStr})
            JSON.stringify(result)
            `
			return funcExpression
		} else {
			const funcExpression = tag`
            ${funcName}(${argStr})
            JSON.stringify(arg0)
            `
			return funcExpression
		}
	} else {
		for (const { type, handleFn } of handleConfig) {
			if (type === returnType) {
				if (!isVoid) {
					const funcExpression = tag`
                    const result=${funcName}(${argStr})
                    resultabc =${handleFn}(result)
                    `
					return funcExpression
				} else {
					const funcExpression = tag`
                    ${funcName}(${argStr})
                    ${handleFn}(arg0)
                    `
					return funcExpression
				}
			}
		}
	}

	throw new Error(`returnType ${returnType} not support`)
}
function handleArgsType(meta: LanguageMetaData, originCode: string, args: string[], isEsbuild = false) {
	const params = meta.params || []
	const rt = meta.return.type
	const funcName = meta.name
	const argExpressions: string[] = []
	const paramCount = params.length
	for (let i = 0; i < paramCount; i++) {
		const { type } = params[i]
		argExpressions[i] = handleParam(i, type, isEsbuild)
	}
	const argExpression = argExpressions.join('\n')

	const rtExpression = handleReturn(paramCount, funcName, rt, params[0].type, isEsbuild)
	const formatArg = JSON.stringify(args)
	return (
		originCode +
		'\n' +
		tag`
    const unitArgs=${formatArg}
    ${argExpression}
    ${rtExpression}
    `
	)
}

function generateId(): string {
	return Math.random().toString(32).slice(2)
}

export {
	detectEnableExt,
	getJsTestCaseList as getTestCaseList,
	getTsTestCaseList,
	parseTestCase,
	parseCode as getFuncNames,
	writeFileAsync,
	readFileAsync,
	execFileAsync,
	paramMetaRegExp,
	returnRegExp,
	handleArgsType,
	generateId,
}

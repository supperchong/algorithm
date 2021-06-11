import * as path from 'path'

const langsConfig = {
	algorithms: [
		{
			lang: 'C++',
			langSlug: 'cpp',
			ext: '.cpp',
			comment: '//',
			fileNameSep: '.',
		},
		{
			lang: 'Java',
			langSlug: 'java',
			ext: '.java',
			comment: '//',
			fileNameSep: '.',
		},
		{
			lang: 'Python',
			langSlug: 'python',
			ext: '.py',
			comment: '#',
			fileNameSep: '_',
		},
		{
			lang: 'Python3',
			langSlug: 'python3',
			ext: '.py',
			comment: '#',
			fileNameSep: '_',
		},
		{
			lang: 'C',
			langSlug: 'c',
			ext: '.c',
			comment: '//',
			fileNameSep: '.',
		},
		{
			lang: 'C#',
			langSlug: 'csharp',
			ext: '.cs',
			comment: '//',
			fileNameSep: '.',
		},
		{
			lang: 'JavaScript',
			langSlug: 'javascript',
			ext: '.js',
			comment: '//',
			fileNameSep: '.',
		},
		{
			lang: 'Ruby',
			langSlug: 'ruby',
			ext: '.rb',
			comment: '#',
			fileNameSep: '.',
		},
		{
			lang: 'Swift',
			langSlug: 'swift',
			ext: '.swift',
			comment: '//',
			fileNameSep: '.',
		},
		{
			lang: 'Go',
			langSlug: 'golang',
			ext: '.go',
			comment: '//',
			fileNameSep: '.',
		},
		{
			lang: 'Scala',
			langSlug: 'scala',
			ext: '.scala',
			comment: '//',
			fileNameSep: '.',
		},
		{
			lang: 'Kotlin',
			langSlug: 'kotlin',
			ext: '.kt',
			comment: '//',
			fileNameSep: '.',
		},
		{
			lang: 'Rust',
			langSlug: 'rust',
			ext: '.rs',
			comment: '//',
			fileNameSep: '.',
		},
		{
			lang: 'PHP',
			langSlug: 'php',
			ext: '.php',
			comment: '//',
			fileNameSep: '.',
		},
		{
			lang: 'TypeScript',
			langSlug: 'typescript',
			ext: '.ts',
			comment: '//',
			fileNameSep: '.',
		},
	],
	database: [
		{
			lang: 'MySQL',
			langSlug: 'mysql',
			ext: '.sql',
			comment: '#',
			fileNameSep: '.',
		},
		{
			lang: 'MS SQL Server',
			langSlug: 'mssql',
			ext: '.sql',
			comment: '#',
			fileNameSep: '.',
		},
		{
			lang: 'Oracle',
			langSlug: 'oraclesql',
			ext: '.sql',
			comment: '#',
			fileNameSep: '.',
		},
	],
	shell: [
		{
			lang: 'Bash',
			langSlug: 'bash',
			ext: '.sh',
			comment: '#',
			fileNameSep: '.',
		},
	],
}
enum LangBaseComment {
	Slash = '//',
	Pound = '#',
}
export interface LangBase {
	lang: CodeLang
	langSlug: string
	ext: string
	comment: LangBaseComment
	fileNameSep: '.' | '_'
}
export interface LangMap {
	[langSlug: string]: LangBase
}
interface LangExtMap {
	[ext: string]: LangBase
}
const allLangs = Object.values(langsConfig).reduce((prev, cur) => prev.concat(cur))
export const langMap: LangMap = allLangs.reduce((prev, cur) => (prev[cur.langSlug] = cur) && prev, {})
export const langExtMap: LangExtMap = allLangs.reduce((prev, cur) => (prev[cur.ext] = cur) && prev, {})
export enum CodeLang {
	'C++' = 'C++',
	'C#' = 'C#',
	Java = 'Java',
	Python = 'Python',
	Python3 = 'Python3',
	C = 'C',
	JavaScript = 'JavaScript',
	Ruby = 'Ruby',
	Swift = 'Swift',
	Go = 'Go',
	Scala = 'Scala',
	Kotlin = 'Kotlin',
	Rust = 'Rust',
	PHP = 'PHP',
	TypeScript = 'TypeScript',
}
export enum DataBase {
	MySQL = 'MySQL',
	'MS SQL Server' = 'MS SQL Server',
	'Oracle' = 'Oracle',
}

export function getFileLang(filePath: string): CodeLang {
	const ext = path.extname(filePath)
	const langItem = langExtMap[ext]
	if (!langItem) {
		throw new Error('file extname invalid')
	}
	return langItem.lang
}

export function getFileLangSlug(filePath: string): string {
	const ext = path.extname(filePath)
	const langItem = langExtMap[ext]
	if (!langItem) {
		throw new Error('file extname invalid')
	}
	return langItem.langSlug
}
export function isDataBase(filePath: string): boolean {
	const ext = path.extname(filePath)
	return ext === '.sql'
}
export function isShell(filePath: string): boolean {
	const ext = path.extname(filePath)
	return ext === '.sh'
}
export function isAlgorithm(lang: CodeLang): boolean {
	return !!langsConfig.algorithms.find((alg) => alg.lang === lang)
}
export function getFileComment(filePath: string): LangBaseComment {
	const ext = path.extname(filePath)
	const langItem = langExtMap[ext]
	if (!langItem) {
		throw new Error('file extname invalid')
	}
	return langItem.comment
}

export const builtInLang = [CodeLang.JavaScript, CodeLang.TypeScript]
export const otherLang = [CodeLang.Python3, CodeLang.Go, CodeLang.Java, CodeLang['C++']]
export const enableLang = [...builtInLang, ...otherLang]
export const databases = [DataBase['MS SQL Server'], DataBase.MySQL, DataBase.Oracle]
export const enNameLangs = [CodeLang.Java, CodeLang['C++']]
export enum ExtraType {
	ListNode = 'ListNode',
	TreeNode = 'TreeNode',
}
export const highlightLangMap = {
	cpp: 'cpp',
	java: 'java',
	python: 'python',
	python3: 'python',
	c: 'c',
	csharp: 'csharp',
	javascript: 'javascript',
	ruby: 'ruby',
	swift: 'swift',
	golang: 'go',
	scala: 'scala',
	kotlin: 'kotlin',
	rust: 'rust',
	php: 'php',
	typescript: 'typescript',
}
export function transformToHightlightLang(lang: string): string {
	return highlightLangMap[lang] || lang
}
export function isSupportFile(filePath: string) {
	if (isShell(filePath) || isDataBase(filePath)) {
		return true
	}
	const ext = path.extname(filePath)

	const langItem = langExtMap[ext]
	if (!langItem) {
		return false
	}
	const lang = langItem.lang
	return enableLang.includes(lang)
}

import * as vscode from 'vscode'
import { window } from 'vscode'
import { transformAsync } from '@babel/core'
import { generateAddTestCommentPlugin } from './babelPlugin'
import { langMap, getFileLang, CodeLang, ExtraType, transformToHightlightLang } from './common/langConfig'
import { ParseContent } from './common/parseContent'
import { config, updateConfig, updateEnv, InstallState, log, checkEsbuildDir } from './config'
import { tag } from 'pretty-tag'
import { AskForImportState, CodeSnippet, CommonQuestion, ConciseQuestion } from './model/common'
import { MemoFile } from './model/memo'
import { Service } from './lang/common'
import { LanguageMetaData, MetaData } from './common/lang'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const hljs = require('highlight.js')

// eslint-disable-next-line @typescript-eslint/no-var-requires
const md = require('markdown-it')({
	highlight: function (str, lang) {
		if (lang && hljs.getLanguage(lang)) {
			try {
				return (
					'<pre class="hljs"><code>' +
					hljs.highlight(str, {
						language: lang,
						ignoreIllegals: true,
					}).value +
					'</code></pre>'
				)
			} catch (err) {
				log.appendLine('highlight code error')
			}
		}

		return '<pre class="hljs"><code>' + md.utils.escapeHtml(str) + '</code></pre>'
	},
})
export const highlightCode = (code: string, lang: string) =>
	md.render(`\`\`\`${transformToHightlightLang(lang)}\n${code}\n\`\`\``)
export async function execWithProgress<T>(promise: Promise<T>, message: string): Promise<T> {
	return window.withProgress<T>({ location: vscode.ProgressLocation.Notification }, (p) => {
		p.report({ message })
		return promise
	})
}
export async function execWithProgress2<T>(promise: Promise<T>, message: string): Promise<T> {
	return window.withProgress({ location: vscode.ProgressLocation.Window }, (p) => {
		p.report({ message })
		return promise
	})
}
export async function appendComment(code: string, comment: string, funcName: string) {
	const fileResult = await transformAsync(code, {
		// comments: true,
		// compact: false,
		plugins: [generateAddTestCommentPlugin(funcName, comment)],
	})
	return fileResult?.code
}

const extraTypeValues = [ExtraType.ListNode, ExtraType.TreeNode]

export function shouldAskForImport(): boolean {
	return !config.hasAskForImport && config.env.askForImportState === AskForImportState.Later && !config.autoImportAlgm
}
export async function askForImport() {
	config.hasAskForImport = true
	const r = await window.showInformationMessage(
		'Would you like to import the algm module?',
		AskForImportState.Yes,
		AskForImportState.No,
		AskForImportState.Later
	)
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
	params.forEach((p) => {
		extraTypeValues.forEach((e) => {
			if (p.type.includes(e)) {
				arr.add(e)
			}
		})
	})
	extraTypeValues.forEach((e) => {
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

function isLanguageMetaData(metaData: MetaData): metaData is LanguageMetaData {
	return 'name' in metaData
}
export function preprocessCode(
	{ questionId, metaData, content, titleSlug, questionSourceContent }: CommonQuestion,
	weekname = '',
	codeSnippet: CodeSnippet,
	name: string
) {
	const testCases = ParseContent.getTestCases(questionSourceContent || content)
	const langSlug = codeSnippet.langSlug
	const langConfig = langMap[langSlug]
	const weektag = weekname ? `weekname=${weekname}` : ''

	const metaDataParse: MetaData = JSON.parse(metaData)
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
        `

	let codeTestSnippet = ''
	try {
		codeTestSnippet = testCases
			.map((testCase) => {
				const pa = metaDataParse.params
					.map((param, i) => {
						const input = testCase.input.find(({ key }) => key === param.name)
						if (input) {
							return input.value
						} else {
							return testCase.input[i].value
						}
					})
					.join(',')
				return `${langConfig.comment} @test(${pa})=${testCase.output}\n`
			})
			.join('')
	} catch (err) {
		console.log(err)
	}

	const code = codeSnippet.code
	const newCode = flag + '\n' + codeTestSnippet + code
	return newCode
}
export function getDebugConfig() {
	const { nodeBinPath } = config

	return {
		type: 'node',
		request: 'launch',
		name: 'debug question',
		skipFiles: ['<node_internals>/**'],
		program: '${workspaceFolder}/out/code.js',
		outFiles: ['${workspaceFolder}/out/*.js'],
		runtimeVersion: 'default',
		runtimeExecutable: nodeBinPath,
		sourceMaps: true,
		args: ['${file}'],
		preLaunchTask: 'algorithm: build',
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
		const fid1: string = q1.name
		const fid2: string = q2.name
		const sortOrder = ['LCP', '剑指 Offer', '面试题']
		const weight1 = sortOrder.findIndex((prefix) => fid1.startsWith(prefix))
		const weight2 = sortOrder.findIndex((prefix) => fid2.startsWith(prefix))
		if (weight1 !== weight2) {
			return weight1 - weight2
		} else {
			if (weight1 !== -1) {
				return fid1.localeCompare(fid2)
			}
			return parseInt(fid1) - parseInt(fid2)
		}
	})
}
export function sortQuestions(questions: ConciseQuestion[]) {
	questions.sort((q1, q2) => {
		const fid1: string = q1.fid
		const fid2: string = q2.fid
		const sortOrder = ['LCP', '剑指 Offer', '面试题']
		const weight1 = sortOrder.findIndex((prefix) => fid1.startsWith(prefix))
		const weight2 = sortOrder.findIndex((prefix) => fid2.startsWith(prefix))
		if (weight1 !== weight2) {
			return weight1 - weight2
		} else {
			if (weight1 !== -1) {
				return fid1.localeCompare(fid2)
			}
			return parseInt(fid1) - parseInt(fid2)
		}
	})
}
export function reRequire(moduleName: string) {
	delete require.cache[moduleName]
	return require(moduleName)
}

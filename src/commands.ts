import { getFuncNames, QuestionMeta, retry } from './common/util'
import { checkBeforeDebug, execWithProgress, execWithProgress2 } from './util'
import { log, updateConfig } from './config'
import { window } from 'vscode'
import { createPanel } from './webview/buildCodeWebview'
import { api, freshQuestions } from './api/index'
import * as vscode from 'vscode'
import { QuestionsProvider, QuestionTree } from './provider/questionsProvider'
import { cache } from './cache'
import { checkParams, CheckResponse, ErrorStatus, Lang } from './model/common'
import { config } from './config'
import { selectLogin } from './login/input'
import { getQuestionDescription } from './webview/questionPreview'
import { databases, enableLang, getFileLang, isAlgorithm, isDataBase, isShell } from './common/langConfig'
import { normalizeQuestionLabel, writeFileAsync } from './common/util'
import { MemoFile } from './model/memo'
import { addFolder, addQuestion } from './memo/index'
import { MemoProvider, MemoTree } from './provider/memoProvider'
import { ResolverParam } from './provider/resolver'
import { Service } from './lang/common'
import { DataBaseParse } from './lang/database'
import { BashParse } from './lang/bash'
import { createSubmitHistoryPanel } from './webview/submitHistory'
import { submitStorage } from './history/storage'
import { answerStorage } from './history/answer'
import {
	BuildCodeArguments,
	GetDescriptionArguments,
	SubmitCodeArguments,
	TestCodeArguments,
	ViewSubmitHistoryArguments,
} from './model/command'

export async function testCodeCommand(...args: TestCodeArguments) {
	const [
		{
			filePath,
			testCaseParam: { testCase },
		},
	] = args
	try {
		const service = new Service(filePath)
		const promise = service.execTest(testCase)
		const msg = await execWithProgress(promise, 'wait test')
		if (msg) {
			log.appendLine(msg)
		}
		log.show()
	} catch (err) {
		console.log(err)
		window.showInformationMessage(`parse params err: ${err}`)
	}
}
async function openFolder() {
	const items = [
		'open questions folder in new window',
		'open questions folder in current window',
		'add questions folder at the start of workspace folders',
	]

	const uri = vscode.Uri.file(config.baseDir)
	const pickItem = await window.showQuickPick(items)
	if (pickItem === items[0]) {
		const uri = vscode.Uri.file(config.baseDir)
		return vscode.commands.executeCommand('vscode.openFolder', uri, {
			forceNewWindow: true,
		})
	} else if (pickItem === items[1]) {
		return vscode.commands.executeCommand('vscode.openFolder', uri, {
			forceNewWindow: false,
		})
	} else if (pickItem === items[2]) {
		return vscode.workspace.updateWorkspaceFolders(0, 0, { uri })
	}
}

export async function buildCode(text: string, filePath: string): Promise<BuildCode> {
	if (isDataBase(filePath)) {
		const parse = new DataBaseParse(filePath, text)
		return parse.buildCode()
	} else if (isShell(filePath)) {
		const parse = new BashParse(filePath, text)
		return parse.buildCode()
	}
	const service = new Service(filePath, text)

	return service.buildCode()
}

// TODO
async function submitAsync(code: string, questionMeta: QuestionMeta): Promise<CheckResponse> {
	checkParams(questionMeta, ['titleSlug', 'id'])
	const { titleSlug, id } = questionMeta
	const res = await api.submit({
		titleSlug: titleSlug,
		question_id: id,
		typed_code: code,
		lang: questionMeta.lang,
	})
	if (!res.submission_id) {
		log.appendLine(JSON.stringify(res))
		log.show()
		return Promise.reject(new Error('submit error'))
	}
	const fn = async () => {
		const res2 = await api.check({
			submission_id: res.submission_id,
			titleSlug: titleSlug,
		})
		if (['PENDING', 'STARTED', 'SUCCESS'].includes(res2.state)) {
			return res2
		} else {
			console.log('check res', res2)
			log.appendLine(JSON.stringify(res2))
			return Promise.reject(new Error('submit error'))
		}
	}
	const verifyFn = (res: CheckResponse) => res.state === 'SUCCESS'
	const result = await retry({ fn, verifyFn, time: 6 })
	return result
}
async function submitCode(text: string, filePath: string) {
	const buildResult = await buildCode(text, filePath)

	const code = buildResult.code
	const questionMeta = buildResult.questionMeta
	const result = await submitAsync(code, questionMeta)
	return {
		result,
		code,
		questionMeta,
	}
}
export async function debugCodeCommand(filePath: string) {
	const uri = vscode.Uri.file(config.baseDir)
	const p = vscode.workspace.getWorkspaceFolder(uri)
	const workspaceFolders = vscode.workspace.workspaceFolders
	if (!workspaceFolders?.find((w) => w.uri === p?.uri)) {
		return openFolder()
	}
	const breaks = vscode.debug.breakpoints as vscode.SourceBreakpoint[]
	if (!breaks.find((b) => b?.location?.uri.fsPath === filePath)) {
		console.log('breakpoint not found')
		window.showErrorMessage('please set breakpoint')
		return
	}
	if (!checkBeforeDebug(filePath)) {
		return
	}
	const service = new Service(filePath)
	service.debugCodeCommand(p!, breaks)
}
export async function buildCodeCommand(...args: BuildCodeArguments) {
	const [context, { text, filePath, langSlug }] = args
	const { code } = await buildCode(text, filePath)
	createPanel(context, code, langSlug)
}
// export async function buildCodeCommand(context: ExtensionContext, text: string, filePath: string, langSlug: string) {
// 	const { code } = await buildCode(text, filePath)
// 	createPanel(context, code, langSlug)
// }
export async function submitCommand(...args: SubmitCodeArguments) {
	const [questionsProvider, { text, filePath }] = args
	let message = ''
	try {
		const { result, questionMeta } = await execWithProgress(submitCode(text, filePath), 'wait submit')

		message = result.status_msg
		submitStorage.saveSubmit({
			filePath: filePath,
			text,
			result,
			desc: questionMeta.desc,
		})
		if (message === 'Accepted') {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			cache.updateQuestion(parseInt(questionMeta.id!), { status: 'ac' })
			questionsProvider.refresh()
		} else {
			if (result.status_code === 11) {
				//'Wrong Answer'
				const inputLength = result?.input_formatted?.length || 0
				const maxLength = 300
				if (inputLength <= maxLength) {
					const msg = `× @test(${result.input_formatted})  result: ${result.code_output} ,expect: ${result.expected_output}\n`
					log.appendLine(msg)
					log.show()
					const codeLang = getFileLang(filePath)

					if (questionMeta.id && isAlgorithm(codeLang)) {
						const questionDetail = await api.fetchQuestionDetailById(questionMeta.id)
						try {
							if (questionDetail) {
								const metaData = JSON.parse(questionDetail.metaData)
								const funcName = metaData.name
								const comment = ` @test(${result.input_formatted})=${result.expected_output}`
								const s = new Service(filePath)
								const newCode = s.addComment(text, comment, funcName)
								await writeFileAsync(filePath, newCode)
							}
						} catch (err) {
							console.log('parse questionDetail error', questionDetail)
						}
					}
				}
			}
		}
		console.log(result)
		window.showInformationMessage(message)
	} catch (err) {
		if ([ErrorStatus.InvalidCookie, ErrorStatus.Unlogin].includes(err?.response?.status)) {
			return
		}
		console.log(err)
		message = err.message
	}

	window.showInformationMessage(message)
}

interface BuildCode {
	code: string
	questionMeta: QuestionMeta
}

export async function getDescriptionCommand(...args: GetDescriptionArguments) {
	const [extensionPath, { text, filePath }] = args
	//extensionPath: string, text: string, filePath: string
	const { questionMeta } = getFuncNames(text, filePath)
	getQuestionDescription(extensionPath, {
		questionId: questionMeta.id,
		titleSlug: questionMeta.titleSlug,
		weekname: questionMeta.weekname,
	})
}

export async function freshCommand(questionsProvider: QuestionsProvider) {
	const promise = freshQuestions()
	await execWithProgress2(promise, '')
	questionsProvider.refresh()
}

export async function signInCommand(questionsProvider: QuestionsProvider) {
	try {
		await selectLogin(questionsProvider)
	} catch (err) {
		if (err.code !== 2) {
			window.showInformationMessage(err.message)
		}
	}
}

class LangItem implements vscode.QuickPickItem {
	constructor(public label: string, public description: string, public detail: string) {}
}
export async function switchEndpointCommand() {
	const LangConfigs = [
		{
			lang: Lang.en,
			label: 'Leetcode',
			description: 'leetcode.com',
			detail: 'Enable Leetcode US',
		},
		{
			lang: Lang.cn,
			label: '力扣',
			description: 'leetcode-cn.com',
			detail: '启用中国版Leetcode',
		},
	]
	const items = LangConfigs.map((langConfig) => {
		if (langConfig.lang === config.lang) {
			return new LangItem('$(check)' + langConfig.label, langConfig.description, langConfig.detail)
		}
		return new LangItem(langConfig.label, langConfig.description, langConfig.detail)
	})
	const [itemEN, itemCN] = items
	const result = await window.showQuickPick<LangItem>(items)
	if (result === itemEN) {
		updateConfig('lang', Lang.en)
	} else if (result === itemCN) {
		updateConfig('lang', Lang.cn)
	}
}

class CodeLangItem implements vscode.QuickPickItem {
	constructor(public label: string, public description: string) {}
}
export async function switchCodeLangCommand() {
	// const langs: CodeLang[] = [CodeLang.JavaScript, CodeLang.TypeScript, CodeLang.Python3, CodeLang.Go]
	const curLang = config.codeLang
	const langLabels = enableLang.map((lang) => {
		if (lang === curLang) {
			return new CodeLangItem(lang, '$(check)')
		}
		return new CodeLangItem(lang, '')
	})
	const pickItem = await window.showQuickPick(langLabels)
	const pickIndex = langLabels.findIndex((v) => v === pickItem)
	if (pickIndex !== -1) {
		const pickLang = enableLang[pickIndex]
		updateConfig('codeLang', pickLang)
	}
}

export async function switchDataBaseCommand() {
	const curDataBase = config.database
	const langLabels = databases.map((lang) => {
		if (lang === curDataBase) {
			return new CodeLangItem(lang, '$(check)')
		}
		return new CodeLangItem(lang, '')
	})
	const pickItem = await window.showQuickPick(langLabels)
	const pickIndex = langLabels.findIndex((v) => v === pickItem)
	if (pickIndex !== -1) {
		const pickLang = databases[pickIndex]
		updateConfig('database', pickLang)
	}
}

export async function searchCommand() {
	const questions = await api.getAllQuestions()
	const items = questions.map((v) => normalizeQuestionLabel(v))
	const pickItem = await window.showQuickPick(items)
	const index = items.findIndex((item) => item === pickItem)
	if (index !== -1) {
		const question = questions[index]
		const param = {
			id: question.id,
			titleSlug: question.slug,
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
	}
}

export async function addMemoFileCommand(memoProvider: MemoProvider, questionTree: QuestionTree) {
	const folderNames = config.env.memo.map((v) => v.name)
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

export async function viewSubmitHistoryCommand(...args: ViewSubmitHistoryArguments) {
	const [context, { text, filePath }] = args

	const { questionMeta } = getFuncNames(text, filePath)
	if (!questionMeta.id) {
		return
	}
	createSubmitHistoryPanel(context, questionMeta.id)
}

export async function newAnswerCommand(uri: vscode.Uri) {
	const filePath = uri.fsPath
	answerStorage.newAnswer(filePath)
}

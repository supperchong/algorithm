import * as path from 'path'
import * as vscode from 'vscode'
import { commands } from 'vscode'
import { api, apiCn, apiEn } from '../api/index'
import { config, log } from '../config'
import { writeFile, parseHtml } from '../common/util'
import { preprocessCode, shouldAskForImport, askForImport } from '../util'
import { CodeLang, enNameLangs, isAlgorithm, isDataBase, LangBase, langMap } from '../common/langConfig'
import { Service } from '../lang/common'
import { pathExists } from 'fs-extra'
import { BaseLang } from '../lang/base'
import { getSolution } from '../common/website'
export const QuestionPreview = 'algorithm.questionPreview'
const defaultLang = 'JavaScript'

const md = require('markdown-it')({
	html: true,
	inkify: true,
	typographer: true,
})
// type Param = Pick<ResolverParam, 'titleSlug' | 'weekname' | 'questionId' | 'itemId'>
interface Param {
	titleSlug?: string
	weekname?: string
	questionId?: number | string
	itemId?: string
}
export async function fetchQuestion(param: Param) {
	let { titleSlug, weekname, questionId: id, itemId } = param
	let data: string
	let question
	if (itemId) {
		const q = await api.fetchQuestionByItemId(itemId)
		if (q) {
			id = q.questionId
			titleSlug = q.titleSlug
		}
	}
	if (id) {
		question = await api.fetchQuestionDetailById(id)
	}

	if (!question && titleSlug) {
		if (weekname) {
			data = await api.fetchContestQuestionDetail(titleSlug, weekname)
			question = parseHtml(data)
		} else {
			question = await api.fetchQuestionDetail(titleSlug)
		}
		if (question) {
			api.saveQuestionDetail(question)
		}
	}
	return question
}
function getCodeSnippet(codeSnippets) {
	const langTypes = [config.codeLang, config.database]
	for (const defaultLang of langTypes) {
		let codeSnippet = codeSnippets.find((codeSnippet) => codeSnippet.lang === defaultLang)
		if (codeSnippet) {
			return codeSnippet
		}
	}
	return codeSnippets[0]
}
export function getName(questionFrontendId: string, title: string, translatedTitle: string, codeSnippet: any) {
	const langSlug = codeSnippet.langSlug
	const langConfig = langMap[langSlug]
	let filename = questionFrontendId + langConfig.fileNameSep + title + langConfig.ext
	if (config.lang === 'cn' && !enNameLangs.includes(langConfig.lang)) {
		filename = questionFrontendId + langConfig.fileNameSep + translatedTitle + langConfig.ext
	}
	let questionDir = path.join(config.algDir, codeSnippet.lang)

	let filePath = path.join(questionDir, filename)
	let name = path.parse(filename).name
	if (langConfig.lang === CodeLang.Go) {
		filePath = path.join(questionDir, name, 'solution.go')
	} else if (langConfig.lang === CodeLang.Java) {
		name = '_' + name.replace(/\./, '_')
		name = name.replace(/[^\w]/g, '_')
		filePath = path.join(questionDir, name, 'Solution.java')
	} else if (langConfig.lang === CodeLang['C++']) {
		name = name.replace(/[^\w]/g, '_')
		filePath = path.join(questionDir, 'question', name + '.cpp')
	}
	return {
		filePath,
		name,
		filename,
	}
}
export async function createQuestionPanelCommand(extensionPath: string, param: Param) {
	let { weekname } = param
	try {
		const question = await fetchQuestion(param)

		if (question) {
			const { codeSnippets, questionFrontendId, title, content, translatedContent, translatedTitle, titleSlug } =
				question
			//preview
			let previewText = `# ${title}\n` + content
			if (config.lang === 'cn') {
				previewText = `# ${translatedTitle}\n` + translatedContent
			}

			const defaultLang = config.codeLang
			let codeSnippet = getCodeSnippet(codeSnippets)
			let questionDir = path.join(config.algDir, codeSnippet.lang)

			const langSlug = codeSnippet.langSlug
			const langConfig = langMap[langSlug]

			//generate code
			const { filePath, name, filename } = getName(questionFrontendId, title, translatedTitle, codeSnippet)
			const exist = await pathExists(filePath)

			if (!exist) {
				const supportImport = ['JavaScript', 'TypeScript'].includes(langConfig.lang)
				if (supportImport && shouldAskForImport()) {
					askForImport()
				}
				let code = preprocessCode(question, weekname, codeSnippet, name)
				if (langConfig.lang === CodeLang.Java) {
					code = code.replace('class Solution', 'public class Solution')
				}
				if (isAlgorithm(langConfig.lang)) {
					await Service.handlePreImport(filePath)
				}

				await writeFile(filePath, code)
			}
			const fileDocument = await vscode.workspace.openTextDocument(filePath)
			await vscode.window.showTextDocument(fileDocument, vscode.ViewColumn.One)
			QuestionPreviewPanel.createOrShow(extensionPath, previewText, titleSlug)
		} else {
			console.log('parse question error:', question)
		}

		return
	} catch (err) {
		console.log(err)
	}
}
export async function getQuestionDescription(extensionPath: string, param: Param) {
	const question = await fetchQuestion(param)
	if (question) {
		const { codeSnippets, questionFrontendId, title, content, translatedContent, translatedTitle, titleSlug } =
			question
		//preview
		let previewText = `# ${title}\n` + content
		if (config.lang === 'cn') {
			previewText = `# ${translatedTitle}\n` + translatedContent
		}
		QuestionPreviewPanel.createOrShow(extensionPath, previewText, titleSlug)
	} else {
		console.log('question not found')
	}
}
class QuestionPreviewPanel {
	/**
	 * Track the currently panel. Only allow a single panel to exist at a time.
	 */
	public static currentPanel: QuestionPreviewPanel | undefined
	private static readonly buildCodeActiveContextKey = 'questionPreviewFocus'
	public static readonly viewType = 'questionPreview'
	public static readonly commandText = QuestionPreview
	private readonly _panel: vscode.WebviewPanel
	private readonly _extensionPath: string
	public text: string
	public titleSlug: string
	private _disposables: vscode.Disposable[] = []
	public static commands = new Map<string, vscode.Disposable>()
	private setbuildCodeActiveContext(value: boolean) {
		vscode.commands.executeCommand('setContext', QuestionPreviewPanel.buildCodeActiveContextKey, value)
	}
	private registerCommand(id: string, impl: (...args: any[]) => void, thisArg?: any) {
		if (!QuestionPreviewPanel.commands.get(id)) {
			const dispose = vscode.commands.registerCommand(id, impl, thisArg)
			QuestionPreviewPanel.commands.set(id, dispose)
		}
	}
	public static createOrShow(extensionPath: string, text: string, titleSlug: string) {
		const column = vscode.ViewColumn.Two
		// If we already have a panel, show it.

		if (QuestionPreviewPanel.currentPanel) {
			QuestionPreviewPanel.currentPanel._panel.reveal(column)
			QuestionPreviewPanel.currentPanel.update(text, titleSlug)
			return
		}

		// Otherwise, create a new panel.
		const panel = vscode.window.createWebviewPanel(QuestionPreviewPanel.viewType, 'algorithm', column, {
			// Enable javascript in the webview
			enableScripts: true,
			// And restrict the webview to only loading content from our extension's `media` directory.
			localResourceRoots: [vscode.Uri.file(path.join(extensionPath, 'media'))],
		})

		QuestionPreviewPanel.currentPanel = new QuestionPreviewPanel(panel, extensionPath, text, titleSlug)
	}

	private constructor(panel: vscode.WebviewPanel, extensionPath: string, text: string, titleSlug: string) {
		this._panel = panel
		this._extensionPath = extensionPath
		// QuestionPreviewPanel._text = text;
		this.text = text
		this.titleSlug = titleSlug
		// Set the webview's initial html content
		this._update()

		// Listen for when the panel is disposed
		// This happens when the user closes the panel or when the panel is closed programatically
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables)

		// Update the content based on view changes
		this._panel.onDidChangeViewState(
			(e) => {
				this.setbuildCodeActiveContext(e.webviewPanel.active)
				if (this._panel.visible) {
					this._update()
				}
			},
			null,
			this._disposables
		)

		// Handle messages from the webview
		this._panel.webview.onDidReceiveMessage(
			(message) => {
				switch (message.command) {
					case 'alert':
						vscode.window.showErrorMessage(message.text)
						return
				}
			},
			null,
			this._disposables
		)
	}

	public doRefactor() {
		// Send a message to the webview webview.
		// You can send any JSON serializable data.
		this._panel.webview.postMessage({ command: 'refactor' })
	}

	public dispose() {
		QuestionPreviewPanel.currentPanel = undefined

		// Clean up our resources
		this._panel.dispose()
		this.setbuildCodeActiveContext(false)
		while (this._disposables.length) {
			const x = this._disposables.pop()
			if (x) {
				x.dispose()
			}
		}
	}
	public update(text: string, titleSlug: string) {
		this.text = text
		this.titleSlug = titleSlug
		this._update()
	}
	private _update() {
		this.setbuildCodeActiveContext(true)
		const webview = this._panel.webview
		const nonce = getNonce()
		const scriptPathOnDisk = vscode.Uri.file(path.join(this._extensionPath, 'media', 'highlight.min.js'))
		const cssPathOnDisk = vscode.Uri.file(path.join(this._extensionPath, 'media', 'highlight.css'))
		const cssMdOnDisk = vscode.Uri.file(path.join(this._extensionPath, 'media', 'markdown.css'))
		const text = this.text
		const titleSlug = this.titleSlug
		const solutionUrl = getSolution(titleSlug)
		// let temp = QuestionPreviewPanel._text;
		const temp = text.replace(/<pre>/g, '<pre><code>').replace(/<\/pre>/g, '</code></pre>')
		const code = md.render(temp)
		const scriptUri = webview.asWebviewUri(scriptPathOnDisk)
		const cssUri = webview.asWebviewUri(cssPathOnDisk)
		const cssMd = webview.asWebviewUri(cssMdOnDisk)
		this._panel.webview.html = `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <!--
            Use a content security policy to only allow loading images from https or from our extension directory,
            and only allow scripts that have a specific nonce.
            -->
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' vscode-resource: https: data:; media-src 'self' vscode-resource: https: data:; script-src 'nonce-${nonce}'; style-src 'self' vscode-resource: 'unsafe-inline' https: data:; font-src 'self' vscode-resource: https: data:;">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Cat Coding</title>
			<link  rel="stylesheet" type="text/css"  href="${cssUri}">
			<link  rel="stylesheet" type="text/css"  href="${cssMd}">
        </head>
		<body>
		<style>
		pre code{
			white-space:pre-wrap;
		}
		</style>
            ${code}
			<br>
			<a href="${solutionUrl}">
			Solution
			</a>
        </body>
        </html>`
	}
}

function getNonce() {
	let text = ''
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length))
	}
	return text
}

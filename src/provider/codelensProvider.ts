import * as vscode from 'vscode'
import { detectEnableExt, TestCaseParam } from '../common/util'
import { getFileLang, getFileLangSlug, isAlgorithm } from '../common/langConfig'
import { Service } from '../lang/common'
import {
	CodeLensesOptions,
	DebugLensesOptions,
	GetDescriptionCodeLensesOptions,
	SubmitCodeLensesOptions,
	TestCodeLensesOptions,
	ViewSubmitHistoryCodeLensesOptions,
} from '../model/command'
export class CodelensProvider implements vscode.CodeLensProvider {
	private codeLenses: vscode.CodeLens[] = []
	private regex: RegExp
	private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>()
	public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event

	constructor() {
		this.regex = /(@test)/g

		vscode.workspace.onDidChangeConfiguration((_) => {
			this._onDidChangeCodeLenses.fire()
		})
	}
	private getBuildCodeLenses(options: CodeLensesOptions): vscode.CodeLens {
		const codeLens = new vscode.CodeLens(new vscode.Range(0, 0, 0, 7))

		codeLens.command = {
			title: 'build',
			tooltip: 'build',
			command: 'algorithm.buildCode',
			arguments: [options],
		}
		return codeLens
	}
	private getSubmitCodeLenses(options: SubmitCodeLensesOptions): vscode.CodeLens {
		const codeLens = new vscode.CodeLens(new vscode.Range(0, 0, 0, 7))

		codeLens.command = {
			title: 'submit',
			tooltip: 'submit',
			command: 'algorithm.submit',
			arguments: [options],
		}
		return codeLens
	}
	private getDescriptionCodeLenses(options: GetDescriptionCodeLensesOptions) {
		const codeLens = new vscode.CodeLens(new vscode.Range(0, 0, 0, 7))
		codeLens.command = {
			title: 'description',
			tooltip: 'description',
			command: 'algorithm.getDescription',
			arguments: [options],
		}
		return codeLens
	}
	private getHistoryCodeLenses(options: ViewSubmitHistoryCodeLensesOptions) {
		const codeLens = new vscode.CodeLens(new vscode.Range(0, 0, 0, 7))
		codeLens.command = {
			title: 'history',
			tooltip: 'history',
			command: 'algorithm.viewSubmitHistory',
			arguments: [options],
		}
		return codeLens
	}
	private getTestCodeLenses(options: TestCodeLensesOptions) {
		const {
			testCaseParam: { line },
		} = options
		const codeLens = new vscode.CodeLens(new vscode.Range(line, 0, line, 7))
		codeLens.command = {
			title: 'test',
			tooltip: 'test',
			command: 'algorithm.testCode',
			arguments: [options],
		}
		return codeLens
	}
	private getDebugCodeLenses(testCaseParam: TestCaseParam, filePath: DebugLensesOptions) {
		const { line } = testCaseParam
		const codeLens = new vscode.CodeLens(new vscode.Range(line, 0, line, 7))
		codeLens.command = {
			title: 'debug',
			tooltip: 'debug',
			command: 'algorithm.debugCode',
			arguments: [filePath],
		}
		return codeLens
	}

	public provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
		this.codeLenses = []
		const text = document.getText()
		const filePath = document.fileName
		const enableExt = detectEnableExt(text, filePath)

		if (enableExt) {
			const codeLang = getFileLang(filePath)
			const langSlug = getFileLangSlug(filePath)
			const codeLensesOptions: CodeLensesOptions = {
				text,
				filePath,
				langSlug,
			}
			const submitCodeLenses = this.getSubmitCodeLenses({
				...codeLensesOptions,
			})
			const buildCodeLenses = this.getBuildCodeLenses({
				...codeLensesOptions,
			})
			const desCodeLenses = this.getDescriptionCodeLenses({
				...codeLensesOptions,
			})
			const historyCodeLenses = this.getHistoryCodeLenses({
				...codeLensesOptions,
			})
			this.codeLenses.push(submitCodeLenses)
			this.codeLenses.push(buildCodeLenses)
			this.codeLenses.push(desCodeLenses)
			this.codeLenses.push(historyCodeLenses)
			if (isAlgorithm(codeLang)) {
				const lang = new Service(filePath, text)
				const testCaseList = lang.getTestCaseList(text)
				testCaseList.forEach((testCaseParam) => {
					const testCodeOptions: TestCodeLensesOptions = {
						filePath: document.uri.fsPath,
						testCaseParam,
					}
					const testCodeLenses = this.getTestCodeLenses(testCodeOptions)
					const debugCodeLenses = this.getDebugCodeLenses(testCaseParam, document.uri.fsPath)
					this.codeLenses.push(testCodeLenses)
					this.codeLenses.push(debugCodeLenses)
				})
			}

			return this.codeLenses
		}
		return []
	}
}

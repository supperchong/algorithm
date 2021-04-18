import * as vscode from 'vscode';
import { detectEnableExt, getTestCaseList, getTsTestCaseList, TestCaseParam } from '../common/util';
import { CodeLang, getFileLang } from '../common/langConfig'
import * as path from 'path'
import { PythonParse } from '../lang/python'
import { Service } from '../lang/common'
export class CodelensProvider implements vscode.CodeLensProvider {

	private codeLenses: vscode.CodeLens[] = [];
	private regex: RegExp;
	private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
	public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

	constructor() {
		this.regex = /(@test)/g;

		vscode.workspace.onDidChangeConfiguration((_) => {
			this._onDidChangeCodeLenses.fire();
		});
	}
	private getBuildCodeLenses(text: string, filePath: string): vscode.CodeLens {
		const codeLens = new vscode.CodeLens(
			new vscode.Range(0, 0, 0, 7)
		);
		codeLens.command = {
			title: "build",
			tooltip: "build",
			command: "algorithm.buildCode",
			arguments: [text, filePath]
		};
		return codeLens;
	}
	private getSubmitCodeLenses(text: string, filePath: string): vscode.CodeLens {
		const codeLens = new vscode.CodeLens(
			new vscode.Range(0, 0, 0, 7)
		);
		codeLens.command = {
			title: "submit",
			tooltip: "submit",
			command: "algorithm.submit",
			arguments: [text, filePath]
		};
		return codeLens;
	}
	private getDescriptionCodeLenses(text: string, filePath: string) {
		const codeLens = new vscode.CodeLens(
			new vscode.Range(0, 0, 0, 7)
		);
		codeLens.command = {
			title: "description",
			tooltip: "description",
			command: "algorithm.getDescription",
			arguments: [text, filePath]
		};
		return codeLens
	}
	private getTestCodeLenses(testCaseParam: TestCaseParam, filePath: string) {
		const { line, testCase, funcName, paramsTypes, resultType } = testCaseParam
		const codeLens = new vscode.CodeLens(
			new vscode.Range(line, 0, line, 7)
		);
		codeLens.command = {
			title: "test",
			tooltip: "test",
			command: "algorithm.testCode",
			arguments: [line, testCase, funcName, paramsTypes, resultType, filePath]
		};
		return codeLens
	}
	private getDebugCodeLenses(testCaseParam: TestCaseParam, filePath: string) {
		const { line, testCase, funcName, paramsTypes, resultType } = testCaseParam
		const codeLens = new vscode.CodeLens(
			new vscode.Range(line, 0, line, 7)
		);
		codeLens.command = {
			title: "debug",
			tooltip: "debug",
			command: "algorithm.debugCode",
			arguments: [filePath]
		};
		return codeLens
	}

	public provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {

		this.codeLenses = [];
		const text = document.getText();
		const filePath = document.fileName
		const enableExt = detectEnableExt(text, filePath);

		if (enableExt) {
			const codeLang = getFileLang(filePath)
			const submitCodeLenses = this.getSubmitCodeLenses(text, filePath);
			const desCodeLenses = this.getDescriptionCodeLenses(text, filePath)
			this.codeLenses.push(submitCodeLenses);
			this.codeLenses.push(desCodeLenses)
			if ([CodeLang.JavaScript, CodeLang.TypeScript].includes(codeLang)) {

				const buildCodeLenses = this.getBuildCodeLenses(text, filePath);
				this.codeLenses.push(buildCodeLenses);
				let testCaseList: TestCaseParam[] = []
				if (codeLang === CodeLang.JavaScript) {
					testCaseList = getTestCaseList(text);
				} else {
					testCaseList = getTsTestCaseList(text)
				}
				testCaseList.forEach((testCaseParam) => {
					const testCodeLenses = this.getTestCodeLenses(testCaseParam, document.uri.fsPath)
					const debugCodeLenses = this.getDebugCodeLenses(testCaseParam, document.uri.fsPath)
					this.codeLenses.push(testCodeLenses);
					this.codeLenses.push(debugCodeLenses);
				});
			} else {
				const lang = new Service(filePath, text)


				const testCaseList = lang.getTestCaseList(text)
				testCaseList.forEach((testCaseParam) => {
					const testCodeLenses = this.getTestCodeLenses(testCaseParam, document.uri.fsPath)
					const debugCodeLenses = this.getDebugCodeLenses(testCaseParam, document.uri.fsPath)
					this.codeLenses.push(testCodeLenses);
					this.codeLenses.push(debugCodeLenses);
				});
			}



			return this.codeLenses;
		}
		return [];
	}

}
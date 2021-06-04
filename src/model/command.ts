import * as vscode from 'vscode'
import { TestCaseParam } from '../common/util'
import { QuestionsProvider } from '../provider/questionsProvider'

export interface CodeLensesOptions {
	text: string
	filePath: string
	langSlug: string
}
export interface TestCodeLensesOptions {
	filePath: string
	testCaseParam: TestCaseParam
}
export type BuildCodeLensesOptions = CodeLensesOptions
export type SubmitCodeLensesOptions = CodeLensesOptions
export type GetDescriptionCodeLensesOptions = CodeLensesOptions
export type ViewSubmitHistoryCodeLensesOptions = CodeLensesOptions
type FilePath = string
export type DebugLensesOptions = FilePath
type ExtensionPath = string
export type BuildCodeArguments = [vscode.ExtensionContext, BuildCodeLensesOptions]
export type TestCodeArguments = [TestCodeLensesOptions]
export type DebugCodeArguments = [DebugLensesOptions]
export type SubmitCodeArguments = [QuestionsProvider, SubmitCodeLensesOptions]
export type GetDescriptionArguments = [ExtensionPath, GetDescriptionCodeLensesOptions]
export type ViewSubmitHistoryArguments = [vscode.ExtensionContext, CodeLensesOptions]

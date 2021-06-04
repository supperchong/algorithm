import { config } from '../config'
import * as vscode from 'vscode'

const defaultCompletionItems = [
	{
		languages: ['javascript', 'typescript'],
		prefix: 'algorithm',
		body: "// @algorithm\r\nimport * as a from '" + config.algmModuleDir + "'\r\n\r\n",
	},
]
export function registerCompletionItemProvider(context: vscode.ExtensionContext) {
	defaultCompletionItems.forEach(({ languages, prefix, body }) => {
		context.subscriptions.push(
			vscode.languages.registerCompletionItemProvider(
				languages,
				{
					// eslint-disable-next-line @typescript-eslint/no-unused-vars
					provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
						const snippetCompletion = new vscode.CompletionItem(prefix)
						snippetCompletion.insertText = new vscode.SnippetString(body)

						return [snippetCompletion]
					},
				},
				'.' // triggered whenever a '.' is being typed
			)
		)
	})
}

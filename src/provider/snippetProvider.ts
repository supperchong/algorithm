import * as vscode from 'vscode'
import { setLinePrefix } from '../common/util'
import { tag } from 'pretty-tag'
export function registerForSnippetProviders(context: vscode.ExtensionContext) {
	const forVariables = ['i', 'j', 'k']
	const fns = forVariables.map((forVariable) => {
		return function provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
			const key = `for${forVariable}.`
			let text = document.lineAt(position).text
			if (!text.endsWith(key)) {
				return
			}
			let whitePrefix = ''
			for (let i = 0; i < text.length; i++) {
				if (!/\s/.test(text[i])) {
					whitePrefix = text.slice(0, i)
					break
				}
			}
			text = text.trimLeft()
			const snippetCompletion = new vscode.CompletionItem(text)
			const range = document.lineAt(position).range
			snippetCompletion.range = range
			const prefix = text.slice(0, text.length - 5)
			let snippetString = tag`
            for (let ${forVariable} = 0; ${forVariable} < ${prefix}.length; ${forVariable}++) {
                let element = ${prefix}[${forVariable}]
                $0
            }`
			snippetString = setLinePrefix(snippetString, whitePrefix)
			snippetCompletion.insertText = new vscode.SnippetString(snippetString)
			return [snippetCompletion]
		}
	})
	fns.forEach((fn) => {
		context.subscriptions.push(
			vscode.languages.registerCompletionItemProvider(
				{ language: 'javascript', scheme: 'file' },
				{ provideCompletionItems: fn },
				'.'
			)
		)
	})
}

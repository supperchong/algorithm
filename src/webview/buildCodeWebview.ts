import * as path from 'path';
import * as vscode from 'vscode';
import { commands, Clipboard, env } from 'vscode';
import { highlightCode } from '../util';
const md = require('markdown-it')({
	html: true,
	inkify: true,
	typographer: true
});

export function createPanel(context: vscode.ExtensionContext, text: string, langSlug: string) {
	BuildCodePanel.createOrShow(context, text, langSlug);
}

class BuildCodePanel {
	/**
	 * Track the currently panel. Only allow a single panel to exist at a time.
	 */
	public static currentPanel: BuildCodePanel | undefined;
	private static readonly buildCodeActiveContextKey = 'buildCodeFocus';
	public static readonly viewType = 'buildCodeView';

	private readonly _panel: vscode.WebviewPanel;
	private readonly _extensionPath: string;
	private context: vscode.ExtensionContext
	public text: string;
	public langSlug: string;
	private clipboard: Clipboard = env.clipboard;
	private _disposables: vscode.Disposable[] = [];
	public static commands = new Map<string, vscode.Disposable>();
	private setbuildCodeActiveContext(value: boolean) {
		vscode.commands.executeCommand('setContext', BuildCodePanel.buildCodeActiveContextKey, value);
	}
	private registerCommand(id: string, impl: (...args: any[]) => void, thisArg?: any) {
		if (!BuildCodePanel.commands.get(id)) {
			const dispose = vscode.commands.registerCommand(id, impl, thisArg);
			this.context.subscriptions.push(dispose)
			BuildCodePanel.commands.set(id, dispose);
		}
	}
	public static createOrShow(context: vscode.ExtensionContext, text: string, langSlug: string) {
		const column = vscode.ViewColumn.Two;
		const extensionPath = context.extensionPath;
		// If we already have a panel, show it.

		if (BuildCodePanel.currentPanel) {
			BuildCodePanel.currentPanel._panel.reveal(column);
			BuildCodePanel.currentPanel.update(text, langSlug);
			return;
		}

		// Otherwise, create a new panel.
		const panel = vscode.window.createWebviewPanel(
			BuildCodePanel.viewType,
			'code',
			vscode.ViewColumn.Two,
			{
				// Enable javascript in the webview
				enableScripts: true,
				localResourceRoots: [vscode.Uri.file(path.join(extensionPath, 'media'))]
			}
		);

		BuildCodePanel.currentPanel = new BuildCodePanel(panel, context, text, langSlug);
	}


	private constructor(panel: vscode.WebviewPanel, context: vscode.ExtensionContext, text: string, langSlug: string) {
		this._panel = panel;
		this._extensionPath = context.extensionPath;
		this.context = context
		this.text = text;
		this.langSlug = langSlug;
		this.registerCommand('algorithm.copyCode', () => {
			this.clipboard.writeText(this.text);
		});


		// Set the webview's initial html content
		this._update();

		// Listen for when the panel is disposed
		// This happens when the user closes the panel or when the panel is closed programatically
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

		// Update the content based on view changes
		this._panel.onDidChangeViewState(
			e => {
				this.setbuildCodeActiveContext(e.webviewPanel.active);
			},
			null,
			this._disposables
		);

		// Handle messages from the webview
		this._panel.webview.onDidReceiveMessage(
			message => {
				switch (message.command) {
					case 'alert':
						vscode.window.showErrorMessage(message.text);
						return;
				}
			},
			null,
			this._disposables
		);
	}

	public dispose() {
		BuildCodePanel.currentPanel = undefined;

		// Clean up our resources
		this._panel.dispose();
		this.setbuildCodeActiveContext(false);
		while (this._disposables.length) {
			const x = this._disposables.pop();
			if (x) {
				x.dispose();
			}
		}
	}
	public update(text: string, langSlug: string) {
		this.text = text
		this.langSlug = langSlug
		this._update();
	}
	private _update() {
		this.setbuildCodeActiveContext(true);
		const webview = this._panel.webview;
		const nonce = getNonce();
		const scriptPathOnDisk = vscode.Uri.file(
			path.join(this._extensionPath, 'media', 'highlight.min.js')
		);
		const cssPathOnDisk = vscode.Uri.file(
			path.join(this._extensionPath, 'media', 'highlight.css')
		);
		const code = highlightCode(this.text, this.langSlug)
		// And the uri we use to load this script in the webview
		const scriptUri = webview.asWebviewUri(scriptPathOnDisk);
		const cssUri = webview.asWebviewUri(cssPathOnDisk);
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
        </head>
        <body>
            ${code}

        <script nonce=${nonce} src="${scriptUri}"></script>
        <script nonce=${nonce}>hljs.initHighlightingOnLoad();</script>
        </body>
        </html>`;
	}

}

function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}
import * as path from 'path';
import * as vscode from 'vscode';
import { api } from '../api/index';
import { config } from '../config';
import { getHistory, getRemoteSubmits, updateComment } from '../history';
const md = require('markdown-it')({
	html: true,
	inkify: true,
	typographer: true
});
const formatCode = code => md.render(`\`\`\`js\n${code}\n\`\`\``)
export function createSubmitHistoryPanel(context: vscode.ExtensionContext, question_id: string) {
	BuildSubmitHistoryPanel.createOrShow(context, question_id);
}

class BuildSubmitHistoryPanel {
	/**
	 * Track the currently panel. Only allow a single panel to exist at a time.
	 */
	public static currentPanel: BuildSubmitHistoryPanel | undefined;
	public static readonly viewType = 'submitHistoryView';

	private readonly _panel: vscode.WebviewPanel;
	private readonly _extensionPath: string;
	private context: vscode.ExtensionContext
	public static _text: string;
	private _disposables: vscode.Disposable[] = [];
	public static commands = new Map<string, vscode.Disposable>();
	private question_id: string

	public static createOrShow(context: vscode.ExtensionContext, question_id: string) {
		const column = vscode.ViewColumn.Two;
		const extensionPath = context.extensionPath;
		// If we already have a panel, show it.

		if (BuildSubmitHistoryPanel.currentPanel) {
			BuildSubmitHistoryPanel.currentPanel._panel.reveal(column);
			BuildSubmitHistoryPanel.currentPanel.update(question_id);
			return;
		}

		// Otherwise, create a new panel.
		const panel = vscode.window.createWebviewPanel(
			BuildSubmitHistoryPanel.viewType,
			'history',
			vscode.ViewColumn.Two,
			{
				// Enable javascript in the webview
				enableScripts: true,
				localResourceRoots: [vscode.Uri.file(path.join(extensionPath, 'media'))]
			}
		);

		BuildSubmitHistoryPanel.currentPanel = new BuildSubmitHistoryPanel(panel, context, question_id);
	}


	private constructor(panel: vscode.WebviewPanel, context: vscode.ExtensionContext, question_id: string) {
		this._panel = panel;
		this._extensionPath = context.extensionPath;
		this.context = context
		this.question_id = question_id
		this.initView()
		this._update()
		// Listen for when the panel is disposed
		// This happens when the user closes the panel or when the panel is closed programatically
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
		this._panel.webview.onDidReceiveMessage(
			message => {
				switch (message.command) {
					case 'getSubmissionCode':
						api.fetchSubmissionDetail({ id: message.id }).then(q => {
							this._panel.webview.postMessage({
								command: 'submissionDetail', data: {
									code: formatCode(q.submissionDetail.code),
									id: message.id,
									uuid: message.uuid
								}
							});

						}).catch(err => {
							this._panel.webview.postMessage({
								command: 'submissionDetail', data: {
									code: err,
									id: message.id,
									uuid: message.uuid
								}
							});
						})
						return;
					case 'updateComment': {
						updateComment(message.type, message.params).then(v => {
							this._panel.webview.postMessage({
								command: 'updateComment', data: {
									code: 200,
									msg: 'ok',
									uuid: message.uuid
								}
							})
						}).catch(err => {
							this._panel.webview.postMessage({
								command: 'updateComment', data: {
									code: 201,
									msg: 'update fail',
									uuid: message.uuid
								}
							})
							config.log.appendLine(err)
						})
					}
				}
			},
			null,
			this._disposables
		);
	}

	public dispose() {
		BuildSubmitHistoryPanel.currentPanel = undefined;

		// Clean up our resources
		this._panel.dispose();
		while (this._disposables.length) {
			const x = this._disposables.pop();
			if (x) {
				x.dispose();
			}
		}
	}
	public update(question_id: string) {
		if (question_id !== this.question_id) {
			this.question_id = question_id
			// BuildSubmitHistoryPanel._text = text;

			this._update();
		}

	}
	private getWebviewUri(name: string) {
		const webview = this._panel.webview;
		const scriptPathOnDisk = vscode.Uri.file(
			path.join(this._extensionPath, 'media', name)
		);
		return webview.asWebviewUri(scriptPathOnDisk);
	}
	private initView() {
		const nonce = getNonce();

		const historyUri = this.getWebviewUri('history.js')
		const scriptUri = this.getWebviewUri('highlight.min.js')
		const cssUri = this.getWebviewUri('highlight.css')
		const historyCssUri = this.getWebviewUri('history.css')
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
			<link  rel="stylesheet" type="text/css"  href="${historyCssUri}">
        </head>
        <body>
		<nav class="nav" id="nav">
			<button>
				answers
			</button>
			<button>
				localSubmit
			</button>
			<button>
				remoteSubmit
			</button>
		</nav>
		<div id="container" class="container"></div>
		<div id="history-code" class="history-code"></div>

		<script nonce=${nonce} src="${scriptUri}"></script>
		<script nonce=${nonce}>hljs.initHighlightingOnLoad();</script>
		<script nonce=${nonce} src="${historyUri}"></script>
        </body>
        </html>`;
	}
	private async _update() {
		const question_id = this.question_id
		const data = await getHistory(question_id, formatCode)
		this._panel.webview.postMessage({ command: 'init', data: data });
		getRemoteSubmits(question_id).then(data => {
			this._panel.webview.postMessage({ command: 'remoteStorageData', data: data });
		})
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

import { downloadAndUnzipVSCode } from 'vscode-test'

import * as vscode from 'vscode'
import { config, updateEnv } from '../config'
import { memoFilePreviewCommand } from '../commands'
import { sortFiles, sortQuestions } from '../util'
const MemoFilePreviewCommand = 'algorithm.memoFilePreview'
const MemoFileContext = 'memoFile'
enum MemoLevel {
	Folder,
	File,
	Invalid,
}
enum RemoveMemoMsg {
	Folder = 'Are you sure you want to delete the folder?',
	File = 'Are you sure you want to delete the file?',
}
export class MemoProvider implements vscode.TreeDataProvider<MemoTree> {
	private _onDidChangeTreeData: vscode.EventEmitter<MemoTree | undefined> = new vscode.EventEmitter<
		MemoTree | undefined
	>()
	readonly onDidChangeTreeData: vscode.Event<MemoTree | undefined> = this._onDidChangeTreeData.event
	refresh(): void {
		this._onDidChangeTreeData.fire(undefined)
	}
	getTreeItem(element: MemoTree): vscode.TreeItem {
		return element
	}
	getChildren(element?: MemoTree): Thenable<MemoTree[]> {
		if (element) {
			const folderName = element.label
			const files = this.getFolderFiles(folderName)
			return Promise.resolve(
				files.map((f) => {
					const tree = new MemoTree(f.label, f.id, f.paths, vscode.TreeItemCollapsibleState.None, {
						title: 'memoFilePreview',
						command: MemoFilePreviewCommand,
						arguments: [f.param],
					})
					tree.contextValue = MemoFileContext
					return tree
				})
			)
		} else {
			const folders = this.getFolders()
			return Promise.resolve(
				folders.map((f) => {
					const tree = new MemoTree(f.label, f.id, f.paths)
					tree.contextValue = MemoFileContext
					return tree
				})
			)
		}
	}
	getFolders() {
		return config.env.memo.map((v) => {
			return {
				label: v.name,
				id: 'folder' + v.name,
				paths: [v.name],
			}
		})
	}
	getFolderFiles(name: string) {
		const folder = config.env.memo.find((v) => v.name === name)
		if (folder) {
			const files = folder.children
			sortFiles(files)
			return files.map((v) => {
				return {
					label: v.name,
					id: name + v.name,
					paths: [name, v.name],
					param: v,
				}
			})
		} else {
			return []
		}
	}
	static getElementLevel(element: MemoTree) {
		const paths = element.paths
		if (paths.length === 1) {
			return MemoLevel.Folder
		} else if (paths.length === 2) {
			return MemoLevel.File
		}
		return MemoLevel.Invalid
	}
	static async remove(element: MemoTree): Promise<boolean> {
		const isRemove = await MemoProvider.checkRemove(element)
		if (!isRemove) {
			return false
		}
		const removeConfigs = [
			{
				level: MemoLevel.Folder,
				fn: MemoProvider.removeFolder,
			},
			{
				level: MemoLevel.File,
				fn: MemoProvider.removeFile,
			},
		]
		const level = MemoProvider.getElementLevel(element)
		const config = removeConfigs.find((c) => c.level === level)
		if (config) {
			config.fn(element.paths)
			return true
		}
		return false
	}

	static async checkRemove(element: MemoTree): Promise<boolean> {
		const msgConfigs = [
			{
				level: MemoLevel.Folder,
				msg: RemoveMemoMsg.Folder,
			},
			{
				level: MemoLevel.File,
				msg: RemoveMemoMsg.File,
			},
		]
		const Remove = 'remove'
		const level = MemoProvider.getElementLevel(element)
		const config = msgConfigs.find((c) => c.level === level)
		if (config) {
			let msg = config.msg
			const r = await vscode.window.showWarningMessage(msg, { modal: true }, Remove)
			return r === Remove
		}
		return false
	}
	static removeFolder(paths: string[]) {
		const memo = config.env.memo
		const folderName = paths[0]
		const index = memo.findIndex((m) => m.name === folderName)
		if (index !== -1) {
			memo.splice(index, 1)
			return updateEnv('memo', memo)
		}

		config.log.appendLine('folder not exist')
	}
	static removeFile(paths: string[]) {
		const memo = config.env.memo
		const [folderName, fileName] = paths
		const folder = memo.find((m) => m.name === folderName)
		if (folder) {
			const index = folder.children.findIndex((f) => f.name === fileName)
			if (index !== -1) {
				folder.children.splice(index, 1)
				return updateEnv('memo', memo)
			}
		}
		config.log.appendLine('file not exist')
	}
}

export class MemoTree extends vscode.TreeItem {
	constructor(
		public label: string,
		public id: string,
		public paths: string[],
		public collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.Collapsed,
		public command?: vscode.Command
	) {
		super(label, vscode.TreeItemCollapsibleState.Collapsed)
	}
	contextValue = 'memo'
}

import { existDir, writeFileAsync } from '../common/util'
import { config, updateEnv } from '../config'
import * as path from 'path'
import { ResolverParam } from '../provider/resolver'
export function addFolder(name: string) {
	if (config.env.memo.find((v) => v.name === name)) {
		throw new Error('folder already exists')
	}
	config.env.memo.push({
		name,
		children: [],
	})
	updateEnv('memo', config.env.memo)
}
export function deleteFolder(name: string) {
	const memo = config.env.memo
	const index = memo.findIndex((item) => item.name === name)
	memo.splice(index, 1)
	updateEnv('memo', memo)
}
export async function addFolderFile(folderName: string, fileName: string) {
	const memo = config.env.memo
	const folder = memo.find((item) => item.name === folderName)
	if (folder) {
		folder.children.push({
			type: 'other',
			name: fileName,
			param: fileName,
		})
		const memoDir = path.join(config.cacheBaseDir, 'memo')
		const filePath = path.join(memoDir, fileName)
		await existDir(memoDir)
		await writeFileAsync(filePath, Buffer.alloc(0))
	}
}
export function addQuestion(folderName: string, name: string, param: Partial<ResolverParam>) {
	const memo = config.env.memo
	const folder = memo.find((item) => item.name === folderName)
	if (folder) {
		if (folder.children.find((v) => v.name === name)) {
			throw new Error('file already exists')
		}
		folder.children.push({
			type: 'question',
			name,
			param,
		})
		updateEnv('memo', memo)
	}
}
async function deleteFile(folderName: string, fileName: string) {
	const memo = config.env.memo
	const folder = memo.find((item) => item.name === folderName)
	if (folder) {
		const index = folder.children.findIndex((c) => c.name === fileName)
		if (index !== -1) {
			folder.children.splice(index, 1)
		}
	}
}

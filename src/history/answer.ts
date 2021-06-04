import { generateId, getDesc, getFuncNames, QuestionMeta, readFileAsync, writeFileAsync } from '../common/util'
import { submitStorage } from './storage'
import * as path from 'path'
import { config } from '../config'
import { fetchQuestion, getName } from '../webview/questionPreview'
import { preprocessCode } from '../util'
import { CodeLang, isAlgorithm, langMap } from '../common/langConfig'
import { Service } from '../lang/common'
import { writeFile, parseHtml } from '../common/util'
import { pathExists, readJson, writeJson, ensureFile } from 'fs-extra'
import { UpdateCommentOption } from '../model/common'
interface Answer {
	id: string
	code: string
	desc: string
	timestamp: string
	lang?: string
	titleSlug?: string
	questionId?: string
}

export class AnswerStorage {
	static answerStorage = new AnswerStorage()
	getFilePath(questionId: string) {
		const cacheDir = path.join(config.cacheDir, 'answer')
		return path.join(cacheDir, questionId + '.json')
	}
	static saveSubmit(filePath: string, text: string, result: any) {
		const desc = getDesc(text, filePath) || ''

		submitStorage.save({
			filePath: filePath,
			text,
			result,
			desc,
		})
	}
	async read(questionId: string): Promise<Answer[]> {
		const filePath = this.getFilePath(questionId)
		try {
			const arr = await readJson(filePath)
			return arr
		} catch (err) {
			console.log(err)
			return []
		}
	}
	async save(data: string, questionMeta: QuestionMeta) {
		const id = questionMeta.id!
		const historyfilePath = this.getFilePath(id)
		const arr = await this.read(id)
		const newAnswer: Answer = {
			code: data,
			id: generateId(),
			desc: questionMeta.desc || '',
			timestamp: Math.floor(Date.now() / 1000).toString(),
			lang: questionMeta.lang,
			questionId: id,
			titleSlug: questionMeta.titleSlug,
		}
		arr.push(newAnswer)
		await ensureFile(historyfilePath)
		await writeJson(historyfilePath, arr)
	}
	async updateComment({ id, questionId, comment }: UpdateCommentOption) {
		const arr = await this.read(questionId)
		const historyfilePath = this.getFilePath(questionId)
		let item = arr.find((v) => v.id === id)
		if (item) {
			item.desc = comment
		}
		await writeJson(historyfilePath, arr)
	}
	async newAnswer(filePath: string) {
		const data = await readFileAsync(filePath, { encoding: 'utf8' })
		const { questionMeta } = getFuncNames(data, filePath)
		const id = questionMeta.id
		if (!id) {
			return
		}
		await this.save(data, questionMeta)

		const { weekname, lang: langSlug } = questionMeta
		const param = {
			titleSlug: questionMeta.titleSlug,
			weekname: questionMeta.weekname,
			questionId: questionMeta.id,
		}
		const question = await fetchQuestion(param)
		const { codeSnippets, questionFrontendId, title, translatedTitle } = question
		const codeSnippet = codeSnippets.find((codeSnippet) => codeSnippet.langSlug === langSlug)
		if (codeSnippet) {
			const langSlug = codeSnippet.langSlug
			const langConfig = langMap[langSlug]
			const { name } = getName(questionFrontendId, title, translatedTitle, codeSnippet)
			let code = preprocessCode(question, weekname, codeSnippet, name)
			if (langConfig.lang === CodeLang.Java) {
				code = code.replace('class Solution', 'public class Solution')
			}
			if (isAlgorithm(langConfig.lang)) {
				await Service.handlePreImport(filePath)
			}

			await writeFile(filePath, code)
		}
	}
}
export const answerStorage = AnswerStorage.answerStorage

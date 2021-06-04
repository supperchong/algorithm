import { ConciseQuestion } from './model/common'
import fs = require('fs')
import { config, Config, log } from './config'
import { reRequire } from './util'
const COOKIE = 'cookie'
const TAG = 'tag'
export const ALLQUESTIONS = 'allQuestions'
class Cache {
	private cacheMap: Map<string, any> = new Map()
	config: Config
	constructor() {
		this.config = config
	}
	removeCache() {
		this.cacheMap.clear()
	}
	get(key: string) {
		return this.cacheMap.get(key)
	}
	set(key: string, value: any) {
		this.cacheMap.set(key, value)
	}
	has(key: string) {
		return this.cacheMap.has(key)
	}
	async getCookie() {
		const { cookiePath } = config
		if (this.has(COOKIE)) {
			return this.get(COOKIE)
		}
		try {
			const cookie = reRequire(cookiePath)
			this.set(COOKIE, cookie)
			return this.get(COOKIE)
		} catch (err) {
			return null
		}
	}
	getQuestions(): ConciseQuestion[] {
		const { questionPath } = config
		if (this.has(ALLQUESTIONS)) {
			return this.get(ALLQUESTIONS)
		}
		try {
			const allQuestions = reRequire(questionPath)
			const filterPrivilegeQuestions = allQuestions.filter((v) => !v.paid_only)
			this.set(ALLQUESTIONS, filterPrivilegeQuestions)
			return this.get(ALLQUESTIONS)
		} catch (err) {
			return []
		}
	}

	setQuestions(questions: ConciseQuestion[]) {
		const { questionPath } = config
		const filterPrivilegeQuestions = questions.filter((v) => !v.paid_only)
		this.set(ALLQUESTIONS, filterPrivilegeQuestions)
		fs.writeFile(
			questionPath,
			JSON.stringify(filterPrivilegeQuestions),
			{
				encoding: 'utf8',
			},
			(err) => {
				if (err) {
					log.append(err.message)
				}
			}
		)
	}
	updateQuestion(id: number, params) {
		const questions: ConciseQuestion[] = this.get(ALLQUESTIONS)
		if (questions) {
			const question = questions.find((q) => q.id === id)
			if (question) {
				question.status = 'ac'
				this.setQuestions(questions)
			}
		}
	}
	getTags() {
		const { tagPath } = config
		if (this.has(TAG)) {
			return this.get(TAG)
		}
		try {
			const tags = reRequire(tagPath)
			this.set(TAG, tags)
			return this.get(TAG)
		} catch (err) {
			return null
		}
	}
	setTags(tags) {
		const { tagPath } = config
		this.set(TAG, tags)
		fs.writeFile(
			tagPath,
			JSON.stringify(tags),
			{
				encoding: 'utf8',
			},
			(err) => {
				if (err) {
					log.append(err.message)
				}
			}
		)
	}
	getQuestionDescription() {}
}
export const cache = new Cache()

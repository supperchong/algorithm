import { ConciseQuestion, MapIdConciseQuestion, Tag } from './model/common'
import fs = require('fs')
import { config, Config, log } from './config'
import { reRequire } from './util'
const COOKIE = 'cookie'
const TAG = 'tag'
export const ALLQUESTIONS = 'allQuestions'
export const MAPIDQUESTION = 'MapIdQuestion'
interface CacheMap {
	[COOKIE]: Cookie
	[TAG]: Tag[]
	[ALLQUESTIONS]: ConciseQuestion[]
	[MAPIDQUESTION]: MapIdConciseQuestion
	[titleSlug: string]: any
}
interface Cookie {
	cookie: string
	'x-csrftoken': string
}
class Cache {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private cacheMap: Partial<CacheMap> = {}
	config: Config
	constructor() {
		this.config = config
	}
	removeCache() {
		this.cacheMap = {}
	}
	get<T extends keyof CacheMap>(key: T) {
		return this.cacheMap[key]
	}
	set<T extends keyof CacheMap, R extends CacheMap[T]>(key: T, value: R) {
		this.cacheMap[key] = value
	}
	has(key: string) {
		return key in this.cacheMap
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
			return this.get(ALLQUESTIONS) || []
		}
		try {
			const allQuestions = reRequire(questionPath)
			let filterPrivilegeQuestions = allQuestions
			if (!config.displayLock) {
				filterPrivilegeQuestions = allQuestions.filter((v) => !v.paid_only)
			}
			this.set(ALLQUESTIONS, filterPrivilegeQuestions)
			return this.get(ALLQUESTIONS) || []
		} catch (err) {
			return []
		}
	}

	setQuestions(questions: ConciseQuestion[]) {
		const { questionPath } = config
		let filterPrivilegeQuestions = questions
		if (!config.displayLock) {
			filterPrivilegeQuestions = questions.filter((v) => !v.paid_only)
		}
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
	updateQuestion(id: number, params: Partial<ConciseQuestion>) {
		const questions: ConciseQuestion[] | undefined = this.get(ALLQUESTIONS)
		if (questions) {
			const question = questions.find((q) => q.id === id)
			if (question) {
				Object.assign(question, params)
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
	setTags(tags: Tag[]) {
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
}
export const cache = new Cache()

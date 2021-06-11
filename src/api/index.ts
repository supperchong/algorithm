import { config } from '../config'
import * as apiCn from './api.cn'
import * as apiEn from './api'
import { getDb } from '../db'
import * as modelCn from '../model/question.cn'
import * as modelEn from '../model/question'

export const api = {
	async fetchQuestionDetailById(id: string | number) {
		if (typeof id === 'string') {
			id = parseInt(id)
		}
		const db = await getDb()
		const out = await db.read(id)
		if (out) {
			return JSON.parse(out)
		}
	},
	async fetchQuestionDetail(titleSlug: string) {
		if (config.lang === 'en') {
			return apiEn.api.fetchQuestionDetail(titleSlug)
		} else {
			return apiCn.api.fetchQuestionDetail(titleSlug)
		}
	},
	async fetchContestQuestionDetail(titleSlug: string, weekname: string) {
		if (config.lang === 'en') {
			return apiEn.api.fetchContestQuestionDetail(titleSlug, weekname)
		} else {
			return apiCn.api.fetchContestQuestionDetail(titleSlug, weekname)
		}
	},
	async fetchQuestionByItemId(id: string) {
		if (config.lang === 'en') {
			const res = await apiEn.api.fetchChapterItem(id)
			return res.item.question
		}
	},
	async saveQuestionDetail(question) {
		const db = await getDb()
		await db.add(JSON.stringify(question), Number(question.questionId), Number(question.questionFrontendId))
	},
	async submitContest(options: modelCn.SubmitContestOptions | modelEn.SubmitContestOptions) {
		if (config.lang === 'en') {
			return apiEn.api.submitContest(options)
		} else {
			return apiCn.api.submitContest(options)
		}
	},
	async submit(options: modelCn.SubmitOptions | modelEn.SubmitOptions) {
		if (config.lang === 'en') {
			return apiEn.api.submit(options)
		} else {
			return apiCn.api.submit(options)
		}
	},

	async check(options: modelCn.CheckOptions | modelEn.CheckOptions) {
		if (config.lang === 'en') {
			return apiEn.api.check(options)
		} else {
			return apiCn.api.check(options)
		}
	},
	checkContest(options: modelCn.CheckContestOptions | modelEn.CheckContestOptions) {
		if (config.lang === 'en') {
			return apiEn.api.checkContest(options)
		} else {
			return apiCn.api.checkContest(options)
		}
	},
	async getAllQuestions() {
		if (config.lang === 'en') {
			return apiEn.api.getAllQuestions()
		} else {
			return apiCn.api.getAllQuestions()
		}
	},
	async fetchSubmissions(options: modelCn.SubmissionsOptions | modelEn.SubmissionsOptions) {
		if (config.lang === 'en') {
			return apiEn.api.fetchSubmissions(options)
		} else {
			return apiCn.api.fetchSubmissions(options)
		}
	},
	async fetchSubmissionDetail(options: modelCn.SubmissionDetailOptions) {
		if (config.lang === 'en') {
			return apiEn.api.fetchSubmissionDetail(options)
		} else {
			return apiCn.api.fetchSubmissionDetail(options)
		}
	},
}

export async function refreshQuestions() {
	if (config.lang === 'en') {
		await apiEn.api.refreshQuestions()
	} else {
		await apiCn.api.refreshQuestions()
	}
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function handleCategorieQuestions(data) {
	const { stat_status_pairs } = data
	const questions = stat_status_pairs.map((v) => ({
		fid: String(v.stat.frontend_question_id),
		level: v.difficulty.level,
		id: v.stat.question_id,
		title: v.stat.question__title,
		slug: v.stat.question__title_slug,
		acs: v.stat.total_acs,
		submitted: v.stat.total_submitted,
		paid_only: v.paid_only,
		status: v.status,
		name: v.stat.question__title,
	}))
	return questions
}
export { apiEn, apiCn }

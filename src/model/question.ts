import { CodeSnippet, GraphqlVariables, SubmissionComment } from './common'

export interface Chapter {
	descriptionText: string
	id: string
	slug: string
	title: string
}
export interface ChaptersRes {
	chapters: Chapter[]
}
interface ChapterQuestion {
	chapterId: number
	id: string
	isEligibleForCompletion: boolean
	paidOnly: boolean
	prerequisites: unknown[]
	title: string
	type: number
}
interface ChapterDetail {
	description: string
	id: string
	slug: string
	title: string
	items: ChapterQuestion[]
}
export interface ChapterRes {
	chapter: ChapterDetail
}
interface GetOrCreateExploreSession {
	progress: string
}

interface DailyProgress {
	is_complete: boolean
}
interface DailyQuestionMap {
	[key: string]: DailyProgress
}
export interface DailyWeekMap {
	[key: string]: DailyQuestionMap
}
export interface ChaptersProgressRes {
	getOrCreateExploreSession: GetOrCreateExploreSession
}
interface ChapterItem {
	question: Pick<Question, 'questionId' | 'title' | 'titleSlug'>
}
export interface ChapterItemRes {
	item: ChapterItem
}

export interface ConciseQuestion {
	fid: string
	level: number
	id: number
	title: string
	slug: string
	acs: number
	submitted: number
	paid_only: boolean
	status: string
	name: string
}
export interface MapIdConciseQuestion {
	[id: number]: ConciseQuestion
}

export interface TodayRecordData {
	todayRecord: TodayRecord[]
}
interface TodayRecord {
	question: Pick<Question, 'questionFrontendId' | 'titleSlug' | 'translatedTitle'>
	lastSubmission: LastSubmission
	date: string
	userStatus: UserStatus
	__typename: string
}
interface LastSubmission {
	id: string
	__typename: string
}
type UserStatus = 'FINISH' | 'NOT_START'

export interface QuestionTranslationData {
	translations: Translation[]
}
interface Translation {
	questionId: string
	title: string
}

export interface GraphqlResponse<T> {
	data: T
}
export interface DailyQuestionRecordData {
	dailyQuestionRecords: [DailyQuestionRecord]
}
export interface DailyQuestionRecord {
	date: string

	question: Pick<Question, 'questionId' | 'questionFrontendId' | 'titleSlug' | 'title' | 'translatedTitle'>
	userStatus: string
	__typename: string
}

export interface GraphqlRequestData {
	operationName: string | null
	query: string
	variables: GraphqlVariables
}

export interface QuestionData {
	question: Question
}
export interface Question {
	questionId: string
	questionFrontendId: string
	boundTopicId: number
	title: string
	titleSlug: string
	content: string
	translatedTitle: string
	translatedContent: string
	isPaidOnly: boolean
	difficulty: string
	likes: number
	dislikes: number
	isLiked: unknown
	similarQuestions: string
	contributors: []
	langToValidPlayground: string
	topicTags: TopicTags[]
	companyTagStats: unknown
	codeSnippets: CodeSnippet[]
	stats: string
	hints: string[]
	solution: Solution
	status: Status
	sampleTestCase: string
	metaData: string
	judgerAvailable: boolean
	judgeType: string
	mysqlSchemas: string[]
	enableRunCode: boolean
	envInfo: string
	book: unknown
	isSubscribed: boolean
	isDailyQuestion: boolean
	dailyRecordStatus: string
	editorType: string
	ugcQuestionId: unknown
	style: string
	__typename: string

	// questionTitleSlug: string
}
interface Solution {
	canSeeDetail: boolean
	id: string
}
type Status = 'ac' | 'notac' | null

interface TopicTags {
	name: string
	slug: string
	translatedName: string
	questions: number[] //question id
	__typename: string
}

export interface ContestData {
	allContests: Pick<Contest, 'title' | 'titleSlug' | 'startTime' | 'duration' | 'originStartTime' | 'isVirtual'>[]
}
interface Contest {
	containsPremium: boolean
	title: string
	cardImg: string
	titleSlug: string
	description: string
	startTime: number
	duration: number
	originStartTime: number
	isVirtual: boolean
	company: Company
	__typename: string
}
interface Company {
	watermark: string
	__typename: string
}

export interface TagData {
	topics: TopicTags[]
}
// interface Topics {
//     slug: string
//     name: string
//     questions: number[]
//     translatedName: string
// }

export interface SubmitOptions {
	titleSlug: string
	typed_code: string
	question_id: string
	lang?: string
}
export interface SubmitContestOptions extends SubmitOptions {
	weekname: string
}
export interface SubmitResponse {
	submission_id: number
}
export interface CheckResponse {
	status_code: number
	lang: string
	run_success: boolean
	status_runtime: string
	memory: number
	question_id: string
	elapsed_time: number
	compare_result: string
	code_output: string
	std_output: string
	last_testcase: string
	task_finish_time: number
	task_name: string
	finished: boolean
	status_msg: string
	state: State
	fast_submit: boolean
	total_correct: number
	total_testcases: number
	submission_id: string
	runtime_percentile: number
	status_memory: string
	memory_percentile: number
	pretty_lang: string
}

export interface CheckContestResponse {
	state: State
}
type State = 'PENDING' | 'STARTED' | 'SUCCESS'

export interface CheckOptions {
	submission_id: number
	titleSlug: string
}
export interface CheckContestOptions extends CheckOptions {
	weekname: string
}

export interface SubmissionsResponse {
	submissionList: SubmissionList
}
export interface SubmissionsOptions {
	lastKey?: string
	limit?: number
	offset?: number
	titleSlug: string
}
interface SubmissionList {
	lastKey: string
	hasNext: boolean
	submissions: Submissions[]
}
export interface Submissions {
	id: string
	statusDisplay: string
	lang: string
	runtime: string
	timestamp: string
	url: string
	isPending: string
	memory: string
	submissionComment?: SubmissionComment
}
export interface SubmissionDetailOptions {
	id: string
}

export interface SubmissionDetailPageData {
	submissionData: SubmissionData
	questionId: string
	sessionId: string
	getLangDisplay: string
	submissionCode: string
	editCodeUrl: string
	checkUrl: string
	runtimeDistributionFormatted: string
	memoryDistributionFormatted: string
	langs: unknown[]
	runtime: string
	memory: string
	enableMemoryDistribution: string
	nonSufficientMsg: string
}
interface SubmissionData {
	status_code: number
	runtime: string
	memory: string
	total_correct: string
	total_testcases: string
	compare_result: string
	input_formatted: string
	input: string
	expected_output: string
	code_output: string
	last_testcase: string
}

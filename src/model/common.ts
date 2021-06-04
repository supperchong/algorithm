export interface GraphqlVariables {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	[key: string]: any
}
export interface GraphRes<T> {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	errors: any
	data: T
}
export enum Lang {
	en = 'en',
	cn = 'cn',
}
export interface Tag {
	slug: string
	name: string
	questions: number[]
	translatedName: string
}
export interface CodeSnippet {
	lang: string
	langSlug: string
	code: string
}
// export type CodeLang = 'C++' | 'Java' | 'Python' | 'Python3' | 'C' | 'C#' | 'JavaScript' | 'Ruby' | 'Swift' | 'Go' | 'Scala' | 'Kotlin' | 'Rust' | 'PHP' | 'TypeScript'
// export const CodeLangs = ['C++', 'Java', 'Python', 'Python3', 'C', 'C#', 'JavaScript', 'Ruby', 'Swift', 'Go', 'Scala', 'Kotlin', 'Rust', 'PHP', 'TypeScript']
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
	input_formatted?: string
	expected_output?: string
}
type State = 'PENDING' | 'STARTED' | 'SUCCESS'
export interface MapIdConciseQuestion {
	[id: number]: ConciseQuestion
}
export interface Problems {
	user_name: string
	num_solved: number
	num_total: number
	ac_easy: number
	ac_medium: number
	ac_hard: number
	stat_status_pairs: StatStatusPairs[]
	frequency_high: number
	frequency_mid: number
	category_slug: string
}
interface StatStatusPairs {
	stat: Stat
	status: unknown
	difficulty: Difficulty
	paid_only: boolean
	is_favor: boolean
	frequency: number
	progress: number
}
interface Difficulty {
	level: number
}
interface Stat {
	question_id: number
	question__title: string
	question__title_slug: string
	question__hide: boolean
	total_acs: number
	total_submitted: number
	total_column_articles: number
	frontend_question_id: string
	is_new_question: boolean
}
export enum ErrorStatus {
	Unlogin = 403,
	InvalidCookie = 499,
}

export enum AskForImportState {
	Yes = 'Yes',
	No = 'No',
	Later = 'Later',
}

export enum PendingStatus {
	NotPending = 'Not Pending',
	Pending = 'Pending',
}
export enum FlagType {
	BLUE = 'BLUE',
	ORANGE = 'ORANGE',
	GREEN = 'GREEN',
	PURPLE = 'PURPLE',
	RED = 'RED',
}
export interface SubmissionComment {
	comment: string
	flagType: FlagType
}
export interface Submission {
	id: string
	isPending: PendingStatus
	submissionComment?: SubmissionComment
	lang: string
	memory: string
	runtime: string
	statusDisplay: string
	timestamp: string
	url: string
}

export interface LocalSubmission {
	code: string
	submission: Submission
}

export type LocalSubmissionArr = LocalSubmission[]

export enum HistoryType {
	Answer = 'answer',
	LocalSubmit = 'localSubmit',
	RemoteSubmit = 'remoteSubmit',
}

export interface UpdateCommentOption {
	id: string
	comment: string
	questionId: string
}
export type UpdateRemoteCommentOption = Omit<UpdateCommentOption, 'questionId'>

type Requred<T, R extends keyof T> = {
	[key in R]-?: T[key]
} &
	{
		[key in keyof T]: T[key]
	}
export function checkParams<T, R extends keyof T>(obj: T, attrs: R[]): asserts obj is Requred<T, R> {
	const verify = attrs.every((attr) => !!obj[attr])
	if (!verify) {
		const attr = attrs.find((attr) => !obj[attr])!
		throw new Error(`options error, ${attr} is ${obj[attr]}`)
	}
}

export interface ContestDetail {
	contest: Contest
	questions: ContestQuestion[]
	user_num: number
	has_chosen_contact: boolean
	company: Company
	registered: boolean
	containsPremium: boolean
}
interface Company {
	name: string
	description: string
	logo: string
	slug?: string
}
interface ContestQuestion {
	id: number
	question_id: number
	credit: number
	title: string
	english_title: string
	title_slug: string
	category_slug: string
}
interface Contest {
	id: number
	title: string
	title_slug: string
	description: string
	duration: number
	start_time: number
	is_virtual: boolean
	origin_start_time: number
	is_private: boolean
	related_contest_title?: unknown
	discuss_topic_id?: number
}

export interface CnContestPageData {
	questionId: string
	questionIdHash: string
	questionTitleSlug: string
	questionTitle: string
	questionSourceTitle: string
	questionExampleTestcases: string
	categoryTitle: string
	contestTitleSlug: string
	loginUrl: string
	isSignedIn: boolean
	sessionId: string
	reverseUrl: ReverseUrl
	enableRunCode: boolean
	enableSubmit: boolean
	submitUrl: string
	interpretUrl: string
	judgeType: string
	nextChallengePairs?: unknown
	codeDefinition: CodeDefinition[]
	enableTestMode: boolean
	metaData: MetaData
	sampleTestCase: string
	judgerAvailable: boolean
	envInfo: EnvInfo
	questionContent: string
	questionSourceContent: string
	editorType: string
}
interface EnvInfo {
	cpp: string[]
	java: string[]
	python: string[]
	c: string[]
	csharp: string[]
	javascript: string[]
	ruby: string[]
	swift: string[]
	golang: string[]
	python3: string[]
	scala: string[]
	kotlin: string[]
	rust: string[]
	php: string[]
	typescript: string[]
	racket: string[]
}
interface MetaData {
	name: string
	params: Param[]
	return: Return
}
interface Return {
	type: string
}
interface Param {
	name: string
	type: string
}
export interface CodeDefinition {
	value: string
	text: string
	defaultCode: string
}
interface ReverseUrl {
	latest_submission: string
	account_login: string
	maintenance: string
	profile: string
}

export interface CommonQuestion {
	translatedContent: string
	translatedTitle: string
	questionFrontendId: string
	metaData: string
	content: string
	title: string
	titleSlug: string
	codeSnippets: CodeSnippet[]
	questionId: string
	questionSourceContent?: string
}

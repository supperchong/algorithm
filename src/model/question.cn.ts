import { FlagType, SubmissionComment } from "./common";

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
type UserStatus = 'FINISH' | 'NOT_START';

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
    variables: object
}

export interface QuestionData {
    question: Question
}
export interface Question {
    questionSourceContent?: string
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
    isLiked: any
    similarQuestions: string
    contributors: []
    langToValidPlayground: string
    topicTags: TopicTags[]
    companyTagStats: any
    codeSnippets: CodeSnippet[]
    stats: string
    hints: Hints[]
    solution: Solution
    status: Status
    sampleTestCase: string
    metaData: string
    judgerAvailable: boolean
    judgeType: string
    mysqlSchemas: string[]
    enableRunCode: boolean
    envInfo: string
    book: any
    isSubscribed: boolean
    isDailyQuestion: boolean
    dailyRecordStatus: string
    editorType: string
    ugcQuestionId: any
    style: string
    __typename: string

    // questionTitleSlug: string
}
interface Solution {
    canSeeDetail: boolean
    id: string
}
type Status = 'ac' | 'notac' | null;
interface Hints {
}
export interface CodeSnippet {
    lang: string
    langSlug: string
    code: string
    __typename: string
}
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
type State = 'PENDING' | 'STARTED' | 'SUCCESS';

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
interface Submissions {
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
export interface UpdateCommentOptions {
    comment: string
    flagType?: FlagType
    submissionId: string
}
export interface UpdateCommentResponse {
    submissionCreateOrUpdateSubmissionComment: SubmissionCreateOrUpdateSubmissionComment
}

interface SubmissionCreateOrUpdateSubmissionComment {
    ok: boolean
}

export interface SubmissionDetailOptions {
    id: string
}
export interface SubmissionDetailResponse {
    submissionDetail?: SubmissionDetail
}
interface SubmissionDetail {
    id: string
    code: string
    runtime: string
    memory: string
    rawMemory: string
    statusDisplay: string
    timestamp: number
    lang: string
    passedTestCaseCnt: number
    totalTestCaseCnt: number
    sourceUrl: string
    question: Question
    outputDetail: OutputDetail
    __typename: string
    submissionComment: SubmissionComment
}

interface OutputDetail {
    codeOutput: string
    expectedOutput: string
    input: string
    compileError: string
    runtimeError: string
    lastTestcase: string
    __typename: String
}
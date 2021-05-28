export interface GraphRes<T> {
    errors: any
    data: T
}
export enum Lang {
    en = 'en',
    cn = 'cn'
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
type State = 'PENDING' | 'STARTED' | 'SUCCESS';
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
    status: any
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
    InvalidCookie = 499
}

export enum AskForImportState {
    Yes = 'Yes',
    No = 'No',
    Later = 'Later'
}
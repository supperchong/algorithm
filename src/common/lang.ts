import { CaseList } from "./util";

export type MetaData = LanguageMetaData | DataBaseMetaData | ShellMetaData
interface Param {
    name: string,
    type: string,
}
interface ReturnType {
    type: string
}
export interface LanguageMetaData {
    name: string,
    params: Param[],
    return: ReturnType
}
export interface DataBaseMetaData {
    database: true,
    mssql: string[],
    mysql: string[],
    oraclesql: string[]
}
export interface ShellMetaData {
    shell: true
}

export interface TestOptions {
    caseList: CaseList
    metaData: LanguageMetaData
    filePath: string
    originCode: string
}
export type DebugOptions = Omit<TestOptions, 'caseList'>
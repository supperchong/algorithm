import { ResolverParam } from '../provider/resolver'

interface MemoQuestionFile {
	type: 'question'
	name: string
	param: Partial<ResolverParam>
}
interface MemoOtherFile {
	type: 'other'
	name: string
	param: string
}
export type MemoFile = MemoQuestionFile | MemoOtherFile
export interface MemoFolder {
	name: string
	children: MemoFile[]
}

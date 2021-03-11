import { api, getTags, getQuestionsByTag, getQuestionsByDifficult, getAllQuestions } from '../api/api'
import { config } from '../config'
import { DailyWeekMap } from '../model/question';
import * as vscode from 'vscode';
import { QuestionTree } from './questionsProvider'
import { ConciseQuestion } from '../model/common';
import { normalizeQuestions } from '../common/util'

export interface ResolverParam {
    tag: string
    titleSlug: string
    weekname: string
    questionId: number
    chapterId: string
    itemId: string
}


interface ResolverReturn extends Pick<QuestionTree, 'label' | 'id' | 'key' | 'type' | 'param'> {
    isLast?: boolean
    isAC?: boolean
    paidOnly?: boolean
}
export type ResolverFn = (param: Partial<ResolverParam>) => Promise<ResolverReturn[]> | ResolverReturn[]

interface RootResolver {
    Query: () => Promise<ResolverReturn[]> | ResolverReturn[]
}
export interface ResolverTypeBase {
    [key: string]: ResolverFn | ResolverTypeBase
}
export type ResolverType = ResolverTypeBase & RootResolver


export const resolverEn: ResolverType = {
    Query() {
        //'Company', 'Favorite',
        return ['All', 'Difficulty', 'Tag', 'Contest', 'DailyChallenge'].map(v => ({
            type: 'Catalogue',
            key: v.toLowerCase(),
            label: v,
            id: v
        }));
    },
    Catalogue: {
        async all() {
            const questions = await getAllQuestions();
            return normalizeQuestions(questions, 'all');
        },
        difficulty() {
            return ['Easy', 'Medium', 'Hard'].map(v => ({
                type: 'Difficulty',
                key: v.toLowerCase(),
                label: v,
                id: v
            }));
        },
        async tag() {
            const tags = await getTags();
            return tags.map(tag => ({
                type: 'Tag',
                key: 'tagkey',
                label: tag,
                id: tag,
                param: {
                    tag
                }
            }));
        },

        // company() {

        // },
        // favorite() {

        // },
        async contest() {
            const contests = await api.fetchContests();
            return contests.map(contest => ({
                type: 'Contest',
                key: 'contestKey',
                label: contest.title,
                id: contest.title,
                param: {
                    titleSlug: contest.titleSlug,
                }
            }));
        },
        async dailychallenge() {
            const { chapters } = await api.fetchChapters()
            return chapters.map(chapter => ({
                type: "Chapter",
                label: chapter.title,
                id: chapter.title,
                param: {
                    // titleSlug: chapter.slug,
                    chapterId: chapter.id
                }

            }))

        }
    },
    async Chapter({ chapterId }) {
        if (!chapterId) {
            return []
        }
        const chapterDetail = await api.fetchChapter(chapterId)
        const chaptersProgressRes = await api.fetchChapterProgress()
        const progress = chaptersProgressRes?.getOrCreateExploreSession?.progress
        let isAC = false
        let progressMap: DailyWeekMap | null = null
        try {
            progressMap = JSON.parse(progress)
        } catch (err) {
            progressMap = null
        }

        const items = chapterDetail.chapter.items
        return items.map(item => {
            return {
                type: 'DailyQuestion',
                label: item.title,
                id: 'DailyQuestion' + item.title,
                isLast: true,
                isAC: progressMap ? progressMap[chapterId][item.id].is_complete : false,
                paidOnly: item.paidOnly,
                param: {
                    itemId: item.id,

                }
            }
        })
    },
    Tag: {
        async tagkey({ tag }) {
            if (!tag) {return []}
            const questions = await getQuestionsByTag(tag);
            return normalizeQuestions(questions, 'tag' + tag);
        }
    },

    Difficulty: {
        async easy() {
            const key = 'easy'
            const questions = await getQuestionsByDifficult(key);
            return normalizeQuestions(questions, key);
        },
        async medium() {
            const key = 'medium'
            const questions = await getQuestionsByDifficult(key);
            return normalizeQuestions(questions, key);
        },
        async hard() {
            const key = 'hard'
            const questions = await getQuestionsByDifficult(key);
            return normalizeQuestions(questions, key);
        }
    },
    // Company() {

    // },
    // Favorite() {

    // },
    Contest: {
        async contestKey({ titleSlug }) {
            if (!titleSlug) {

                return []
            }
            const data = await api.fetchContest(titleSlug);
            const questions = data.questions;
            return questions.map(question => ({
                type: 'QuestionContest',
                label: question.id + ' ' + question.title,
                id: 'QuestionContest' + question.id,
                isLast: true,
                param: {
                    titleSlug: question.title_slug,
                    fatherTitleSlug: titleSlug,
                }
            }));
        }
    },
};
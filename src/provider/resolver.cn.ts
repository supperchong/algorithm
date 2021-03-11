import { api, getTags, getQuestionsByTag, getQuestionsByDifficult, getAllQuestions, getCategories, getQuestionsByCategory } from '../api/api.cn'
import { ResolverType } from './resolver'
import { normalizeQuestions } from '../common/util'


export const resolverCn: ResolverType = {
    Query() {
        //'Company', 'Favorite',
        return ['All', 'Difficulty', 'Category', 'Tag', 'Contest', 'TodayRecord'].map(v => ({
            key: v.toLowerCase(),
            type: 'Catalogue',
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
                key: v.toLowerCase(),
                type: 'Difficulty',
                label: v,
                id: v
            }));
        },
        category() {
            const categories = getCategories()
            return categories.map(v => ({
                label: v.label,
                type: 'Category',
                key: v.category_slug,
                id: 'Category' + v.category_slug,

            }))
        },
        async tag() {
            const tags = await getTags();
            return tags.map(tag => ({
                key: 'tagkey',
                type: 'Tag',
                label: tag,
                id: tag,
                param: {
                    tag,
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
                key: 'contestKey',
                type: 'Contest',
                label: contest.title,
                id: contest.title,
                param: {
                    titleSlug: contest.titleSlug,
                }
            }));
        },
        async todayrecord() {
            const record = await api.fetchTodayRecord();
            return record.map(v => ({
                type: 'Question',
                label: v.question.questionFrontendId + '.' + v.question.translatedTitle,
                isAC: v.userStatus === 'FINISH', //NOT_START
                isLast: true,
                id: 'todayrecord' + v.question.questionFrontendId,
                param: {
                    titleSlug: v.question.titleSlug,
                }
            }));
        }
    },
    Category: {
        async algorithm() {
            const key = 'algorithm'
            const questions = await getQuestionsByCategory(key);
            return normalizeQuestions(questions, key);
        },
        async lcci() {
            const key = 'lcci'
            const questions = await getQuestionsByCategory(key);
            return normalizeQuestions(questions, key);
        },
        async lcof() {
            const key = 'lcof'
            const questions = await getQuestionsByCategory(key);
            return normalizeQuestions(questions, key);
        }
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
            if (!titleSlug) {return []}
            const data = await api.fetchContest(titleSlug);
            const questions = data.questions;
            return questions.map(question => ({
                type: 'QuestionContest',
                label: question.title,
                isLast: true,
                param: {
                    titleSlug: question.title_slug,
                    weekname: titleSlug
                }
            }));
        }
    },

};
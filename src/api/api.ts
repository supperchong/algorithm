import axios, { AxiosRequestConfig } from 'axios';
import fs = require('fs');
import { cache, ALLQUESTIONS } from '../cache';
import { ChapterItemRes, ChaptersRes, ChapterRes, ConciseQuestion, MapIdConciseQuestion, CheckContestOptions, CheckOptions, SubmitContestOptions, CheckResponse, SubmitOptions, SubmitResponse, TagData, GraphqlResponse, QuestionTranslationData, TodayRecordData, DailyQuestionRecordData, DailyQuestionRecord, QuestionData, GraphqlRequestData, ContestData, ChaptersProgressRes } from '../model/question';
import { Problems } from '../model/common'
import { getDb } from '../db';
import { GraphRes, ErrorStatus } from '../model/common'
import { showLoginMessage } from '../login/index'
import { window } from 'vscode';
import { signInCommand } from '../commands';
const MAPIDQUESTION = 'MapIdQuestion';
const monthEns = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"]
const categories: Category[] = [
    'algorithms',
    'database',
    'shell',
    'concurrency',
    "all"
];

type Category = 'algorithms' | 'database' | 'shell' | 'concurrency' | 'all';
interface PlainObject {
    [key: string]: any
}
function checkParams(obj: PlainObject, attrs: string[]) {
    let verify = attrs.every(attr => obj[attr]);
    if (!verify) {
        throw new Error('options有误 options:' + obj + ',attrs:' + attrs);
    }
}

async function getHeaders() {
    const cookie = await cache.getCookie();
    return {
        'user-agent': "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.87 Safari/537.36",
        // 'x-requested-with': "XMLHttpRequest",
        ...cookie
    };
}
export async function fetchAllQuestions() {
    const url = 'https://leetcode.com/graphql';
    const headers = await getHeaders();
    axios.request({
        url,
        headers,
        data: {
            operationName: "getQuestionTranslation",
            query: `query getQuestionTranslation($lang: String) {\n  translations: allAppliedQuestionTranslations(lang: $lang) {\n    title\n    questionId\n    __typename\n  }\n}\n`,
            variables: {}
        }
    });
}

async function request<T>(config: AxiosRequestConfig): Promise<T> {
    const headers = await getHeaders();

    return axios.request<T>({
        ...config,
        headers: {
            ...config.headers,
            ...headers
        }
    }).then(res => res.data).catch(async err => {
        if (err.response.status === ErrorStatus.Unlogin) {
            showLoginMessage()

        } else if (err.response.status === ErrorStatus.InvalidCookie) {
            showLoginMessage()
        }
        return Promise.reject(err)
    });
}
async function graphql<T>(data: GraphqlRequestData): Promise<T> {
    const headers = await getHeaders();
    return request<GraphRes<T>>({
        url: 'https://leetcode.com/graphql',
        data,
        method: 'POST',
        headers: {
            origin: "https://leetcode.com",
            referer: "https://leetcode.com/problemset/all/",
            ...headers
        }
    }).then(res => {
        if (res.errors) {
            return Promise.reject(res.errors);
        }
        return res.data;
    })

}
const config = {
    allQuestions:
    {
        operationName: "getQuestionTranslation",
        query: `query getQuestionTranslation($lang: String) {\n  translations: allAppliedQuestionTranslations(lang: $lang) {\n    title\n    questionId\n    __typename\n  }\n}\n`,
        variables: {}
    },
    getQuestionsByCategory(category: Category): AxiosRequestConfig {
        return {
            url: `https://leetcode.com/api/problems/${category}/`,
            method: "GET"
        };
    }
    ,
    tags: {
        url: "https://leetcode.com/problems/api/tags/",
        referer: "https://leetcode.com/problemset/all/"
    },
    contests: {

        operationName: null,
        variables: {},
        query: "{\n  brightTitle\n  allContests {\n       title\n      titleSlug\n     startTime\n    duration\n    originStartTime\n    isVirtual\n      __typename\n  }\n}\n"

    },
    getChapters() {
        const monthIndex = new Date().getMonth();
        const year = new Date().getFullYear();
        const monthEn = monthEns[monthIndex]
        const cardSlug = `${monthEn}-leetcoding-challenge-${year}`
        return { "operationName": "GetChapters", "variables": { "cardSlug": cardSlug }, "query": "query GetChapters($cardSlug: String!) {\n  chapters(cardSlug: $cardSlug) {\n    descriptionText\n    id\n    title\n    slug\n    __typename\n  }\n}\n" };
    },
    getChapter(chapterId: string | number) {
        const monthIndex = new Date().getMonth();
        const year = new Date().getFullYear();
        const monthEn = monthEns[monthIndex]
        const cardSlug = `${monthEn}-leetcoding-challenge-${year}`
        return { "operationName": "GetChapter", "variables": { "chapterId": chapterId, "cardSlug": cardSlug }, "query": "query GetChapter($chapterId: String, $cardSlug: String) {\n  chapter(chapterId: $chapterId, cardSlug: $cardSlug) {\n    ...ExtendedChapterDetail\n    description\n    __typename\n  }\n}\n\nfragment ExtendedChapterDetail on ChapterNode {\n  id\n  title\n  slug\n  items {\n    id\n    title\n    type\n    info\n    paidOnly\n    chapterId\n    isEligibleForCompletion\n    prerequisites {\n      id\n      chapterId\n      __typename\n    }\n    __typename\n  }\n  __typename\n}\n" }
    },
    getChapterItem(itemId: string) {
        return { "operationName": "GetItem", "variables": { "itemId": itemId }, "query": "query GetItem($itemId: String!) {\n  item(id: $itemId) {\n    id\n    title\n    type\n    paidOnly\n    lang\n    isEligibleForCompletion\n    hasAppliedTimeTravelTicket\n    question {\n      questionId\n      title\n      titleSlug\n      __typename\n    }\n    article {\n      id\n      title\n      __typename\n    }\n    video {\n      id\n      __typename\n    }\n    htmlArticle {\n      id\n      __typename\n    }\n    webPage {\n      id\n      __typename\n    }\n    __typename\n  }\n  isCurrentUserAuthenticated\n  validTimeTravelTicketCount\n}\n" }
    },
    getChaptersProgress() {
        const monthIndex = new Date().getMonth();
        const year = new Date().getFullYear();
        const monthEn = monthEns[monthIndex]
        const cardSlug = `${monthEn}-leetcoding-challenge-${year}`
        return { "operationName": "GetOrCreateExploreSession", "variables": { "cardSlug": cardSlug }, "query": "mutation GetOrCreateExploreSession($cardSlug: String!) {\n  getOrCreateExploreSession(cardSlug: $cardSlug) {\n    ok\n    errors\n    progress\n    cardId\n    __typename\n  }\n}\n" }
    },
    getDailyQuestionRecords() {
        const monthIndex = new Date().getMonth();
        const year = new Date().getFullYear();
        const monthEn = monthEns[monthIndex]
        const cardSlug = `${monthEn}-leetcoding-challenge-${year}`

        return { "operationName": "GetChaptersWithItems", "variables": { "cardSlug": cardSlug }, "query": "query GetChaptersWithItems($cardSlug: String!) {\n  chapters(cardSlug: $cardSlug) {\n    ...ExtendedChapterDetail\n    descriptionText\n    __typename\n  }\n}\n\nfragment ExtendedChapterDetail on ChapterNode {\n  id\n  title\n  slug\n  items {\n    id\n    title\n    type\n    info\n    paidOnly\n    chapterId\n    isEligibleForCompletion\n    prerequisites {\n      id\n      chapterId\n      __typename\n    }\n    __typename\n  }\n  __typename\n}\n" };
    },
    getContest(titleSlug: string): AxiosRequestConfig {
        return {
            url: `https://leetcode.com/contest/api/info/${titleSlug}/`,
            method: 'GET'
        };

    },
    getQuestionDetail(titleSlug: string) {
        return { "operationName": "questionData", "variables": { "titleSlug": titleSlug }, "query": "query questionData($titleSlug: String!) {\n  question(titleSlug: $titleSlug) {\n    questionId\n    questionFrontendId\n    boundTopicId\n    title\n    titleSlug\n    content\n    translatedTitle\n    translatedContent\n    isPaidOnly\n    difficulty\n    likes\n    dislikes\n    isLiked\n    similarQuestions\n    exampleTestcases\n    contributors {\n      username\n      profileUrl\n      avatarUrl\n      __typename\n    }\n    topicTags {\n      name\n      slug\n      translatedName\n      __typename\n    }\n    companyTagStats\n    codeSnippets {\n      lang\n      langSlug\n      code\n      __typename\n    }\n    stats\n    hints\n    solution {\n      id\n      canSeeDetail\n      paidOnly\n      hasVideoSolution\n      paidOnlyVideo\n      __typename\n    }\n    status\n    sampleTestCase\n    metaData\n    judgerAvailable\n    judgeType\n    mysqlSchemas\n    enableRunCode\n    enableTestMode\n    enableDebugger\n    envInfo\n    libraryUrl\n    adminUrl\n    __typename\n  }\n}\n" }

    },
    getQuestionContest(titleSlug: string, weekname: string): AxiosRequestConfig {
        return {
            url: `https://leetcode.com/contest/${weekname}/problems/${titleSlug}/`,
            method: 'GET',
            headers: {
                referer: `https://leetcode.com/contest/${weekname}/`
            }
        };
    },
    getSubmitContest(options: SubmitContestOptions): AxiosRequestConfig {
        const { titleSlug, weekname, question_id, typed_code } = options;
        let attrs = ['titleSlug', 'weekname', 'question_id', 'typed_code'];
        checkParams(options, attrs);
        return {
            url: `https://leetcode.com/contest/api/${weekname}/problems/${titleSlug}/submit/`,
            method: 'POST',
            headers: {
                'x-requested-with': "XMLHttpRequest",
                origin: "https://leetcode.com",
                referer: `https://leetcode.com/contest/${weekname}/problems/${titleSlug}/`
            },
            data: {
                "question_id": question_id,
                "data_input": "",
                "lang": "javascript",
                "typed_code": typed_code,
                "test_mode": false,
                "judge_type": "large"
            }
        };
    },
    getSubmit(options: SubmitOptions): AxiosRequestConfig {
        const { titleSlug,
            question_id,
            typed_code,
            lang = 'javascript', } = options;
        checkParams(options, ['titleSlug', 'question_id', 'typed_code']);
        return {
            url: `https://leetcode.com/problems/${titleSlug}/submit/`,
            method: 'POST',
            headers: {
                referer: `https://leetcode.com/problems/${titleSlug}/submissions/`,
                origin: 'https://leetcode.com'

            },
            data: {
                question_id,
                lang,
                typed_code,
                test_mode: false,
                test_judger: "",
                questionSlug: titleSlug
            }
        };
    },
    getCheck(options: CheckOptions): AxiosRequestConfig {
        const { submission_id, titleSlug } = options;
        checkParams(options, ['submission_id', 'titleSlug']);
        return {
            url: `https://leetcode.com/submissions/detail/${submission_id}/check/`,
            method: 'GET',
            headers: {
                referer: `https://leetcode.com/problems/${titleSlug}/submissions/`
            },

        };
    },
    getContestCheck(options: CheckContestOptions): AxiosRequestConfig {
        const { submission_id, titleSlug, weekname } = options;
        checkParams(options, ['submission_id', 'titleSlug', 'weekname']);

        return {
            url: `https://leetcode.com/submissions/detail/${submission_id}/check/`,
            method: 'GET',
            headers: {
                referer: `https://leetcode.com/contest/${weekname}/problems/${titleSlug}/`,
                'x-requested-with': "XMLHttpRequest"
            },

        };
    }


};
export async function getAllQuestions() {

    let questions = cache.getQuestions();
    if (questions.length) {
        return questions;
    }
    await freshQuestions();
    return cache.getQuestions();

}
export async function freshQuestions() {
    let questions: ConciseQuestion[] = [];
    const data = await api.fetchCategorieQuestions('all');
    questions = handleCategorieQuestions(data);
    // await setTranslations(questions);
    questions.sort((q1, q2) => {
        const fid1: string = q1.fid;
        const fid2: string = q2.fid;
        if (fid1.startsWith('LCP') && fid2.startsWith('LCP')) {
            const rgx = /LCP (\d+)/;
            const match1 = fid1.match(rgx);
            const match2 = fid2.match(rgx);
            if (match1 && match2) {
                return parseInt(match1[1]) - parseInt(match2[1]);
            }
            return 0;
        } else if (fid1.startsWith('LCP')) {
            return 1;
        } else if (fid2.startsWith('LCP')) {
            return -1;
        }
        return parseInt(fid1) - parseInt(fid2);
    });
    cache.setQuestions(questions);
}
async function getMapIdQuestion(): Promise<object> {
    if (cache.has(MAPIDQUESTION)) {
        return cache.get(MAPIDQUESTION);
    }
    const questions = await getAllQuestions();
    let map: MapIdConciseQuestion = {};
    for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        map[question.id] = question;
    }
    cache.set(MAPIDQUESTION, map);
    return map;
}
export async function getDifficulty() {
    const questions = await getAllQuestions();

}
export async function getQuestionDetailById(id: string) {
    const db = await getDb()
    const out = await db.read(parseInt(id))
    if (out) { return JSON.parse(out) }

}
export async function saveQuestionDetail(question) {
    const db = await getDb()
    await db.add(JSON.stringify(question), Number(question.questionId), Number(question.questionFrontendId))
}
export async function getTags() {
    let tags: Tag[] = cache.getTags();
    if (!tags) {
        const data = await api.fetchTags();
        tags = data.topics;
        cache.setTags(tags);
    }

    return tags.map(tag => tag.translatedName || tag.name);
}
export async function getQuestionsByTag(translatedName: string) {
    let tags = cache.getTags();
    let tag = tags.find(tag => tag.translatedName === translatedName || tag.name === translatedName);

    if (tag && tag.questions) {
        const map = await getMapIdQuestion();
        return tag.questions.map(id => map[id]).filter(v => !!v);
    }
    return [];
}
export async function getQuestionsByDifficult(difficult) {
    const mapDifficultLevel = {
        easy: 1,
        medium: 2,
        hard: 3
    };
    const questions = await getAllQuestions();
    return questions.filter(q => q.level === mapDifficultLevel[difficult]);
}
function handleCategorieQuestions(data) {
    const { stat_status_pairs } = data;
    const questions = stat_status_pairs.map(v => ({
        fid: String(v.stat.frontend_question_id),
        level: v.difficulty.level,
        id: v.stat.question_id,
        title: v.stat.question__title,
        slug: v.stat.question__title_slug,
        acs: v.stat.total_acs,
        submitted: v.stat.total_submitted,
        paid_only: v.paid_only,
        status: v.status,
        name: v.stat.question__title
    }));
    return questions;
}
async function setTranslations(questions) {
    const translationsQuestions = await api.fetchTranslations();
    let mapIdTitle = {};
    for (let i = 0; i < translationsQuestions.length; i++) {
        const { questionId, title } = translationsQuestions[i];
        mapIdTitle[questionId] = title;
    }
    for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        question.name = mapIdTitle[question.id] || question.title;
    }
}
interface Question {
    questionId: string
    title: string
}
interface Tag {
    slug: string
    name: string
    questions: number[]
    translatedName: string
}
export const api = {
    freshQuestions,
    getAllQuestions,
    fetchTranslations(): Promise<Question[]> {
        return graphql<QuestionTranslationData>(config.allQuestions).then(data => data.translations);
    },
    fetchCategorieQuestions(categorie: Category) {
        return request<Problems>(config.getQuestionsByCategory(categorie));
    },
    fetchContests() {
        return graphql<ContestData>(config.contests).then(data => data.allContests);
    },
    fetchTags() {
        return request<TagData>(config.tags);
    },
    fetchContest(titleSlug: string) {
        return request<any>(config.getContest(titleSlug));
    },
    fetchChapters() {
        return graphql<ChaptersRes>(config.getChapters())
    },
    fetchChapter(chapterId: string | number) {
        return graphql<ChapterRes>(config.getChapter(chapterId))
    },
    fetchChapterProgress() {
        return graphql<ChaptersProgressRes>(config.getChaptersProgress())
    },
    fetchDailyQuestionRecords() {
        return graphql<DailyQuestionRecordData>(config.getDailyQuestionRecords()).then(data => data.dailyQuestionRecords);
    },
    fetchChapterItem(id: string) {
        return graphql<ChapterItemRes>(config.getChapterItem(id))

    },
    async fetchQuestionDetailByItemId(id: string) {
        const { item } = await api.fetchChapterItem(id)
        return api.fetchQuestionDetail(item.question.titleSlug)
    },
    fetchQuestionDetail(titleSlug: string): Promise<Question> {
        if (cache.get(titleSlug)) {
            return cache.get(titleSlug);
        }
        return graphql<QuestionData>(config.getQuestionDetail(titleSlug)).then(data => {
            if (data && data.question && data.question.titleSlug === titleSlug) {
                cache.set(titleSlug, data.question);
            }
            return cache.get(titleSlug);
        });
    },
    fetchContestQuestionDetail(titleSlug: string, weekname: string) {
        return request<string>(config.getQuestionContest(titleSlug, weekname));
    },
    submit(options: SubmitOptions) {
        return request<SubmitResponse>(config.getSubmit(options));
    },
    submitContest(options: SubmitContestOptions) {
        return request<SubmitResponse>(config.getSubmitContest(options));
    },
    check(options: CheckOptions) {
        return request<CheckResponse>(config.getCheck(options));
    },
    checkContest(options: CheckContestOptions) {
        return request<CheckResponse>(config.getContestCheck(options));
    }
};
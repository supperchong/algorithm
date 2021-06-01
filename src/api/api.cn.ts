import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import fs = require('fs');
import { cache, ALLQUESTIONS } from '../cache';
import { ConciseQuestion, MapIdConciseQuestion, CheckContestOptions, CheckOptions, SubmitContestOptions, CheckResponse, SubmitOptions, SubmitResponse, TagData, GraphqlResponse, QuestionTranslationData, TodayRecordData, DailyQuestionRecordData, DailyQuestionRecord, QuestionData, GraphqlRequestData, ContestData, SubmissionsOptions, SubmissionsResponse, UpdateCommentOptions, UpdateCommentResponse, SubmissionDetailOptions, SubmissionDetailResponse } from '../model/question.cn';
import { Problems, ErrorStatus, FlagType } from '../model/common'
import { showLoginMessage } from '../login/index'

import { getDb } from '../db';
import { GraphRes } from '../model/common'
import { log } from '../config'
import { sortQuestions } from '../util'
const MAPIDQUESTION = 'MapIdQuestion';
const monthEns = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"]
const categories: Category[] = [
    'algorithms',
    'database',
    'shell',
    'concurrency',
    'lcof',
    'lcci',
    "all"
];
const curCategories = [{
    label: '面试题',
    category_slug: 'lcci'
}, {
    label: '剑指 Offer',
    category_slug: 'lcof'
}]
type Category = 'all' | 'algorithms' | 'database' | 'shell' | 'concurrency' | 'lcof' | 'lcci';
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
    const url = 'https://leetcode-cn.com/graphql';
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
    }).then(res => res.data).catch(async (err: AxiosError) => {
        if (err.response) {
            if (err.response.status === ErrorStatus.Unlogin) {
                showLoginMessage()

            } else if (err.response.status === ErrorStatus.InvalidCookie) {
                showLoginMessage()
            }
        }
        if (err.message) {
            log.appendLine(err.message)
        }

        return Promise.reject(err)
    });
}
async function graphql<T>(data: GraphqlRequestData): Promise<T> {
    const headers = await getHeaders();
    return request<GraphRes<T>>({
        url: 'https://leetcode-cn.com/graphql',
        data,
        method: 'POST',
        headers: {
            origin: "https://leetcode-cn.com",
            referer: "https://leetcode-cn.com/problemset/all/",
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
            url: `https://leetcode-cn.com/api/problems/${category}/`,
            method: "GET"
        };
    }
    ,
    tags: {
        url: "https://leetcode-cn.com/problems/api/tags/",
        referer: "https://leetcode-cn.com/problemset/all/"
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
    todayRecord: { "operationName": "questionOfToday", "variables": {}, "query": "query questionOfToday {\n  todayRecord {\n    question {\n      questionFrontendId\n      titleSlug\n  translatedTitle\n    __typename\n    }\n    lastSubmission {\n      id\n      __typename\n    }\n    date\n    userStatus\n    __typename\n  }\n}\n" },
    getDailyQuestionRecords() {
        const monthIndex = new Date().getMonth();
        const year = new Date().getFullYear();
        const monthEn = monthEns[monthIndex]
        const cardSlug = `${monthEn}-leetcoding-challenge-${year}`
        return { "operationName": "GetChaptersWithItems", "variables": { "cardSlug": cardSlug }, "query": "query GetChaptersWithItems($cardSlug: String!) {\n  chapters(cardSlug: $cardSlug) {\n    ...ExtendedChapterDetail\n    descriptionText\n    __typename\n  }\n}\n\nfragment ExtendedChapterDetail on ChapterNode {\n  id\n  title\n  slug\n  items {\n    id\n    title\n    type\n    info\n    paidOnly\n    chapterId\n    isEligibleForCompletion\n    prerequisites {\n      id\n      chapterId\n      __typename\n    }\n    __typename\n  }\n  __typename\n}\n" };
    },
    getContest(titleSlug: string): AxiosRequestConfig {
        return {
            url: `https://leetcode-cn.com/contest/api/info/${titleSlug}/`,
            method: 'GET'
        };

    },
    getQuestionDetail(titleSlug: string) {
        return { "operationName": "questionData", "variables": { "titleSlug": titleSlug }, "query": "query questionData($titleSlug: String!) {\n  question(titleSlug: $titleSlug) {\n    questionId\n    questionFrontendId\n    boundTopicId\n    title\n    titleSlug\n    content\n    translatedTitle\n    translatedContent\n    isPaidOnly\n    difficulty\n    likes\n    dislikes\n    isLiked\n    similarQuestions\n    contributors {\n      username\n      profileUrl\n      avatarUrl\n      __typename\n    }\n    langToValidPlayground\n    topicTags {\n      name\n      slug\n      translatedName\n      __typename\n    }\n    companyTagStats\n    codeSnippets {\n      lang\n      langSlug\n      code\n      __typename\n    }\n    stats\n    hints\n    solution {\n      id\n      canSeeDetail\n      __typename\n    }\n    status\n    sampleTestCase\n    metaData\n    judgerAvailable\n    judgeType\n    mysqlSchemas\n    enableRunCode\n    envInfo\n    book {\n      id\n      bookName\n      pressName\n      source\n      shortDescription\n      fullDescription\n      bookImgUrl\n      pressImgUrl\n      productUrl\n      __typename\n    }\n    isSubscribed\n    isDailyQuestion\n    dailyRecordStatus\n    editorType\n    ugcQuestionId\n    style\n    __typename\n  }\n}\n" };

    },
    getQuestionContest(titleSlug: string, weekname: string): AxiosRequestConfig {
        return {
            url: `https://leetcode-cn.com/contest/${weekname}/problems/${titleSlug}/`,
            method: 'GET',
            headers: {
                referer: `https://leetcode-cn.com/contest/${weekname}/`
            }
        };
    },
    getSubmitContest(options: SubmitContestOptions): AxiosRequestConfig {
        const { titleSlug, weekname, question_id, typed_code } = options;
        let attrs = ['titleSlug', 'weekname', 'question_id', 'typed_code'];
        checkParams(options, attrs);
        return {
            url: `https://leetcode-cn.com/contest/api/${weekname}/problems/${titleSlug}/submit/`,
            method: 'POST',
            headers: {
                'x-requested-with': "XMLHttpRequest",
                origin: "https://leetcode-cn.com",
                referer: `https://leetcode-cn.com/contest/${weekname}/problems/${titleSlug}/`
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
            url: `https://leetcode-cn.com/problems/${titleSlug}/submit/`,
            method: 'POST',
            headers: {
                referer: `https://leetcode-cn.com/problems/${titleSlug}/submissions/`,
                origin: 'https://leetcode-cn.com'

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
            url: `https://leetcode-cn.com/submissions/detail/${submission_id}/check/`,
            method: 'GET',
            headers: {
                referer: `https://leetcode-cn.com/problems/${titleSlug}/submissions/`
            },

        };
    },
    getContestCheck(options: CheckContestOptions): AxiosRequestConfig {
        const { submission_id, titleSlug, weekname } = options;
        checkParams(options, ['submission_id', 'titleSlug', 'weekname']);

        return {
            url: `https://leetcode-cn.com/submissions/detail/${submission_id}/check/`,
            method: 'GET',
            headers: {
                referer: `https://leetcode-cn.com/contest/${weekname}/problems/${titleSlug}/`,
                'x-requested-with': "XMLHttpRequest"
            },

        };
    },
    getSubmissions(options: SubmissionsOptions) {
        const { titleSlug, limit = 40, offset = 0, lastKey = null } = options;
        return { "operationName": "submissions", "variables": { "offset": offset, "limit": limit, "lastKey": lastKey, "questionSlug": titleSlug }, "query": "query submissions($offset: Int!, $limit: Int!, $lastKey: String, $questionSlug: String!, $markedOnly: Boolean, $lang: String) {\n  submissionList(offset: $offset, limit: $limit, lastKey: $lastKey, questionSlug: $questionSlug, markedOnly: $markedOnly, lang: $lang) {\n    lastKey\n    hasNext\n    submissions {\n      id\n      statusDisplay\n      lang\n      runtime\n      timestamp\n      url\n      isPending\n      memory\n      submissionComment {\n        comment\n        flagType\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n}\n" }

    },
    getUpdateComment(options: UpdateCommentOptions) {
        const { submissionId, flagType = FlagType.BLUE, comment } = options
        return { "operationName": "submissionCreateOrUpdateSubmissionComment", "variables": { "submissionId": submissionId, "flagType": flagType, "comment": comment }, "query": "mutation submissionCreateOrUpdateSubmissionComment($submissionId: ID!, $flagType: SubmissionFlagTypeEnum!, $comment: String!) {\n  submissionCreateOrUpdateSubmissionComment(comment: $comment, flagType: $flagType, submissionId: $submissionId) {\n    ok\n    __typename\n  }\n}\n" }
    },
    getSubmissionDetail(options: SubmissionDetailOptions) {
        const { id } = options
        return { "operationName": "mySubmissionDetail", "variables": { "id": id }, "query": "query mySubmissionDetail($id: ID!) {\n  submissionDetail(submissionId: $id) {\n    id\n    code\n    runtime\n    memory\n    rawMemory\n    statusDisplay\n    timestamp\n    lang\n    passedTestCaseCnt\n    totalTestCaseCnt\n    sourceUrl\n    question {\n      titleSlug\n      title\n      translatedTitle\n      questionId\n      __typename\n    }\n    ... on GeneralSubmissionNode {\n      outputDetail {\n        codeOutput\n        expectedOutput\n        input\n        compileError\n        runtimeError\n        lastTestcase\n        __typename\n      }\n      __typename\n    }\n    submissionComment {\n      comment\n      flagType\n      __typename\n    }\n    __typename\n  }\n}\n" }
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
    await setTranslations(questions);
    sortQuestions(questions)
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
export function getCategories() {
    return curCategories
}
export async function getQuestionsByCategory(category: string) {
    let c = curCategories.find(c => c.category_slug === category)
    if (!c) {
        return []
    }
    const label = c.label
    const questions = await getAllQuestions();
    return questions.filter(q => q.fid.startsWith(label));
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
export async function getQuestionsByDifficult(difficult: string) {
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
        fid: v.stat.frontend_question_id,
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
    fetchTodayRecord() {
        return graphql<TodayRecordData>(config.todayRecord).then(data => data.todayRecord);
    },
    fetchDailyQuestionRecords() {
        return graphql<DailyQuestionRecordData>(config.getDailyQuestionRecords()).then(data => data.dailyQuestionRecords);
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
    },
    fetchSubmissions(options: SubmissionsOptions) {
        return graphql<SubmissionsResponse>(config.getSubmissions(options))
    },
    updateComment(options: UpdateCommentOptions) {
        return graphql<UpdateCommentResponse>(config.getUpdateComment(options))
    },
    async fetchSubmissionDetail(options: SubmissionDetailOptions) {
        const submissionDetail = await graphql<SubmissionDetailResponse>(config.getSubmissionDetail(options))
        if (submissionDetail.submissionDetail) {
            return submissionDetail.submissionDetail?.code
        } else {
            return 'can not query'
        }

    }
};
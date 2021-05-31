import { answerStorage } from './answer'
import { submitStorage } from './storage'
import { config } from '../config'
import { HistoryType, Lang, UpdateCommentOption, UpdateRemoteCommentOption } from '../model/common'
import { api } from '../api/index'

export async function getHistory(questionId: string, fn: (code: string) => string) {
  const originAnswers = await answerStorage.read(questionId)
  const formatAnswers = originAnswers.map(v => {
    return {
      code: fn(v.code),
      obj: {
        desc: v.desc,
        timestamp: formatTimestamp(v.timestamp),
        id: v.id,
        lang: v.lang
      }
    }
  }).reverse()
  const answerData = {
    header: [{
      label: 'description',
      key: 'desc'
    }, {
      label: 'lang',
      key: 'lang'
    }, {
      label: 'timestamp',
      key: 'timestamp'
    }],
    arr: formatAnswers
  }
  const originSubmitStorage = await submitStorage.read(questionId)
  const formatSubmits = originSubmitStorage.map(v => {
    return {
      code: fn(v.code),
      obj: {
        ...v.submission,
        memory: v.submission.memory,
        comment: v.submission.submissionComment,
        statusDisplay: v.submission.statusDisplay
      }
    }
  }).reverse()

  const submitStorageData = {
    header: [{
      label: "statusDisplay",
      key: 'statusDisplay'
    }, {
      label: 'lang',
      key: 'lang'
    }, {
      label: 'memory',
      key: 'memory'
    }, {
      label: 'runtime',
      key: 'runtime'
    }, {
      label: 'comment',
      key: "comment"
    }],
    arr: formatSubmits
  }

  return {
    id: questionId,
    answerData: answerData,
    localSubmit: submitStorageData,
    // remoteSubmit: remoteStorageData
  }
}
export async function getRemoteSubmits(questionId: string) {
  const question = await api.fetchQuestionDetailById(questionId)
  const res = await api.fetchSubmissions({ titleSlug: question.titleSlug })
  const submissions = res.submissionList.submissions
  const formatRemoteSubmits = submissions.map(v => {
    return {
      code: '',
      obj: {
        ...v,
        memory: v.memory,
        timestamp: formatTimestamp(v.timestamp),
        comment: v?.submissionComment?.comment,
        id: v.id
      }

    }
  })
  const remoteStorageData = {
    header: [{
      label: "statusDisplay",
      key: 'statusDisplay'
    }, {
      label: 'lang',
      key: 'lang'
    }, {
      label: 'memory',
      key: 'memory'
    }, {
      label: 'runtime',
      key: 'runtime'
    }, {
      label: 'comment',
      key: "comment"
    }],
    arr: formatRemoteSubmits
  }
  return remoteStorageData
}
function formatTimestamp(time: string) {
  const num = parseInt(time) * 1000
  const date = new Date(num)
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  if (config.lang === Lang.cn) {
    return `${year}/${month}/${day} ${hours}:${minutes}`
  } else {
    return `${year}/${month}/${day} ${hours}:${minutes}`
  }

}
export function formatMemory(memory: number) {
  return Math.floor(memory / (1024 * 1024)) + 'M'
}

// export function updateComment(type: HistoryType.Answer | HistoryType.LocalSubmit, options: UpdateCommentOption): Promise<void>
// export function updateComment(type: HistoryType.RemoteSubmit, options: UpdateRemoteCommentOption): Promise<void>

export async function updateComment(type: HistoryType, options: UpdateCommentOption): Promise<any> {
  switch (type) {
    case HistoryType.Answer: {
      return answerStorage.updateComment(options)
    }
    case HistoryType.LocalSubmit: {
      return submitStorage.updateComment(options)
    }
    case HistoryType.RemoteSubmit: {
      return submitStorage.updateRemoteComment(options)
    }
  }
}
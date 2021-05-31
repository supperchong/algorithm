import * as path from 'path'
import { config } from '../config'
import { pathExists, readJson, writeJson, ensureFile } from 'fs-extra'
import { getDesc } from "../common/util";
import { Lang, UpdateCommentOption, UpdateRemoteCommentOption } from '../model/common';
import { apiCn } from '../api';
import { Submissions } from '../model/question'
interface Param {
  filePath: string
  text: string
  result: any
  desc?: string
}
interface LocalSubmit {
  id: string,
  code: string
  submission: Submission
  result: any
}
interface Submission {
  id: string
  statusDisplay: string
  lang: string
  runtime: string
  timestamp: string
  url: string
  isPending: string
  memory: string
  submissionComment: string
}
class SubmitStorage {
  static submitStorage = new SubmitStorage()
  arr: Param[] = []
  isWork = false
  getFilePath(question_id: string) {
    const cacheDir = path.join(config.cacheDir, 'submit')
    return path.join(cacheDir, question_id + '.json')
  }
  async read(question_id: string): Promise<LocalSubmit[]> {
    const filePath = this.getFilePath(question_id)
    try {
      const arr = await readJson(filePath)
      return arr
    } catch (err) {
      return []
    }

  }
  async save(options: Param) {
    if (this.isWork) {
      this.arr.push(options)
    } else {
      this.isWork = true
      await this.innerSave(options)
    }
  }
  saveSubmit(options: Param) {
    if (options.desc) {
      this.updateRemoteComment({ id: options.result.submission_id, comment: options.desc })
    }

    this.save(options)
  }
  updateRemoteComment({ id, comment }: UpdateRemoteCommentOption) {
    if (config.lang === Lang.cn && comment) {
      return apiCn.api.updateComment({
        submissionId: id,
        comment: comment
      })
    }
  }
  async updateComment({ id, questionId, comment }: UpdateCommentOption) {
    const arr = await this.read(questionId)
    const item = arr.find(v => v.id === id)
    if (item) {
      item.submission.submissionComment = comment
    }
    const filePath = this.getFilePath(questionId)
    return writeJson(filePath, arr)
  }
  private async innerSave(options: Param) {
    try {
      const id = options.result.question_id as string
      const r = options.result
      const filePath = this.getFilePath(id)
      const obj: LocalSubmit = {
        id: r.submission_id,
        code: options.text,
        submission: {
          id: r.submission_id,
          isPending: 'Not Pending',
          submissionComment: options.desc || '',
          lang: r.lang,
          memory: r.memory,
          runtime: r.status_runtime,
          statusDisplay: r.status_msg,
          timestamp: r.task_finish_time,
          url: '/submissions/detail/' + r.submission_id + '/'
        },
        result: options.result
      }
      let arr: any[] = []
      const exist = await pathExists(filePath)
      if (exist) {
        arr = await readJson(filePath)
        arr.push(obj)
      } else {
        arr.push(obj)
      }
      await ensureFile(filePath)
      await writeJson(filePath, arr)
    } catch (err) {
      console.log(err)
    }
    if (this.arr.length) {
      const opt = this.arr.shift()!
      await this.innerSave(opt)
    } else {
      this.isWork = false
    }
  }
}

export const submitStorage = SubmitStorage.submitStorage
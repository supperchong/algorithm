import { Lang } from '../model/common'
import { config } from '../config'
export enum Website {
    Leetcode = 'https:\/\/leetcode.com',
    LeetcodeCn = 'https:\/\/leetcode-cn.com'
}
export const WebsiteMap = {
    [Lang.cn]: Website.LeetcodeCn,
    [Lang.en]: Website.Leetcode
}
function baseTag(strs: TemplateStringsArray, ...arr: any[]) {
    const baseUrl = WebsiteMap[config.lang]
    console.log(config.lang)
    return baseUrl + '/' + arr.reduce((prev, cur, i) => prev + cur + strs[i + 1], strs[0])
}
export const getSolution = (titleSlug: string) => baseTag`problems/${titleSlug}/solution/`


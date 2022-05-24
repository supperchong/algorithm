import { Lang } from '../model/common'
import { config, DomainCN, DomainEN } from '../config'
export enum Website {
	Leetcode = 'https://leetcode.com',
	LeetcodeCn = 'https://leetcode.cn',
}
export const WebsiteMap = {
	[Lang.cn]: Website.LeetcodeCn,
	[Lang.en]: Website.Leetcode,
}
function baseTag(strs: TemplateStringsArray, ...arr: string[]): string {
	const baseUrl = WebsiteMap[config.lang]
	return baseUrl + '/' + arr.reduce((prev, cur, i) => prev + cur + strs[i + 1], strs[0])
}
export const getSolution = (titleSlug: string): string => baseTag`problems/${titleSlug}/solution/`

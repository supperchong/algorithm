import _request = require('request')
import { promisify } from 'util'
import { window } from 'vscode'
import { config, DomainCN, DomainEN } from '../config'
import { User } from './input'
import { writeFileAsync } from '../common/util'
import { signInCommand } from '../commands'

function parseCookie(cookie: string) {
	const keyValueStrArr = cookie.split(';')
	const map = {}
	keyValueStrArr.forEach((kvStr) => {
		let [key, value] = kvStr.split('=')
		key = key.trim()
		value = value.trim()
		map[key] = value
	})
	return map
}

async function saveCookie(cookie: string) {
	const cookiePath = config.cookiePath
	const map = parseCookie(cookie)
	const headers = { cookie }
	if (map['csrftoken']) {
		headers['x-csrftoken'] = map['csrftoken']
	}
	await writeFileAsync(cookiePath, JSON.stringify(headers))
}
// set-cookie
async function saveResCookie(cookies: string[] = []) {
	const map = {}
	for (let i = 0; i < cookies.length; i++) {
		const cookie = cookies[i]
		const arr = cookie.split(';')
		const kv = arr[0]
		let [key, value] = kv.split('=')
		key = key.trim()
		if (key) {
			map[key] = value
		}
	}
	const cookieStr = Object.keys(map)
		.map((key) => `${key}=${map[key]}`)
		.join('; ')
	const headers = { cookie: cookieStr }
	if (map['csrftoken']) {
		headers['x-csrftoken'] = map['csrftoken']
	}
	const cookiePath = config.cookiePath
	await writeFileAsync(cookiePath, JSON.stringify(headers))
}
function parseFormData(html: string) {
	const formRegExp = /<form.*name="password".*<\/form>/
	const r = formRegExp.exec(html.replace(/\n/g, ''))
	if (!r) {
		return Promise.reject({
			message: 'the page of login github not found',
			code: 3,
		})
	}
	const formStr = r[0]
	const inputRegExp = /<input[^>]*name="(.*?)"(?:[^>](?!alue))*(?:value="(.*?)")?[^>]*>/g
	let inputRegExpRes: RegExpExecArray | null = null
	let d = {}
	const defaultObj = {
		'webauthn-support': 'supported',
		'webauthn-iuvpaa-support': 'unsupported',
	}
	while ((inputRegExpRes = inputRegExp.exec(formStr))) {
		const name = inputRegExpRes[1]
		const value = inputRegExpRes[2]
		if (name) {
			d[name] = value || ''
		}
	}
	d = Object.assign(d, defaultObj)
	return d
}
type RequestAsync = (
	arg1: (_request.UriOptions & _request.CoreOptions) | (_request.UrlOptions & _request.CoreOptions)
) => Promise<_request.Response>
async function githubAuth(html: string, request: RequestAsync, user) {
	let data = parseFormData(html)
	data = Object.assign(data, {
		login: user.name,
		password: user.password,
	})
	// github login and then redirect back
	const res = await request({
		url: 'https://github.com/session',
		form: data,
		method: 'POST',
		followAllRedirects: true,
		headers: {
			'content-type': 'application/x-www-form-urlencoded',
		},
	})
	let body = res.body
	if (/Incorrect username or password/.test(body)) {
		return Promise.reject({
			message: 'Incorrect username or password',
			code: 3,
		})
	}
	// enable two-factor
	const twoFactorRegExp = /Two-factor authentication/
	if (twoFactorRegExp.test(body)) {
		body = await githubTwoFactorAuth(body, request)
	}
	return body
}
async function githubTwoFactorAuth(html: string, request: RequestAsync) {
	const authenticityTokenTwoFactor = html.match(/name="authenticity_token" value="(.*?)"/)
	if (authenticityTokenTwoFactor === null) {
		return Promise.reject({
			message: 'get GitHub two-factor page fail',
			code: 3,
		})
	}
	const code = await window.showInputBox({
		prompt: 'input the Authentication code',
	})
	if (!code) {
		return Promise.reject({
			message: 'cancel login',
			code: 2,
		})
	}
	const data = {
		otp: code,
		authenticity_token: authenticityTokenTwoFactor[1],
	}
	const res = await request({
		url: 'https://github.com/sessions/two-factor',
		form: data,
		method: 'POST',
		followAllRedirects: true,
		headers: {
			'content-type': 'application/x-www-form-urlencoded',
		},
	})
	return res.body
}
async function githubRedirectBack(body: string, request: RequestAsync) {
	const redirectRegExp = /<a id="js-manual-authorize-redirect" href="(.*?)"/

	const redirectRes = redirectRegExp.exec(body)
	if (!redirectRes) {
		return Promise.reject({
			message: 'github login redirect fail',
			code: 3,
		})
	}
	const href = redirectRes[1]

	// get the cookie
	const res = await request({
		url: href,
		method: 'GET',
	})

	const cookie = res.request.headers.cookie

	await saveCookie(cookie)
}

export async function githubLogin(user: User) {
	const domain = config.lang === 'en' ? DomainEN : DomainCN
	const url = `${domain}/accounts/github/login/?next=%2F`
	// store the cookie in request
	const j = _request.jar()
	const request: RequestAsync = promisify(_request.defaults({ jar: j }))
	// redirect to github auth page
	const res = await request({
		url: url,
		method: 'get',
	})
	if (res.statusCode !== 200) {
		return Promise.reject({
			message: 'github login fail',
			code: 3,
		})
	}
	const html = res.body
	const body = await githubAuth(html, request, user)
	await githubRedirectBack(body, request)
}

export async function cookieLogin(cookie: string) {
	await saveCookie(cookie)
}
export async function accountLogin(user: User) {
	// not support the us website
	const url = `${DomainCN}/accounts/login/`
	const request = promisify(_request)
	const res = await request({
		url,
		method: 'POST',
		headers: {
			Origin: DomainCN,
			Referer: url,
			Cookie: 'csrftoken=null;',
		},
		form: {
			login: user.name,
			password: user.password,
			csrfmiddlewaretoken: null,
		},
	})

	if (res.statusCode !== 302) {
		return Promise.reject({
			message: 'invalid username or password',
			code: 3,
		})
	}
	const cookies = res.headers['set-cookie']
	await saveResCookie(cookies)
}

export async function showLoginMessage() {
	const LOGIN = 'login'
	const r = await window.showInformationMessage('please login in', LOGIN)
	if (r === LOGIN) {
		if (config.questionsProvider) {
			signInCommand(config.questionsProvider)
		}
	}
}

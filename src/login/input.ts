import { QuickPickItem, window, Disposable, QuickInputButton, QuickInput, QuickInputButtons } from 'vscode'
import { accountLogin, cookieLogin, githubLogin } from '.'
import { refreshQuestions } from '../api/index'
import { cache } from '../cache'
import { config } from '../config'
import { QuestionsProvider } from '../provider/questionsProvider'
import { execWithProgress } from '../util'
class InputFlowAction {
	static back = new InputFlowAction()
	static cancel = new InputFlowAction()
	static resume = new InputFlowAction()
}

type InputStep = (input: MultiStepInput) => Thenable<InputStep | void>
interface QuickPickParameters<T extends QuickPickItem> {
	title: string
	step: number
	totalSteps: number
	items: T[]
	activeItem?: T
	placeholder: string
	buttons?: QuickInputButton[]
	shouldResume: () => Thenable<boolean>
}
interface InputBoxParameters {
	title: string
	step: number
	totalSteps: number
	value: string
	prompt: string
	password?: boolean
	validate: (value: string) => Promise<string | undefined>
	buttons?: QuickInputButton[]
	shouldResume: () => Thenable<boolean>
}
class MultiStepInput {
	static async run(start: InputStep) {
		const input = new MultiStepInput()
		return input.stepThrough(start)
	}

	private current?: QuickInput
	private steps: InputStep[] = []

	private async stepThrough(start: InputStep) {
		let step: InputStep | void = start
		while (step) {
			this.steps.push(step)
			if (this.current) {
				this.current.enabled = false
				this.current.busy = true
			}
			try {
				step = await step(this)
			} catch (err) {
				if (err === InputFlowAction.back) {
					this.steps.pop()
					step = this.steps.pop()
				} else if (err === InputFlowAction.resume) {
					step = this.steps.pop()
				} else if (err === InputFlowAction.cancel) {
					step = undefined
				} else {
					throw err
				}
			}
		}
		if (this.current) {
			this.current.dispose()
		}
	}

	async showQuickPick<T extends QuickPickItem, P extends QuickPickParameters<T>>({
		title,
		step,
		totalSteps,
		items,
		activeItem,
		placeholder,
		buttons,
		shouldResume,
	}: P) {
		const disposables: Disposable[] = []
		try {
			return await new Promise<T | (P extends { buttons: (infer I)[] } ? I : never)>((resolve, reject) => {
				const input = window.createQuickPick<T>()
				input.title = title
				input.step = step
				input.totalSteps = totalSteps
				input.placeholder = placeholder
				input.items = items
				if (activeItem) {
					input.activeItems = [activeItem]
				}
				input.buttons = [...(this.steps.length > 1 ? [QuickInputButtons.Back] : []), ...(buttons || [])]
				disposables.push(
					input.onDidTriggerButton((item) => {
						if (item === QuickInputButtons.Back) {
							reject(InputFlowAction.back)
						} else {
							// eslint-disable-next-line @typescript-eslint/no-explicit-any
							resolve(item as any)
						}
					}),
					input.onDidChangeSelection((items) => resolve(items[0])),
					input.onDidHide(() => {
						; (async () => {
							reject(
								shouldResume && (await shouldResume()) ? InputFlowAction.resume : InputFlowAction.cancel
							)
						})().catch(reject)
					})
				)
				if (this.current) {
					this.current.dispose()
				}
				this.current = input
				this.current.show()
			})
		} finally {
			disposables.forEach((d) => d.dispose())
		}
	}

	async showInputBox<P extends InputBoxParameters>({
		title,
		step,
		totalSteps,
		password = false,
		value,
		prompt,
		validate,
		buttons,
		shouldResume,
	}: P) {
		const disposables: Disposable[] = []
		try {
			return await new Promise<string | (P extends { buttons: (infer I)[] } ? I : never)>((resolve, reject) => {
				const input = window.createInputBox()
				input.title = title
				input.step = step
				input.totalSteps = totalSteps
				input.value = value || ''
				input.prompt = prompt
				input.password = password
				input.buttons = [...(this.steps.length > 1 ? [QuickInputButtons.Back] : []), ...(buttons || [])]
				let validating = validate('')
				disposables.push(
					input.onDidTriggerButton((item) => {
						if (item === QuickInputButtons.Back) {
							reject(InputFlowAction.back)
						} else {
							resolve(item as never)
						}
					}),
					input.onDidAccept(async () => {
						const value = input.value
						input.enabled = false
						input.busy = true
						if (!(await validate(value))) {
							resolve(value)
						}
						input.enabled = true
						input.busy = false
					}),
					input.onDidChangeValue(async (text) => {
						const current = validate(text)
						validating = current
						const validationMessage = await current
						if (current === validating) {
							input.validationMessage = validationMessage
						}
					}),
					input.onDidHide(() => {
						; (async () => {
							reject(
								shouldResume && (await shouldResume()) ? InputFlowAction.resume : InputFlowAction.cancel
							)
						})().catch(reject)
					})
				)
				if (this.current) {
					this.current.dispose()
				}
				this.current = input
				this.current.show()
			})
		} finally {
			disposables.forEach((d) => d.dispose())
		}
	}
}
export interface User {
	name: string
	password: string
}
async function inputName(input: MultiStepInput, user: Partial<User>, title: string): Promise<InputStep> {
	user.name = await input.showInputBox({
		step: 1,
		totalSteps: 2,
		validate: async () => '',
		prompt: 'please input username or email',
		title,
		value: '',
		shouldResume: () => Promise.resolve(false),
	})
	return (input) => inputPass(input, user, title)
}
async function inputPass(input: MultiStepInput, user: Partial<User>, title: string) {
	user.password = await input.showInputBox({
		step: 2,
		totalSteps: 2,
		password: true,
		validate: async () => '',
		prompt: 'please input password',
		title,
		value: '',
		shouldResume: () => Promise.resolve(false),
	})
}
function validUser(user: Partial<User>): user is User {
	return !!(user.name && user.password)
}
function validCookie(cookie: string) {
	return cookie.includes('LEETCODE_SESSION') && cookie.includes('csrftoken')
}
async function refresh(questionsProvider: QuestionsProvider) {
	cache.removeCache()
	const refreshPromise = refreshQuestions()
	await execWithProgress(refreshPromise, 'refresh questions')
	questionsProvider.refresh()
}
export async function selectLogin(questionsProvider: QuestionsProvider) {
	const githubItem = {
		label: 'Third-Party:GitHub',
		detail: 'Use GitHub account to login',
	}
	const cookieItem = {
		label: 'Leetcode Cookie',
		detail: 'Use Leetcode cookie copied from browser to login',
	}
	const accountItem = {
		label: 'Leetcode Account',
		detail: 'use Leetcode account to login',
	}
	const items = [githubItem, cookieItem]
	if (config.lang === 'cn') {
		items.unshift(accountItem)
	}
	const result = await window.showQuickPick(items)
	if (result === githubItem) {
		const user = await githubInput()
		if (!validUser(user)) {
			return
		}
		await execWithProgress(githubLogin(user), 'wait login')
		window.showInformationMessage('login success')
	} else if (result === cookieItem) {
		const cookie = await cookieInput()
		if (!cookie) {
			return
		}
		if (!validCookie(cookie)) {
			window.showErrorMessage('cookie is invalid')
			return
		}
		await cookieLogin(cookie)
		config.log.appendLine('save cookie success')
		// window.showInformationMessage('save cookie success')
		await refresh(questionsProvider)
		return
	} else if (result === accountItem) {
		const user = await accountInput()
		if (!validUser(user)) {
			return
		}
		await accountLogin(user)
		config.log.appendLine('login success')
		// window.showInformationMessage('login success')
		await refresh(questionsProvider)
	}
}
export async function githubInput(): Promise<Partial<User>> {
	const user: Partial<User> = {}
	await MultiStepInput.run((input) => inputName(input, user, 'login github'))
	return user
}
export async function cookieInput(): Promise<string | undefined> {
	const cookie = await window.showInputBox({
		prompt: 'copy the cookie from browser',
	})
	return cookie
}
export async function accountInput() {
	const user: Partial<User> = {}
	await MultiStepInput.run((input) => inputName(input, user, 'account login'))
	return user
}

// copy from https://github.com/microsoft/vscode-extension-samples/blob/master/quickinput-sample/src/multiStepInput.ts

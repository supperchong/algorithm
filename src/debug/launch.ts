import { fstat, writeSync } from 'fs'
import { Breakpoint, debug, SourceBreakpoint } from 'vscode'
import { existFile, mkdirSync } from '../common/util'
import { config } from '../config'
import * as vscode from 'vscode'
import { WorkspaceFolder, DebugConfiguration, ProviderResult, CancellationToken } from 'vscode'
import * as path from 'path'
import { getDebugConfig } from '../util'
import { writeFileSync } from '../common/util'
export function registerDebug() {
	class ConfigurationProvider implements vscode.DebugConfigurationProvider {
		provideDebugConfigurations(
			folder: WorkspaceFolder | undefined,
			token?: CancellationToken
		): ProviderResult<DebugConfiguration[]> {
			const debugConfiguration = getDebugConfig()
			return [debugConfiguration]
		}
		/**
		 * Massage a debug configuration just before a debug session is being launched,
		 * e.g. add all missing attributes to the debug configuration.
		 */
		resolveDebugConfigurationWithSubstitutedVariables(
			folder: WorkspaceFolder | undefined,
			debugConfig: DebugConfiguration,
			token?: CancellationToken
		): ProviderResult<DebugConfiguration> {
			const { nodeBinPath } = config
			debugConfig.runtimeExecutable = nodeBinPath
			return debugConfig
		}
	}
	class TaskProvider implements vscode.TaskProvider {
		static TaskType = 'algorithm'
		provideTasks() {
			const { debugOptionsFilePath, nodeBinPath } = config
			const debugTaskFilePath = path.resolve(__dirname, '../debugTask', 'index.js')
			const taskName = 'build'
			let tasks = [
				new vscode.Task(
					{
						type: TaskProvider.TaskType,
					},
					vscode.TaskScope.Workspace,
					taskName,
					TaskProvider.TaskType,
					new vscode.ProcessExecution(nodeBinPath, [debugTaskFilePath, '${file}', debugOptionsFilePath])
				),
			]
			const param = serializeBreaks(breaks as SourceBreakpoint[])
			writeFileSync(debugOptionsFilePath, param, { encoding: 'utf8' })
			return tasks
		}
		resolveTask(task: vscode.Task, token?: CancellationToken | undefined): ProviderResult<vscode.Task> {
			return task
		}
	}
	let breaks: Breakpoint[] = []
	debug.onDidChangeBreakpoints((e) => {
		breaks = breaks.concat(e.added)
		const removePoints = e.removed
		const editPoints = e.changed
		breaks = breaks.filter((b) => !removePoints.find((v) => v.id === b.id))
		breaks = breaks.map((v) => editPoints.find((eb) => eb.id === v.id) || v)
	})
	vscode.tasks.registerTaskProvider('algorithm', new TaskProvider())

	// Automatically set configuration more better
	// debug.registerDebugConfigurationProvider('node', new ConfigurationProvider())
}

interface CustomBreakpoint {
	path: string
	lines: number[]
}
function serializeBreaks(breaks: SourceBreakpoint[]): string {
	let pathMap = new Map<string, number[]>()
	breaks.forEach((b) => {
		const p = b.location.uri.fsPath
		const line = b.location.range.start.line
		if (!pathMap.has(p)) {
			pathMap.set(p, [line])
		} else {
			pathMap.get(p)!.push(line)
		}
	})
	let r: CustomBreakpoint[] = []
	for (const key of pathMap.keys()) {
		r.push({ path: key, lines: pathMap.get(key)! })
	}
	return JSON.stringify(r)
}
export function tranfromToCustomBreakpoint(breaks: SourceBreakpoint[]) {
	let pathMap = new Map<string, number[]>()
	breaks.forEach((b) => {
		const p = b.location.uri.fsPath
		const line = b.location.range.start.line
		if (!pathMap.has(p)) {
			pathMap.set(p, [line])
		} else {
			pathMap.get(p)!.push(line)
		}
	})
	let r: CustomBreakpoint[] = []
	for (const key of pathMap.keys()) {
		r.push({ path: key, lines: pathMap.get(key)! })
	}
	return r
}

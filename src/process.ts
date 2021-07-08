import * as cp from 'child_process'


export const processArr: cp.ChildProcess[] = []
export function clearProcessArr() {
	processArr.forEach(p => {
		p.kill()
	})
}

class ChildProcessProxy {
	processIdSet: Set<number> = new Set()
	clear() {
		this.processIdSet.forEach(pid => {
			process.kill(pid)
		})
	}
	add(p: cp.ChildProcess) {
		const pid = p.pid
		this.processIdSet.add(pid)
		p.once('exit', () => {
			this.processIdSet.delete(pid)
		})
	}
	remove(p: cp.ChildProcess | null) {
		if (!p) {
			return
		}
		if (this.processIdSet.has(p.pid)) {
			p.kill()
		}
	}
}

export const childProcessProxy = new ChildProcessProxy()
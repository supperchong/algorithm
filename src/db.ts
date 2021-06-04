import Db from './fileStorage/db'
import { config } from './config'
import { Lang } from './model/common'

const filename = 'question'
const dbMap: Partial<Record<Lang, Db>> = {}
export async function getDb(): Promise<Db> {
	const lang = config.lang
	const db = dbMap[lang]
	if (db) {
		return db
	} else {
		const dbDir = config.dbDir
		const db = new Db({
			dbDir,
			filename: filename,
		})
		await db.init()
		dbMap[lang] = db
		return db
	}
}

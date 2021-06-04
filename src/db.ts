import Db from './fileStorage/db'
import { config } from './config'
import { Lang } from './model/common'

const filename = 'question'
let dbMap: Partial<Record<Lang, Db>> = {}
export async function getDb(): Promise<Db> {
	let lang = config.lang
	if (dbMap[lang]) {
		return dbMap[lang]!
	} else {
		const dbDir = config.dbDir
		let db = new Db({
			dbDir,
			filename: filename,
		})
		await db.init()
		dbMap[lang] = db
		return db
	}
}

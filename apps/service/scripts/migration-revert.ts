/**
 * Revert the LAST applied migration (one step).
 *
 *   node scripts/dist/migration-revert.js
 *
 * Destructive by definition — back up the database first. Each migration's
 * down() is wrapped in its own transaction.
 */
import 'dotenv/config'
import { AppDataSource } from '../src/utils/database'

try {
  await AppDataSource.initialize()
  const before = (
    (await AppDataSource.query('SELECT name FROM migrations ORDER BY id DESC LIMIT 1')) as {
      name: string
    }[]
  )[0]?.name
  await AppDataSource.undoLastMigration({ transaction: 'each' })
  const after = (
    (await AppDataSource.query('SELECT name FROM migrations ORDER BY id DESC LIMIT 1')) as {
      name: string
    }[]
  )[0]?.name
  console.log(`[migration:revert] reverted · ${before ?? '(none)'} → now at ${after ?? '(empty)'}`)
} finally {
  if (AppDataSource.isInitialized) await AppDataSource.destroy()
}

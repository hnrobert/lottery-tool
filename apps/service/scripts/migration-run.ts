/**
 * Apply pending migrations to the database (target from DB_* env vars / .env).
 *
 *   node scripts/dist/migration-run.js
 *
 * Runs the exact same code path as server boot (initDataSource), so what you
 * get locally is what production does automatically on its next start.
 */
import 'dotenv/config'
import { resolve } from 'node:path'

const rootDir = resolve(import.meta.dirname, '../..')

const { initDataSource, closeDataSource, AppDataSource } = await import('../src/utils/database')

try {
  await initDataSource()
  console.log(
    `[migration:run] up to date · ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'lottery_system'} · ${rootDir}`,
  )
} finally {
  await closeDataSource()
}

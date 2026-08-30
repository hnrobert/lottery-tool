/**
 * Migration barrel — the ordered list of migrations, imported explicitly (not
 * globbed) so the compiled server bundle includes them and the app can
 * auto-apply pending migrations on boot. The `migration:*` CLI scripts reuse
 * this same list through src/utils/database.ts.
 *
 * After `pnpm migration:generate --name=<Name>`, register the new class here.
 */
import { Init1787934397009 } from './1787934397009-Init'
import { SignatureToPgsql1788027007612 } from './1788027007612-SignatureToPgsql'
import { AddSystemSettings1788091777967 } from './1788091777967-AddSystemSettings'

// typeorm@1 typings expect `MixedList<string | Function>` for the DataSource
// option; migration classes satisfy that at runtime (classes are functions)
// but not structurally, hence the cast.
export const migrations = [
  Init1787934397009,
  SignatureToPgsql1788027007612,
  AddSystemSettings1788091777967,
] as unknown as (string | Function)[]

# GitLab PostgreSQL Full Mirror Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the API-based GitLab mirror with a PostgreSQL full-table mirror datasource that imports real GitLab database tables into local NocoBase mirror tables and supports UI building.

**Architecture:** The plugin will connect directly to external PostgreSQL, inspect tables and columns from `information_schema`, create local mirror tables plus datasource collection metadata, and expose those local tables through a read-only datasource runtime. Client flow stays in data source manager, but the form and collection loader switch from API scope fields to PostgreSQL connection fields.

**Tech Stack:** NocoBase plugin system, `pg`, Sequelize/NocoBase database, React/Formily client schema.

---

### Task 1: Replace connector config model

**Files:**
- Modify: `packages/plugins/@my-project/plugin-datasource-mirror/src/server/services/datasource-connector.ts`
- Modify: `packages/plugins/@my-project/plugin-datasource-mirror/src/server/services/index.ts`
- Test: `packages/plugins/@my-project/plugin-datasource-mirror/src/server/__tests__/data-import.test.ts`

**Step 1: Write/adjust failing test expectations for PostgreSQL config shape**

Add tests for:
- host/port/database/schema/username/password parsing
- table listing
- schema fetch behavior

**Step 2: Run targeted test/typecheck**

Run: `yarn.cmd tsc -p packages/plugins/@my-project/plugin-datasource-mirror/tsconfig.json --noEmit`

**Step 3: Implement PostgreSQL connector**

Implement:
- `connect()`
- `disconnect()`
- `getTables()`
- `getTableSchema(tableName)`
- `queryTable(tableName)`

Use `pg` and `information_schema` / `pg_catalog` queries.

**Step 4: Re-run verification**

Run: `yarn.cmd tsc -p packages/plugins/@my-project/plugin-datasource-mirror/tsconfig.json --noEmit`

### Task 2: Rework import service for real tables

**Files:**
- Modify: `packages/plugins/@my-project/plugin-datasource-mirror/src/server/services/data-import.ts`
- Modify: `packages/plugins/@my-project/plugin-datasource-mirror/src/server/services/sync-utils.ts`
- Test: `packages/plugins/@my-project/plugin-datasource-mirror/src/server/__tests__/data-import.test.ts`

**Step 1: Add failing expectations for primary-key and no-primary-key sync**

Cover:
- upsert when primary key exists
- replace-all fallback when no primary key exists

**Step 2: Implement mirror table creation and sync**

Make import use real table schemas from PostgreSQL connector and ensure:
- deterministic mirror table naming
- local table creation
- insert/update/delete or replace behavior

**Step 3: Re-run verification**

Run: `yarn.cmd tsc -p packages/plugins/@my-project/plugin-datasource-mirror/tsconfig.json --noEmit`

### Task 3: Stabilize datasource runtime repositories

**Files:**
- Modify: `packages/plugins/@my-project/plugin-datasource-mirror/src/server/datasource/gitlab-postgres-mirror-datasource.ts`
- Modify: `packages/plugins/@my-project/plugin-datasource-mirror/src/server/datasource/mirror-repository.ts`
- Modify: `packages/plugins/@my-project/plugin-datasource-mirror/src/server/plugin.ts`

**Step 1: Reproduce current repository lookup failure from code path**

Trace how `dataSourcesCollections` resolve to mirror table repository names.

**Step 2: Implement repository resolution against local mirror tables**

Ensure:
- runtime collection metadata always carries mirror table name
- repository lookup falls back to local DB model/repository
- list/read actions no longer fail with `Target repository ... is not available`

**Step 3: Re-run typecheck**

Run: `yarn.cmd tsc -p packages/plugins/@my-project/plugin-datasource-mirror/tsconfig.json --noEmit`

### Task 4: Switch client form back to PostgreSQL mode

**Files:**
- Modify: `packages/plugins/@my-project/plugin-datasource-mirror/src/client/DataSourceSettingsForm.tsx`
- Modify: `packages/plugins/@my-project/plugin-datasource-mirror/src/client/index.ts`
- Modify: `packages/plugins/@my-project/plugin-datasource-mirror/src/client/export.ts`

**Step 1: Replace API scope fields with database connection fields**

Fields:
- host
- port
- database
- schema
- username
- password
- ssl
- webhook token
- full sync interval

Port should be blank by default.

**Step 2: Make `Load Collections` use real DB tables**

Collections table should show database tables returned by connector test endpoint.

**Step 3: Preserve current only-read field viewer**

Do not reintroduce editable field actions.

**Step 4: Re-run typecheck**

Run: `yarn.cmd tsc -p packages/plugins/@my-project/plugin-datasource-mirror/tsconfig.json --noEmit`

### Task 5: Handle migration from API datasource records

**Files:**
- Modify: `packages/plugins/@my-project/plugin-datasource-mirror/src/server/plugin.ts`
- Modify: `packages/plugins/@my-project/plugin-datasource-mirror/src/server/constants.ts`
- Modify: `packages/plugins/@my-project/plugin-datasource-mirror/README.md`

**Step 1: Decide runtime behavior for old API-mode records**

Implement either:
- clear error requiring recreation
or
- auto-ignore deprecated options

**Step 2: Update docs and UI messaging**

Explain this plugin now mirrors PostgreSQL tables, not GitLab API resources.

**Step 3: Re-run typecheck**

Run: `yarn.cmd tsc -p packages/plugins/@my-project/plugin-datasource-mirror/tsconfig.json --noEmit`

### Task 6: Verify end-to-end datasource behavior

**Files:**
- No code change required unless verification reveals a bug

**Step 1: Run plugin typecheck**

Run: `yarn.cmd tsc -p packages/plugins/@my-project/plugin-datasource-mirror/tsconfig.json --noEmit`
Expected: PASS

**Step 2: Restart dev stack if needed**

Run: `yarn.cmd dev`
Expected: frontend and backend boot normally

**Step 3: Verify datasource lifecycle manually**

Check:
- add datasource
- test connection
- load collections
- import `users` or another real GitLab table
- open field viewer
- build a UI table block from imported collection

**Step 4: Fix any remaining runtime bug from verification**

If a repository or UI-block error remains, patch minimal code and re-run the same manual flow.


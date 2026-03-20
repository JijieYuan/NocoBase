# GitLab PostgreSQL Mirror Plugin Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor `@my-project/plugin-datasource-mirror` into a working NocoBase plugin that mirrors selected GitLab 16 PostgreSQL tables into the local NocoBase database and syncs them manually or through a GitLab webhook trigger.

**Architecture:** Keep the existing plugin package name, but narrow the behavior to one datasource type: external PostgreSQL. The server owns datasource config, sync orchestration, mirror collection creation, and webhook-triggered sync. The client provides one settings page for datasource management and sync operations.

**Tech Stack:** NocoBase plugin APIs, TypeScript, React, Ant Design, PostgreSQL `pg`

---

### Task 1: Add regression coverage for the sync utility behavior

**Files:**
- Create: `packages/plugins/@my-project/plugin-datasource-mirror/src/server/__tests__/data-import.test.ts`
- Modify: `packages/plugins/@my-project/plugin-datasource-mirror/package.json`

**Step 1: Write the failing test**

Add tests for:
- mapped record transformation
- where clause from `primary_key`
- rejection when mapping has no primary key

**Step 2: Run test to verify it fails**

Run: `yarn vitest packages/plugins/@my-project/plugin-datasource-mirror/src/server/__tests__/data-import.test.ts`

Expected: FAIL because helpers are not exported or behavior does not exist yet.

**Step 3: Write minimal implementation**

Expose or extract helper methods in the data import service so they can be tested cleanly.

**Step 4: Run test to verify it passes**

Run: `yarn vitest packages/plugins/@my-project/plugin-datasource-mirror/src/server/__tests__/data-import.test.ts`

Expected: PASS

### Task 2: Repair and narrow collection definitions

**Files:**
- Modify: `packages/plugins/@my-project/plugin-datasource-mirror/src/server/collections/datasources.ts`
- Modify: `packages/plugins/@my-project/plugin-datasource-mirror/src/server/collections/mirror_tables.ts`
- Modify: `packages/plugins/@my-project/plugin-datasource-mirror/src/server/collections/datasource_sync_logs.ts`

**Step 1: Write the failing test**

Use the existing build as the failing signal because the current files contain broken strings and invalid syntax.

**Step 2: Run test to verify it fails**

Run: `yarn tsc -p packages/plugins/@my-project/plugin-datasource-mirror/tsconfig.json --noEmit`

Expected: FAIL with syntax errors in collection files.

**Step 3: Write minimal implementation**

Rewrite the three collection files with valid TypeScript and narrowed comments/field semantics for PostgreSQL-only support.

**Step 4: Run test to verify it passes**

Run: `yarn tsc -p packages/plugins/@my-project/plugin-datasource-mirror/tsconfig.json --noEmit`

Expected: no syntax errors from collection definitions.

### Task 3: Replace generic connectors with PostgreSQL-only connector logic

**Files:**
- Modify: `packages/plugins/@my-project/plugin-datasource-mirror/src/server/services/datasource-connector.ts`

**Step 1: Write the failing test**

Extend the test file to verify unsupported datasource types are rejected and PostgreSQL table SQL generation uses the configured schema.

**Step 2: Run test to verify it fails**

Run: `yarn vitest packages/plugins/@my-project/plugin-datasource-mirror/src/server/__tests__/data-import.test.ts`

Expected: FAIL because the connector factory still supports unrelated modes or lacks the helper.

**Step 3: Write minimal implementation**

Reduce the connector factory to PostgreSQL support and add small exported helpers where needed for testability.

**Step 4: Run test to verify it passes**

Run: `yarn vitest packages/plugins/@my-project/plugin-datasource-mirror/src/server/__tests__/data-import.test.ts`

Expected: PASS

### Task 4: Rebuild sync and webhook services around a safe sync trigger model

**Files:**
- Modify: `packages/plugins/@my-project/plugin-datasource-mirror/src/server/services/data-import.ts`
- Modify: `packages/plugins/@my-project/plugin-datasource-mirror/src/server/services/webhook.ts`
- Modify: `packages/plugins/@my-project/plugin-datasource-mirror/src/server/services/index.ts`

**Step 1: Write the failing test**

Add tests for:
- webhook token mismatch rejection
- webhook requests triggering sync instead of direct row mutation

**Step 2: Run test to verify it fails**

Run: `yarn vitest packages/plugins/@my-project/plugin-datasource-mirror/src/server/__tests__/data-import.test.ts`

Expected: FAIL

**Step 3: Write minimal implementation**

Implement:
- sync log lifecycle
- table iteration using mapping
- mirror collection creation
- upsert by mapped primary key
- webhook trigger validation and dispatch

**Step 4: Run test to verify it passes**

Run: `yarn vitest packages/plugins/@my-project/plugin-datasource-mirror/src/server/__tests__/data-import.test.ts`

Expected: PASS

### Task 5: Rebuild the plugin server resource surface

**Files:**
- Modify: `packages/plugins/@my-project/plugin-datasource-mirror/src/server/plugin.ts`
- Modify: `packages/plugins/@my-project/plugin-datasource-mirror/src/server/index.ts`

**Step 1: Write the failing test**

Use TypeScript compilation as the failing signal for the new API contract.

**Step 2: Run test to verify it fails**

Run: `yarn tsc -p packages/plugins/@my-project/plugin-datasource-mirror/tsconfig.json --noEmit`

Expected: FAIL before the server contract is aligned.

**Step 3: Write minimal implementation**

Define resource actions for:
- `list`
- `test-connection`
- `sync`
- `webhook`

Register collections and remove unrelated resource behavior.

**Step 4: Run test to verify it passes**

Run: `yarn tsc -p packages/plugins/@my-project/plugin-datasource-mirror/tsconfig.json --noEmit`

Expected: PASS

### Task 6: Replace the client page with a PostgreSQL-only management UI

**Files:**
- Modify: `packages/plugins/@my-project/plugin-datasource-mirror/src/client/DataSourceManagerPage.tsx`
- Modify: `packages/plugins/@my-project/plugin-datasource-mirror/src/client/hooks.ts`
- Modify: `packages/plugins/@my-project/plugin-datasource-mirror/src/client/index.ts`
- Modify: `packages/plugins/@my-project/plugin-datasource-mirror/src/client/export.ts`

**Step 1: Write the failing test**

Use TypeScript compilation as the failing signal because the current page has broken strings and mismatched API assumptions.

**Step 2: Run test to verify it fails**

Run: `yarn tsc -p packages/plugins/@my-project/plugin-datasource-mirror/tsconfig.json --noEmit`

Expected: FAIL

**Step 3: Write minimal implementation**

Provide:
- PostgreSQL-only datasource form
- mapping JSON editor
- test connection action
- manual sync action
- datasource list refresh

**Step 4: Run test to verify it passes**

Run: `yarn tsc -p packages/plugins/@my-project/plugin-datasource-mirror/tsconfig.json --noEmit`

Expected: PASS

### Task 7: Refresh package metadata and documentation for the narrowed plugin

**Files:**
- Modify: `packages/plugins/@my-project/plugin-datasource-mirror/package.json`
- Modify: `packages/plugins/@my-project/plugin-datasource-mirror/README.md`

**Step 1: Write the failing test**

Use a targeted build plus manual content verification.

**Step 2: Run test to verify it fails**

Run: `yarn tsc -p packages/plugins/@my-project/plugin-datasource-mirror/tsconfig.json --noEmit`

Expected: FAIL or stale metadata after narrowing scope.

**Step 3: Write minimal implementation**

Update display name, description, keywords, and README instructions to describe PostgreSQL-only GitLab mirror support.

**Step 4: Run test to verify it passes**

Run: `yarn tsc -p packages/plugins/@my-project/plugin-datasource-mirror/tsconfig.json --noEmit`

Expected: PASS

### Task 8: Full verification

**Files:**
- Verify: `packages/plugins/@my-project/plugin-datasource-mirror`

**Step 1: Run targeted tests**

Run: `yarn vitest packages/plugins/@my-project/plugin-datasource-mirror/src/server/__tests__/data-import.test.ts`

Expected: PASS

**Step 2: Run plugin TypeScript verification**

Run: `yarn tsc -p packages/plugins/@my-project/plugin-datasource-mirror/tsconfig.json --noEmit`

Expected: PASS

**Step 3: Run plugin build**

Run: `yarn build @my-project/plugin-datasource-mirror`

Expected: PASS

**Step 4: Review scope**

Confirm the plugin now:
- only supports PostgreSQL
- matches GitLab 16 usage
- stores mirrored tables locally
- supports manual sync and GitLab webhook triggered sync

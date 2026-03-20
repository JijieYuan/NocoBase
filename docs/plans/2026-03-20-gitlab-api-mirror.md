# GitLab API Mirror Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace PostgreSQL direct collection with GitLab API based mirroring while preserving the existing datasource-manager workflow.

**Architecture:** Keep the existing datasource type, frontend entry point, mirror repository, sync logs, and scheduler. Replace the connector and import pipeline with a GitLab API client plus resource-specific schema and record adapters.

**Tech Stack:** NocoBase plugin APIs, TypeScript, GitLab REST API, existing plugin scheduler and sync log model.

---

### Task 1: Freeze the frontend interaction contract

**Files:**
- Modify: `packages/plugins/@my-project/plugin-datasource-mirror/src/client/DataSourceSettingsForm.tsx`
- Modify: `packages/plugins/@my-project/plugin-datasource-mirror/src/client/index.ts`

**Step 1:** Update the form fields from PostgreSQL settings to GitLab API settings without changing the drawer workflow.

**Step 2:** Keep the existing resource-selection area and datasource type registration.

**Step 3:** Add concise helper copy that explains the datasource reads GitLab API and mirrors locally.

**Step 4:** Run plugin TypeScript check.

### Task 2: Replace the backend connector with a GitLab API client

**Files:**
- Replace: `packages/plugins/@my-project/plugin-datasource-mirror/src/server/services/datasource-connector.ts`
- Modify: `packages/plugins/@my-project/plugin-datasource-mirror/src/server/services/index.ts`
- Test: `packages/plugins/@my-project/plugin-datasource-mirror/src/server/__tests__/data-import.test.ts`

**Step 1:** Introduce a GitLab API connector that supports:
- token-authenticated test connection
- paginated reads for `projects`, `issues`, `merge_requests`, `notes`
- resource discovery for the UI

**Step 2:** Remove PostgreSQL-specific assumptions from the connector factory.

**Step 3:** Add or update tests for connector creation and unsupported types.

**Step 4:** Run targeted tests or TypeScript verification.

### Task 3: Implement resource schema definitions

**Files:**
- Create: `packages/plugins/@my-project/plugin-datasource-mirror/src/server/services/gitlab-resource-definitions.ts`
- Modify: `packages/plugins/@my-project/plugin-datasource-mirror/src/server/datasource/gitlab-postgres-mirror-datasource.ts`

**Step 1:** Define the selectable resources and their local mirror fields.

**Step 2:** Make `readTables` return GitLab resources instead of database tables.

**Step 3:** Make `loadTables` create local mirror collections and datasource metadata from the predefined resource schemas.

**Step 4:** Verify the datasource metadata path still loads collections into the app.

### Task 4: Replace the import pipeline

**Files:**
- Modify: `packages/plugins/@my-project/plugin-datasource-mirror/src/server/services/data-import.ts`
- Modify: `packages/plugins/@my-project/plugin-datasource-mirror/src/server/services/sync-utils.ts`

**Step 1:** Replace table-based database queries with GitLab resource fetches.

**Step 2:** Add normalization logic that converts GitLab API records into local mirror rows.

**Step 3:** Preserve upsert behavior into local mirror tables.

**Step 4:** Keep sync logging, scheduler, webhook, and datasource reload behavior intact.

### Task 5: Update plugin actions and validation

**Files:**
- Modify: `packages/plugins/@my-project/plugin-datasource-mirror/src/server/plugin.ts`
- Modify: `packages/plugins/@my-project/plugin-datasource-mirror/src/server/services/webhook.ts`

**Step 1:** Update `test-connection` to validate GitLab API credentials.

**Step 2:** Preserve webhook-triggered sync and scheduler behavior.

**Step 3:** Ensure no code path attempts Docker, PostgreSQL, or database-level GitLab changes.

### Task 6: Update docs and verify

**Files:**
- Modify: `packages/plugins/@my-project/plugin-datasource-mirror/README.md`

**Step 1:** Rewrite README usage around GitLab API based mirroring.

**Step 2:** Run:
- `yarn.cmd tsc -p packages/plugins/@my-project/plugin-datasource-mirror/tsconfig.json --noEmit`
- plugin build command with local Node 20

**Step 3:** Summarize any residual gaps, especially resource coverage limits for phase 1.


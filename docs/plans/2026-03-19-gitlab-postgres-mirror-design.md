# GitLab PostgreSQL Mirror Plugin Design

## Goal

Build a NocoBase plugin that connects to an external PostgreSQL database used by GitLab 16, mirrors selected tables into the local NocoBase database, and exposes a GitLab webhook endpoint that triggers a sync job.

## Scope

This first version supports one external source type only:

- External PostgreSQL
- Primary use case: GitLab 16 database

This version does not try to be a generic multi-source platform. It focuses on a stable, maintainable plugin that follows the NocoBase plugin structure.

## Options Considered

### Option 1: Generic connector platform

Keep support for MySQL, REST API, GitLab API, and PostgreSQL in one plugin.

Pros:
- Broad feature surface
- Can be reused for more systems later

Cons:
- Current codebase is not stable enough for this scope
- Harder to test and maintain
- Moves away from the confirmed GitLab 16 requirement

### Option 2: GitLab API only sync

Use GitLab webhook plus GitLab REST API to fetch issues and merge requests.

Pros:
- Simpler credentials model
- No direct database access

Cons:
- Does not satisfy the requirement to import an external database
- Limited to API-exposed entities

### Option 3: PostgreSQL-only mirror plugin

Support external PostgreSQL only, with GitLab webhook used as a sync trigger.

Pros:
- Directly matches GitLab 16
- Smallest reliable implementation
- Clear plugin boundaries
- Easy to extend later

Cons:
- Less general in the first release

## Decision

Choose Option 3.

## Architecture

The plugin has three layers:

1. Configuration layer
   Stores external PostgreSQL connection settings, webhook secret, and table mapping rules in plugin collections.

2. Sync layer
   Connects to the external PostgreSQL database, reads configured source tables, creates corresponding mirror collections locally when needed, and performs upsert-based synchronization.

3. Trigger layer
   Exposes API actions for:
   - testing database connectivity
   - running a manual sync
   - receiving a GitLab webhook and triggering a sync

## Data Model

### `datasources`

Stores one datasource configuration record.

Key fields:
- `name`
- `description`
- `type` fixed to `postgres`
- `config` with host, port, database, schema, username, password, ssl
- `mapping` array of table mapping definitions
- `enabled`
- `webhook_token`
- `last_sync_time`

### `mirror_tables`

Stores metadata for each mirrored table.

Key fields:
- `datasource_id`
- `source_table`
- `mirror_table`
- `field_mapping`
- `total_records`
- `last_sync_time`
- `enabled`

### `datasource_sync_logs`

Stores sync history and operational status.

Key fields:
- `datasource_id`
- `status`
- `sync_type`
- `records_inserted`
- `records_updated`
- `records_deleted`
- `error_message`
- `duration_seconds`
- `started_at`
- `completed_at`

## Table Mapping Format

Each mapping item follows this shape:

```json
[
  {
    "source_table": "issues",
    "target_table": "gitlab_mirror_issues",
    "fields": [
      { "source": "id", "target": "gitlab_id", "type": "bigInt", "primary_key": true },
      { "source": "title", "target": "title", "type": "string" },
      { "source": "state_id", "target": "state_id", "type": "integer" },
      { "source": "created_at", "target": "created_at", "type": "dateTime" },
      { "source": "updated_at", "target": "updated_at", "type": "dateTime" }
    ]
  }
]
```

Rules:
- At least one field should be marked `primary_key`
- `target_table` is the local NocoBase mirror table
- If no explicit primary key is provided, sync should fail with a clear error

## Sync Behavior

Manual sync and webhook-triggered sync share the same sync service.

For each configured table:

1. Read rows from external PostgreSQL
2. Ensure the local mirror collection exists
3. Transform source rows using field mapping
4. Upsert by mapped primary key
5. Update `mirror_tables` and `datasource_sync_logs`

This version uses whole-table sync per configured table. Webhook does not directly mutate mirror rows. It only triggers sync for the datasource.

## Webhook Behavior

Expose a webhook endpoint at the plugin resource action.

Behavior:
- Read datasource id from the request body or header
- Validate the GitLab token against the saved webhook token
- Record the webhook-triggered sync in sync logs
- Run the same sync flow as manual sync

This design is intentionally conservative. It favors correctness over complex event-specific delta handling.

## Security and Constraints

- The plugin UI and API should not default to `public`
- Credentials remain inside datasource `config`
- The webhook must reject invalid token requests
- The plugin should only support `postgres` in the UI and server validation

## Client UI

Provide a plugin settings page for:
- creating or editing one datasource
- testing PostgreSQL connectivity
- managing table mappings as JSON
- triggering manual sync
- viewing recent sync status summary

The UI should remove MySQL, REST API, and GitLab API options.

## Testing Strategy

First pass testing focuses on:
- connector validation
- primary-key-based where clause generation
- row transformation
- webhook token validation

Then verify:
- TypeScript build passes
- plugin compiles in the monorepo

## Non-Goals for Version 1

- CDC or WAL-based incremental sync
- automatic schema discovery UI
- field-level diff sync
- full GitLab event-specific row patching
- support for non-PostgreSQL external databases

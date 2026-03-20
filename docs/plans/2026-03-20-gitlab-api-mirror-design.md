# GitLab API Mirror Design

**Goal**

Keep the current NocoBase datasource-manager user flow, but replace GitLab PostgreSQL direct access with GitLab API based full import and local mirror-table generation.

**Why This Change**

The original PostgreSQL-first design depended on exposing GitLab's internal database from a Docker-on-Windows deployment. That is fragile and can interfere with GitLab startup. The new design keeps the same NocoBase experience while moving data collection to the GitLab HTTP API, which is safer and more portable.

**User Flow**

The frontend flow stays the same:

1. Open `Data source management`
2. Click `Add`
3. Choose `GitLab Mirror`
4. Fill a datasource form
5. Select resources to mirror
6. Submit

What changes is the backend meaning of the form fields:

- Replace PostgreSQL connection settings with GitLab API settings
- Keep webhook token and sync interval
- Keep selectable "tables", but the choices are GitLab resources

**Phase 1 Resource Scope**

The first API-backed mirror version will support:

- `projects`
- `issues`
- `merge_requests`
- `notes`

These resources provide enough coverage to build a real data collection platform foundation without over-expanding the first implementation.

**Architecture**

The plugin will have two layers:

1. `GitLab API collection layer`
   - Calls GitLab REST API
   - Paginates through selected resources
   - Normalizes each resource into flat records

2. `NocoBase local mirror layer`
   - Defines local mirror collections
   - Writes imported records into local tables
   - Exposes those tables through the datasource manager as read-only mirrored collections

**Datasource Model**

Each datasource record will store:

- GitLab base URL
- Access token
- Optional scope settings such as group path, project ids, or namespace filters
- Selected resources
- Webhook token
- Full sync interval

Sensitive fields such as the token must not be echoed back in public datasource options.

**Resource Mapping**

GitLab resources will appear as selectable "tables" in the UI:

- `projects`
- `issues`
- `merge_requests`
- `notes`

For each selected resource, the plugin creates a local mirror table name using the existing datasource-key-based naming convention.

**Sync Strategy**

Initial sync:

- On datasource creation, perform a full import of the selected resources
- Generate local mirror schema first, then load data

Manual sync:

- Trigger the same import pipeline on demand

Webhook sync:

- GitLab webhook only triggers a sync job
- The sync job may be resource-scoped where possible, but phase 1 can safely resync the affected resource set

Scheduled sync:

- Runs full reconcile based on the configured interval

**Schema Strategy**

Phase 1 uses resource-specific local schema definitions maintained by the plugin.

Examples:

- `projects`: `id`, `name`, `path`, `path_with_namespace`, `web_url`, `visibility`, timestamps
- `issues`: `id`, `iid`, `project_id`, `title`, `state`, `labels`, `assignees`, `milestone`, timestamps
- `merge_requests`: `id`, `iid`, `project_id`, `title`, `state`, branch info, author, merged_by, timestamps
- `notes`: `id`, `project_id`, `noteable_type`, `noteable_id`, `body`, `author`, timestamps

Nested API objects will be flattened conservatively for phase 1. Arrays and rich objects will be stored as JSON/text where needed.

**Error Handling**

The plugin must distinguish:

- invalid GitLab URL or token
- webhook token mismatch
- GitLab API rate limiting or temporary errors
- partial sync failure for one resource while others succeed

Sync logs should record per-run status and error details using the existing `datasource_sync_logs` collection.

**Safety Boundary**

This plugin must not:

- modify GitLab Docker configuration
- expose GitLab PostgreSQL ports
- mutate GitLab database settings
- write back to GitLab business data

It only reads from GitLab APIs and writes to NocoBase local mirror tables.

**Verification**

Success means:

- the datasource type still appears in `Data source management`
- the form flow stays familiar
- datasource creation can complete with GitLab API credentials
- selected resources create local mirrored collections
- initial import populates mirror data
- scheduled/manual/webhook sync paths still work


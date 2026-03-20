# @my-project/plugin-datasource-mirror

A NocoBase plugin for mirroring selected GitLab resources into the local NocoBase database.

## Scope

This version supports:

- GitLab REST API collection
- Manual sync
- GitLab webhook triggered sync
- Scheduled full sync
- Read-only mirror mode

This version does not modify GitLab Docker, PostgreSQL, or container runtime settings.

## What It Does

1. Save a GitLab datasource config
2. Select GitLab resources to mirror
3. Create local mirror tables in the NocoBase database
4. Upsert GitLab records into the local mirror tables
5. Expose a webhook endpoint that triggers a sync job

## Plugin Actions

- `POST /api/datasource-mirror:test-connection`
- `POST /api/datasource-mirror:sync`
- `POST /api/datasource-mirror:webhook`
- `GET /api/datasource-mirror:list`

## Supported Resources

- `projects`
- `issues`
- `merge_requests`
- `notes`

## Webhook Usage

Configure GitLab to call:

```text
POST /api/datasource-mirror:webhook
```

Send either:

- header `X-Datasource-Id`
- header `X-Gitlab-Token`

Or include `datasource_id` in the JSON body.

The webhook does not patch rows directly. It validates the token and triggers a full sync for the configured mappings.

## Notes

- GitLab 16 uses PostgreSQL internally, but this plugin reads through the GitLab API.
- Mirror tables are created in the local NocoBase database.
- The plugin expects a GitLab HTTP endpoint and an access token that are already reachable from the NocoBase server.
- For Docker-based GitLab on Windows, do not expose or rewrite the internal GitLab PostgreSQL from the plugin side.

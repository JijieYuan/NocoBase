import { describe, expect, it } from 'vitest';
import { getWhereClause, transformRecord } from '../services';
import { DataSourceConnectorFactory, GitlabConnector } from '../services/datasource-connector';

describe('sync helpers', () => {
  it('transforms a source record using field mapping', () => {
    const result = transformRecord(
      { id: 1, title: 'Issue', state_id: 2 },
      [
        { source: 'id', target: 'gitlab_id', primary_key: true },
        { source: 'title', target: 'title' },
      ],
    );

    expect(result).toEqual({ gitlab_id: 1, title: 'Issue' });
  });

  it('builds where clause from primary key mapping', () => {
    const result = getWhereClause(
      { gitlab_id: 99, title: 'Issue' },
      [
        { source: 'id', target: 'gitlab_id', primary_key: true },
        { source: 'title', target: 'title' },
      ],
    );

    expect(result).toEqual({ gitlab_id: 99 });
  });

  it('rejects mappings without a primary key', () => {
    expect(() =>
      getWhereClause(
        { title: 'Issue' },
        [{ source: 'title', target: 'title' }],
      ),
    ).toThrow('Each mapping must define one primary_key field');
  });

  it('creates only gitlab connector instances', () => {
    const connector = DataSourceConnectorFactory.createConnector('gitlab-postgres-mirror', {
      host: '127.0.0.1',
      port: 5432,
      database: 'gitlabhq_production',
      schema: 'public',
      username: 'gitlab',
      password: 'secret',
    });

    expect(connector).toBeInstanceOf(GitlabConnector);
    expect(() =>
      DataSourceConnectorFactory.createConnector('mysql', {
        host: '127.0.0.1',
        database: 'gitlabhq_production',
        username: 'gitlab',
        password: 'secret',
      } as any),
    ).toThrow('Unsupported datasource type: mysql');
  });
});

import { Database } from '@nocobase/database';
import { materializeMirrorTables } from '../packages/plugins/@my-project/plugin-datasource-mirror/src/server/datasource/gitlab-postgres-mirror-datasource';

async function main() {
  const db = new Database({
    dialect: 'postgres',
    host: 'localhost',
    port: 5432,
    database: 'nocobase',
    username: 'postgres',
    password: 'root',
    logging: false,
  } as any);

  await db.connect();

  try {
    const result = await materializeMirrorTables({
      db,
      dataSourceKey: 'gitlab_rocksdb',
      options: {
        database: 'gitlabhq_production',
        schema: 'public',
        username: 'gitlab',
        dockerContainerName: 'gitlab-data-web-1',
        addAllCollections: true,
      },
      tables: ['application_settings'],
    });

    console.log(JSON.stringify({ ok: true, result }, null, 2));
  } finally {
    await db.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

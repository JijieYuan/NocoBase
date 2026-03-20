const { Client } = require('pg');

const config = {
  host: process.env.NOCOBASE_DB_HOST || 'localhost',
  port: Number(process.env.NOCOBASE_DB_PORT || 5432),
  database: process.env.NOCOBASE_DB_NAME || 'nocobase',
  user: process.env.NOCOBASE_DB_USER || 'postgres',
  password: process.env.NOCOBASE_DB_PASSWORD || 'root',
};

async function main() {
  const client = new Client(config);
  await client.connect();

  try {
    const key = process.env.DATASOURCE_KEY;
    const datasourceSql = key
      ? 'select key, "displayName", type, options from "dataSources" where type = $1 and key = $2 order by key'
      : 'select key, "displayName", type, options from "dataSources" where type = $1 order by key limit 1';
    const datasourceArgs = key ? ['gitlab-postgres-mirror', key] : ['gitlab-postgres-mirror'];
    const datasourceResult = await client.query(datasourceSql, datasourceArgs);

    if (!datasourceResult.rows.length) {
      throw new Error('No gitlab-postgres-mirror datasource found for integration test');
    }

    const datasource = datasourceResult.rows[0];
    const progress = datasource.options?.mirrorProgress || {};

    const collectionsResult = await client.query(
      'select name, options from "dataSourcesCollections" where "dataSourceKey" = $1 order by name limit 10',
      [datasource.key],
    );

    if (progress.status === 'success' && collectionsResult.rowCount === 0) {
      throw new Error(`Datasource ${datasource.key} reports success but has no collections`);
    }

    if (typeof progress.totalTables === 'number' && typeof progress.completedTables === 'number') {
      if (progress.completedTables > progress.totalTables) {
        throw new Error(`Invalid progress for ${datasource.key}: completedTables > totalTables`);
      }
    }

    if (collectionsResult.rowCount > 0) {
      const mirrorCollectionName =
        collectionsResult.rows[0].options?.mirrorCollectionName || `mirror_${datasource.key}_${collectionsResult.rows[0].name}`;
      const tableResult = await client.query(
        'select exists(select 1 from information_schema.tables where table_schema = $1 and table_name = $2) as exists',
        ['public', mirrorCollectionName],
      );

      if (!tableResult.rows[0]?.exists) {
        throw new Error(`Mirror table ${mirrorCollectionName} does not exist`);
      }
    }

    console.log(
      JSON.stringify(
        {
          datasourceKey: datasource.key,
          displayName: datasource.displayName,
          progress,
          collectionCount: collectionsResult.rowCount,
          sampleCollections: collectionsResult.rows.map((row) => row.name),
        },
        null,
        2,
      ),
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});

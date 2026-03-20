import type { Database } from '@nocobase/database';
import { DataSourceConnectorFactory } from './datasource-connector';
import { buildMirrorCollectionName, normalizeFieldType, normalizeSyncOptions } from './sync-utils';

export class DataImportService {
  constructor(private readonly db: Database) {}

  async importData(
    dataSourceKey: string,
    sourceTables?: string[],
    syncType: 'manual' | 'webhook' | 'scheduled' | 'initial' = 'manual',
  ) {
    const datasource = await this.getDatasource(dataSourceKey);
    if (!datasource) {
      throw new Error(`Datasource ${dataSourceKey} not found`);
    }
    if (datasource.get?.('type') !== 'gitlab-postgres-mirror') {
      throw new Error(`Unsupported datasource type: ${datasource.get?.('type')}`);
    }

    const syncLog = await this.createSyncLog(dataSourceKey, syncType);
    const startedAt = Date.now();
    const options = normalizeSyncOptions(datasource.get?.('options') || datasource.options || {});
    const connector = DataSourceConnectorFactory.createConnector('gitlab-postgres-mirror', options);

    try {
      await connector.connect();

      const collections = await this.db.getRepository('dataSourcesCollections').find({
        filter: {
          dataSourceKey,
        },
      });

      const tablesToSync = collections
        .map((collection: any) => collection.toJSON?.() || collection.get?.() || collection)
        .filter((collection: any) =>
          Array.isArray(sourceTables) && sourceTables.length > 0 ? sourceTables.includes(collection.name) : true,
        );

      if (tablesToSync.length === 0) {
        throw new Error('No mirrored tables configured for this data source');
      }

      let totalInserted = 0;
      let totalUpdated = 0;
      let totalDeleted = 0;

      for (const collection of tablesToSync) {
        const result = await this.syncTable(connector, dataSourceKey, collection);
        totalInserted += result.inserted;
        totalUpdated += result.updated;
        totalDeleted += result.deleted;
      }

      await connector.disconnect();

      await this.updateSyncLog(syncLog.id, {
        status: 'success',
        records_inserted: totalInserted,
        records_updated: totalUpdated,
        records_deleted: totalDeleted,
        completed_at: new Date(),
        duration_seconds: (Date.now() - startedAt) / 1000,
      });

      return {
        status: 'success',
        inserted: totalInserted,
        updated: totalUpdated,
        deleted: totalDeleted,
      };
    } catch (error: any) {
      await connector.disconnect().catch(() => undefined);
      await this.updateSyncLog(syncLog.id, {
        status: 'failed',
        error_message: error.message,
        completed_at: new Date(),
        duration_seconds: (Date.now() - startedAt) / 1000,
      });
      throw error;
    }
  }

  async getLastSuccessTime(dataSourceKey: string, syncTypes: string[]) {
    const log = await this.db.getRepository('datasource_sync_logs').findOne({
      filter: {
        datasource_key: dataSourceKey,
        sync_type: {
          $in: syncTypes,
        },
        status: 'success',
      },
      sort: ['-completed_at'],
    });

    return log?.get?.('completed_at') || log?.completed_at || null;
  }

  private async syncTable(connector: ReturnType<typeof DataSourceConnectorFactory.createConnector>, dataSourceKey: string, collection: any) {
    const sourceTable = collection.name;
    const mirrorTable =
      collection.mirrorCollectionName ||
      collection.options?.mirrorCollectionName ||
      buildMirrorCollectionName(dataSourceKey, sourceTable);
    const schema = await connector.getTableSchema(sourceTable);
    const rows = await connector.queryTable(sourceTable);

    await this.ensureMirrorTable(mirrorTable, schema);
    const mirrorModel = this.db.getModel(mirrorTable);
    const primaryKeyFields = schema.filter((field) => field.is_primary_key).map((field) => field.name);

    let inserted = 0;
    let updated = 0;
    let deleted = 0;

    if (primaryKeyFields.length === 0) {
      deleted = await mirrorModel.destroy({ where: {} });
      for (const row of rows) {
        await mirrorModel.create(row);
        inserted += 1;
      }
      return { inserted, updated, deleted };
    }

    for (const row of rows) {
      const where = Object.fromEntries(primaryKeyFields.map((field) => [field, row[field]]));
      const existing = await mirrorModel.findOne({ where });

      if (existing) {
        await existing.update(row);
        updated += 1;
      } else {
        await mirrorModel.create(row);
        inserted += 1;
      }
    }

    return { inserted, updated, deleted };
  }

  private async ensureMirrorTable(tableName: string, schema: any[]) {
    const existingCollection = (this.db as any).collections?.get?.(tableName) || (this.db as any).getCollection?.(tableName);

    if (existingCollection) {
      return;
    }

    this.db.collection({
      name: tableName,
      fields: schema.map((field) => ({
        name: field.name,
        type: normalizeFieldType(field.type),
        primaryKey: Boolean(field.is_primary_key),
        allowNull: field.is_nullable !== 'NO',
      })),
    } as any);

    if (typeof (this.db as any).sync === 'function') {
      await (this.db as any).sync();
    } else if ((this.db as any).sequelize?.sync) {
      await (this.db as any).sequelize.sync();
    }
  }

  private async getDatasource(key: string) {
    return this.db.getRepository('dataSources').findOne({
      filter: {
        key,
      },
    }) as Promise<any>;
  }

  private async createSyncLog(dataSourceKey: string, syncType: string) {
    return this.db.getModel('datasource_sync_logs').create({
      datasource_key: dataSourceKey,
      sync_type: syncType,
      status: 'processing',
      started_at: new Date(),
    });
  }

  private async updateSyncLog(id: number, updates: Record<string, any>) {
    return this.db.getModel('datasource_sync_logs').update(updates, {
      where: { id },
    });
  }
}

export { buildMirrorCollectionName } from './sync-utils';

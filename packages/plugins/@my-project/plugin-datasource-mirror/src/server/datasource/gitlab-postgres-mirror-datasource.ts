import { CollectionManager, DataSource } from '@nocobase/data-source-manager';
import type { Context } from '@nocobase/actions';
import type { Database } from '@nocobase/database';
import { DataSourceConnectorFactory } from '../services/datasource-connector';
import {
  buildMirrorCollectionName,
  buildUiSchemaTitle,
  interfaceByFieldType,
  normalizeFieldType,
  normalizeSyncOptions,
} from '../services/sync-utils';
import { MirrorRepository } from './mirror-repository';

type ReadTableItem = {
  name: string;
  title?: string;
  required?: boolean;
};

type LocalDataRecord = {
  name: string;
  title?: string;
  filterTargetKey?: string;
  fields?: any[];
  options?: Record<string, any>;
  mirrorCollectionName?: string;
};

export async function materializeMirrorTables(params: {
  db: Database;
  dataSourceKey: string;
  options: Record<string, any>;
  tables?: string[];
  onProgress?: (progress: Record<string, any>) => Promise<void> | void;
}) {
  const { db, dataSourceKey, options, tables, onProgress } = params;
  const connector = DataSourceConnectorFactory.createConnector('gitlab-postgres-mirror', normalizeSyncOptions(options));
  const dataSource = new GitlabPostgresMirrorDataSource({
    name: dataSourceKey,
    options,
  } as any);
  const dataSourcesRepo = db.getRepository('dataSources');
  const logger = (db as any).logger || console;
  let pendingSchemaSync = false;

  try {
    await connector.connect();
    const selectedTables = Array.isArray(tables) && tables.length > 0 ? tables : await connector.getTables();
    logger.info?.(`[datasource-mirror] materialize start key=${dataSourceKey} tableCount=${selectedTables.length}`);
    const startedProgress = await updateMirrorProgress(dataSourcesRepo, dataSourceKey, {
      status: 'running',
      totalTables: selectedTables.length,
      completedTables: 0,
      failedTables: 0,
      currentTable: selectedTables[0] || null,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      lastError: null,
    });
    await onProgress?.(startedProgress);

    for (const [index, tableName] of selectedTables.entries()) {
      logger.info?.(`[datasource-mirror] materialize table start key=${dataSourceKey} table=${tableName} index=${index + 1}/${selectedTables.length}`);
      const tableStartProgress = await updateMirrorProgress(dataSourcesRepo, dataSourceKey, {
        status: 'running',
        totalTables: selectedTables.length,
        completedTables: index,
        failedTables: 0,
        currentTable: tableName,
        finishedAt: null,
        lastError: null,
      });
      await onProgress?.(tableStartProgress);

      const schema = await connector.getTableSchema(tableName);
      const mirrorCollectionName = buildMirrorCollectionName(dataSourceKey, tableName);

      const created = await dataSource.ensureMirrorCollection(db, mirrorCollectionName, schema, { skipSync: true });
      pendingSchemaSync = pendingSchemaSync || created;
      await dataSource.upsertCollectionMetadata(db, dataSourceKey, tableName, mirrorCollectionName, schema);

      const tableDoneProgress = await updateMirrorProgress(dataSourcesRepo, dataSourceKey, {
        status: 'running',
        totalTables: selectedTables.length,
        completedTables: index + 1,
        failedTables: 0,
        currentTable: tableName,
        finishedAt: null,
        lastError: null,
      });
      await onProgress?.(tableDoneProgress);
      logger.info?.(
        `[datasource-mirror] materialize table complete key=${dataSourceKey} table=${tableName} index=${index + 1}/${selectedTables.length}`,
      );
    }

    if (pendingSchemaSync) {
      logger.info?.(`[datasource-mirror] materialize schema sync start key=${dataSourceKey}`);
      if (typeof (db as any).sync === 'function') {
        await (db as any).sync();
      } else if ((db as any).sequelize?.sync) {
        await (db as any).sequelize.sync();
      }
      logger.info?.(`[datasource-mirror] materialize schema sync complete key=${dataSourceKey}`);
    }

    const successProgress = await updateMirrorProgress(dataSourcesRepo, dataSourceKey, {
      status: 'success',
      totalTables: selectedTables.length,
      completedTables: selectedTables.length,
      failedTables: 0,
      currentTable: null,
      finishedAt: new Date().toISOString(),
      lastError: null,
    });
    await onProgress?.(successProgress);
    logger.info?.(`[datasource-mirror] materialize complete key=${dataSourceKey} tableCount=${selectedTables.length}`);

    return selectedTables;
  } catch (error: any) {
    const failedProgress = await updateMirrorProgress(dataSourcesRepo, dataSourceKey, {
      status: 'failed',
      failedTables: 1,
      finishedAt: new Date().toISOString(),
      lastError: error?.message || String(error),
    }).catch(() => undefined);
    if (failedProgress) {
      await onProgress?.(failedProgress);
    }
    logger.error?.(`[datasource-mirror] materialize failed key=${dataSourceKey}: ${error?.stack || error?.message || error}`);
    throw error;
  } finally {
    await connector.disconnect().catch(() => undefined);
  }
}

async function updateMirrorProgress(repo: any, dataSourceKey: string, patch: Record<string, any>) {
  const record = await repo.findOne({
    filter: {
      key: dataSourceKey,
    },
  });

  if (!record) {
    return;
  }

  const currentOptions = record.get?.('options') || record.options || {};
  const currentProgress = currentOptions.mirrorProgress || {};
  const nextOptions = {
    ...currentOptions,
    mirrorProgress: {
      ...currentProgress,
      ...patch,
      updatedAt: new Date().toISOString(),
    },
  };

  await repo.update({
    filterByTk: record.get?.('key') || record.key,
    values: {
      options: nextOptions,
    },
  });

  return nextOptions.mirrorProgress;
}

function extractValue<T = any>(value: any, key: string): T | undefined {
  return value?.[key] ?? value?.options?.[key];
}

class MirrorCollectionManager extends CollectionManager {
  db?: Database;

  constructor(options: { dataSource?: GitlabPostgresMirrorDataSource; db?: Database } = {}) {
    super(options);
    this.db = options.db;
  }

  private ensureRuntimeCollection(name: string) {
    const existing = super.getCollection(name);
    if (existing) {
      return existing;
    }

    const dataSource = this.dataSource as unknown as GitlabPostgresMirrorDataSource | undefined;
    if (!dataSource) {
      return undefined;
    }

    const collectionOptions = dataSource.getRuntimeCollectionOptions(name);
    if (!collectionOptions) {
      return undefined;
    }

    return this.defineCollection(collectionOptions);
  }

  override hasCollection(name: string) {
    return Boolean(this.ensureRuntimeCollection(name));
  }

  override getCollection(name: string) {
    return this.ensureRuntimeCollection(name);
  }

  override getRepository(name: string, sourceId?: string | number) {
    const collection = this.ensureRuntimeCollection(name);
    return (collection ? new MirrorRepository(collection as any) : undefined) as any;
  }
}

export class GitlabPostgresMirrorDataSource extends DataSource {
  private localDataCache: Record<string, LocalDataRecord> = {};

  static async testConnection(options: Record<string, any>) {
    const config = normalizeSyncOptions(options);
    const connector = DataSourceConnectorFactory.createConnector('gitlab-postgres-mirror', config);
    await connector.connect();
    await connector.disconnect();
    return true;
  }

  createCollectionManager(options?: any) {
    const manager = new MirrorCollectionManager();
    manager.registerRepositories({
      MirrorRepository,
    });
    return manager;
  }

  override setDataSourceManager(dataSourceManager: any) {
    super.setDataSourceManager(dataSourceManager);
    (this.collectionManager as unknown as MirrorCollectionManager).db = dataSourceManager?.options?.app?.db;
  }

  publicOptions() {
    const options = normalizeSyncOptions(this.options);
    return {
      host: options.host,
      port: options.port,
      database: options.database,
      schema: options.schema,
      username: options.username,
      ssl: options.ssl,
      syncIntervalMinutes: options.syncIntervalMinutes,
      webhookToken: options.webhookToken ? 'configured' : '',
    };
  }

  async load(loadOptions: { localData?: Record<string, LocalDataRecord> } = {}) {
    const localData = loadOptions.localData || {};
    this.localDataCache = localData;

    (this.collectionManager as any).collections.clear();

    for (const value of Object.values(localData)) {
      const collectionOptions = this.buildCollectionOptions(value);
      this.collectionManager.defineCollection(collectionOptions);
    }
  }

  getRuntimeCollectionOptions(name: string) {
    const value = this.localDataCache[name];
    if (!value) {
      return undefined;
    }

    return this.buildCollectionOptions(value);
  }

  private buildCollectionOptions(value: LocalDataRecord) {
    const fields = Array.isArray(value.fields) ? value.fields : [];
    const mirrorCollectionName = extractValue<string>(value, 'mirrorCollectionName') || buildMirrorCollectionName(this.name, value.name);
    const filterTargetKey =
      extractValue<string>(value, 'filterTargetKey') ||
      fields.find((field) => extractValue<boolean>(field, 'primaryKey'))?.name ||
      'id';

    return {
      name: value.name,
      tableName: mirrorCollectionName,
      title: extractValue<string>(value, 'title') || value.title || value.name,
      filterTargetKey,
      mirrorCollectionName,
      readOnly: true,
      repository: 'MirrorRepository',
      fields: fields.map((field) => ({
        name: field.name,
        type: extractValue<string>(field, 'type') || 'string',
        rawType: extractValue<string>(field, 'type') || 'string',
        field: extractValue<string>(field, 'field') || field.name,
        interface: extractValue<string>(field, 'interface') || interfaceByFieldType(extractValue<string>(field, 'type') || 'string'),
        uiSchema: extractValue<any>(field, 'uiSchema') || { title: buildUiSchemaTitle(field.name) },
        description: extractValue<string>(field, 'description'),
        primaryKey: Boolean(extractValue<boolean>(field, 'primaryKey')),
      })),
    };
  }

  async readTables(): Promise<ReadTableItem[]> {
    const connector = DataSourceConnectorFactory.createConnector('gitlab-postgres-mirror', normalizeSyncOptions(this.options));
    try {
      await connector.connect();
      const tables = await connector.getTables();
      return tables.map((name) => ({ name, title: buildUiSchemaTitle(name) }));
    } finally {
      await connector.disconnect().catch(() => undefined);
    }
  }

  async loadTables(ctx: Context, tables: string[]) {
    const dataSourceKey = ctx.action.params.values?.key || ctx.action.params.values?.dataSourceKey || ctx.action.params.filterByTk;
    if (!dataSourceKey) {
      throw new Error('Data source key is required');
    }

    const selectedTables = Array.isArray(tables) ? tables : [];
    if (selectedTables.length === 0) {
      throw new Error('At least one table must be selected');
    }

    await materializeMirrorTables({
      db: ctx.app.db,
      dataSourceKey,
      options: ctx.action.params.values?.options || this.options,
      tables: selectedTables,
    });
  }

  async ensureMirrorCollection(db: Database, mirrorCollectionName: string, schema: any[], options: { skipSync?: boolean } = {}) {
    const existingCollection = db.getCollection?.(mirrorCollectionName);
    if (existingCollection) {
      return false;
    }

    db.collection({
      name: mirrorCollectionName,
      fields: schema.map((column) => ({
        name: column.name,
        type: normalizeFieldType(column.type),
        primaryKey: Boolean(column.is_primary_key),
        allowNull: column.is_nullable !== 'NO',
      })),
    } as any);

    if (!options.skipSync) {
      if (typeof (db as any).sync === 'function') {
        await (db as any).sync();
      } else if ((db as any).sequelize?.sync) {
        await (db as any).sequelize.sync();
      }
    }

    return true;
  }

  async upsertCollectionMetadata(
    db: Database,
    dataSourceKey: string,
    sourceTable: string,
    mirrorCollectionName: string,
    schema: any[],
  ) {
    const collectionsRepo = db.getRepository('dataSourcesCollections');
    const fieldsRepo = db.getRepository('dataSourcesFields');
    const filterTargetKey = schema.find((column) => column.is_primary_key)?.name || schema[0]?.name || 'id';

    await collectionsRepo.updateOrCreate({
      filterKeys: ['name', 'dataSourceKey'],
      values: {
        name: sourceTable,
        dataSourceKey,
        title: buildUiSchemaTitle(sourceTable),
        filterTargetKey,
        readOnly: true,
        mirrorCollectionName,
      },
    });

    for (const column of schema) {
      const normalizedType = normalizeFieldType(column.type);
      await fieldsRepo.updateOrCreate({
        filterKeys: ['name', 'collectionName', 'dataSourceKey'],
        values: {
          name: column.name,
          collectionName: sourceTable,
          dataSourceKey,
          type: normalizedType,
          field: column.name,
          interface: interfaceByFieldType(normalizedType),
          uiSchema: {
            title: buildUiSchemaTitle(column.name),
          },
          primaryKey: Boolean(column.is_primary_key),
          description: column.description || column.rawType || column.type,
          options: {
            type: column.rawType || column.type,
            allowNull: column.is_nullable !== 'NO',
            defaultValue: column.default_value || null,
            maxLength: column.max_length || null,
            numericPrecision: column.numeric_precision || null,
            numericScale: column.numeric_scale || null,
            primaryKey: Boolean(column.is_primary_key),
            target: column.references?.table || null,
            targetKey: column.references?.column || null,
          },
        },
      });
    }
  }
}

export default GitlabPostgresMirrorDataSource;

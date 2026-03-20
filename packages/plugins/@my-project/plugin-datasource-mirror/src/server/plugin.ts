import { Plugin } from '@nocobase/server';
import { QueryTypes } from 'sequelize';
import { collections } from './collections';
import { DEFAULT_SYNC_INTERVAL_MINUTES, GITLAB_POSTGRES_MIRROR_TYPE } from './constants';
import GitlabPostgresMirrorDataSource, { materializeMirrorTables } from './datasource/gitlab-postgres-mirror-datasource';
import { DataImportService, DataSourceConnectorFactory, WebhookService } from './services';

export class PluginDatasourceMirrorServer extends Plugin {
  private dataImportService!: DataImportService;
  private webhookService!: WebhookService;
  private syncTimer: NodeJS.Timeout | null = null;
  private runningSyncs = new Set<string>();
  private runningPrepareAndSyncs = new Set<string>();

  async load() {
    for (const collection of collections) {
      this.db.collection(collection as any);
    }

    this.dataImportService = new DataImportService(this.db);
    this.webhookService = new WebhookService(this.dataImportService);

    this.app.dataSourceManager.registerDataSourceType(GITLAB_POSTGRES_MIRROR_TYPE, GitlabPostgresMirrorDataSource as any);
    this.defineResources();
    this.registerHooks();
    this.startScheduler();
  }

  private defineResources() {
    this.app.resourceManager.define({
      name: 'datasource-mirror',
      actions: {
        sync: async (ctx) => {
          const { dataSourceKey, tables } = ctx.request.body || {};
          if (!dataSourceKey) {
            ctx.throw(400, 'dataSourceKey is required');
          }

          const data = await this.runSync(dataSourceKey, 'manual', tables);
          ctx.body = { data };
        },

        'test-connection': async (ctx) => {
          const { type, config } = ctx.request.body || {};
          const connector = DataSourceConnectorFactory.createConnector(type || GITLAB_POSTGRES_MIRROR_TYPE, config);
          await connector.connect();
          await connector.disconnect();
          ctx.body = { status: 'ok' };
        },

        webhook: async (ctx) => {
          const dataSourceKey = String(ctx.headers['x-datasource-key'] || ctx.request.body?.dataSourceKey || '');
          if (!dataSourceKey) {
            ctx.throw(400, 'dataSourceKey is required');
          }

          const token = (ctx.headers['x-gitlab-token'] as string | undefined) || ctx.request.body?.webhookToken;
          const data = await this.webhookService.handleWebhook(this.db, dataSourceKey, token);
          ctx.body = { data };
        },

        'field-insights': async (ctx) => {
          const dataSourceKey = String(ctx.request.query?.dataSourceKey || ctx.request.body?.dataSourceKey || '');
          const collectionName = String(ctx.request.query?.collectionName || ctx.request.body?.collectionName || '');
          const fieldName = String(ctx.request.query?.fieldName || ctx.request.body?.fieldName || '');

          if (!dataSourceKey || !collectionName || !fieldName) {
            ctx.throw(400, 'dataSourceKey, collectionName and fieldName are required');
          }

          const data = await this.buildFieldInsights(dataSourceKey, collectionName, fieldName);
          ctx.body = { data };
        },

        progress: async (ctx) => {
          const dataSourceKey = String(ctx.request.query?.dataSourceKey || ctx.request.body?.dataSourceKey || '');
          const runningOnly = ['1', 'true', 'yes'].includes(
            String(ctx.request.query?.runningOnly || ctx.request.body?.runningOnly || '').toLowerCase(),
          );
          const plugin = this.app.pm.get<any>('data-source-manager');
          const repo = this.app.db.getRepository('dataSources');
          const records = await repo.find({
            filter: {
              type: GITLAB_POSTGRES_MIRROR_TYPE,
            },
          });

          const items = records
            .map((record: any) => {
              const options = record.get?.('options') || record.options || {};
              const key = record.get?.('key') || record.key;
              return {
                key,
                displayName: record.get?.('displayName') || record.displayName || key,
                enabled: record.get?.('enabled') ?? record.enabled,
                status: plugin?.dataSourceStatus?.[key] || 'loaded',
                progress: options.mirrorProgress || null,
              };
            })
            .filter((item: any) => !dataSourceKey || item.key === dataSourceKey)
            .filter((item: any) => !runningOnly || ['running', 'failed'].includes(item.progress?.status));

          ctx.body = { data: dataSourceKey ? items[0] || null : items };
        },
      },
    });

    this.app.acl.allow('datasource-mirror', 'webhook', 'public');
  }

  private async buildFieldInsights(dataSourceKey: string, collectionName: string, fieldName: string) {
    const collection = await this.app.db.getRepository('dataSourcesCollections').findOne({
      filter: {
        dataSourceKey,
        name: collectionName,
      },
    });

    if (!collection) {
      throw new Error(`Collection ${collectionName} not found in data source ${dataSourceKey}`);
    }

    const collectionData = collection.toJSON?.() || collection.get?.() || collection;
    const mirrorCollectionName =
      collectionData.mirrorCollectionName || collectionData.options?.mirrorCollectionName || collectionData.name;
    const sequelize = (this.app.db as any).sequelize;
    if (!sequelize) {
      throw new Error('Database connection is not available');
    }

    const quotedTable = `"${String(mirrorCollectionName).replace(/"/g, '""')}"`;
    const quotedField = `"${String(fieldName).replace(/"/g, '""')}"`;
    const rows = await sequelize.query(`SELECT ${quotedField} AS value FROM ${quotedTable} LIMIT 50`, {
      type: QueryTypes.SELECT,
    });

    const values = rows
      .map((row: any) => row?.value)
      .filter((value: any) => value !== undefined && value !== null && value !== '');

    return this.summarizeFieldValues(values);
  }

  private summarizeFieldValues(values: any[]) {
    const distinct = new Map<string, { value: any; count: number }>();
    const pushDistinct = (value: any) => {
      const key = typeof value === 'string' ? value : JSON.stringify(value);
      const entry = distinct.get(key);
      if (entry) {
        entry.count += 1;
      } else {
        distinct.set(key, { value, count: 1 });
      }
    };

    let inferredDisplay = 'plain';

    if (values.some(Array.isArray)) {
      inferredDisplay = 'multiple';
      for (const value of values) {
        if (Array.isArray(value)) {
          for (const item of value) {
            if (item !== null && item !== undefined && item !== '') {
              pushDistinct(item);
            }
          }
        }
      }
    } else if (values.length > 0 && values.every((value) => typeof value === 'boolean')) {
      inferredDisplay = 'boolean';
      values.forEach(pushDistinct);
    } else if (values.length > 0 && values.every((value) => typeof value === 'string')) {
      values.forEach(pushDistinct);
      if (distinct.size > 0 && distinct.size <= 20) {
        inferredDisplay = 'single';
      } else {
        inferredDisplay = 'plain';
      }
    } else {
      values.forEach(pushDistinct);
    }

    const candidateValues = Array.from(distinct.values())
      .sort((left, right) => right.count - left.count)
      .slice(0, 20)
      .map((entry) => ({
        value: entry.value,
        label: String(entry.value),
        count: entry.count,
      }));

    return {
      inferredDisplay,
      hasData: values.length > 0,
      sampleValues: values.slice(0, 5),
      candidateValues,
    };
  }

  private registerHooks() {
    this.app.db.on('dataSources.afterCreate', async (model: any) => {
      if (model.get('type') !== GITLAB_POSTGRES_MIRROR_TYPE || model.get('enabled') === false) {
        return;
      }

      setTimeout(() => {
        void this.prepareAndSync(model, 'initial').catch((error) => {
          this.app.logger?.error?.(error);
        });
      }, 500);
    });

    this.app.db.on('dataSources.afterSave', async (model: any) => {
      if (model.get('type') !== GITLAB_POSTGRES_MIRROR_TYPE || model.get('enabled') === false) {
        return;
      }

      if (model.changed('options') && !this.isMirrorProgressOnlyChange(model)) {
        setTimeout(() => {
          void this.prepareAndSync(model, 'manual').catch((error) => {
            this.app.logger?.error?.(error);
          });
        }, 500);
      }
    });
  }

  private async prepareAndSync(model: any, syncType: 'manual' | 'initial' | 'scheduled') {
    const dataSourceKey = model.get('key');
    if (this.runningPrepareAndSyncs.has(dataSourceKey)) {
      this.app.logger?.info?.(
        `[datasource-mirror] prepareAndSync skipped key=${dataSourceKey} syncType=${syncType} reason=already-running`,
      );
      return;
    }

    this.runningPrepareAndSyncs.add(dataSourceKey);
    const options = model.get('options') || {};
    const selectedTables = await this.resolveSelectedTables(model);
    try {
      this.updateManagerLoadingState(dataSourceKey, {
        status: 'running',
        totalTables: 0,
        completedTables: 0,
        failedTables: 0,
        currentTable: null,
      });

      this.app.logger?.info?.(
        `[datasource-mirror] prepareAndSync start key=${dataSourceKey} syncType=${syncType} selectedTables=${
          selectedTables?.length ?? 'all'
        }`,
      );

      await materializeMirrorTables({
        db: this.app.db,
        dataSourceKey,
        options,
        tables: selectedTables,
        onProgress: async (progress) => {
          this.updateManagerLoadingState(dataSourceKey, progress);
        },
      });

      await this.runSync(dataSourceKey, syncType, selectedTables);
      this.updateManagerLoadingState(dataSourceKey, {
        status: 'success',
      });
      this.app.logger?.info?.(`[datasource-mirror] prepareAndSync complete key=${dataSourceKey} syncType=${syncType}`);
    } catch (error: any) {
      this.updateManagerLoadingState(dataSourceKey, {
        status: 'failed',
        lastError: error?.message || String(error),
      });
      throw error;
    } finally {
      this.runningPrepareAndSyncs.delete(dataSourceKey);
    }
  }

  private updateManagerLoadingState(dataSourceKey: string, progress: Record<string, any>) {
    const plugin = this.app.pm.get<any>('data-source-manager');
    if (!plugin) {
      return;
    }

    if (progress.status === 'running') {
      plugin.dataSourceStatus[dataSourceKey] = 'loading';
      plugin.dataSourceLoadingProgress[dataSourceKey] = {
        loaded: Number(progress.completedTables || 0),
        total: Number(progress.totalTables || 0),
      };
      delete plugin.dataSourceErrors[dataSourceKey];
      return;
    }

    if (progress.status === 'success') {
      plugin.dataSourceStatus[dataSourceKey] = 'loaded';
      delete plugin.dataSourceLoadingProgress[dataSourceKey];
      delete plugin.dataSourceErrors[dataSourceKey];
      return;
    }

    if (progress.status === 'failed') {
      plugin.dataSourceStatus[dataSourceKey] = 'loading-failed';
      delete plugin.dataSourceLoadingProgress[dataSourceKey];
      plugin.dataSourceErrors[dataSourceKey] = new Error(progress.lastError || 'Mirror import failed');
    }
  }

  private isMirrorProgressOnlyChange(model: any) {
    const currentOptions = model.get?.('options') || model.options || {};
    const previousOptions = model.previous?.('options') || {};

    const currentComparable = JSON.stringify(this.stripMirrorProgress(currentOptions));
    const previousComparable = JSON.stringify(this.stripMirrorProgress(previousOptions));

    return currentComparable === previousComparable;
  }

  private stripMirrorProgress(options: Record<string, any> = {}) {
    const nextOptions = { ...options };
    delete nextOptions.mirrorProgress;
    return nextOptions;
  }

  private async resolveSelectedTables(model: any) {
    const dataSourceKey = model.get('key');
    const options = model.get('options') || {};
    const addAllCollections = options.addAllCollections !== false;
    if (addAllCollections) {
      return undefined;
    }

    const configuredCollections = await this.app.db.getRepository('dataSourcesCollections').find({
      filter: {
        dataSourceKey,
      },
    });

    const names = configuredCollections
      .map((collection: any) => collection.get?.('name') || collection.name)
      .filter(Boolean);

    return names.length > 0 ? names : undefined;
  }

  private async runSync(dataSourceKey: string, syncType: 'manual' | 'webhook' | 'scheduled' | 'initial', tables?: string[]) {
    if (this.runningSyncs.has(dataSourceKey)) {
      return {
        status: 'skipped',
        reason: 'sync already in progress',
      };
    }

    this.runningSyncs.add(dataSourceKey);
    try {
      const result = await this.dataImportService.importData(dataSourceKey, tables, syncType);
      const model = await this.app.db.getRepository('dataSources').findOne({
        filter: {
          key: dataSourceKey,
        },
      });
      await model?.loadIntoApplication?.({
        app: this.app,
        refresh: true,
        reuseDB: true,
      });
      return result;
    } finally {
      this.runningSyncs.delete(dataSourceKey);
    }
  }

  private startScheduler() {
    this.stopScheduler();
    this.syncTimer = setInterval(() => {
      void this.runScheduledSync();
    }, 60 * 1000);
  }

  private stopScheduler() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  private async runScheduledSync() {
    const records = await this.app.db.getRepository('dataSources').find({
      filter: {
        type: GITLAB_POSTGRES_MIRROR_TYPE,
        enabled: true,
      },
    });

    for (const record of records as any[]) {
      const options = record.get?.('options') || record.options || {};
      const intervalMinutes = Number(options.syncIntervalMinutes || DEFAULT_SYNC_INTERVAL_MINUTES);
      const lastSuccessTime = await this.dataImportService.getLastSuccessTime(record.get('key'), ['initial', 'manual', 'scheduled']);
      const dueAt = lastSuccessTime ? new Date(lastSuccessTime).getTime() + intervalMinutes * 60 * 1000 : 0;
      const needsMaterialization = await this.needsMaterialization(record);
      const dataSourceKey = record.get?.('key') || record.key;

      if (needsMaterialization || !lastSuccessTime || Date.now() >= dueAt) {
        this.app.logger?.info?.(
          `[datasource-mirror] scheduled sync key=${dataSourceKey} needsMaterialization=${needsMaterialization} lastSuccessTime=${
            lastSuccessTime || 'none'
          }`,
        );
        try {
          await this.prepareAndSync(record, 'scheduled');
        } catch (error: any) {
          this.app.logger?.error?.(
            `[datasource-mirror] scheduled sync failed key=${dataSourceKey}: ${error?.stack || error?.message || error}`,
          );
        }
      }
    }
  }

  private async needsMaterialization(record: any) {
    const options = record.get?.('options') || record.options || {};
    if (options.addAllCollections === false) {
      return false;
    }

    const dataSourceKey = record.get?.('key') || record.key;
    const configuredCollections = await this.app.db.getRepository('dataSourcesCollections').find({
      filter: {
        dataSourceKey,
      },
    });

    const connector = DataSourceConnectorFactory.createConnector(GITLAB_POSTGRES_MIRROR_TYPE, options);

    try {
      await connector.connect();
      const remoteTables = await connector.getTables();
      return configuredCollections.length < remoteTables.length;
    } finally {
      await connector.disconnect().catch(() => undefined);
    }
  }

  async afterDisable() {
    this.stopScheduler();
  }

  async remove() {
    this.stopScheduler();
  }
}

export default PluginDatasourceMirrorServer;

import type { Database } from '@nocobase/database';
import { DataImportService } from './data-import';

export class WebhookService {
  constructor(private readonly dataImportService: DataImportService) {}

  async handleWebhook(db: Database, dataSourceKey: string, requestToken?: string) {
    const datasource = await db.getRepository('dataSources').findOne({
      filter: {
        key: dataSourceKey,
      },
    });
    if (!datasource) {
      throw new Error(`Data source ${dataSourceKey} not found`);
    }

    const options = datasource.get?.('options') ?? datasource.options ?? {};
    const expectedToken = options.webhookToken || options.webhook_token;
    if (expectedToken && requestToken !== expectedToken) {
      throw new Error('Invalid GitLab webhook token');
    }

    return this.dataImportService.importData(dataSourceKey, undefined, 'webhook');
  }
}

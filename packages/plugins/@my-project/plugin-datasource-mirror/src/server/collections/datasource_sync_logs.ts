import { defineCollection } from '@nocobase/database';

export default defineCollection({
  name: 'datasource_sync_logs',
  fields: [
    {
      type: 'bigInt',
      name: 'id',
      primaryKey: true,
      autoIncrement: true,
    },
    {
      type: 'string',
      name: 'datasource_key',
      required: true,
    },
    {
      type: 'string',
      name: 'status',
      defaultValue: 'pending',
    },
    {
      type: 'string',
      name: 'sync_type',
      required: true,
    },
    {
      type: 'integer',
      name: 'records_inserted',
      defaultValue: 0,
    },
    {
      type: 'integer',
      name: 'records_updated',
      defaultValue: 0,
    },
    {
      type: 'integer',
      name: 'records_deleted',
      defaultValue: 0,
    },
    {
      type: 'text',
      name: 'error_message',
    },
    {
      type: 'double',
      name: 'duration_seconds',
    },
    {
      type: 'date',
      name: 'started_at',
      createdAt: true,
    },
    {
      type: 'date',
      name: 'completed_at',
    },
  ],
});

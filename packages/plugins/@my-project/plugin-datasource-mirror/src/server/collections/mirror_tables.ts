import { defineCollection } from '@nocobase/database';

export default defineCollection({
  name: 'mirror_tables',
  fields: [
    {
      type: 'bigInt',
      name: 'id',
      primaryKey: true,
      autoIncrement: true,
    },
    {
      type: 'bigInt',
      name: 'datasource_id',
      required: true,
    },
    {
      type: 'string',
      name: 'source_table',
      required: true,
    },
    {
      type: 'string',
      name: 'mirror_table',
      required: true,
    },
    {
      type: 'json',
      name: 'field_mapping',
      defaultValue: [],
    },
    {
      type: 'bigInt',
      name: 'total_records',
      defaultValue: 0,
    },
    {
      type: 'date',
      name: 'last_sync_time',
    },
    {
      type: 'boolean',
      name: 'enabled',
      defaultValue: true,
    },
    {
      type: 'date',
      name: 'created_at',
      createdAt: true,
    },
    {
      type: 'date',
      name: 'updated_at',
      updatedAt: true,
    },
  ],
});

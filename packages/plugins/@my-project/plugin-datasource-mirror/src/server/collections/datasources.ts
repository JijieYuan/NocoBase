import { defineCollection } from '@nocobase/database';

export default defineCollection({
  name: 'datasources',
  fields: [
    {
      type: 'bigInt',
      name: 'id',
      primaryKey: true,
      autoIncrement: true,
    },
    {
      type: 'string',
      name: 'name',
      required: true,
      comment: 'Datasource name',
    },
    {
      type: 'text',
      name: 'description',
      comment: 'Datasource description',
    },
    {
      type: 'string',
      name: 'type',
      required: true,
      defaultValue: 'gitlab',
      comment: 'GitLab source type',
    },
    {
      type: 'json',
      name: 'config',
      required: true,
      defaultValue: {},
      comment: 'GitLab API datasource config',
    },
    {
      type: 'json',
      name: 'mapping',
      defaultValue: [],
      comment: 'Source table to local mirror table mappings',
    },
    {
      type: 'boolean',
      name: 'enabled',
      defaultValue: true,
    },
    {
      type: 'string',
      name: 'webhook_token',
      comment: 'GitLab webhook secret token',
    },
    {
      type: 'date',
      name: 'last_sync_time',
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

import { defineCollection } from '@nocobase/database';

export default defineCollection({
  name: 'rocksdb_issues',
  fields: [
    { type: 'bigInt', name: 'id', primaryKey: true },
    { type: 'string', name: 'title' },
    { type: 'string', name: 'state' },
    // 强制设置默认值，确保看板显示“工程图”
    { 
      type: 'bigInt', 
      name: 'module_id', 
      defaultValue: 353995233099776 
    },
  ],
});
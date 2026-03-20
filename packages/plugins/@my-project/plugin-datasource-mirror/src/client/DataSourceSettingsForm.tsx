import React, { useMemo } from 'react';
import { SchemaComponent } from '@nocobase/client';
import { useField } from '@formily/react';

type CollectionsTableFactory = (options: { NAMESPACE: string; t: (key: string, options?: any) => string }) => {
  CollectionsTable: React.ComponentType<any>;
  createCollectionsSchema: (from: string, loadCollections: any) => any;
};

type DataSourceSettingsFormProps = {
  CollectionsTableField: CollectionsTableFactory;
  loadCollections: any;
  from: 'create' | 'edit';
};

export const DataSourceSettingsForm: React.FC<DataSourceSettingsFormProps> = ({
  CollectionsTableField,
  loadCollections,
  from,
}) => {
  const tableField = useMemo(
    () =>
      CollectionsTableField({
        NAMESPACE: 'data-source-manager',
        t: (key: string) => key,
      }),
    [CollectionsTableField],
  );

  const CollectionsTable = useMemo(() => {
    const BaseCollectionsTable = tableField.CollectionsTable;

    const WrappedCollectionsTable: React.FC<any> = (props) => {
      const field = useField();
      const form = field.form;
      return (
        <BaseCollectionsTable
          {...props}
          from={from}
          loadCollections={loadCollections}
          formValues={form.values}
          options={form.values?.options}
          formSetValues={form.setValuesIn}
        />
      );
    };

    WrappedCollectionsTable.displayName = 'GitlabMirrorCollectionsTable';
    return WrappedCollectionsTable;
  }, [from, loadCollections, tableField.CollectionsTable]);

  const schema = useMemo(
    () => ({
      type: 'object',
      properties: {
        key: {
          type: 'string',
          title: '数据源标识',
          'x-decorator': 'FormItem',
          'x-component': 'Input',
          required: true,
          'x-disabled': from === 'edit',
        },
        displayName: {
          type: 'string',
          title: '数据源名称',
          'x-decorator': 'FormItem',
          'x-component': 'Input',
          required: true,
        },
        type: {
          type: 'string',
          'x-decorator': 'FormItem',
          'x-component': 'Input',
          'x-hidden': true,
        },
        options: {
          type: 'object',
          properties: {
            host: {
              type: 'string',
              title: '主机地址',
              'x-decorator': 'FormItem',
              'x-component': 'Input',
              description: '留空时，优先尝试通过本地 GitLab Docker 容器读取数据库。',
            },
            port: {
              type: 'number',
              title: '端口',
              'x-decorator': 'FormItem',
              'x-component': 'InputNumber',
              'x-component-props': {
                style: { width: '100%' },
              },
            },
            database: {
              type: 'string',
              title: '数据库名',
              'x-decorator': 'FormItem',
              'x-component': 'Input',
              required: true,
              default: 'gitlabhq_production',
            },
            schema: {
              type: 'string',
              title: 'Schema',
              'x-decorator': 'FormItem',
              'x-component': 'Input',
              default: 'public',
            },
            username: {
              type: 'string',
              title: '用户名',
              'x-decorator': 'FormItem',
              'x-component': 'Input',
              default: 'gitlab',
            },
            password: {
              type: 'string',
              title: '密码',
              'x-decorator': 'FormItem',
              'x-component': 'Password',
              description: '如果使用本地 GitLab Docker 模式，此字段可以留空。',
            },
            dockerContainerName: {
              type: 'string',
              title: '本地 GitLab Docker 容器名',
              'x-decorator': 'FormItem',
              'x-component': 'Input',
              default: 'gitlab-data-web-1',
              description:
                '本地 Docker 模式下，插件会通过 docker exec + Unix socket 读取 GitLab 自带数据库，无需修改 GitLab 配置文件。',
            },
            ssl: {
              type: 'boolean',
              title: '启用 SSL',
              'x-decorator': 'FormItem',
              'x-component': 'Checkbox',
            },
            webhookToken: {
              type: 'string',
              title: 'Webhook Token',
              'x-decorator': 'FormItem',
              'x-component': 'Input',
            },
            syncIntervalMinutes: {
              type: 'number',
              title: '全量同步间隔（分钟）',
              'x-decorator': 'FormItem',
              'x-component': 'InputNumber',
              'x-component-props': {
                style: { width: '100%' },
              },
              default: 60,
            },
            addAllCollections: {
              type: 'boolean',
              'x-component': 'Checkbox',
              'x-display': 'hidden',
              default: true,
            },
          },
        },
        collections: {
          type: 'array',
          title: '数据表',
          'x-decorator': 'FormItem',
          'x-component': 'CollectionsTable',
          'x-component-props': {
            dataSourceKey: '{{$form.values.key}}',
          },
        },
      },
    }),
    [from],
  );

  return <SchemaComponent components={{ CollectionsTable }} schema={schema as any} />;
};

export default DataSourceSettingsForm;

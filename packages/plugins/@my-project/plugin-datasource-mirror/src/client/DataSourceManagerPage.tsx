import React, { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Space,
  Spin,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  DatabaseOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SyncOutlined,
} from '@ant-design/icons';

type DatasourceRecord = {
  id: number;
  name: string;
  description?: string;
  type: 'postgres';
  enabled?: boolean;
  webhook_token?: string;
  last_sync_time?: string;
  config: {
    host: string;
    port?: number;
    database: string;
    schema?: string;
    username: string;
    password: string;
    ssl?: boolean;
  };
  mapping: Array<{
    source_table: string;
    target_table: string;
    fields: Array<{
      source: string;
      target: string;
      type?: string;
      primary_key?: boolean;
      required?: boolean;
    }>;
  }>;
};

const defaultMapping = JSON.stringify(
  [
    {
      source_table: 'issues',
      target_table: 'gitlab_mirror_issues',
      fields: [
        { source: 'id', target: 'gitlab_id', type: 'bigInt', primary_key: true },
        { source: 'title', target: 'title', type: 'string' },
        { source: 'description', target: 'description', type: 'text' },
        { source: 'state_id', target: 'state_id', type: 'integer' },
        { source: 'created_at', target: 'created_at', type: 'date' },
        { source: 'updated_at', target: 'updated_at', type: 'date' },
      ],
    },
  ],
  null,
  2,
);

async function parseJsonResponse(response: Response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.errors?.[0]?.message || payload?.message || 'Request failed');
  }
  return payload;
}

function buildPayload(values: any) {
  return {
    name: values.name,
    description: values.description,
    type: 'postgres',
    enabled: values.enabled !== false,
    webhook_token: values.webhook_token,
    config: {
      host: values.config?.host,
      port: values.config?.port || 5432,
      database: values.config?.database,
      schema: values.config?.schema || 'public',
      username: values.config?.username,
      password: values.config?.password,
      ssl: Boolean(values.config?.ssl),
    },
    mapping: typeof values.mapping === 'string' ? JSON.parse(values.mapping || '[]') : values.mapping || [],
  };
}

export const DataSourceManagerPage: React.FC = () => {
  const [form] = Form.useForm();
  const [records, setRecords] = useState<DatasourceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [editingRecord, setEditingRecord] = useState<DatasourceRecord | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const loadRecords = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/datasource-mirror:list');
      const payload = await parseJsonResponse(response);
      setRecords(Array.isArray(payload?.data) ? payload.data : []);
    } catch (error: any) {
      message.error(error.message || 'Failed to load datasources');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRecords();
  }, []);

  const openCreateModal = () => {
    setEditingRecord(null);
    form.resetFields();
    form.setFieldsValue({
      enabled: true,
      mapping: defaultMapping,
      config: {
        host: '',
        port: 5432,
        database: 'gitlabhq_production',
        schema: 'public',
        username: 'gitlab',
        password: '',
        ssl: false,
      },
    });
    setModalOpen(true);
  };

  const openEditModal = (record: DatasourceRecord) => {
    setEditingRecord(record);
    form.setFieldsValue({
      ...record,
      mapping: JSON.stringify(record.mapping || [], null, 2),
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const payload = buildPayload(values);
      setSaving(true);

      const response = await fetch(
        editingRecord
          ? `/api/datasources:update?filterByTk=${editingRecord.id}`
          : '/api/datasources:create',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );

      await parseJsonResponse(response);
      message.success(editingRecord ? 'Datasource updated' : 'Datasource created');
      setModalOpen(false);
      await loadRecords();
    } catch (error: any) {
      if (error?.errorFields) {
        return;
      }
      message.error(error.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      const values = await form.validateFields();
      setTesting(true);
      const response = await fetch('/api/datasource-mirror:test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'postgres',
          config: buildPayload(values).config,
        }),
      });

      await parseJsonResponse(response);
      message.success('GitLab connection successful');
    } catch (error: any) {
      if (error?.errorFields) {
        return;
      }
      message.error(error.message || 'Connection test failed');
    } finally {
      setTesting(false);
    }
  };

  const handleSync = async (record: DatasourceRecord) => {
    try {
      setSyncingId(record.id);
      const response = await fetch('/api/datasource-mirror:sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ datasource_id: record.id }),
      });
      const payload = await parseJsonResponse(response);
      message.success(
        `Sync finished: inserted ${payload?.data?.inserted ?? 0}, updated ${payload?.data?.updated ?? 0}`,
      );
      await loadRecords();
    } catch (error: any) {
      message.error(error.message || 'Sync failed');
    } finally {
      setSyncingId(null);
    }
  };

  const handleDelete = async (record: DatasourceRecord) => {
    Modal.confirm({
      title: `Delete datasource ${record.name}`,
      content: 'This will not delete existing local mirror tables. Continue?',
      okButtonProps: { danger: true },
      onOk: async () => {
        const response = await fetch(`/api/datasources:destroy?filterByTk=${record.id}`, {
          method: 'POST',
        });
        await parseJsonResponse(response);
        message.success('Datasource deleted');
        await loadRecords();
      },
    });
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: () => <Tag color="blue">postgres</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (enabled: boolean) => (enabled ? <Tag color="green">enabled</Tag> : <Tag>disabled</Tag>),
    },
    {
      title: 'Last sync',
      dataIndex: 'last_sync_time',
      key: 'last_sync_time',
      render: (value: string) => (value ? new Date(value).toLocaleString() : '-'),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, record: DatasourceRecord) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => openEditModal(record)}>
            Edit
          </Button>
          <Button
            type="primary"
            icon={<SyncOutlined />}
            loading={syncingId === record.id}
            onClick={() => handleSync(record)}
          >
            Sync now
          </Button>
          <Button danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)}>
            Delete
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title={
        <Space>
          <DatabaseOutlined />
          <span>GitLab Mirror</span>
        </Space>
      }
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => void loadRecords()}>
            Refresh
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            New datasource
          </Button>
        </Space>
      }
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Alert
          type="info"
          showIcon
          message="Version 1 only supports external PostgreSQL used by GitLab 16."
          description="Webhook requests only trigger sync jobs. They do not patch mirror rows directly. Each mapping must define source_table, target_table, and one primary_key field."
        />

        <Spin spinning={loading}>
          <Table rowKey="id" columns={columns} dataSource={records} pagination={{ pageSize: 10 }} />
        </Spin>
      </Space>

      <Modal
        open={modalOpen}
        title={editingRecord ? `Edit ${editingRecord.name}` : 'New GitLab PostgreSQL datasource'}
        width={860}
        destroyOnClose
        onCancel={() => setModalOpen(false)}
        footer={[
          <Button key="test" onClick={handleTestConnection} loading={testing}>
            Test connection
          </Button>,
          <Button key="cancel" onClick={() => setModalOpen(false)}>
            Cancel
          </Button>,
          <Button key="save" type="primary" onClick={handleSave} loading={saving}>
            Save
          </Button>,
        ]}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Datasource name" rules={[{ required: true, message: 'Enter datasource name' }]}>
            <Input placeholder="gitlab-prod-db" />
          </Form.Item>

          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="GitLab 16 production database for issues and merge requests" />
          </Form.Item>

          <Typography.Title level={5}>GitLab connection</Typography.Title>

          <Form.Item name={['config', 'host']} label="Host" rules={[{ required: true, message: 'Enter PostgreSQL host' }]}>
            <Input />
          </Form.Item>
          <Form.Item name={['config', 'port']} label="Port" initialValue={5432}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name={['config', 'database']}
            label="Database"
            rules={[{ required: true, message: 'Enter database name' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name={['config', 'schema']}
            label="Schema"
            initialValue="public"
            rules={[{ required: true, message: 'Enter schema name' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name={['config', 'username']}
            label="Username"
            rules={[{ required: true, message: 'Enter username' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name={['config', 'password']}
            label="Password"
            rules={[{ required: true, message: 'Enter password' }]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item name={['config', 'ssl']} label="Use SSL" valuePropName="checked" initialValue={false}>
            <Switch />
          </Form.Item>

          <Typography.Title level={5}>Webhook</Typography.Title>

          <Form.Item name="webhook_token" label="GitLab webhook token">
            <Input.Password placeholder="Match the GitLab webhook secret token" />
          </Form.Item>

          <Typography.Title level={5}>Table mapping</Typography.Title>

          <Form.Item
            name="mapping"
            label="Mapping JSON"
            rules={[{ required: true, message: 'Enter mapping JSON' }]}
            extra="Each mapping requires at least one primary_key field."
          >
            <Input.TextArea rows={14} placeholder={defaultMapping} />
          </Form.Item>

          <Form.Item name="enabled" label="Enabled" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default DataSourceManagerPage;

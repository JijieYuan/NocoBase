import React, { useMemo, useState } from 'react';
import { useAPIClient, useCompile, useRecord } from '@nocobase/client';
import { useParams } from 'react-router-dom';
import { Button, Descriptions, Drawer, Empty, List, Space, Spin, Table, Tag, Typography } from 'antd';
import { EyeOutlined } from '@ant-design/icons';

type FieldRecord = {
  name: string;
  interface?: string;
  description?: string;
  primaryKey?: boolean;
  uiSchema?: {
    title?: string;
    enum?: Array<{ label?: string; value?: any }>;
    'x-component-props'?: Record<string, any>;
  };
  options?: Record<string, any>;
};

type FieldInsights = {
  inferredDisplay?: 'plain' | 'single' | 'multiple' | 'boolean';
  hasData?: boolean;
  sampleValues?: any[];
  candidateValues?: Array<{ value: any; label: string; count: number }>;
};

function prettifyJson(value: unknown) {
  if (value == null) {
    return '';
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function renderValue(value: unknown) {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <Typography.Text type="secondary">[]</Typography.Text>;
    }
    return (
      <Space wrap>
        {value.map((item, index) => (
          <Tag key={`${String(item)}-${index}`}>{typeof item === 'object' ? prettifyJson(item) : String(item)}</Tag>
        ))}
      </Space>
    );
  }

  if (typeof value === 'boolean') {
    return <Tag color={value ? 'green' : 'default'}>{value ? '是' : '否'}</Tag>;
  }

  if (value && typeof value === 'object') {
    return (
      <Typography.Paragraph style={{ marginBottom: 0 }}>
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{prettifyJson(value)}</pre>
      </Typography.Paragraph>
    );
  }

  if (value === undefined || value === null || value === '') {
    return <Typography.Text type="secondary">-</Typography.Text>;
  }

  return String(value);
}

function readFieldTitle(field: FieldRecord) {
  return field.uiSchema?.title || field.name;
}

function readStorageType(field: FieldRecord) {
  return String(field.options?.type || field.description || '-');
}

function readUiType(field: FieldRecord, insights?: FieldInsights) {
  if (Array.isArray(field.uiSchema?.enum) && field.uiSchema?.enum.length > 0) {
    return '下拉单选';
  }
  if (insights?.inferredDisplay === 'multiple') {
    return '下拉多选';
  }
  if (insights?.inferredDisplay === 'single') {
    return '下拉单选';
  }
  if (insights?.inferredDisplay === 'boolean') {
    return '布尔';
  }
  return field.interface || '-';
}

function readDescription(field: FieldRecord, insights?: FieldInsights) {
  const parts = [field.description].filter(Boolean) as string[];
  if (insights?.inferredDisplay === 'multiple') {
    parts.push('已根据真实数据识别为多值字段');
  } else if (insights?.inferredDisplay === 'single') {
    parts.push('已根据真实数据识别为候选值较少的单值字段');
  }
  return parts.join('；') || '-';
}

function readDefaultValue(field: FieldRecord) {
  const componentProps = field.uiSchema?.['x-component-props'] || {};
  return componentProps.defaultValue ?? field.options?.defaultValue ?? field.options?.default;
}

function readEnumOptions(field: FieldRecord) {
  const uiEnum = Array.isArray(field.uiSchema?.enum) ? field.uiSchema?.enum : [];
  const optionEnum = Array.isArray(field.options?.enum) ? field.options?.enum : [];
  const merged = [...uiEnum, ...optionEnum].filter(Boolean);
  return merged.map((item: any) => ({
    label: item.label ?? item.value ?? String(item),
    value: item.value ?? item.label ?? item,
  }));
}

function renderAssociationDetails(field: FieldRecord) {
  const entries = [
    ['关系类型', field.options?.type],
    ['目标表', field.options?.target],
    ['中间表', field.options?.through],
    ['外键', field.options?.foreignKey],
    ['源字段', field.options?.sourceKey],
    ['目标字段', field.options?.targetKey],
    ['反向字段', field.options?.reverseField?.name || field.options?.reverseField],
  ].filter(([, value]) => value !== undefined && value !== null && value !== '');

  if (entries.length === 0) {
    return <Typography.Text type="secondary">没有关联元信息</Typography.Text>;
  }

  return (
    <Descriptions column={1} size="small" bordered>
      {entries.map(([label, value]) => (
        <Descriptions.Item key={label} label={label}>
          {typeof value === 'object' ? prettifyJson(value) : String(value)}
        </Descriptions.Item>
      ))}
    </Descriptions>
  );
}

function renderOptionList(options: Array<{ label: string; value: any; count?: number }>, emptyText: string) {
  if (!options.length) {
    return <Typography.Text type="secondary">{emptyText}</Typography.Text>;
  }

  return (
    <List
      size="small"
      bordered
      dataSource={options}
      renderItem={(item) => (
        <List.Item>
          <Space wrap style={{ justifyContent: 'space-between', width: '100%' }}>
            <Space wrap>
              <Tag color="blue">{item.label}</Tag>
              <Typography.Text type="secondary">{String(item.value)}</Typography.Text>
            </Space>
            {typeof item.count === 'number' ? <Typography.Text type="secondary">出现 {item.count} 次</Typography.Text> : null}
          </Space>
        </List.Item>
      )}
    />
  );
}

export const ReadonlyCollectionFieldsAction: React.FC<any> = ({ item, ...rest }) => {
  const record = useRecord() || item;
  const collectionName = record?.name;
  const collectionTitle = record?.title || record?.options?.title || collectionName;
  const compile = useCompile();
  const api = useAPIClient();
  const { name: dataSourceName = 'main' } = useParams();

  const [open, setOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [fields, setFields] = useState<FieldRecord[]>([]);
  const [selectedField, setSelectedField] = useState<FieldRecord | null>(null);
  const [selectedFieldInsights, setSelectedFieldInsights] = useState<FieldInsights | null>(null);

  const loadFields = async () => {
    if (!collectionName) {
      return;
    }
    setLoading(true);
    try {
      const response = await api.request({
        url: `dataSourcesCollections/${dataSourceName}.${collectionName}/fields:list`,
        params: {
          paginate: false,
          sort: ['sort', 'name'],
        },
      });
      setFields(response?.data?.data || []);
    } finally {
      setLoading(false);
    }
  };

  const loadFieldInsights = async (field: FieldRecord) => {
    if (!collectionName) {
      return;
    }
    setDetailLoading(true);
    try {
      const response = await api.request({
        url: 'datasource-mirror:field-insights',
        params: {
          dataSourceKey: dataSourceName,
          collectionName,
          fieldName: field.name,
        },
      });
      setSelectedFieldInsights(response?.data?.data || {});
    } finally {
      setDetailLoading(false);
    }
  };

  const handleOpen = async () => {
    setOpen(true);
    await loadFields();
  };

  const columns = useMemo(
    () => [
      {
        title: '字段名称',
        dataIndex: 'uiSchema',
        key: 'title',
        render: (_: unknown, field: FieldRecord) => compile(readFieldTitle(field)),
      },
      {
        title: '字段标识',
        dataIndex: 'name',
        key: 'name',
      },
      {
        title: '存储类型',
        key: 'type',
        render: (_: unknown, field: FieldRecord) => <Tag>{readStorageType(field)}</Tag>,
      },
      {
        title: '界面类型',
        dataIndex: 'interface',
        key: 'interface',
        render: (value: string | undefined, field: FieldRecord) => (
          <Tag color="blue">{readUiType(field, field === selectedField ? selectedFieldInsights || undefined : undefined) || value || '-'}</Tag>
        ),
      },
      {
        title: '索引',
        key: 'indexes',
        render: (_: unknown, field: FieldRecord) => (
          <Space>
            {(field.options?.primaryKey || field.primaryKey) ? <Tag color="gold">主键</Tag> : null}
            {field.options?.unique ? <Tag color="purple">唯一</Tag> : null}
          </Space>
        ),
      },
      {
        title: '操作',
        key: 'actions',
        render: (_: unknown, field: FieldRecord) => (
          <Button
            type="link"
            onClick={() => {
              setSelectedField(field);
              setSelectedFieldInsights(null);
              setDetailOpen(true);
              void loadFieldInsights(field);
            }}
          >
            查看
          </Button>
        ),
      },
    ],
    [compile, selectedField, selectedFieldInsights],
  );

  const enumOptions = useMemo(() => (selectedField ? readEnumOptions(selectedField) : []), [selectedField]);
  const sampledOptions = useMemo(
    () => (selectedFieldInsights?.candidateValues || []).map((item) => ({ ...item, label: item.label || String(item.value) })),
    [selectedFieldInsights],
  );

  return (
    <>
      <Button type="link" icon={<EyeOutlined />} onClick={() => void handleOpen()} {...rest}>
        查看字段
      </Button>

      <Drawer
        title={`${compile(collectionTitle || '')} - 查看字段`}
        width="70%"
        open={open}
        destroyOnClose
        onClose={() => {
          setOpen(false);
          setDetailOpen(false);
          setSelectedField(null);
          setSelectedFieldInsights(null);
        }}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Typography.Text type="secondary">这里是只读视图，可以查看镜像字段信息，但不能编辑。</Typography.Text>

          <Spin spinning={loading}>
            <Table<FieldRecord>
              rowKey="name"
              pagination={false}
              columns={columns as any}
              dataSource={fields}
              locale={{
                emptyText: <Empty description="没有字段信息" />,
              }}
            />
          </Spin>
        </Space>

        <Drawer
          title={`${compile(collectionTitle || '')} - 查看字段详情`}
          width="52%"
          open={detailOpen}
          destroyOnClose
          onClose={() => {
            setDetailOpen(false);
            setSelectedField(null);
            setSelectedFieldInsights(null);
          }}
        >
          {selectedField ? (
            <Spin spinning={detailLoading}>
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Descriptions column={1} bordered size="small">
                  <Descriptions.Item label="字段名称">{compile(readFieldTitle(selectedField))}</Descriptions.Item>
                  <Descriptions.Item label="字段标识">{selectedField.name}</Descriptions.Item>
                  <Descriptions.Item label="存储类型">{readStorageType(selectedField)}</Descriptions.Item>
                  <Descriptions.Item label="界面类型">{readUiType(selectedField, selectedFieldInsights || undefined)}</Descriptions.Item>
                  <Descriptions.Item label="主键">
                    {(selectedField.options?.primaryKey || selectedField.primaryKey) ? '是' : '否'}
                  </Descriptions.Item>
                  <Descriptions.Item label="唯一">{selectedField.options?.unique ? '是' : '否'}</Descriptions.Item>
                  <Descriptions.Item label="默认值">{renderValue(readDefaultValue(selectedField))}</Descriptions.Item>
                  <Descriptions.Item label="描述">{readDescription(selectedField, selectedFieldInsights || undefined)}</Descriptions.Item>
                </Descriptions>

                <div>
                  <Typography.Title level={5}>预设选项</Typography.Title>
                  {renderOptionList(enumOptions, '当前字段没有显式配置预设选项')}
                </div>

                <div>
                  <Typography.Title level={5}>根据数据推断的候选值</Typography.Title>
                  {renderOptionList(sampledOptions, '当前没有足够的数据样本用于推断候选值')}
                </div>

                <div>
                  <Typography.Title level={5}>样例值</Typography.Title>
                  {!selectedFieldInsights?.sampleValues?.length ? (
                    <Typography.Text type="secondary">当前字段暂无样例值</Typography.Text>
                  ) : (
                    <List
                      size="small"
                      bordered
                      dataSource={selectedFieldInsights.sampleValues}
                      renderItem={(item) => <List.Item>{renderValue(item)}</List.Item>}
                    />
                  )}
                </div>

                <div>
                  <Typography.Title level={5}>关联信息</Typography.Title>
                  {renderAssociationDetails(selectedField)}
                </div>

                <div>
                  <Typography.Title level={5}>原始配置</Typography.Title>
                  <Typography.Paragraph>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {prettifyJson(selectedField.options || {})}
                    </pre>
                  </Typography.Paragraph>
                </div>
              </Space>
            </Spin>
          ) : null}
        </Drawer>
      </Drawer>
    </>
  );
};

export default ReadonlyCollectionFieldsAction;

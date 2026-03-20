export type MappingField = {
  source: string;
  target: string;
  type?: string;
  primary_key?: boolean;
  required?: boolean;
};

export type TableMapping = {
  source_table: string;
  target_table: string;
  fields: MappingField[];
};

export function transformRecord(sourceRecord: Record<string, any>, fieldMapping: MappingField[]) {
  if (!Array.isArray(fieldMapping) || fieldMapping.length === 0) {
    return { ...sourceRecord };
  }

  return fieldMapping.reduce<Record<string, any>>((acc, field) => {
    acc[field.target] = sourceRecord[field.source];
    return acc;
  }, {});
}

export function getPrimaryKeyField(fieldMapping: MappingField[]) {
  return fieldMapping.find((field) => field.primary_key);
}

export function getWhereClause(record: Record<string, any>, fieldMapping: MappingField[]) {
  const primaryKeyField = getPrimaryKeyField(fieldMapping);
  if (!primaryKeyField) {
    throw new Error('Each mapping must define one primary_key field');
  }

  return {
    [primaryKeyField.target]: record[primaryKeyField.target],
  };
}

export function normalizeFieldType(type?: string) {
  const value = (type || 'string').toLowerCase();
  const typeMap: Record<string, string> = {
    string: 'string',
    text: 'text',
    integer: 'integer',
    int: 'integer',
    bigint: 'bigInt',
    biginteger: 'bigInt',
    number: 'integer',
    boolean: 'boolean',
    date: 'date',
    datetime: 'date',
    timestamp: 'date',
    json: 'json',
    jsonb: 'json',
    float: 'float',
    double: 'double',
    numeric: 'double',
    real: 'float',
    uuid: 'string',
    character: 'string',
    'character varying': 'string',
    varchar: 'string',
    time: 'date',
  };

  return typeMap[value] || 'string';
}

export function interfaceByFieldType(type?: string) {
  switch (normalizeFieldType(type)) {
    case 'boolean':
      return 'checkbox';
    case 'integer':
    case 'bigInt':
    case 'float':
    case 'double':
      return 'number';
    case 'date':
      return 'datetime';
    case 'json':
      return 'json';
    case 'text':
      return 'textarea';
    default:
      return 'input';
  }
}

export function normalizeSyncOptions(options: Record<string, any> = {}) {
  return {
    host: options.host || options.hostname || '',
    port: options.port ? Number(options.port) : undefined,
    database: options.database || options.db || '',
    schema: options.schema || options.dbSchema || 'public',
    username: options.username || options.user || '',
    password: options.password || '',
    ssl: Boolean(options.ssl),
    dockerContainerName: options.dockerContainerName || options.docker_container_name || 'gitlab-data-web-1',
    webhookToken: options.webhookToken || options.webhook_token,
    syncIntervalMinutes: Number(options.syncIntervalMinutes || 60),
  };
}

export function buildUiSchemaTitle(name: string) {
  return name
    .split('_')
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

export function buildMirrorCollectionName(dataSourceKey: string, sourceTable: string) {
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  const base = `mirror_${normalize(dataSourceKey)}_${normalize(sourceTable)}`.slice(0, 55);
  const suffix = Math.abs(hashCode(`${dataSourceKey}:${sourceTable}`)).toString(36).slice(0, 6);
  return `${base}_${suffix}`;
}

function hashCode(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

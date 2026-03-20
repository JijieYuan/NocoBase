import { execFile } from 'child_process';
import { promisify } from 'util';
import { Client } from 'pg';

const execFileAsync = promisify(execFile);

export type PostgresMirrorConfig = {
  host: string;
  port?: number | string;
  database: string;
  schema?: string;
  username: string;
  password: string;
  ssl?: boolean | Record<string, any>;
  webhookToken?: string;
  syncIntervalMinutes?: number;
  dockerContainerName?: string;
};

export type TableSchemaField = {
  name: string;
  type: string;
  rawType: string;
  is_nullable: 'YES' | 'NO';
  is_primary_key: boolean;
  default_value?: string | null;
  max_length?: number | null;
  numeric_precision?: number | null;
  numeric_scale?: number | null;
  description?: string | null;
  references?: {
    table: string;
    column: string;
  } | null;
};

function quoteIdentifier(value: string) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export class DataSourceConnectorFactory {
  static createConnector(type: string, config: PostgresMirrorConfig) {
    if (!['gitlab', 'gitlab-postgres-mirror'].includes(type)) {
      throw new Error(`Unsupported datasource type: ${type}`);
    }

    if (!config.host && config.dockerContainerName) {
      return new DockerExecPostgresMirrorConnector(config);
    }

    return new PostgresMirrorConnector(config);
  }
}

export class PostgresMirrorConnector {
  private client: Client | null = null;

  constructor(public readonly config: PostgresMirrorConfig) {}

  get schema() {
    return String(this.config.schema || 'public');
  }

  async connect(): Promise<void> {
    this.ensureConfigured();

    if (this.client) {
      return;
    }

    const client = new Client({
      host: this.config.host,
      port: this.config.port ? Number(this.config.port) : 5432,
      database: this.config.database,
      user: this.config.username,
      password: this.config.password,
      ssl: this.resolveSsl(),
    } as any);

    await client.connect();
    this.client = client;
  }

  async disconnect(): Promise<void> {
    if (!this.client) {
      return;
    }

    const client = this.client;
    this.client = null;
    await client.end();
  }

  async queryTable(tableName: string): Promise<any[]> {
    const client = this.getClient();
    const sql = `SELECT * FROM ${quoteIdentifier(this.schema)}.${quoteIdentifier(tableName)}`;
    const result = await client.query(sql);
    return result.rows;
  }

  async getTables(): Promise<string[]> {
    const client = this.getClient();
    const result = await client.query(
      `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = $1
          AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `,
      [this.schema],
    );
    return result.rows.map((row) => String(row.table_name));
  }

  async getTableSchema(tableName: string): Promise<TableSchemaField[]> {
    const client = this.getClient();

    const columnsResult = await client.query(
      `
        SELECT
          c.column_name AS name,
          c.data_type AS type,
          c.udt_name AS raw_type,
          c.is_nullable,
          c.column_default AS default_value,
          c.character_maximum_length AS max_length,
          c.numeric_precision,
          c.numeric_scale,
          pgd.description AS description
        FROM information_schema.columns c
        LEFT JOIN pg_catalog.pg_namespace pgn
          ON pgn.nspname = c.table_schema
        LEFT JOIN pg_catalog.pg_class pgc
          ON pgc.relname = c.table_name
         AND pgc.relnamespace = pgn.oid
        LEFT JOIN pg_catalog.pg_attribute pga
          ON pga.attrelid = pgc.oid
         AND pga.attname = c.column_name
        LEFT JOIN pg_catalog.pg_description pgd
          ON pgd.objoid = pgc.oid
         AND pgd.objsubid = pga.attnum
        WHERE c.table_schema = $1
          AND c.table_name = $2
        ORDER BY c.ordinal_position
      `,
      [this.schema, tableName],
    );

    const primaryKeysResult = await client.query(
      `
        SELECT kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
        WHERE tc.table_schema = $1
          AND tc.table_name = $2
          AND tc.constraint_type = 'PRIMARY KEY'
      `,
      [this.schema, tableName],
    );

    const foreignKeysResult = await client.query(
      `
        SELECT
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
         AND ccu.table_schema = tc.table_schema
        WHERE tc.table_schema = $1
          AND tc.table_name = $2
          AND tc.constraint_type = 'FOREIGN KEY'
      `,
      [this.schema, tableName],
    );

    const primaryKeys = new Set(primaryKeysResult.rows.map((row) => String(row.column_name)));
    const foreignKeys = new Map(
      foreignKeysResult.rows.map((row) => [
        String(row.column_name),
        {
          table: String(row.foreign_table_name),
          column: String(row.foreign_column_name),
        },
      ]),
    );

    return columnsResult.rows.map((row) => ({
      name: String(row.name),
      type: String(row.type || row.raw_type || 'text'),
      rawType: String(row.raw_type || row.type || 'text'),
      is_nullable: row.is_nullable === 'NO' ? 'NO' : 'YES',
      is_primary_key: primaryKeys.has(String(row.name)),
      default_value: row.default_value ?? null,
      max_length: row.max_length ?? null,
      numeric_precision: row.numeric_precision ?? null,
      numeric_scale: row.numeric_scale ?? null,
      description: row.description ?? null,
      references: foreignKeys.get(String(row.name)) || null,
    }));
  }

  private getClient() {
    if (!this.client) {
      throw new Error('PostgreSQL connector is not connected');
    }
    return this.client;
  }

  private ensureConfigured() {
    if (!this.config.host) {
      throw new Error('PostgreSQL host is required');
    }
    if (!this.config.database) {
      throw new Error('PostgreSQL database is required');
    }
    if (!this.config.username) {
      throw new Error('PostgreSQL username is required');
    }
    if (!this.config.password) {
      throw new Error('PostgreSQL password is required');
    }
  }

  private resolveSsl() {
    if (typeof this.config.ssl === 'object') {
      return this.config.ssl;
    }
    return this.config.ssl ? { rejectUnauthorized: false } : false;
  }
}

export { PostgresMirrorConnector as GitlabConnector };

class DockerExecPostgresMirrorConnector {
  constructor(public readonly config: PostgresMirrorConfig) {}

  get schema() {
    return String(this.config.schema || 'public');
  }

  async connect(): Promise<void> {
    await this.queryRaw('select 1');
  }

  async disconnect(): Promise<void> {
    return Promise.resolve();
  }

  async queryTable(tableName: string): Promise<any[]> {
    const sql = `SELECT row_to_json(t)::text FROM (SELECT * FROM ${quoteIdentifier(this.schema)}.${quoteIdentifier(tableName)}) t`;
    const output = await this.queryLines(sql);
    return output.filter(Boolean).map((line) => JSON.parse(line));
  }

  async getTables(): Promise<string[]> {
    const sql = `SELECT tablename FROM pg_tables WHERE schemaname = '${String(this.schema).replace(/'/g, "''")}' ORDER BY tablename`;
    return this.queryLines(sql);
  }

  async getTableSchema(tableName: string): Promise<TableSchemaField[]> {
    const schemaSql = `
      SELECT json_build_object(
        'name', c.column_name,
        'type', c.data_type,
        'rawType', c.udt_name,
        'is_nullable', c.is_nullable,
        'is_primary_key', EXISTS (
          SELECT 1
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
           AND tc.table_schema = kcu.table_schema
          WHERE tc.table_schema = c.table_schema
            AND tc.table_name = c.table_name
            AND tc.constraint_type = 'PRIMARY KEY'
            AND kcu.column_name = c.column_name
        ),
        'default_value', c.column_default,
        'max_length', c.character_maximum_length,
        'numeric_precision', c.numeric_precision,
        'numeric_scale', c.numeric_scale,
        'description', pgd.description,
        'references', (
          SELECT CASE
            WHEN ccu.table_name IS NULL THEN NULL
            ELSE json_build_object('table', ccu.table_name, 'column', ccu.column_name)
          END
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
           AND tc.table_schema = kcu.table_schema
          JOIN information_schema.constraint_column_usage ccu
            ON ccu.constraint_name = tc.constraint_name
           AND ccu.table_schema = tc.table_schema
          WHERE tc.table_schema = c.table_schema
            AND tc.table_name = c.table_name
            AND tc.constraint_type = 'FOREIGN KEY'
            AND kcu.column_name = c.column_name
          LIMIT 1
        )
      )::text
      FROM information_schema.columns c
      LEFT JOIN pg_catalog.pg_namespace pgn
        ON pgn.nspname = c.table_schema
      LEFT JOIN pg_catalog.pg_class pgc
        ON pgc.relname = c.table_name
       AND pgc.relnamespace = pgn.oid
      LEFT JOIN pg_catalog.pg_attribute pga
        ON pga.attrelid = pgc.oid
       AND pga.attname = c.column_name
      LEFT JOIN pg_catalog.pg_description pgd
        ON pgd.objoid = pgc.oid
       AND pgd.objsubid = pga.attnum
      WHERE c.table_schema = '${String(this.schema).replace(/'/g, "''")}'
        AND c.table_name = '${String(tableName).replace(/'/g, "''")}'
      ORDER BY c.ordinal_position
    `;
    const lines = await this.queryLines(schemaSql);
    return lines.filter(Boolean).map((line) => JSON.parse(line));
  }

  private async queryLines(sql: string) {
    const output = await this.queryRaw(sql);
    return output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  private async queryRaw(sql: string) {
    const container = this.config.dockerContainerName || 'gitlab-data-web-1';
    const database = this.config.database || 'gitlabhq_production';
    const username = this.config.username || 'gitlab';
    const args = [
      'exec',
      '-e',
      'PGOPTIONS=-c statement_timeout=0',
      '-u',
      'git',
      container,
      '/opt/gitlab/embedded/bin/psql',
      '-h',
      '/var/opt/gitlab/postgresql',
      '-U',
      username,
      '-d',
      database,
      '-P',
      'pager=off',
      '-At',
      '-c',
      sql,
    ];

    const { stdout, stderr } = await execFileAsync('docker', args, {
      windowsHide: true,
      maxBuffer: 50 * 1024 * 1024,
    });

    if (stderr && stderr.trim()) {
      throw new Error(stderr.trim());
    }

    return stdout || '';
  }
}

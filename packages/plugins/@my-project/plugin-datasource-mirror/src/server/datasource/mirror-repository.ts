import type { Collection } from '@nocobase/data-source-manager';
import type { Database } from '@nocobase/database';
import { QueryTypes } from 'sequelize';

function extractOption<T = any>(collection: Collection, key: string): T | undefined {
  const options = ((collection as any).options as any) || {};
  return options[key] ?? options.options?.[key];
}

export class MirrorRepository {
  constructor(public readonly collection: Collection) {
  }

  private getDatabase(): Database {
    const dataSource = this.collection.collectionManager.dataSource as any;
    const collectionManager = this.collection.collectionManager as any;
    const db = collectionManager.db || dataSource?.dataSourceManager?.options?.app?.db;

    if (!db) {
      throw new Error('Application database is not available for mirror repository');
    }

    return db;
  }

  private getMirrorCollectionName() {
    return extractOption<string>(this.collection, 'mirrorCollectionName') || extractOption<string>(this.collection, 'tableName') || (this.collection as any).options?.name;
  }

  private getSequelize() {
    const db = this.getDatabase() as any;
    const sequelize = db.sequelize;
    if (!sequelize) {
      throw new Error('Application sequelize connection is not available for mirror repository');
    }
    return sequelize;
  }

  private getTargetModel() {
    const db = this.getDatabase();
    const resolvedMirrorCollectionName = this.getMirrorCollectionName() || this.collection.name;

    if (!resolvedMirrorCollectionName) {
      throw new Error(`Mirror collection name is not configured for ${this.collection.name}`);
    }

    let targetModel = null;
    try {
      targetModel =
        (db as any).getModel?.(resolvedMirrorCollectionName) ||
        (db as any).sequelize?.models?.[resolvedMirrorCollectionName] ||
        (db as any).models?.get?.(resolvedMirrorCollectionName);
    } catch (error) {
      targetModel =
        (db as any).sequelize?.models?.[resolvedMirrorCollectionName] ||
        (db as any).models?.get?.(resolvedMirrorCollectionName) ||
        null;
    }

    return targetModel || null;
  }

  private convertFilter(filter: Record<string, any> = {}) {
    const where: Record<string, any> = {};
    for (const [key, value] of Object.entries(filter)) {
      if (value && typeof value === 'object' && '$in' in value) {
        where[key] = value.$in;
      } else {
        where[key] = value;
      }
    }
    return where;
  }

  private toFindOptions(options: any = {}) {
    const sort = Array.isArray(options.sort) ? options.sort : [];
    const order = sort
      .map((item: string) => {
        const value = String(item || '');
        if (!value) {
          return null;
        }
        if (value.startsWith('-')) {
          return [value.slice(1), 'DESC'];
        }
        return [value, 'ASC'];
      })
      .filter(Boolean);

    return {
      where: this.convertFilter(options.filter || {}),
      limit: options.limit,
      offset: options.offset,
      order,
    };
  }

  private quoteIdentifier(value: string) {
    return `"${String(value).replace(/"/g, '""')}"`;
  }

  private buildWhereClause(filter: Record<string, any> = {}) {
    const clauses: string[] = [];
    const replacements: any[] = [];

    for (const [key, value] of Object.entries(filter)) {
      if (value && typeof value === 'object' && '$in' in value && Array.isArray((value as any).$in)) {
        const items = (value as any).$in;
        if (!items.length) {
          clauses.push('1 = 0');
          continue;
        }
        const placeholders = items.map(() => '?').join(', ');
        clauses.push(`${this.quoteIdentifier(key)} IN (${placeholders})`);
        replacements.push(...items);
      } else {
        clauses.push(`${this.quoteIdentifier(key)} = ?`);
        replacements.push(value);
      }
    }

    return {
      sql: clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '',
      replacements,
    };
  }

  private buildOrderClause(order: any[] = []) {
    const entries = order
      .filter((entry) => Array.isArray(entry) && entry[0])
      .map(([column, direction]) => `${this.quoteIdentifier(String(column))} ${String(direction || 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC'}`);

    return entries.length ? ` ORDER BY ${entries.join(', ')}` : '';
  }

  private async getActualColumns() {
    const sequelize = this.getSequelize();
    const tableName = this.getMirrorCollectionName() || this.collection.name;
    const rows = await sequelize.query(
      `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = ?
        ORDER BY ordinal_position
      `,
      {
        replacements: [tableName],
        type: QueryTypes.SELECT,
      },
    );
    return rows.map((row: any) => String(row.column_name));
  }

  private getSelectedColumns() {
    const fields = (this.collection.getFields?.() || []).map((field: any) => field.name).filter(Boolean);
    if (!fields.length) {
      return '*';
    }
    return fields.map((field: string) => this.quoteIdentifier(field)).join(', ');
  }

  private async queryRows(options: any = {}) {
    const sequelize = this.getSequelize();
    const tableName = this.getMirrorCollectionName() || this.collection.name;
    const findOptions = this.toFindOptions(options);
    const where = this.buildWhereClause(findOptions.where);
    const order = this.buildOrderClause(findOptions.order);
    const limit = typeof findOptions.limit === 'number' ? ` LIMIT ${findOptions.limit}` : '';
    const offset = typeof findOptions.offset === 'number' ? ` OFFSET ${findOptions.offset}` : '';
    const actualColumns = await this.getActualColumns();
    const declaredColumns = (this.collection.getFields?.() || []).map((field: any) => field.name).filter(Boolean);
    const selectedColumns = (declaredColumns.length ? declaredColumns.filter((column: string) => actualColumns.includes(column)) : actualColumns).map((field: string) => this.quoteIdentifier(field)).join(', ');
    const sql = `SELECT ${selectedColumns || '*'} FROM ${this.quoteIdentifier(tableName)}${where.sql}${order}${limit}${offset}`;
    return sequelize.query(sql, {
      replacements: where.replacements,
      type: QueryTypes.SELECT,
    });
  }

  async find(options: any) {
    return this.queryRows(options);
  }

  async findOne(options: any) {
    const rows = await this.queryRows({ ...(options || {}), limit: 1 });
    return rows[0] || null;
  }

  async count(options: any) {
    const sequelize = this.getSequelize();
    const tableName = this.getMirrorCollectionName() || this.collection.name;
    const where = this.buildWhereClause(this.convertFilter(options?.filter || {}));
    const rows = await sequelize.query(
      `SELECT COUNT(*)::int AS count FROM ${this.quoteIdentifier(tableName)}${where.sql}`,
      {
        replacements: where.replacements,
        type: QueryTypes.SELECT,
      },
    );
    return Number((rows[0] as any)?.count || 0);
  }

  async findAndCount(options: any) {
    const [rows, count] = await Promise.all([this.queryRows(options), this.count(options)]);
    return [rows, count] as [any[], number];
  }

  async create() {
    throw new Error('GitLab mirror data source is read-only');
  }

  async update() {
    throw new Error('GitLab mirror data source is read-only');
  }

  async destroy() {
    throw new Error('GitLab mirror data source is read-only');
  }
}

export default MirrorRepository;

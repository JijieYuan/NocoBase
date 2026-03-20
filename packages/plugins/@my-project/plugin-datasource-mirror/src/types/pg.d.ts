declare module 'pg' {
  export type ClientConfig = Record<string, any>;

  export class Client {
    constructor(config?: ClientConfig);
    connect(): Promise<void>;
    end(): Promise<void>;
    query(sql: string, params?: any[]): Promise<{ rows: any[] }>;
  }
}

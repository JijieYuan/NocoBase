# 架构设计文档

## 概述

plugin-datasource-mirror 是一个 NocoBase 插件，用于从外部数据源（MySQL、PostgreSQL、REST API 等）导入数据并在 NocoBase 本地创建数据镜像。该插件支持一次性导入和增量更新。

## 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                    NocoBase Instance                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐         ┌──────────────────┐          │
│  │   Plugin Layer   │         │   Data Layer     │          │
│  │                  │         │                  │          │
│  │ ┌──────────────┐ │         │ ┌──────────────┐ │          │
│  │ │  API Routes  │ │         │ │   Tables:    │ │          │
│  │ │              │ │◄────────┤ │ datasources  │ │          │
│  │ │ - import     │ │         │ │ sync_logs    │ │          │
│  │ │ - webhook    │ │         │ │ mirror_*     │ │          │
│  │ │ - test-conn  │ │         │ └──────────────┘ │          │
│  │ └──────────────┘ │         └──────────────────┘          │
│  │        │         │                                        │
│  │ ┌──────▼──────┐  │         ┌──────────────────┐          │
│  │ │  Services   │  │         │   Local DB       │          │
│  │ │             │  │         │   (SQLite/MySQL) │          │
│  │ │ - Import    │  │         │                  │          │
│  │ │ - Webhook   │  │         │ Mirror Data:     │          │
│  │ │ - Connector │  │         │ - users          │          │
│  │ └──────▲──────┘  │         │ - orders         │          │
│  └───────┼──────────┘         │ - ...            │          │
│          │                    └──────────────────┘          │
└──────────┼──────────────────────────────────────────────────┘
           │
           │ Network
           │
    ┌──────▼──────────────────────────────┐
    │   External Data Sources              │
    │                                      │
    │   ┌──────────────────────────────┐  │
    │   │ Database Connectors:         │  │
    │   │ - MySQL                      │  │
    │   │ - PostgreSQL                 │  │
    │   │ - REST API                   │  │
    │   │ - MongoDB (future)           │  │
    │   └──────────────────────────────┘  │
    │                                      │
    │   ┌──────────────────────────────┐  │
    │   │ Webhook Events:              │  │
    │   │ - Data inserted              │  │
    │   │ - Data updated               │  │
    │   │ - Data deleted               │  │
    │   └──────────────────────────────┘  │
    └──────────────────────────────────────┘
```

## 核心模块

### 1. Plugin 主类 (`plugin.ts`)

**职责**：
- 注册数据表和 API 端点
- 初始化服务
- 管理插件生命周期

**关键方法**：
- `load()` - 插件加载时初始化
- `setupAcl()` - 设置访问控制
- `defineApiActions()` - 定义 API 端点
- `defineHooks()` - 定义钩子

### 2. 数据源连接器 (`datasource-connector.ts`)

**设计模式**：Factory + Strategy

**支持的连接器**：

```
DataSourceConnector (抽象基类)
├── MysqlConnector
├── PostgresConnector
├── RestApiConnector
└── [MongoDConnector - 计划中]
```

**接口**：
```typescript
abstract class DataSourceConnector {
  connect(): Promise<void>           // 建立连接
  disconnect(): Promise<void>        // 断开连接
  query(sql: string): Promise<any[]> // 执行查询
  getTables(): Promise<string[]>     // 获取表列表
  getTableSchema(name: string)       // 获取表结构
}
```

### 3. 数据导入服务 (`data-import.ts`)

**职责**：
- 从外部数据源抓取数据
- 数据字段映射和转换
- 在本地数据库执行 upsert 操作
- 生成同步日志

**工作流程**：

```
1. 验证数据源存在
2. 创建同步日志记录（status: processing）
3. 获取数据源连接器
4. 对每个映射表：
   a. 从源数据库查询数据
   b. 根据映射规则转换字段
   c. 确保目标镜像表存在
   d. Upsert 数据（插入新数据，更新已存在的）
   e. 更新镜像表元信息
5. 更新数据源最后同步时间
6. 更新同步日志（status: success/failed）
```

**数据转换示例**：

```javascript
// 源数据
{
  "id": 1,
  "user_name": "John",
  "created_date": "2024-03-19"
}

// 映射配置
{
  "source": "id",
  "target": "user_id",
  "type": "number"
}

// 转换后
{
  "user_id": 1,
  "user_name": "John",
  "created_date": "2024-03-19"
}
```

### 4. Webhook 服务 (`webhook.ts`)

**职责**：
- 接收和验证 webhook 事件
- 处理增量更新（create/update/delete）
- 记录同步历史

**验证流程**：

```
1. 提取 X-Datasource-Id 和 X-Webhook-Signature
2. 从数据库查询数据源配置
3. 使用 webhook_token 验证签名
4. 签名有效 → 处理事件
5. 签名无效 → 返回 401 Unauthorized
```

**事件处理**：

```
事件 → 提取表名和操作类型
     ↓
   CREATE → insert 新记录
   UPDATE → update 已存在的记录
   DELETE → delete 记录
     ↓
   记录到同步日志
```

## 数据流

### 完整导入流程

```
用户调用 import API
    ↓
DataImportService.importData()
    ↓
获取数据源配置信息
    ↓
创建数据源连接器（工厂模式）
    ↓
连接到外部数据源
    ↓
对每个映射表：
    ├─ 执行查询
    ├─ 数据字段映射
    ├─ 目标表 upsert
    └─ 更新元信息
    ↓
断开连接
    ↓
更新同步日志和最后同步时间
    ↓
返回导入统计信息
```

### Webhook 更新流程

```
外部系统发送 Webhook 事件
    ↓
WebhookService.handleWebhook()
    ↓
验证签名和数据源
    ↓
提取操作信息（表名、操作类型、数据）
    ↓
根据操作类型处理：
    ├─ INSERT → 在镜像表插入
    ├─ UPDATE → 在镜像表更新
    └─ DELETE → 在镜像表删除
    ↓
记录到同步日志
    ↓
返回处理结果
```

## 数据表设计

### datasources 表

存储数据源配置：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigInt | 主键 |
| name | string | 数据源名称 |
| type | string | 类型（mysql/postgres/rest-api） |
| config | json | 连接配置（加密） |
| mapping | json | 表映射规则 |
| webhook_token | string | Webhook 验证令牌 |
| last_sync_time | datetime | 最后同步时间 |

### datasource_sync_logs 表

记录同步历史：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigInt | 主键 |
| datasource_id | bigInt | 数据源 ID |
| sync_type | string | 同步类型（manual/scheduled/webhook） |
| status | string | 状态（pending/processing/success/failed） |
| records_inserted | int | 插入记录数 |
| records_updated | int | 更新记录数 |
| records_deleted | int | 删除记录数 |
| error_message | text | 错误信息 |
| duration_seconds | float | 同步耗时 |

### mirror_tables 表

存储镜像表元信息：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigInt | 主键 |
| datasource_id | bigInt | 数据源 ID |
| source_table | string | 源表名 |
| mirror_table | string | 镜像表名 |
| field_mapping | json | 字段映射规则 |
| total_records | bigInt | 记录总数 |
| last_sync_time | datetime | 最后同步时间 |

### 动态创建的镜像表

根据映射规则动态创建，如 `mirror_users`、`mirror_orders` 等。

## 扩展建议

### 1. 支持更多数据源

在 `datasource-connector.ts` 中添加新的连接器类：

```typescript
export class MongoDbConnector extends DataSourceConnector {
  // 实现 MongoDB 连接逻辑
}
```

### 2. 定时同步任务

使用 NocoBase 的任务调度（如 node-cron）：

```typescript
// 每小时同步一次
cron.schedule('0 * * * *', () => {
  dataImportService.importData(datasourceId);
});
```

### 3. 数据转换增强

支持自定义转换函数：

```json
{
  "source": "birth_date",
  "target": "age",
  "transform": "function(value) { return 2024 - new Date(value).getFullYear(); }"
}
```

### 4. 前端 UI 组件

- 数据源配置表单
- 同步历史查看器
- 映射规则编辑器
- 一键导入按钮

### 5. 监控和告警

- 同步失败告警
- 数据质量检查
- 性能监控

## 性能优化

### 批量操作

```typescript
// 批量 insert/update，而不是逐条处理
await mirrorModel.bulkCreate(records, { updateOnDuplicate: ['name', 'email'] });
```

### 数据库连接池

```typescript
const connectionLimit = 10;  // 根据内存调整
const testConnectionInterval = 60000;  // 60 秒测试一次连接
```

### 增量同步

只同步上次同步后的新增/修改数据：

```typescript
// 伪代码
const lastSyncTime = datasource.last_sync_time;
const query = `SELECT * FROM users WHERE updated_at > '${lastSyncTime}'`;
```

## 安全考虑

1. **配置加密** - 数据源密码使用 AES-256 加密
2. **Webhook 验证** - SHA256 签名验证
3. **访问控制** - API 端点权限管理
4. **审计日志** - 所有操作记录
5. **速率限制** - 防止滥用

## 故障恢复

### 连接断开

```typescript
// 自动重试机制
async connect() {
  for (let i = 0; i < 3; i++) {
    try {
      // 连接逻辑
      break;
    } catch (e) {
      if (i === 2) throw e;
      await sleep(1000 * (i + 1));  // 指数退避
    }
  }
}
```

### 同步失败

```typescript
// 记录详细错误信息
await updateSyncLog(id, {
  status: 'failed',
  error_message: `${error.code}: ${error.message}`,
  stack_trace: error.stack
});
```

## 与 GitLab Sync 的集成潜力

plugin-datasource-mirror 可以与现有的 plugin-gitlab-sync 配合使用：

- GitLab 数据通过 REST API 作为数据源
- 定期拉取 GitLab 数据（issues、PRs 等）
- 在本地创建 GitLab 数据镜像
- 使用 webhook 进行实时更新

# 插件使用指南

## 1. 安装插件

首先确保插件已在 NocoBase 项目中注册。在 `lerna.json` 中添加：

```json
{
  "packages": [
    "packages/plugins/@my-project/plugin-datasource-mirror"
  ]
}
```

然后运行：
```bash
yarn install
yarn nocobase pm install @my-project/plugin-datasource-mirror
```

## 2. 创建数据源配置

### 2.1 通过 API 创建数据源

```bash
curl -X POST http://localhost:8000/api/datasources \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-mysql-source",
    "description": "MySQL 生产数据库",
    "type": "mysql",
    "config": {
      "host": "192.168.1.100",
      "port": 3306,
      "database": "production_db",
      "username": "app_user",
      "password": "secure_password"
    },
    "mapping": [
      {
        "source_table": "users",
        "target_table": "mirror_users",
        "fields": [
          { "source": "id", "target": "user_id", "type": "number", "primary_key": true },
          { "source": "name", "target": "user_name", "type": "string" },
          { "source": "email", "target": "user_email", "type": "string" },
          { "source": "created_at", "target": "created_at", "type": "datetime" }
        ]
      },
      {
        "source_table": "orders",
        "target_table": "mirror_orders",
        "fields": [
          { "source": "id", "target": "order_id", "type": "number", "primary_key": true },
          { "source": "user_id", "target": "user_id", "type": "number" },
          { "source": "amount", "target": "order_amount", "type": "float" },
          { "source": "status", "target": "order_status", "type": "string" }
        ]
      }
    ],
    "enabled": true
  }'
```

### 2.2 测试连接

在导入数据前，先测试连接是否正常：

```bash
curl -X POST http://localhost:8000/api/datasource-mirror:test-connection \
  -H "Content-Type: application/json" \
  -d '{
    "type": "mysql",
    "config": {
      "host": "192.168.1.100",
      "port": 3306,
      "database": "production_db",
      "username": "app_user",
      "password": "secure_password"
    }
  }'
```

## 3. 导入数据

### 3.1 导入所有数据

```bash
curl -X POST http://localhost:8000/api/datasource-mirror:import \
  -H "Content-Type: application/json" \
  -d '{
    "datasource_id": 1
  }'
```

### 3.2 导入指定表的数据

```bash
curl -X POST http://localhost:8000/api/datasource-mirror:import \
  -H "Content-Type: application/json" \
  -d '{
    "datasource_id": 1,
    "tables": ["users", "orders"]
  }'
```

## 4. 配置 Webhook（自动化更新）

### 4.1 为数据源生成 Webhook Token

```bash
curl -X PUT http://localhost:8000/api/datasources/1 \
  -H "Content-Type: application/json" \
  -d '{
    "webhook_token": "your-secure-token-here"
  }'
```

### 4.2 在源数据库中配置 Webhook

以 MySQL Binlog 为例，使用第三方工具（如 Debezium）进行变更数据捕获：

```json
{
  "webhook_url": "http://your-nocobase-host/api/datasource-mirror:webhook",
  "headers": {
    "X-Datasource-Id": "1",
    "X-Webhook-Signature": "sha256_signature"
  }
}
```

### 4.3 Webhook 事件格式

数据源的 webhook 应按以下格式发送事件：

```json
{
  "event": "data.updated",
  "table": "users",
  "operation": "update",
  "timestamp": "2024-03-19T10:30:00Z",
  "data": {
    "id": 123,
    "name": "John Doe",
    "email": "john@example.com",
    "updated_at": "2024-03-19T10:30:00Z"
  }
}
```

**支持的操作类型**:
- `create` / `insert` - 新增记录
- `update` - 更新记录
- `delete` - 删除记录

## 5. 查询镜像数据

### 5.1 获取同步历史

```bash
curl http://localhost:8000/api/datasource_sync_logs?filter[datasource_id]=1&sort=-created_at
```

### 5.2 获取镜像表元信息

```bash
curl http://localhost:8000/api/mirror_tables?filter[datasource_id]=1
```

### 5.3 查询镜像数据

```bash
curl http://localhost:8000/api/mirror_users?sort=user_id
```

## 6. PostgreSQL 配置示例

```bash
curl -X POST http://localhost:8000/api/datasources \
  -H "Content-Type: application/json" \
  -d '{
    "name": "pg-analytics",
    "type": "postgres",
    "config": {
      "host": "analytics.db.example.com",
      "port": 5432,
      "database": "analytics_db",
      "username": "metrics_user",
      "password": "password"
    },
    "mapping": [
      {
        "source_table": "events",
        "target_table": "mirror_events",
        "fields": [
          { "source": "id", "target": "event_id", "type": "number", "primary_key": true },
          { "source": "event_name", "target": "event_name", "type": "string" },
          { "source": "properties", "target": "event_data", "type": "json" },
          { "source": "created_at", "target": "created_at", "type": "datetime" }
        ]
      }
    ]
  }'
```

## 7. REST API 配置示例

```bash
curl -X POST http://localhost:8000/api/datasources \
  -H "Content-Type: application/json" \
  -d '{
    "name": "external-api",
    "type": "rest-api",
    "config": {
      "url": "https://api.example.com/v1",
      "headers": {
        "Authorization": "Bearer your-api-token",
        "Accept": "application/json"
      },
      "timeout": 30000,
      "params": {
        "per_page": 100
      }
    },
    "mapping": [
      {
        "source_table": "users",
        "target_table": "mirror_external_users",
        "fields": [
          { "source": "id", "target": "user_id", "type": "number", "primary_key": true },
          { "source": "username", "target": "username", "type": "string" },
          { "source": "profile.avatar_url", "target": "avatar", "type": "string" }
        ]
      }
    ]
  }'
```

## 8. 故障排查

### 连接失败

1. 检查网络连接和防火墙
2. 验证用户名和密码
3. 确保数据库/API 端点可访问

### 导入失败

1. 检查同步日志表中的错误信息
2. 验证字段映射配置
3. 查看 NocoBase 应用日志

### Webhook 不触发

1. 验证 webhook URL 是否正确
2. 检查签名验证是否失败
3. 查看同步日志表

## 9. 性能优化

### 大数据量导入

对于大数据量（>100万条记录），建议：

1. 分表导入 - 在 `tables` 参数中指定不同的表
2. 使用定时任务分批导入
3. 增加数据库连接超时时间

```bash
# 分批导入
for table in users orders products; do
  curl -X POST http://localhost:8000/api/datasource-mirror:import \
    -H "Content-Type: application/json" \
    -d "{\"datasource_id\": 1, \"tables\": [\"$table\"]}"
  sleep 10  # 等待 10 秒
done
```

### 优化字段映射

- 只映射必需的字段
- 使用合适的字段类型（避免过大的 TEXT 类型）
- 对常用的查询字段添加索引

## 10. 安全建议

1. **使用 HTTPS** - 在生产环境中使用 HTTPS
2. **Webhook Token** - 16+ 字符的随机令牌
3. **限制访问** - 根据需要限制 API 访问权限
4. **加密配置** - 数据源配置中的敏感信息已加密存储
5. **审计日志** - 定期检查同步日志中的异常活动

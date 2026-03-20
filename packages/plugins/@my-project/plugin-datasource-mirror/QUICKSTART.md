# 快速开始

## 5 分钟快速上手

### 1. 系统要求

- Node.js >= 18
- 已安装的 NocoBase 应用
- 一个外部数据源（MySQL、PostgreSQL 或 REST API）

### 2. 创建测试数据源

**使用 REST API 作为数据源**（最简单）：

```bash
# 使用公开 API：JSONPlaceholder
curl -X POST http://localhost:8000/api/datasources \
  -H "Content-Type: application/json" \
  -d '{
    "name": "jsonplaceholder-users",
    "type": "rest-api",
    "config": {
      "url": "https://jsonplaceholder.typicode.com",
      "timeout": 10000
    },
    "mapping": [
      {
        "source_table": "/users",
        "target_table": "mirror_users",
        "fields": [
          { "source": "id", "target": "user_id", "type": "number", "primary_key": true },
          { "source": "name", "target": "user_name", "type": "string" },
          { "source": "email", "target": "user_email", "type": "string" },
          { "source": "phone", "target": "user_phone", "type": "string" },
          { "source": "website", "target": "user_website", "type": "string" }
        ]
      }
    ],
    "enabled": true
  }'
```

响应示例：
```json
{
  "id": 1,
  "name": "jsonplaceholder-users",
  "type": "rest-api",
  "enabled": true
}
```

### 3. 测试连接

```bash
curl -X POST http://localhost:8000/api/datasource-mirror:test-connection \
  -H "Content-Type: application/json" \
  -d '{
    "type": "rest-api",
    "config": {
      "url": "https://jsonplaceholder.typicode.com",
      "timeout": 10000
    }
  }'
```

### 4. 导入数据

```bash
curl -X POST http://localhost:8000/api/datasource-mirror:import \
  -H "Content-Type: application/json" \
  -d '{
    "datasource_id": 1
  }'
```

响应示例：
```json
{
  "message": "数据导入成功",
  "data": {
    "status": "success",
    "inserted": 10,
    "updated": 0
  }
}
```

### 5. 查看导入的数据

访问 NocoBase UI，查看新创建的 `mirror_users` 表，应该看到 JSONPlaceholder 的 10 个用户数据。

## 常用数据源配置模板

### MySQL

```json
{
  "name": "mysql-prod",
  "type": "mysql",
  "config": {
    "host": "mysql.example.com",
    "port": 3306,
    "database": "myapp",
    "username": "app_user",
    "password": "password123"
  },
  "mapping": [
    {
      "source_table": "users",
      "target_table": "mirror_users",
      "fields": [
        { "source": "id", "target": "id", "primary_key": true },
        { "source": "name", "target": "name" },
        { "source": "email", "target": "email" }
      ]
    }
  ]
}
```

### PostgreSQL

```json
{
  "name": "postgres-analytics",
  "type": "postgres",
  "config": {
    "host": "pg.example.com",
    "port": 5432,
    "database": "analytics",
    "username": "analytics_user",
    "password": "password123"
  }
}
```

### 公开 REST API

```json
{
  "name": "github-users",
  "type": "rest-api",
  "config": {
    "url": "https://api.github.com",
    "headers": {
      "Accept": "application/vnd.github.v3+json"
    },
    "timeout": 30000
  }
}
```

## 单表操作快速命令

### 只导入特定表

```bash
curl -X POST http://localhost:8000/api/datasource-mirror:import \
  -H "Content-Type: application/json" \
  -d '{
    "datasource_id": 1,
    "tables": ["users"]
  }'
```

### 同一数据源导入多个表

```bash
curl -X POST http://localhost:8000/api/datasource-mirror:import \
  -H "Content-Type: application/json" \
  -d '{
    "datasource_id": 1,
    "tables": ["users", "orders", "products"]
  }'
```

## 查询同步历史

```bash
# 查看最后 10 次同步
curl 'http://localhost:8000/api/datasource_sync_logs?sort=-created_at&limit=10'

# 查看特定数据源的同步历史
curl 'http://localhost:8000/api/datasource_sync_logs?filter[datasource_id]=1'

# 查看失败的同步
curl 'http://localhost:8000/api/datasource_sync_logs?filter[status]=failed'
```

## 脚本示例

### Python 脚本：定时导入

```python
#!/usr/bin/env python3
import requests
import time
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

NOCOBASE_URL = "http://localhost:8000"
DATASOURCE_ID = 1
INTERVAL = 3600  # 1 小时

def import_data():
    """导入数据源数据"""
    url = f"{NOCOBASE_URL}/api/datasource-mirror:import"
    payload = {"datasource_id": DATASOURCE_ID}
    
    try:
        response = requests.post(url, json=payload)
        data = response.json()
        logger.info(f"导入成功: {data['data']}")
        return True
    except Exception as e:
        logger.error(f"导入失败: {e}")
        return False

def main():
    """主循环"""
    while True:
        logger.info(f"开始导入数据...")
        import_data()
        logger.info(f"等待 {INTERVAL} 秒后继续...")
        time.sleep(INTERVAL)

if __name__ == "__main__":
    main()
```

运行：
```bash
python3 auto-import.py
```

### Bash 脚本：测试多个数据源

```bash
#!/bin/bash

NOCOBASE_URL="http://localhost:8000"

# 要导入的数据源 ID 列表
datasources=(1 2 3)

for ds_id in "${datasources[@]}"; do
    echo "导入数据源 $ds_id..."
    curl -X POST "${NOCOBASE_URL}/api/datasource-mirror:import" \
      -H "Content-Type: application/json" \
      -d "{\"datasource_id\": $ds_id}"
    
    echo "等待 5 秒..."
    sleep 5
done

echo "所有导入完成！"
```

运行：
```bash
chmod +x import-all.sh
./import-all.sh
```

## Node.js 示例

### 创建数据源

```javascript
const axios = require('axios');

const nocobaseUrl = 'http://localhost:8000/api';

async function createDatasource() {
  const datasource = {
    name: 'my-api-source',
    type: 'rest-api',
    config: {
      url: 'https://api.example.com/v1',
      headers: {
        'Authorization': 'Bearer YOUR_TOKEN'
      }
    },
    mapping: [
      {
        source_table: '/users',
        target_table: 'mirror_users',
        fields: [
          { source: 'id', target: 'id', primary_key: true },
          { source: 'name', target: 'name' },
          { source: 'email', target: 'email' }
        ]
      }
    ]
  };

  try {
    const response = await axios.post(`${nocobaseUrl}/datasources`, datasource);
    console.log('数据源创建成功:', response.data);
    return response.data;
  } catch (error) {
    console.error('创建失败:', error.response?.data || error.message);
  }
}

createDatasource();
```

### 导入数据

```javascript
async function importData(datasourceId) {
  try {
    const response = await axios.post(
      `${nocobaseUrl}/datasource-mirror:import`,
      { datasource_id: datasourceId }
    );
    console.log('导入成功:', response.data);
  } catch (error) {
    console.error('导入失败:', error.response?.data || error.message);
  }
}

importData(1);
```

## 故障排查

### 导入超时

```bash
# 增加单个表的导入时间，分批导入
curl -X POST http://localhost:8000/api/datasource-mirror:import \
  -H "Content-Type: application/json" \
  -d '{
    "datasource_id": 1,
    "tables": ["small_table"]
  }'
```

### 连接失败

```bash
# 测试连接
curl -X POST http://localhost:8000/api/datasource-mirror:test-connection \
  -H "Content-Type: application/json" \
  -d '{
    "type": "mysql",
    "config": {
      "host": "localhost",
      "port": 3306,
      "database": "test",
      "username": "root",
      "password": "password"
    }
  }'
```

## 下一步

- 📖 阅读 [USAGE.md](./USAGE.md) 了解详细用法
- 🏗️ 查看 [ARCHITECTURE.md](./ARCHITECTURE.md) 理解架构
- 🔌 参考 [INTEGRATION.md](./INTEGRATION.md) 进行集成

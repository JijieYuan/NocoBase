# NocoBase 原生集成指南

## 概述

plugin-datasource-mirror 现已完全集成到 NocoBase 的原生插件系统中，可以通过插件管理直接安装，并在数据源界面中启用。

## 🎯 安装步骤

### 方式 1: 通过 NocoBase 插件管理器安装（推荐）

1. **打开 NocoBase 管理后台**
   - 访问 http://localhost:8000/admin/plugins

2. **上传插件包**
   - 点击"上传插件"或"添加插件"
   - 选择 plugin-datasource-mirror 所在的目录
   - 或上传打包的插件文件 `@my-project-plugin-datasource-mirror-0.1.0.tgz`

3. **启用插件**
   - 找到已上传的插件
   - 点击"启用"或"激活"按钮

4. **等待重启**
   - 插件会自动加载
   - 应用会自动重启以应用更改

### 方式 2: 手动集成到项目

如果需要手动集成到现有 NocoBase 项目：

1. **复制插件到项目**
   ```bash
   cp -r packages/plugins/@my-project/plugin-datasource-mirror \
     /path/to/your/nocobase/plugins/
   ```

2. **更新主 package.json**
   ```json
   {
     "dependencies": {
       "@my-project/plugin-datasource-mirror": "^0.1.0"
     }
   }
   ```

3. **注册插件**
   在项目的插件注册文件中：
   ```typescript
   import { PluginDatasourceMirrorServer } from '@my-project/plugin-datasource-mirror';
   import { PluginDatasourceMirrorClient } from '@my-project/plugin-datasource-mirror';

   export const plugins = [
     PluginDatasourceMirrorServer,
     PluginDatasourceMirrorClient,
     // ... 其他插件
   ];
   ```

4. **重启应用**
   ```bash
   yarn dev
   ```

## 🎨 使用界面

### 1. 插件管理界面

安装后，在 NocoBase 管理后台 → 插件管理中可以看到：

```
[✓] 数据源镜像 (v0.1.0)
    ├─ 状态: 已启用
    ├─ 类型: 数据源
    └─ 操作: 禁用 | 卸载 | 配置
```

### 2. 新增数据源菜单

启用插件后，在"新增数据源"或"添加"菜单中会显示：

```
📊 数据源镜像
├─ REST API 镜像
├─ MySQL 镜像  
├─ PostgreSQL 镜像
└─ 更多...
```

### 3. 数据源管理界面

主菜单中会自动添加：

```
☰ 菜单
├─ 数据库
├─ 工作流
├─ 📦 数据源镜像  ← 新增
└─ 设置
```

点击"数据源镜像"进入管理界面：

```
┌─────────────────────────────────────┐
│ 数据源管理                    [+ 添加数据源]
├─────────────────────────────────────┤
│ 名称          | 类型     | 状态 | 最后同步 | 操作
├─────────────────────────────────────┤
│ mysql-prod    | MYSQL    | ✓   | 14:30   | 编辑 导入 删除
│ api-source    | REST-API | ✓   | 14:25   | 编辑 导入 删除
└─────────────────────────────────────┘
```

## 🔧 功能说明

### 添加数据源

点击"+ 添加数据源"打开配置表单：

1. **基本信息**
   - 数据源名称
   - 描述
   - 数据源类型（REST API / MySQL / PostgreSQL）

2. **连接配置**
   根据选择的类型显示相应字段：
   
   **REST API**：
   - API 地址
   - 超时时间
   - 请求头（可选）
   
   **MySQL**：
   - 主机地址
   - 端口
   - 数据库名
   - 用户名
   - 密码
   
   **PostgreSQL**：
   - 主机地址
   - 端口
   - 数据库名
   - 用户名
   - 密码

3. **表映射规则**
   使用 JSON 格式定义源表和目标表的映射：
   ```json
   [
     {
       "source_table": "users",
       "target_table": "mirror_users",
       "fields": [
         {
           "source": "id",
           "target": "id",
           "type": "number",
           "primary_key": true
         },
         {
           "source": "name",
           "target": "user_name",
           "type": "string"
         }
       ]
     }
   ]
   ```

4. **启用设置**
   - 勾选"启用此数据源"以激活该数据源

### 管理操作

#### 编辑 (Edit)
修改已创建的数据源配置。

#### 导入 (Import)
立即从源数据库导入数据到 NocoBase：
- 首次导入：创建所有记录
- 后续导入：更新已存在的记录，新增新记录

#### 删除 (Delete)
删除数据源配置和相关的同步日志。

#### 测试连接
在保存前测试数据源是否连接正常。

## 📊 数据查看

### 查看镜像数据

导入数据后，会在 NocoBase 中自动创建镜像表：

1. 打开"表"或"Collections"菜单
2. 在表列表中找到 `mirror_*` 开头的表（如 `mirror_users`）
3. 点击打开查看和管理数据

示例：
```
总记录数: 10,000
├─ mirror_users
│  ├─ user_id (Primary Key)
│  ├─ user_name
│  ├─ user_email
│  └─ created_at
│
├─ mirror_orders
│  ├─ order_id (Primary Key)
│  ├─ user_id (Foreign Key)
│  ├─ order_amount
│  └─ order_status
```

### 查看同步历史

1. 打开"数据源镜像"菜单
2. 点击"同步历史"或"日志"标签页
3. 查看每次导入的詳細信息：
   - 导入时间
   - 导入状态（成功/失败）
   - 导入数据量（新增/更新/删除）
   - 错误信息（如有）
   - 执行耗时

## 🚀 常用场景

### 场景 1: REST API 数据镜像

配置 JSONPlaceholder（公开 API）：

```json
{
  "name": "jsonplaceholder-mirror",
  "type": "rest-api",
  "config": {
    "url": "https://jsonplaceholder.typicode.com",
    "timeout": 30000
  },
  "mapping": [
    {
      "source_table": "/users",
      "target_table": "mirror_users",
      "fields": [
        { "source": "id", "target": "id", "primary_key": true },
        { "source": "name", "target": "name" },
        { "source": "email", "target": "email" },
        { "source": "phone", "target": "phone" }
      ]
    }
  ]
}
```

### 场景 2: MySQL 生产数据库同步

```json
{
  "name": "mysql-production",
  "type": "mysql",
  "config": {
    "host": "prod-db.example.com",
    "port": 3306,
    "database": "production",
    "username": "sync_user",
    "password": "secure_password"
  },
  "mapping": [
    {
      "source_table": "users",
      "target_table": "mirror_users",
      "fields": [...]
    },
    {
      "source_table": "orders",
      "target_table": "mirror_orders",
      "fields": [...]
    }
  ]
}
```

### 场景 3: 定时同步策略

虽然插件支持 webhook 实时更新，你也可以：

1. 使用 NocoBase 的任务调度功能
2. 设置定时任务每小时调用一次导入 API
3. 或使用外部任务调度工具（cron、Airflow 等）

```bash
# 每小时导入一次
0 * * * * curl -X POST http://localhost:8000/api/datasource-mirror:import \
  -d '{"datasource_id": 1}'
```

## 🔐 安全注意事项

1. **敏感信息保护**
   - 数据源配置中的密码会自动加密存储
   - 不要在日志中记录敏感信息

2. **Webhook 验证**
   - 生成强随机 token（16+ 字符）
   - 始终验证 webhook 签名

3. **访问控制**
   - 限制谁可以访问数据源镜像功能
   - 使用 NocoBase 的权限系统

4. **网络安全**
   - 生产环境使用 HTTPS
   - 配置防火墙规则

5. **日志审计**
   - 定期检查同步日志
   - 监控异常活动

## 🐛 故障排查

### 插件无法加载

1. 检查 NocoBase 日志
   ```bash
   tail -f storage/logs/main/app.log
   ```

2. 验证插件文件
   - 确保插件文件完整
   - 检查 package.json 的 "main" 字段

3. 重启应用
   ```bash
   yarn dev  # 或 yarn start
   ```

### 导入失败

查看同步日志中的错误信息：
1. 打开"数据源镜像"菜单
2. 查看同步历史和错误详情
3. 常见问题：
   - 网络超时 - 检查源数据库连接
   - 字段不匹配 - 检查映射配置
   - 权限错误 - 检查用户名和密码

### Webhook 不工作

1. 检查 webhook URL 是否正确
2. 验证签名生成逻辑
3. 查看应用日志找错误信息

## 📝 API 参考

### 通过 API 管理数据源

即使没有访问 UI，你也可以通过 API 直接管理：

```bash
# 获取所有数据源
GET /api/datasources

# 创建数据源
POST /api/datasources

# 更新数据源
PUT /api/datasources/:id

# 删除数据源
DELETE /api/datasources/:id

# 导入数据
POST /api/datasource-mirror:import

# 接收 webhook
POST /api/datasource-mirror:webhook

# 测试连接
POST /api/datasource-mirror:test-connection

# 查看同步日志
GET /api/datasource_sync_logs

# 查看镜像表信息
GET /api/mirror_tables
```

详见各文档的 API 部分。

## 🔄 更新和升级

### 更新插件

1. 停止 NocoBase 应用
2. 更新插件代码
   ```bash
   cd packages/plugins/@my-project/plugin-datasource-mirror
   git pull origin main
   ```
3. 重新编译
   ```bash
   yarn build
   ```
4. 启动应用
   ```bash
   yarn dev
   ```

### 数据迁移

升级时：
- 现有数据源配置和镜像数据不会丢失
- 同步日志会保留历史记录
- 旧的镜像表会自动保留

## 📚 更多资源

- [QUICKSTART.md](./QUICKSTART.md) - 快速开始
- [USAGE.md](./USAGE.md) - 详细用法
- [ARCHITECTURE.md](./ARCHITECTURE.md) - 架构设计
- [SUMMARY.md](./SUMMARY.md) - 功能总结

## 💡 最佳实践

1. **分离数据源**
   - 为每个环境（开发、测试、生产）创建独立的数据源

2. **合理的映射配置**
   - 只映射必需的字段
   - 使用有意义的字段名称

3. **监控同步状态**
   - 定期检查同步日志
   - 设置告警机制

4. **备份重要数据**
   - 定期备份 NocoBase 数据库
   - 备份同步日志

5. **版本控制**
   - 记录数据源配置变更
   - 使用 Git 管理配置文件

---

如有问题，请查阅对应的文档或提交 Issue。

**版本**: 0.1.0  
**最后更新**: 2024-03-19

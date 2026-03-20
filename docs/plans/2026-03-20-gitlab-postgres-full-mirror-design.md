# GitLab PostgreSQL Full Mirror Design

## Goal

将 `@my-project/plugin-datasource-mirror` 收敛为一个真正的 GitLab PostgreSQL 全表镜像数据源插件。用户在 NocoBase 的“数据源管理”里新增该数据源后，可以直接读取外部 PostgreSQL 的真实表列表，选择部分或全部表导入，并在本地生成对应镜像表与集合元数据，供字段查看、数据浏览和前端搭建 UI 使用。

## Why Change

现有实现以 GitLab API 为主，只镜像 `projects`、`issues`、`merge_requests`、`notes` 四类资源。这条路径无法满足“导入 GitLab 自带数据库全部表”的目标，也无法稳定支撑 NocoBase UI 直接绑定镜像集合。当前 `Target repository ... is not available` 报错本质上也说明 API 资源镜像并不是合适的主模型。

## Recommended Approach

采用“PostgreSQL 直连 + 本地全表镜像”的单一路线：

- 数据源表单改回数据库连接参数
- 连接成功后读取真实 schema/table 列表
- `Load Collections` 返回 PostgreSQL 表，而不是 GitLab API 资源
- 创建数据源时为选中的表生成本地镜像表和 `dataSourcesCollections`
- 读取和 UI 表块全部落在 NocoBase 本地镜像表上
- webhook 和定时同步只负责重新触发同步任务，不直接承载业务资源模型

不再将 GitLab API 四表模式作为主路线。旧代码可以先保留兼容层，但运行逻辑改为 PostgreSQL 优先。

## Data Flow

### Create Data Source

1. 用户在“数据源管理”新增 `GitLab PostgreSQL Mirror`
2. 填写 `host / port / database / schema / username / password / ssl / webhook token / sync interval`
3. 点击 `测试连接`
4. 点击 `Load Collections`，插件从外部 PostgreSQL 读取真实表清单
5. 用户选择部分或全部表提交
6. 服务端为每张选中表：
   - 读取列信息与主键
   - 在本地创建镜像表
   - 写入 NocoBase 集合元数据
   - 执行首轮全量导入

### Runtime Usage

- NocoBase 页面和表格块读取的是本地镜像表仓库
- `查看字段` 展示本地镜像集合的字段信息与关联元信息
- 数据源本身保持只读，不允许编辑外部表结构

### Sync

- 手动同步：从外部 PostgreSQL 重新拉取选中表
- webhook：只作为同步触发器
- 定时全量：按数据源配置周期触发
- 首版以整表刷新/主键 upsert 为主，不做数据库级 CDC

## Architecture

### Connector Layer

`datasource-connector.ts` 改为 PostgreSQL 连接器：

- 支持 `pg` 连接池
- 读取 `information_schema.columns`
- 读取主键和约束信息
- 枚举可同步表
- 按表分页或流式读取数据

### Import Layer

`data-import.ts` 负责：

- 将外部 PostgreSQL 列类型映射为 NocoBase/本地 Sequelize 字段类型
- 建立本地镜像表
- 记录外部表名到本地镜像表名的映射
- 主键存在时执行 upsert
- 主键缺失时执行整表替换

### Datasource Runtime Layer

`gitlab-postgres-mirror-datasource.ts` 和 `mirror-repository.ts` 负责：

- 让 `gitlab_rocksdb.users` 这类镜像集合在运行时稳定绑定本地镜像表仓库
- UI 表块查询不再依赖临时 API 资源对象
- 集合元数据与仓库解析严格以本地镜像表为准

### Client Layer

`DataSourceSettingsForm.tsx` 改回 PostgreSQL 配置表单：

- 去掉 `GitLab URL / Access token / project scope`
- 恢复 `host / port / database / schema / username / password / ssl`
- 端口不预填默认值
- `Load Collections` 展示真实数据库表

只读字段查看器继续保留，并基于镜像表字段元数据展示详情。

## Backward Compatibility

- 已创建的 API 模式数据源不保证继续可用
- 插件类型名保留 `gitlab-postgres-mirror`，避免前端入口再丢
- 若数据库中存在旧 API 模式数据源，可在迁移时标记为不可用，或在首次读取时报出“旧模式已弃用，需要重新创建数据源”

## Error Handling

- 连接失败：明确提示 PostgreSQL 连接失败原因
- 权限不足：提示缺少读取 schema/table 权限
- 表无主键：允许导入，但同步方式退化为替换
- 本地镜像表缺失：运行时自动尝试重新装载；装载失败时返回明确错误

## Verification

需要验证以下链路：

1. 新增数据源并成功测试连接
2. `Load Collections` 能显示 GitLab PostgreSQL 真实表，如 `users`
3. 选中表后首轮导入成功
4. `数据源 -> 数据表 -> 查看字段` 正常打开
5. 页面搭建 UI 时，表格块能读取镜像表，不再出现 `Target repository ... is not available`
6. 手动同步与 webhook 触发同步成功


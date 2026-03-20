# 打包和发布指南

## 📦 为 NocoBase 插件市场打包

### 前置要求

- Node.js >= 18
- npm 或 yarn
- 有 npm 账户（如果要发布到 npm）

### 打包步骤

#### 1. 清理和编译

```bash
cd packages/plugins/@my-project/plugin-datasource-mirror

# 清理旧的编译文件
rm -rf dist node_modules

# 安装依赖
yarn install

# 编译
yarn build
```

#### 2. 检查构建输出

确保 dist 目录包含：
```
dist/
├── client/
│   ├── index.js
│   ├── DataSourceManagerPage.js
│   ├── DataSourceProvider.js
│   └── ...
└── server/
    ├── index.js
    ├── plugin.js
    ├── collections/
    ├── services/
    └── ...
```

#### 3. 验证 package.json

确保 package.json 包含：
```json
{
  "name": "@my-project/plugin-datasource-mirror",
  "version": "0.1.0",
  "displayName": "数据源镜像",
  "description": "从多种数据源导入数据并在 NocoBase 本地创建镜像库...",
  "main": "dist/server/index.js",
  "browser": "dist/client/index.js",
  "keywords": ["nocobase", "plugin", "datasource", ...],
  "publishConfig": { "access": "public" }
}
```

#### 4. 创建压缩包

```bash
# 使用 npm pack 创建 .tgz 包
npm pack

# 或使用 tar
tar -czf plugin-datasource-mirror-0.1.0.tgz dist/ package.json README.md ...
```

输出文件：
```
@my-project-plugin-datasource-mirror-0.1.0.tgz (约 500KB)
```

### 发布选项

#### 选项 1: 发布到 npm 公有仓库

```bash
# 登录 npm
npm login

# 检查是否有权限
npm whoami

# 发布
npm publish

# 验证发布
npm view @my-project/plugin-datasource-mirror
```

#### 选项 2: 发布到私有 npm 仓库

```bash
# 配置私有仓库
npm config set @my-project:registry https://your-private-registry.com

# 发布
npm publish --registry=https://your-private-registry.com
```

#### 选项 3: 上传到 GitHub Releases

```bash
# 创建 GitHub release
gh release create v0.1.0 @my-project-plugin-datasource-mirror-0.1.0.tgz \
  --title "Version 0.1.0" \
  --notes "Initial release"
```

#### 选项 4: 托管在文件服务器

```bash
# 上传到自己的服务器
scp @my-project-plugin-datasource-mirror-0.1.0.tgz \
  user@your-server.com:/var/www/plugins/

# 提供下载 URL
https://your-server.com/plugins/@my-project-plugin-datasource-mirror-0.1.0.tgz
```

## 🔄 版本管理

### 更新版本号

编辑 package.json：

```json
{
  "version": "0.2.0"  // 从 0.1.0 -> 0.2.0
}
```

遵循 Semantic Versioning：
- **主版本** (Major): 不兼容的 API 变更
- **次版本** (Minor): 新增功能，向后兼容
- **修订版** (Patch): 修复 bugs，向后兼容

### 更新日志

创建 [CHANGELOG.md](./CHANGELOG.md)：

```markdown
# Changelog

## [0.2.0] - 2024-03-20

### Added
- 支持 MongoDB 数据源
- 添加数据转换增强功能
- 新增定时任务调度

### Fixed
- 修复 webhook 签名验证 bug
- 修复大数据量导入超时问题

### Changed
- 优化数据导入性能
- 改进错误日志详细程度

## [0.1.0] - 2024-03-19

### Initial Release
- REST API 支持
- MySQL 支持
- PostgreSQL 支持
- Webhook 实时更新
- 同步日志记录
```

## 🚀 安装到 NocoBase

### 从 npm 安装

1. **在 NocoBase 项目中**
   ```bash
   # 通过 npm 安装
   npm install @my-project/plugin-datasource-mirror
   
   # 或 yarn
   yarn add @my-project/plugin-datasource-mirror
   ```

2. **注册插件**
   在应用的插件配置文件中：
   ```typescript
   import { PluginDatasourceMirrorServer } from '@my-project/plugin-datasource-mirror/server';
   import { PluginDatasourceMirrorClient } from '@my-project/plugin-datasource-mirror/client';
   
   export const plugins = [
     PluginDatasourceMirrorServer,
     PluginDatasourceMirrorClient,
     // ...
   ];
   ```

3. **启动应用**
   ```bash
   yarn dev
   ```

### 从 GitHub releases 安装

```bash
# 下载包
curl -L https://github.com/JijieYuan/NocoBase/releases/download/v0.1.0/plugin-datasource-mirror-0.1.0.tgz \
  -o plugin.tgz

# 安装
npm install ./plugin.tgz
```

### 从本地路径安装

```bash
# 本地开发测试
npm install ../plugin-datasource-mirror

# 或在 package.json 中
{
  "dependencies": {
    "@my-project/plugin-datasource-mirror": "file:../plugin-datasource-mirror"
  }
}
```

## 📋 发布清单

在发布前，请确保：

- [ ] 代码编译无错误
- [ ] 所有测试通过
- [ ] README 和文档已更新
- [ ] CHANGELOG 已更新
- [ ] package.json 版本已更新
- [ ] displayName 描述准确
- [ ] 许可证信息正确
- [ ] 所有依赖已列出
- [ ] .npmignore 和 .gitignore 正确
- [ ] Git 标签已创建

```bash
# 创建 Git 标签
git tag -a v0.1.0 -m "Release version 0.1.0"
git push origin v0.1.0
```

## 🔒 安全建议

1. **代码审查**
   - 在发布前进行代码审查
   - 检查是否有敏感信息泄露

2. **依赖安全**
   ```bash
   # 检查依赖安全性
   npm audit
   ```

3. **构建验证**
   ```bash
   # 验证包内容
   npm pack --dry-run
   ```

4. **签名发布**（如果可能）
   ```bash
   # 为 npm 包签名
   npm config set sign-git-tag true
   ```

## 📊 发布后监控

### 获取下载统计

```bash
# npm 包统计
npm stat @my-project/plugin-datasource-mirror

# GitHub releases 下载数
curl https://api.github.com/repos/JijieYuan/NocoBase/releases/tags/v0.1.0
```

### 收集反馈

1. 监听 GitHub issues
2. 收集用户反馈
3. 修复报告的 bugs
4. 规划下一个版本

## 🔄 持续更新流程

```
开发 → 测试 → 更新版本 → 提交 git → 创建标签 → 发布 → 发布说明
                                              ↑
                                         github releases
                                         npm 仓库
                                         其他渠道
```

## 📚 资源

- [npm Documentation](https://docs.npmjs.com/)
- [GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github)
- [Semantic Versioning](https://semver.org/)
- [NocoBase Plugin Guide](https://docs.nocob

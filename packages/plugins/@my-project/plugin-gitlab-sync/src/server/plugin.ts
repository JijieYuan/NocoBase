import { Plugin } from '@nocobase/server';
import axios from 'axios';

export class PluginGitlabSyncServer extends Plugin {
  async load() {
    // 允许公开访问这张表
    this.app.acl.allow('rocksdb_issues', '*', 'public');
    this.app.acl.allow('gitlab', 'pull', 'public');

    // 定义 API 动作：/api/gitlab:pull
    this.app.resourceManager.define({
      name: 'gitlab',
      actions: {
        pull: async (ctx, next) => {
          const token = 'glpat-dNJkpGNfE7ZozhmUT5TJ';
          // 注意：这里去掉了 :8080，直接使用 localhost
          const url = `http://localhost/api/v4/projects/1/issues?private_token=${token}&per_page=50`;
          try {
            const response = await axios.get(url, { timeout: 10000 });
            const model = this.db.getModel('rocksdb_issues');

            for (const item of response.data) {
              await model.upsert({
                id: item.id,
                title: item.title,
                state: item.state,
              });
            }
            ctx.body = { status: 'ok', count: response.data.length };
          } catch (error) {
            ctx.throw(500, `GitLab 连接失败：${error.message}`);
          }
          await next();
        },
      },
    });
  }
}
export default PluginGitlabSyncServer;
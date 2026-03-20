import { Plugin } from '@nocobase/server';

export class PluginGitlabSyncServer extends Plugin {
  async load() {
    this.app.acl.allow('rocksdb_issues', '*', 'public');
    this.app.acl.allow('gitlab', 'pull', 'public');

    this.app.resourceManager.define({
      name: 'gitlab',
      actions: {
        pull: async (ctx: any, next: any) => {
          const token = 'glpat-dNJkpGNfE7ZozhmUT5TJ';
          const url = `http://localhost/api/v4/projects/1/issues?private_token=${token}&per_page=50`;

          try {
            const response = await fetch(url, {
              signal: AbortSignal.timeout(10000),
            });

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            const model = this.db.getModel('rocksdb_issues');

            for (const item of data) {
              await model.upsert({
                id: item.id,
                title: item.title,
                state: item.state,
              });
            }

            ctx.body = { status: 'ok', count: data.length };
          } catch (error: any) {
            ctx.throw(500, `GitLab connection failed: ${error?.message || 'Unknown error'}`);
          }

          await next();
        },
      },
    });
  }
}

export default PluginGitlabSyncServer;

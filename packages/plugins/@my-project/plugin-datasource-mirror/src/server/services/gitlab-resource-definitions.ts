export type GitlabResourceField = {
  name: string;
  type: string;
  is_primary_key?: boolean;
  is_nullable?: 'YES' | 'NO';
  description?: string;
};

export type GitlabResourceDefinition = {
  name: 'projects' | 'issues' | 'merge_requests' | 'notes';
  title: string;
  fields: GitlabResourceField[];
};

export const gitlabResources: GitlabResourceDefinition[] = [
  {
    name: 'projects',
    title: 'Projects',
    fields: [
      { name: 'id', type: 'integer', is_primary_key: true, is_nullable: 'NO' },
      { name: 'name', type: 'string', is_nullable: 'NO' },
      { name: 'path', type: 'string', is_nullable: 'NO' },
      { name: 'path_with_namespace', type: 'string', is_nullable: 'NO' },
      { name: 'web_url', type: 'string', is_nullable: 'YES' },
      { name: 'description', type: 'text', is_nullable: 'YES' },
      { name: 'visibility', type: 'string', is_nullable: 'YES' },
      { name: 'archived', type: 'boolean', is_nullable: 'YES' },
      { name: 'namespace_full_path', type: 'string', is_nullable: 'YES' },
      { name: 'namespace_name', type: 'string', is_nullable: 'YES' },
      { name: 'default_branch', type: 'string', is_nullable: 'YES' },
      { name: 'created_at', type: 'date', is_nullable: 'YES' },
      { name: 'updated_at', type: 'date', is_nullable: 'YES' },
      { name: 'last_activity_at', type: 'date', is_nullable: 'YES' },
    ],
  },
  {
    name: 'issues',
    title: 'Issues',
    fields: [
      { name: 'id', type: 'integer', is_primary_key: true, is_nullable: 'NO' },
      { name: 'iid', type: 'integer', is_nullable: 'NO' },
      { name: 'project_id', type: 'integer', is_nullable: 'NO' },
      { name: 'project_path', type: 'string', is_nullable: 'YES' },
      { name: 'title', type: 'string', is_nullable: 'NO' },
      { name: 'description', type: 'text', is_nullable: 'YES' },
      { name: 'state', type: 'string', is_nullable: 'NO' },
      { name: 'labels', type: 'json', is_nullable: 'YES' },
      { name: 'author_id', type: 'integer', is_nullable: 'YES' },
      { name: 'author_name', type: 'string', is_nullable: 'YES' },
      { name: 'assignee_ids', type: 'json', is_nullable: 'YES' },
      { name: 'assignee_names', type: 'json', is_nullable: 'YES' },
      { name: 'milestone_title', type: 'string', is_nullable: 'YES' },
      { name: 'web_url', type: 'string', is_nullable: 'YES' },
      { name: 'created_at', type: 'date', is_nullable: 'YES' },
      { name: 'updated_at', type: 'date', is_nullable: 'YES' },
      { name: 'closed_at', type: 'date', is_nullable: 'YES' },
    ],
  },
  {
    name: 'merge_requests',
    title: 'Merge requests',
    fields: [
      { name: 'id', type: 'integer', is_primary_key: true, is_nullable: 'NO' },
      { name: 'iid', type: 'integer', is_nullable: 'NO' },
      { name: 'project_id', type: 'integer', is_nullable: 'NO' },
      { name: 'project_path', type: 'string', is_nullable: 'YES' },
      { name: 'title', type: 'string', is_nullable: 'NO' },
      { name: 'description', type: 'text', is_nullable: 'YES' },
      { name: 'state', type: 'string', is_nullable: 'NO' },
      { name: 'source_branch', type: 'string', is_nullable: 'YES' },
      { name: 'target_branch', type: 'string', is_nullable: 'YES' },
      { name: 'labels', type: 'json', is_nullable: 'YES' },
      { name: 'author_id', type: 'integer', is_nullable: 'YES' },
      { name: 'author_name', type: 'string', is_nullable: 'YES' },
      { name: 'assignee_ids', type: 'json', is_nullable: 'YES' },
      { name: 'assignee_names', type: 'json', is_nullable: 'YES' },
      { name: 'web_url', type: 'string', is_nullable: 'YES' },
      { name: 'created_at', type: 'date', is_nullable: 'YES' },
      { name: 'updated_at', type: 'date', is_nullable: 'YES' },
      { name: 'merged_at', type: 'date', is_nullable: 'YES' },
      { name: 'closed_at', type: 'date', is_nullable: 'YES' },
    ],
  },
  {
    name: 'notes',
    title: 'Notes',
    fields: [
      { name: 'id', type: 'integer', is_primary_key: true, is_nullable: 'NO' },
      { name: 'project_id', type: 'integer', is_nullable: 'NO' },
      { name: 'project_path', type: 'string', is_nullable: 'YES' },
      { name: 'noteable_type', type: 'string', is_nullable: 'YES' },
      { name: 'noteable_iid', type: 'integer', is_nullable: 'YES' },
      { name: 'noteable_id', type: 'integer', is_nullable: 'YES' },
      { name: 'body', type: 'text', is_nullable: 'NO' },
      { name: 'author_id', type: 'integer', is_nullable: 'YES' },
      { name: 'author_name', type: 'string', is_nullable: 'YES' },
      { name: 'system', type: 'boolean', is_nullable: 'YES' },
      { name: 'resolvable', type: 'boolean', is_nullable: 'YES' },
      { name: 'created_at', type: 'date', is_nullable: 'YES' },
      { name: 'updated_at', type: 'date', is_nullable: 'YES' },
    ],
  },
];

export function getGitlabResource(name: string) {
  const resource = gitlabResources.find((item) => item.name === name);
  if (!resource) {
    throw new Error(`Unsupported GitLab resource: ${name}`);
  }
  return resource;
}

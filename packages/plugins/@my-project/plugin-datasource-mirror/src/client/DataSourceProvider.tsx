import React from 'react';
import { Button } from 'antd';
import { DatabaseOutlined } from '@ant-design/icons';

function navigateToMirrorSettings() {
  window.location.href = '/admin/settings/datasource-mirror';
}

export const DataSourceProvider: React.FC = () => {
  return (
    <Button type="primary" icon={<DatabaseOutlined />} onClick={navigateToMirrorSettings}>
      GitLab PostgreSQL 镜像配置
    </Button>
  );
};

export default DataSourceProvider;

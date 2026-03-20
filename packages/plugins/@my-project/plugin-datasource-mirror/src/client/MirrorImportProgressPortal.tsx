import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Card, Drawer, Progress, Space, Statistic, Tag, Typography } from 'antd';
import { SyncOutlined } from '@ant-design/icons';
import { createRoot, Root } from 'react-dom/client';

type MirrorProgress = {
  status?: 'idle' | 'running' | 'success' | 'failed';
  totalTables?: number;
  completedTables?: number;
  failedTables?: number;
  currentTable?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  lastError?: string | null;
};

type ProgressRecord = {
  key: string;
  displayName?: string;
  status?: string;
  progress?: MirrorProgress | null;
};

const PORTAL_ID = 'datasource-mirror-progress-portal';

function parseCurrentDataSourceKey() {
  const match = window.location.pathname.match(/\/admin\/settings\/data-source-manager\/([^/?]+)/);
  if (!match) {
    return null;
  }
  const value = decodeURIComponent(match[1]);
  return value === 'main' ? null : value;
}

function formatEta(progress?: MirrorProgress | null) {
  if (!progress?.startedAt || !progress?.totalTables || !progress?.completedTables) {
    return '-';
  }
  if (progress.completedTables <= 0 || progress.completedTables >= progress.totalTables) {
    return progress.completedTables >= progress.totalTables ? '即将完成' : '-';
  }

  const elapsedMs = Date.now() - new Date(progress.startedAt).getTime();
  if (elapsedMs <= 0) {
    return '-';
  }

  const avgPerTable = elapsedMs / progress.completedTables;
  const remainingMs = avgPerTable * (progress.totalTables - progress.completedTables);
  const totalSeconds = Math.max(0, Math.round(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return minutes > 0 ? `${minutes} 分 ${seconds} 秒` : `${seconds} 秒`;
}

function formatPercent(progress?: MirrorProgress | null) {
  if (!progress?.totalTables) {
    return 0;
  }
  return Math.min(100, Math.round(((progress.completedTables || 0) / progress.totalTables) * 100));
}

function useProgressRecords() {
  const [records, setRecords] = useState<ProgressRecord[]>([]);

  useEffect(() => {
    let disposed = false;

    const load = async () => {
      if (!window.location.pathname.includes('/admin/settings/data-source-manager')) {
        if (!disposed) {
          setRecords([]);
        }
        return;
      }

      try {
        const response = await fetch('/api/datasource-mirror:progress?runningOnly=true', { credentials: 'same-origin' });
        const payload = await response.json();
        const items = Array.isArray(payload?.data?.data)
          ? payload.data.data
          : Array.isArray(payload?.data)
            ? payload.data
            : [];
        if (!disposed) {
          setRecords(items);
        }
      } catch {
        if (!disposed) {
          setRecords([]);
        }
      }
    };

    void load();
    const timer = window.setInterval(load, 3000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, []);

  return records;
}

const MirrorImportProgressPortal: React.FC = () => {
  const records = useProgressRecords();
  const [open, setOpen] = useState(false);
  const previousRunningKeys = useRef('');
  const currentDataSourceKey = parseCurrentDataSourceKey();

  const runningRecords = useMemo(
    () => records.filter((item) => item.progress?.status === 'running' || item.progress?.status === 'failed'),
    [records],
  );
  const currentRecord = useMemo(
    () => runningRecords.find((item) => item.key === currentDataSourceKey) || null,
    [currentDataSourceKey, runningRecords],
  );

  useEffect(() => {
    const next = runningRecords.map((item) => item.key).sort().join(',');
    if (next && next !== previousRunningKeys.current) {
      setOpen(true);
    }
    previousRunningKeys.current = next;
  }, [runningRecords]);

  if (!runningRecords.length) {
    return null;
  }

  return (
    <>
      {currentRecord ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(255, 255, 255, 0.78)',
            backdropFilter: 'blur(2px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Card
            title="正在导入镜像数据"
            extra={<Tag color="processing">导入中</Tag>}
            style={{ width: 540, boxShadow: '0 12px 32px rgba(0, 0, 0, 0.12)' }}
          >
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Typography.Text>
                当前数据源 <strong>{currentRecord.displayName || currentRecord.key}</strong> 正在导入中。完成前不展示半成品表列表。
              </Typography.Text>
              <Progress percent={formatPercent(currentRecord.progress)} status="active" />
              <Space size="large" wrap>
                <Statistic title="总表数" value={currentRecord.progress?.totalTables || 0} />
                <Statistic title="已完成" value={currentRecord.progress?.completedTables || 0} />
                <Statistic title="失败数" value={currentRecord.progress?.failedTables || 0} />
                <Statistic title="预计剩余" value={formatEta(currentRecord.progress)} />
              </Space>
              <Alert
                type={currentRecord.progress?.status === 'failed' ? 'error' : 'info'}
                showIcon
                message={currentRecord.progress?.currentTable ? `正在处理：${currentRecord.progress.currentTable}` : '正在准备导入任务'}
                description={currentRecord.progress?.lastError || '后台仍在继续导入，你也可以打开右侧抽屉查看详细进度。'}
              />
              <Button type="primary" icon={<SyncOutlined />} onClick={() => setOpen(true)}>
                查看详细进度
              </Button>
            </Space>
          </Card>
        </div>
      ) : null}

      {!open ? (
        <Button
          type="primary"
          icon={<SyncOutlined />}
          style={{ position: 'fixed', right: 24, bottom: 24, zIndex: 1100 }}
          onClick={() => setOpen(true)}
        >
          导入进度
        </Button>
      ) : null}

      <Drawer title="GitLab 镜像导入进度" width={460} open={open} destroyOnClose={false} onClose={() => setOpen(false)}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {runningRecords.map((record) => (
            <Card
              key={record.key}
              size="small"
              title={record.displayName || record.key}
              extra={<Tag color={record.progress?.status === 'failed' ? 'error' : 'processing'}>{record.progress?.status === 'failed' ? '失败' : '导入中'}</Tag>}
            >
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <Progress percent={formatPercent(record.progress)} status={record.progress?.status === 'failed' ? 'exception' : 'active'} />
                <Space size="large" wrap>
                  <Statistic title="总表数" value={record.progress?.totalTables || 0} />
                  <Statistic title="已完成" value={record.progress?.completedTables || 0} />
                  <Statistic title="失败数" value={record.progress?.failedTables || 0} />
                  <Statistic title="预计剩余" value={formatEta(record.progress)} />
                </Space>
                <Typography.Text type="secondary">
                  {record.progress?.currentTable ? `当前表：${record.progress.currentTable}` : '正在准备导入'}
                </Typography.Text>
                {record.progress?.lastError ? <Alert type="error" showIcon message={record.progress.lastError} /> : null}
              </Space>
            </Card>
          ))}
        </Space>
      </Drawer>
    </>
  );
};

let root: Root | null = null;

export function mountMirrorImportProgressPortal() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  let container = document.getElementById(PORTAL_ID);
  if (!container) {
    container = document.createElement('div');
    container.id = PORTAL_ID;
    document.body.appendChild(container);
  }

  if (!root) {
    root = createRoot(container);
  }

  root.render(<MirrorImportProgressPortal />);
}

export default MirrorImportProgressPortal;

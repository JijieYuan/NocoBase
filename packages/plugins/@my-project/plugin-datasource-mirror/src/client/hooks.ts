import { useContext, useEffect, useState } from 'react';
import { DataSourceContext } from './context';

async function parseJsonResponse(response: Response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.errors?.[0]?.message || payload?.message || 'Request failed');
  }
  return payload;
}

export const useDatasources = () => {
  const [datasources, setDatasources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/datasource-mirror:list');
      const payload = await parseJsonResponse(response);
      setDatasources(Array.isArray(payload?.data) ? payload.data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refetch();
  }, []);

  return { datasources, loading, refetch };
};

export const useDataImport = () => {
  const [loading, setLoading] = useState(false);

  const importData = async (datasourceId: number, tables?: string[]) => {
    setLoading(true);
    try {
      const response = await fetch('/api/datasource-mirror:sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ datasource_id: datasourceId, tables }),
      });

      return parseJsonResponse(response);
    } finally {
      setLoading(false);
    }
  };

  return {
    importData,
    loading,
  };
};

export const useDataSourceContext = () => useContext(DataSourceContext);

export default {
  useDatasources,
  useDataImport,
  useDataSourceContext,
};

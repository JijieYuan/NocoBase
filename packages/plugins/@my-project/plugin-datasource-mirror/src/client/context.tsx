import React, { createContext } from 'react';

export interface DataSourceContextValue {
  reload?: () => Promise<void>;
}

export const DataSourceContext = createContext<DataSourceContextValue>({});

export const DataSourceProvider: React.FC<{ children: React.ReactNode; value?: DataSourceContextValue }> = ({
  children,
  value,
}) => <DataSourceContext.Provider value={value || {}}>{children}</DataSourceContext.Provider>;

export default DataSourceContext;

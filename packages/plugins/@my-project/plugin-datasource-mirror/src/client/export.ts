export { PluginDatasourceMirrorClient } from './index';
export { DataSourceManagerPage } from './DataSourceManagerPage';
export { DataSourceProvider } from './DataSourceProvider';
export { DataSourceContext, DataSourceProvider as DataSourceContextProvider } from './context';
export { useDatasources, useDataImport, useDataSourceContext } from './hooks';

export default {
  DataSourceManagerPage: () =>
    import('./DataSourceManagerPage').then((mod) => mod.DataSourceManagerPage),
  DataSourceProvider: () =>
    import('./DataSourceProvider').then((mod) => mod.DataSourceProvider),
};

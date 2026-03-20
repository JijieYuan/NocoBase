import { Plugin } from '@nocobase/client';
import DataSourceSettingsForm from './DataSourceSettingsForm';
import { mountMirrorImportProgressPortal } from './MirrorImportProgressPortal';
import ReadonlyCollectionFieldsAction from './ReadonlyCollectionFieldsAction';

export class PluginDatasourceMirrorClient extends Plugin {
  private tryRegisterType() {
    const dataSourceManagerPlugin =
      this.pm.get<any>('data-source-manager') || this.pm.get<any>('@nocobase/plugin-data-source-manager');

    if (!dataSourceManagerPlugin?.registerType) {
      return false;
    }

    dataSourceManagerPlugin.registerType('gitlab-postgres-mirror', {
      label: 'GitLab Mirror',
      name: 'gitlab-postgres-mirror',
      DataSourceSettingsForm,
      EditCollection: ReadonlyCollectionFieldsAction,
      disableAddFields: true,
      disabledConfigureFields: true,
      allowCollectionCreate: false,
      allowCollectionDeletion: false,
    });

    return true;
  }

  async load() {
    try {
      mountMirrorImportProgressPortal();

      if (this.tryRegisterType()) {
        return;
      }

      // In dev mode plugin load order can vary, so retry shortly after startup.
      setTimeout(() => {
        try {
          this.tryRegisterType();
        } catch (error) {
          console.warn('plugin-datasource-mirror delayed registration failed', error);
        }
      }, 500);
    } catch (error) {
      console.warn('plugin-datasource-mirror failed to extend data-source-manager', error);
    }
  }
}

export default PluginDatasourceMirrorClient;

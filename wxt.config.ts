import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Jobfill',
    description: 'Fill job applications from your saved details and track where you applied. Local, no account, no limits.',
    permissions: ['storage', 'unlimitedStorage', 'activeTab', 'alarms', 'downloads'],
    host_permissions: ['<all_urls>'],
    commands: {
      'fill-form': {
        suggested_key: { default: 'Alt+Shift+F' },
        description: 'Fill the application form on this page',
      },
    },
  },
});

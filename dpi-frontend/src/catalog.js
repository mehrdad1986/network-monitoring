export const categoryLabels = {
  'network probe': 'Network Probes',
  'live monitor': 'Live Monitors',
  'batch runner': 'Batch Runners',
  'saved report': 'Reports',
  utility: 'Utilities',
  'environment diagnostic': 'Environment',
  'packet experiment': 'Packet Experiments',
  'smoke checks': 'Smoke Checks',
};

export function appName(app) {
  return app.file.split('/').pop().replace(/\.py$/, '').replace(/[_-]/g, ' ');
}

export function filterApps(apps, category, query) {
  const term = query.trim().toLocaleLowerCase();
  return apps.filter(app => (category === 'all' || app.kind === category)
    && `${appName(app)} ${app.description} ${app.file}`.toLocaleLowerCase().includes(term));
}

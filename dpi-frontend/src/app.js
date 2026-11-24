import { appName, categoryLabels, filterApps } from './catalog.js';
import { request } from './api.js';
import { launchFields, launchArguments, dataApps } from './launch-config.js';

const main = document.querySelector('main');
const dialog = document.querySelector('dialog');
let apps = [];
let category = 'all';
let query = '';
let catalogError = false;
let selectedRun = null;
let renderVersion = 0;
let pollTimer;
let readiness = new Map();
let readinessError = '';
let configuredDataDir = '';

function setupReason(reason) {
  if (reason.startsWith('Arguments required')) return 'Configure the target parameters in the app launch form.';
  if (reason.includes('CAP_NET_RAW')) return 'Packet tests require an administrator-approved launch with CAP_NET_RAW.';
  return reason;
}

async function loadReadiness() {
  try {
    const data = await request('readiness', { signal: AbortSignal.timeout(20000) });
    readiness = new Map(data.apps.map(app => [app.file, app]));
    configuredDataDir = data.data_dir || '';
    readinessError = '';
    return data;
  } catch (error) {
    console.error('DPI readiness load failed:', error.name);
    readinessError = error.message;
    throw error;
  }
}

function updateConnection(ready) {
  const status = document.querySelector('.dpi-status');
  status.classList.toggle('dpi-connected', ready);
  status.replaceChildren(element('i'), document.createTextNode(ready ? 'Backend connected' : 'Backend unavailable'));
}

// Catalog text is untrusted: insert it only through textContent.
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function showDetails(app) {
  dialog.replaceChildren();
  const close = element('button', 'dpi-close', 'Close ×');
  close.type = 'button';
  close.onclick = () => dialog.close();
  const title = element('h2', '', appName(app));
  title.id = 'detail-title';
  dialog.append(close, element('span', 'dpi-eyebrow', categoryLabels[app.kind] || app.kind), title,
    element('p', '', app.description));
  const fields = [
    ['Source script', app.file],
    ['Default arguments', app.args?.length ? app.args.join(' ') : 'No default arguments'],
    ['Required executables', app.binaries?.join(', ') || 'None declared'],
    ['Required inputs', app.inputs?.join(', ') || 'None declared'],
    ['Privileges', app.privileged ? 'Requires root or CAP_NET_RAW' : 'No elevated privileges declared'],
  ];
  const list = element('dl', 'dpi-metadata');
  for (const [label, value] of fields) list.append(element('dt', '', label), element('dd', '', value));
  dialog.append(list);
  const check = readiness.get(app.file);
  if (check) {
    for (const reason of check.reasons) dialog.append(element('p', 'dpi-notice', setupReason(reason)));
    if (check.reasons.some(reason => reason.includes('CAP_NET_RAW'))) {
      dialog.append(element('p', 'dpi-notice', 'Packet apps use the optional administrator-approved launcher. Stop the standard server first, then start the scoped packet service from your terminal.'),
        element('pre', 'dpi-output', 'cd dpi-frontend\nsudo -v\nnpm run start:packets'),
        element('p', '', 'The service runs as your normal user with CAP_NET_RAW. Stop it with: sudo systemctl stop dpi-apps-packets'));
    }
    if (check.interactive) dialog.append(element('p', 'dpi-notice', 'Interactive app: answer its prompts using Send input on the Runs page.'));
    const required = check.arguments.filter(arg => arg.required).map(arg => arg.names.join(' / '));
    if (required.length) dialog.append(element('p', 'dpi-notice', `Required arguments: ${required.join(', ')}. Enter values in the arguments field below.`));
  }
  for (const note of [app.special, app.incomplete, app.requires_args && 'Explicit arguments required']) {
    if (note) dialog.append(element('p', 'dpi-notice', note));
  }
  if (dataApps.includes(app.file) && configuredDataDir) dialog.append(element('p', 'dpi-notice', `Configured saved observations: ${configuredDataDir}. These are saved measurements, not a new live trace.`));
  const form = element('form', 'dpi-run-form');
  const profile = launchFields(app.file);
  const profileInputs = new Map();
  if (profile) {
    for (const field of profile) {
      const label = element('label', '', field.label);
      const input = element('input', 'dpi-search');
      input.type = field.kind === 'uuid' ? 'password' : ['port', 'sequence'].includes(field.kind) ? 'number' : 'text';
      input.required = Boolean(field.required);
      input.autocomplete = 'off';
      input.maxLength = 1024;
      if (field.kind === 'port') { input.min = '1'; input.max = '65535'; input.step = '1'; }
      if (field.kind === 'sequence') { input.min = '0'; input.max = '4294967295'; input.step = '1'; }
      input.dataset.parameter = field.key;
      label.append(input); form.append(label); profileInputs.set(field.key, input);
    }
  }
  const timeoutLabel = element('label', '', 'Timeout (seconds)');
  const timeout = element('input', 'dpi-search');
  timeout.type = 'number'; timeout.min = '1'; timeout.max = '3600'; timeout.value = app.runner ? '1800' : '300'; timeout.required = true;
  timeoutLabel.append(timeout);
  const argsLabel = element('label', '', 'Arguments (optional JSON array; blank uses defaults)');
  const args = element('textarea', 'dpi-search');
  args.placeholder = '["--target", "example.com"]';
  args.rows = 3;
  argsLabel.append(args);
  const error = element('p', 'dpi-notice');
  error.hidden = true;
  error.setAttribute('role', 'alert');
  const run = element('button', 'dpi-run-button', 'Run application');
  run.type = 'submit';
  form.append(timeoutLabel);
  if (!profile) form.append(argsLabel);
  form.append(error, run);
  form.onsubmit = async event => {
    event.preventDefault();
    run.disabled = true;
    run.textContent = 'Starting…';
    error.hidden = true;
    try {
      const input = { file: app.file, timeout: Number(timeout.value) };
      if (profile) {
        const configured = launchArguments(app.file, Object.fromEntries([...profileInputs].map(([key, field]) => [key, field.value])));
        if (configured) input.args = configured;
      } else if (args.value.trim()) {
        try { input.args = JSON.parse(args.value); } catch { console.error('DPI argument validation failed'); throw new Error('Arguments must be a JSON array of strings.'); }
        if (!Array.isArray(input.args) || input.args.some(value => typeof value !== 'string')) throw new Error('Arguments must be a JSON array of strings.');
      }
      const data = await request('runs', { method: 'POST', body: JSON.stringify(input) });
      selectedRun = data.run.id;
      dialog.close();
      if (location.hash === '#runs') render();
      else location.hash = 'runs';
    } catch (failure) {
      console.error('DPI run submission failed:', failure.name);
      error.textContent = failure.message || 'Unable to start application';
      error.hidden = false;
    } finally {
      run.disabled = false;
      run.textContent = 'Run application';
    }
  };
  dialog.append(element('p', 'dpi-notice', 'Runs on this computer using the backend script and its requirements. Output and a JSON report appear in Runs.'), form);
  dialog.showModal();
}

function renderCards() {
  const results = document.querySelector('#dpi-results');
  const filtered = filterApps(apps, category, query);
  document.querySelector('#dpi-count').textContent = `${filtered.length} applications`;
  results.replaceChildren();
  if (!filtered.length) {
    results.append(element('p', 'dpi-empty', 'No applications match. Try another search or category.'));
  }
  for (const app of filtered) {
    const card = element('article', 'dpi-card');
    const heading = element('div', 'dpi-card-heading');
    heading.append(element('span', 'dpi-badge', categoryLabels[app.kind] || app.kind));
    const check = readiness.get(app.file);
    const targetOnly = check && check.reasons.length && check.reasons.every(reason => reason.startsWith('Arguments required'));
    heading.append(element('span', check?.ready ? 'dpi-ready' : 'dpi-privilege', check ? (check.ready ? 'Preflight ready' : targetOnly ? 'Configure target' : 'Setup required') : 'Not checked'));
    if (app.privileged) heading.append(element('span', 'dpi-privilege', 'Elevated access'));
    const button = element('button', 'dpi-detail-button', launchFields(app.file) ? 'Configure & run ↗' : 'View details ↗');
    button.type = 'button';
    button.setAttribute('aria-label', `View details for ${app.file}`);
    button.onclick = () => showDetails(app);
    card.append(heading, element('h2', '', appName(app)), element('p', '', app.description),
      element('code', 'dpi-path', app.file), button);
    if (check && !check.ready) card.append(element('p', 'dpi-blocker', check.reasons.map(setupReason).join(' · ')));
    results.append(card);
  }
}

function renderRunReport(job, panel, version) {
  const signature = `${job.id}:${job.status}`;
  if (panel.dataset.signature === signature) {
    for (const key of ['stdout', 'stderr']) {
      const output = panel.querySelector(`[data-stream="${key}"]`);
      if (output) output.textContent = job[key] || (['running', 'cancelling'].includes(job.status) ? 'Waiting for output…' : 'No output');
    }
    return;
  }
  panel.dataset.signature = signature;
  panel.replaceChildren(element('h2', '', job.file), element('span', 'dpi-badge', job.status));
  const active = ['running', 'cancelling'].includes(job.status);
  panel.append(element('p', '', `Started: ${new Date(job.started_at).toLocaleString()}${job.finished_at ? ` · Finished: ${new Date(job.finished_at).toLocaleString()}` : ''}`));
  if (job.exit_code !== undefined) panel.append(element('p', '', `Exit code: ${job.exit_code} · Duration: ${job.duration_seconds ?? '—'}s`));
  for (const reason of [...(job.reasons || []), ...(job.persistence_error ? [job.persistence_error] : [])]) panel.append(element('p', 'dpi-notice', reason));
  if (active) {
    panel.append(element('p', '', 'Live output updates below. If the app asks a question, send a reply using the input field.'));
    const cancel = element('button', 'dpi-run-button', job.status === 'cancelling' ? 'Cancelling…' : 'Cancel run');
    cancel.disabled = job.status === 'cancelling';
    cancel.onclick = async () => {
      cancel.disabled = true;
      try { await request(`runs/${job.id}`, { method: 'DELETE' }); }
      catch (error) {
        console.error('DPI cancellation failed:', error.name);
        if (version === renderVersion) { panel.append(element('p', 'dpi-notice', error.message)); cancel.disabled = false; }
      }
    };
    panel.append(cancel);
    if (job.status === 'running') {
      const form = element('form', 'dpi-input-form');
      const label = element('label', '', 'Reply to app prompt');
      const input = element('input', 'dpi-search');
      input.type = 'text'; input.maxLength = 4096; input.autocomplete = 'off';
      label.append(input);
      const send = element('button', 'dpi-run-button', 'Send input');
      send.type = 'submit';
      const notice = element('p', 'dpi-input-notice');
      notice.setAttribute('role', 'status');
      form.append(label, send, notice);
      form.onsubmit = async event => {
        event.preventDefault();
        send.disabled = true;
        try {
          await request(`runs/${job.id}/inputs`, { method: 'POST', body: JSON.stringify({ text: input.value }) });
          input.value = ''; notice.textContent = 'Reply sent'; input.focus();
        } catch (error) { console.error('DPI input failed:', error.name); notice.textContent = error.message; }
        finally { send.disabled = false; }
      };
      panel.append(form);
    }
  } else {
    const download = element('a', 'dpi-download', 'Download JSON report ↓');
    download.href = new URL(`../api/runs/${job.id}/report`, import.meta.url).href;
    download.download = `dpi-report-${job.id}.json`;
    panel.append(download);
  }
  for (const key of ['stdout', 'stderr']) {
    const output = element('pre', 'dpi-output', job[key] || (active ? 'Waiting for output…' : 'No output'));
    output.dataset.stream = key;
    panel.append(element('h3', '', key === 'stdout' ? 'Application output' : 'Error output'), output);
    if (job.output_truncated?.[key]) panel.append(element('p', 'dpi-notice', 'Output exceeded the limit; displaying the last 32,768 characters.'));
  }
  panel.append(element('p', 'dpi-notice', job.note));
}

function renderRuns(version) {
  const layout = element('section', 'dpi-runs-layout');
  const history = element('div', 'dpi-panel');
  const detail = element('div', 'dpi-panel');
  history.append(element('h2', '', 'Recent runs'));
  detail.append(element('p', '', 'Loading run reports…'));
  layout.append(history, detail);
  main.append(layout);
  const refresh = async () => {
    try {
      const { runs } = await request('runs');
      if (version !== renderVersion) return;
      history.replaceChildren(element('h2', '', 'Recent runs'));
      if (!runs.length) { detail.replaceChildren(element('h2', '', 'No runs yet'), element('p', '', 'Open an application and choose Run application to generate a report.')); return; }
      if (!runs.some(job => job.id === selectedRun)) selectedRun = runs[0].id;
      for (const job of runs) {
        const button = element('button', 'dpi-history-item', `${job.file} · ${job.status}`);
        button.setAttribute('aria-pressed', String(job.id === selectedRun));
        button.onclick = () => { selectedRun = job.id; render(); };
        history.append(button);
      }
      const { run } = await request(`runs/${selectedRun}`);
      if (version !== renderVersion) return;
      renderRunReport(run, detail, version);
      if (runs.some(job => ['running', 'cancelling'].includes(job.status))) pollTimer = setTimeout(refresh, 1000);
    } catch (error) {
      console.error('DPI report refresh failed:', error.name);
      if (version !== renderVersion) return;
      history.append(element('p', 'dpi-notice', error.message));
      const retry = element('button', 'dpi-detail-button', 'Retry loading reports');
      retry.onclick = () => render();
      history.append(retry);
    }
  };
  refresh();
}

function render() {
  clearTimeout(pollTimer);
  const version = ++renderVersion;
  const route = location.hash.slice(1) || 'applications';
  document.querySelectorAll('.dpi-primary a').forEach(link => {
    if (link.hash === `#${route}`) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  main.replaceChildren();
  const intro = element('section', 'dpi-intro');
  intro.append(element('span', 'dpi-eyebrow', 'DPI WORKSPACE'),
    element('h1', '', route === 'runs' ? 'Application runs' : route === 'connection' ? 'Backend connection' : 'Your network investigation toolkit'),
    element('p', '', route === 'applications' ? 'Explore probes, monitors and analysis tools from your Python backend.' : 'A dedicated workspace for your Python DPI applications.'));
  main.append(intro);
  if (route === 'runs') { renderRuns(version); return; }
  if (route === 'connection') {
    const panel = element('section', 'dpi-panel');
    panel.append(element('p', '', 'Checking Python backend…'));
    main.append(panel);
    request('health').then(health => {
      if (version !== renderVersion) return;
      updateConnection(health.ready);
      panel.replaceChildren(element('h2', '', health.message), element('p', '', `${health.applications} applications · Interpreter: ${health.interpreter}`), element('p', 'dpi-notice', 'Individual apps check their dependencies and required inputs before running.'));
      const count = element('p', 'dpi-notice', readinessError || `${[...readiness.values()].filter(app => app.ready).length}/${readiness.size} applications pass preflight. Readiness does not guarantee network reachability.`);
      const refresh = element('button', 'dpi-detail-button', 'Refresh all-app readiness');
      refresh.onclick = async () => {
        refresh.disabled = true; count.textContent = 'Checking every application…';
        try { const data = await loadReadiness(); count.textContent = `${data.ready}/${data.total} applications pass preflight`; }
        catch (error) { count.textContent = error.message; }
        finally { refresh.disabled = false; }
      };
      panel.append(count, refresh);
    }).catch(error => {
      console.error('DPI connection check failed:', error.name);
      if (version !== renderVersion) return;
      updateConnection(false);
      panel.replaceChildren(element('h2', '', 'Backend unavailable'), element('p', 'dpi-notice', error.message));
      const retry = element('button', 'dpi-detail-button', 'Retry connection');
      retry.onclick = () => render();
      panel.append(retry);
    });
    return;
  }
  if (catalogError) {
    const error = element('section', 'dpi-panel');
    error.append(element('h2', '', 'Unable to load the backend catalog'), element('p', '', 'Run npm start and check DPI_BACKEND_DIR. A static server cannot execute Python apps.'));
    const retry = element('button', 'dpi-detail-button', 'Retry');
    retry.onclick = () => location.reload();
    error.append(retry);
    main.append(error);
    return;
  }
  const categories = element('nav', 'dpi-categories');
  categories.setAttribute('aria-label', 'Application categories');
  for (const [key, label] of [['all', 'All Apps'], ...Object.entries(categoryLabels)]) {
    const button = element('button', '', `${label} (${key === 'all' ? apps.length : apps.filter(app => app.kind === key).length})`);
    button.type = 'button';
    button.setAttribute('aria-pressed', String(category === key));
    button.onclick = () => { category = key; render(); };
    categories.append(button);
  }
  const toolbar = element('div', 'dpi-toolbar');
  const label = element('label', 'dpi-search-label', 'Search applications');
  const search = element('input', 'dpi-search');
  search.type = 'search';
  search.placeholder = 'Search by name, description or script…';
  search.value = query;
  search.oninput = () => { query = search.value; renderCards(); };
  label.append(search);
  const count = element('span', 'dpi-count');
  count.id = 'dpi-count';
  count.setAttribute('role', 'status');
  toolbar.append(label, count);
  const results = element('section', 'dpi-grid');
  results.id = 'dpi-results';
  results.setAttribute('aria-label', 'Applications');
  main.append(categories, toolbar, results);
  renderCards();
}

window.addEventListener('hashchange', render);
main.append(element('p', 'dpi-empty', 'Loading application catalog…'));
try {
  const catalog = await request('apps');
  if (!Array.isArray(catalog.apps) || catalog.apps.some(app => typeof app.file !== 'string' || typeof app.kind !== 'string' || typeof app.description !== 'string')) {
    throw new Error('Invalid catalog structure');
  }
  apps = catalog.apps;
  try { await loadReadiness(); }
  catch (error) { console.error('Initial DPI readiness failed:', error.name); }
  try { const health = await request('health'); updateConnection(health.ready); }
  catch (error) { console.error('Initial DPI connection check failed:', error.name); updateConnection(false); }
} catch (error) {
  console.error('DPI catalog load failed', error);
  catalogError = true;
}
render();

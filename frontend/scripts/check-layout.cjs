const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const postcss = require('postcss');
const selectorParser = require('postcss-selector-parser');

const src = path.resolve(__dirname, '../src');
const app = fs.readFileSync(path.join(src, 'App.tsx'), 'utf8');
const tokens = new Set([...app.matchAll(/data-page="([^"]+)"/g)].flatMap(m => m[1].split(' ')));
const importedStyles = new Set();
const visited = new Set();
function collectImports(file) {
  if (visited.has(file)) return;
  visited.add(file);
  const text = fs.readFileSync(file, 'utf8');
  for (const match of text.matchAll(/(?:from\s+|import\s*)['"]([^'"]+)['"]/g)) {
    if (!match[1].startsWith('.')) continue;
    const target = path.resolve(path.dirname(file), match[1]);
    if (target.endsWith('.css')) { importedStyles.add(target); continue; }
    const moduleFile = [target, target + '.tsx', target + '.ts'].find(p => fs.existsSync(p) && fs.statSync(p).isFile());
    if (moduleFile) collectImports(moduleFile);
  }
}
collectImports(path.join(src, 'App.tsx'));
let sheets = 0;
let rules = 0;
for (const token of tokens) {
  const file = path.join(src, 'pages', token + '.css');
  if (!importedStyles.has(file)) continue; // Inline-only informational pages.
  const css = postcss.parse(fs.readFileSync(file, 'utf8'));
  css.walkRules(rule => {
    for (let p = rule.parent; p; p = p.parent) {
      if (p.type === 'atrule' && /keyframes$/.test(p.name)) return;
    }
    selectorParser(selectors => selectors.each(selector => {
      let scoped = false;
      selector.walkAttributes(attribute => {
        if (attribute.attribute !== 'data-page' || !['=', '~='].includes(attribute.operator) || !attribute.value.split(/\s+/).includes(token)) return;
        for (let parent = attribute.parent; parent; parent = parent.parent) {
          if (parent.type === 'pseudo' && (![':where', ':is'].includes(parent.value) || parent.nodes.length !== 1)) return;
        }
        scoped = true;
      });
      // This existing page uses its unique root class instead of a route attribute.
      if (token === 'RealtimeDashboard' && selector.toString().trim().startsWith('.realtime-page')) scoped = true;
      assert(scoped, `${token}: unscoped ${selector}`);
    })).processSync(rule.selector);
    rules++;
  });
  css.walkAtRules(/keyframes$/, rule => {
    const namespaces = token === 'Home' ? ['Home-', 'auth-', 'showcase-'] : [token + '-'];
    assert(namespaces.some(prefix => rule.params.startsWith(prefix)), `${token}: global animation ${rule.params}`);
  });
  sheets++;
}
assert(sheets >= 50, 'Missing route stylesheet coverage');
for (const file of importedStyles) {
  if (path.dirname(file) === path.join(src, 'pages')) assert(tokens.has(path.basename(file, '.css')), `Imported page stylesheet has no route scope: ${file}`);
}
assert(!app.includes('className="main-content"'), 'Application shell collides with Overview content');
assert(app.includes("import './layout.css';"), 'Shared layout rules are not loaded');
assert(/data-page="RealtimeDashboard"><RealtimeDashboard\s*\/>/.test(app), 'RealtimeDashboard lost its page scope');
const shared = fs.readFileSync(path.join(src, 'layout.css'), 'utf8');
postcss.parse(shared);
assert(shared.includes('minmax(min(100%, 200px), 1fr)'), 'Responsive stats grid is missing');
assert(shared.includes('overflow-x: auto'), 'Local table scrolling is missing');
assert(shared.includes('font-size: clamp(22px, 2vw, 28px)'), 'Bounded heading scale is missing');
assert(!fs.readFileSync(path.join(src, 'index.css'), 'utf8').includes('fonts.googleapis.com'), 'Interface depends on external font download');
console.log(`PASS: ${sheets} isolated page stylesheets, ${rules} scoped rules, namespaced animations, responsive shell and typography.`);

for (const component of ['AuditLogs','ToolManagement','UserManagement','BackupManagement']) assert(new RegExp('data-page=\"'+component+'\"><'+component+'\\s*/>').test(app), component+' lost its feature page scope');

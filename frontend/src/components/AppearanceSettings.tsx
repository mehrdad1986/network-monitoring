import { useAppearance, Appearance } from '../appearance/AppearanceProvider';
import { UIIcon } from './UIIcon';

export function AppearanceSettings() {
  const { appearance, update, reset, saved } = useAppearance();
  return <section className="appearance-settings" aria-labelledby="appearance-title">
    <div className="appearance-heading"><div><span className="appearance-eyebrow">YOUR WORKSPACE</span><h2 id="appearance-title">Appearance</h2><p>Familiar colors. A view that feels right for you.</p></div><span className="appearance-save-state" role="status"><UIIcon symbol={saved ? 'check' : 'warning'} />{saved ? 'Saved on this device' : 'Changes apply for this session'}</span></div>
    <fieldset className="appearance-group"><legend>Color mode</legend><p>Change the whole workspace, including menus, cards and tables.</p>
      <div className="appearance-modes">{([['dark', 'moon', 'Dark', 'Deep navy surfaces'], ['light', 'sun', 'Light', 'Bright, clear surfaces'], ['system', 'monitor', 'Use device', 'Follow your device']] as const).map(([mode, icon, label, description]) => <button key={mode} type="button" className={`appearance-mode ${appearance.mode === mode ? 'selected' : ''}`} aria-pressed={appearance.mode === mode} onClick={() => update({ mode })}><div className={`appearance-miniature ${mode}`} aria-hidden="true"><i /><div><b /><span /><span /></div></div><span className="appearance-option-title"><UIIcon symbol={icon} />{label}<span className="appearance-selection">{appearance.mode === mode && <UIIcon symbol="check" />}</span></span><small>{description}</small></button>)}</div>
    </fieldset>
    <div className="appearance-adjustments">
      <fieldset className="appearance-group"><legend>Background depth</legend><p>Subtle shifts within the same color family.</p><div className="appearance-segments">{(['soft', 'balanced', 'deep'] as const).map(depth => <button type="button" key={depth} aria-pressed={appearance.depth === depth} onClick={() => update({ depth })}>{depth === 'soft' ? 'Lighter' : depth === 'deep' ? 'Deeper' : 'Balanced'}</button>)}</div></fieldset>
      <fieldset className="appearance-group"><legend>Blue accent</legend><p>Keep the palette. Adjust the intensity.</p><div className="appearance-shades">{(['soft', 'classic', 'deep'] as Appearance['accent'][]).map(accent => <button type="button" key={accent} aria-label={`${accent} blue accent`} aria-pressed={appearance.accent === accent} onClick={() => update({ accent })}><i className={`accent-swatch ${accent}`} /><span>{accent === 'soft' ? 'Soft' : accent === 'deep' ? 'Deep' : 'Classic'}</span>{appearance.accent === accent && <UIIcon symbol="check" />}</button>)}</div></fieldset>
    </div>
    <div className="appearance-preview" aria-label="Live appearance preview"><div><UIIcon symbol="monitor" /><span>Workspace preview</span><span className="appearance-preview-badge">Connected</span></div><section><div><small>NETWORK OVERVIEW</small><h3>Clear information. Less noise.</h3><p>Your content, controls and navigation use the selected appearance.</p></div><button type="button" disabled>Primary action</button></section></div>
    <footer className="appearance-footer"><p>Changes apply immediately and stay on this device.</p><button type="button" onClick={reset}><UIIcon symbol="refresh" />Reset to defaults</button></footer>
  </section>;
}

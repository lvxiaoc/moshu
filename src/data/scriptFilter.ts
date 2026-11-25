export type ScriptMode = 'trad' | 'simp' | 'both';
export type UiScript = 'trad' | 'simp';
export type CharScript = 'common' | 'trad' | 'simp';

const SCRIPT_STORAGE_KEY = 'inkkey_script_mode_v1';
const UI_SCRIPT_STORAGE_KEY = 'inkkey_ui_script_v1';

export const SCRIPT_MODE_LABELS: Record<ScriptMode, string> = {
  trad: '僅繁體',
  simp: '僅簡體',
  both: '繁簡全集',
};

export const SCRIPT_MODE_OPTIONS: Array<{ id: ScriptMode; label: string; short: string }> = [
  { id: 'trad', label: '繁簡分流：僅繁體', short: '僅繁體' },
  { id: 'simp', label: '繁簡分流：僅簡體', short: '僅簡體' },
  { id: 'both', label: '繁簡全集', short: '繁簡' },
];

export function matchesScript(
  charScript: CharScript | undefined,
  mode: ScriptMode
): boolean {
  if (mode === 'both' || !charScript || charScript === 'common') return true;
  return charScript === mode;
}

export function loadScriptMode(): ScriptMode {
  try {
    const raw = localStorage.getItem(SCRIPT_STORAGE_KEY);
    if (raw === 'trad' || raw === 'simp' || raw === 'both') return raw;
  } catch {
    // Ignore storage errors
  }
  return 'trad';
}

export function saveScriptMode(mode: ScriptMode): void {
  try {
    localStorage.setItem(SCRIPT_STORAGE_KEY, mode);
  } catch {
    // Ignore storage errors
  }
}

export function loadUiScript(scriptMode?: ScriptMode): UiScript {
  if (scriptMode === 'trad') return 'trad';
  if (scriptMode === 'simp') return 'simp';
  try {
    const raw = localStorage.getItem(UI_SCRIPT_STORAGE_KEY);
    if (raw === 'trad' || raw === 'simp') return raw;
  } catch {
    // Ignore storage errors
  }
  return 'trad';
}

export function saveUiScript(ui: UiScript): void {
  try {
    localStorage.setItem(UI_SCRIPT_STORAGE_KEY, ui);
  } catch {
    // Ignore storage errors
  }
}

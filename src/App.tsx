import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  loadScriptMode,
  loadUiScript,
  saveScriptMode,
  saveUiScript,
  ScriptMode,
  UiScript,
} from './data/scriptFilter';
import { UiScriptContext, uiText } from './data/uiScript';
import {
  loadThemeMode,
  saveThemeMode,
  ThemeContext,
  ThemeMode,
} from './data/theme';
import {
  KeystrokeCloudContext,
  loadKeystrokeCloudBlend,
  loadKeystrokeCloudEnabled,
  loadKeystrokeCloudOpacity,
  saveKeystrokeCloudBlend,
  saveKeystrokeCloudEnabled,
  saveKeystrokeCloudOpacity,
} from './data/keystrokeCloud';
import { MemoryPalaceCloud } from './components/MemoryPalaceCloud';
import { WriterCanvas } from './components/WriterCanvas';
import { synth } from './audio/synth';

type ActiveView = 'WRITER' | 'PALACE_CLOUD';

export default function App() {
  const [view, setView] = useState<ActiveView>('WRITER');
  const [muted, setMuted] = useState<boolean>(() => synth.isMuted());

  const [scriptMode, setScriptMode] = useState<ScriptMode>(() => loadScriptMode());
  const [uiScript, setUiScript] = useState<UiScript>(() => loadUiScript(loadScriptMode()));
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => loadThemeMode());
  const isWash = themeMode === 'wash';

  const [keystrokeCloudEnabled, setKeystrokeCloudEnabled] = useState<boolean>(() =>
    loadKeystrokeCloudEnabled()
  );
  const [keystrokeCloudOpacity, setKeystrokeCloudOpacity] = useState<number>(() =>
    loadKeystrokeCloudOpacity()
  );
  const [keystrokeCloudBlend, setKeystrokeCloudBlend] = useState<number>(() =>
    loadKeystrokeCloudBlend()
  );

  const handleSetKeystrokeCloudEnabled = useCallback((next: boolean) => {
    setKeystrokeCloudEnabled(next);
    saveKeystrokeCloudEnabled(next);
  }, []);

  const handleSetKeystrokeCloudOpacity = useCallback((next: number) => {
    const clamped = Math.max(0.05, Math.min(0.85, next));
    setKeystrokeCloudOpacity(clamped);
    saveKeystrokeCloudOpacity(clamped);
  }, []);

  const handleSetKeystrokeCloudBlend = useCallback((next: number) => {
    const clamped = Math.max(0.05, Math.min(1.0, next));
    setKeystrokeCloudBlend(clamped);
    saveKeystrokeCloudBlend(clamped);
  }, []);

  const handleToggleKeystrokeCloud = useCallback(() => {
    setKeystrokeCloudEnabled((prev) => {
      const next = !prev;
      saveKeystrokeCloudEnabled(next);
      return next;
    });
  }, []);

  const keystrokeCloudCtx = useMemo(
    () => ({
      enabled: keystrokeCloudEnabled,
      setEnabled: handleSetKeystrokeCloudEnabled,
      toggle: handleToggleKeystrokeCloud,
      opacity: keystrokeCloudOpacity,
      setOpacity: handleSetKeystrokeCloudOpacity,
      blend: keystrokeCloudBlend,
      setBlend: handleSetKeystrokeCloudBlend,
    }),
    [
      keystrokeCloudEnabled,
      handleSetKeystrokeCloudEnabled,
      handleToggleKeystrokeCloud,
      keystrokeCloudOpacity,
      handleSetKeystrokeCloudOpacity,
      keystrokeCloudBlend,
      handleSetKeystrokeCloudBlend,
    ]
  );

  const handleChangeScriptMode = useCallback((next: ScriptMode) => {
    setScriptMode(next);
    saveScriptMode(next);
    const derivedUi: UiScript = next === 'simp' ? 'simp' : 'trad';
    setUiScript(derivedUi);
    saveUiScript(derivedUi);
  }, []);

  const handleChangeThemeMode = useCallback((next: ThemeMode) => {
    synth.playClick();
    setThemeMode(next);
    saveThemeMode(next);
  }, []);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      synth.setMuted(next);
      if (!next) synth.playClick();
      return next;
    });
  }, []);

  useEffect(() => {
    document.documentElement.lang = uiScript === 'simp' ? 'zh-Hans' : 'zh-Hant';
    document.title = uiText('墨鍵寫作 · 靈明形碼勿打擾寫作臺', uiScript);
  }, [uiScript]);

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    document.documentElement.classList.toggle('wash', themeMode === 'wash');
    saveThemeMode(themeMode);
  }, [themeMode]);

  return (
    <KeystrokeCloudContext.Provider value={keystrokeCloudCtx}>
      <UiScriptContext.Provider value={uiScript}>
        <ThemeContext.Provider value={themeMode}>
          <div className="relative w-screen h-screen overflow-hidden bg-[var(--dojo-canvas)] text-[var(--dojo-text)] flex flex-col">
            {isWash && (
              <div
                aria-hidden="true"
                className="dojo-ink-paper-bg pointer-events-none fixed inset-0 z-0 overflow-hidden"
              >
                <svg
                  viewBox="0 0 1200 800"
                  preserveAspectRatio="none"
                  className="dojo-ink-mist-layer absolute inset-0 w-full h-full opacity-[0.62]"
                >
                  <defs>
                    <radialGradient id="globalInkMistTL" cx="12%" cy="15%" r="44%">
                      <stop offset="0%" stopColor="#141413" stopOpacity="0.13" />
                      <stop offset="50%" stopColor="#5E5E59" stopOpacity="0.055" />
                      <stop offset="100%" stopColor="#F3F1EC" stopOpacity="0" />
                    </radialGradient>
                    <radialGradient id="globalInkMistBR" cx="88%" cy="86%" r="46%">
                      <stop offset="0%" stopColor="#262624" stopOpacity="0.10" />
                      <stop offset="48%" stopColor="#52524D" stopOpacity="0.05" />
                      <stop offset="100%" stopColor="#F3F1EC" stopOpacity="0" />
                    </radialGradient>
                    <radialGradient id="globalInkMistTR" cx="86%" cy="16%" r="36%">
                      <stop offset="0%" stopColor="#3B3B38" stopOpacity="0.075" />
                      <stop offset="55%" stopColor="#6E6E68" stopOpacity="0.032" />
                      <stop offset="100%" stopColor="#F3F1EC" stopOpacity="0" />
                    </radialGradient>
                    <filter id="globalInkCloudBlur" x="-15%" y="-15%" width="130%" height="130%">
                      <feGaussianBlur stdDeviation="26" />
                    </filter>
                  </defs>
                  <ellipse
                    cx="120"
                    cy="110"
                    rx="380"
                    ry="220"
                    fill="url(#globalInkMistTL)"
                    filter="url(#globalInkCloudBlur)"
                  />
                  <ellipse
                    cx="1040"
                    cy="125"
                    rx="320"
                    ry="180"
                    fill="url(#globalInkMistTR)"
                    filter="url(#globalInkCloudBlur)"
                  />
                  <ellipse
                    cx="1050"
                    cy="700"
                    rx="420"
                    ry="240"
                    fill="url(#globalInkMistBR)"
                    filter="url(#globalInkCloudBlur)"
                  />
                  <path
                    d="M-60 765 Q 165 620, 380 705 T 810 675 T 1260 610 L 1260 840 L -60 840 Z"
                    fill="#222220"
                    fillOpacity="0.062"
                    filter="url(#globalInkCloudBlur)"
                  />
                  <path
                    d="M-40 805 Q 240 695, 510 755 T 1010 700 T 1260 665 L 1260 840 L -40 840 Z"
                    fill="#141413"
                    fillOpacity="0.045"
                    filter="url(#globalInkCloudBlur)"
                  />
                </svg>
              </div>
            )}

            {view === 'WRITER' ? (
              <WriterCanvas
                scriptMode={scriptMode}
                onChangeScriptMode={handleChangeScriptMode}
                onChangeThemeMode={handleChangeThemeMode}
                onOpenPalace={() => setView('PALACE_CLOUD')}
                muted={muted}
                onToggleMute={handleToggleMute}
              />
            ) : (
              <MemoryPalaceCloud
                scriptMode={scriptMode}
                onChangeScriptMode={handleChangeScriptMode}
                onChangeThemeMode={handleChangeThemeMode}
                onBack={() => setView('WRITER')}
              />
            )}
          </div>
        </ThemeContext.Provider>
      </UiScriptContext.Provider>
    </KeystrokeCloudContext.Provider>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Move,
  RotateCcw,
  Download,
  Upload,
  Check,
  X,
  Route,
} from 'lucide-react';
import {
  getLingmingRadicalScript,
  LINGMING_CHAMBER_BY_KEY,
  LINGMING_CHAMBERS,
  LINGMING_ROOT_MAP,
  PalaceChamber,
} from '../data/lingming';
import {
  FINGER_LABELS,
  KEY_FINGER_MAP,
  KEYBOARD_ROWS,
  VOWEL_KEYS,
} from '../data/schemes';
import { PALACE_PDF_CHAMBERS } from '../data/palacePdfData';
import {
  exportPalacePositionsJson,
  hasUserChamberOverrides,
  importPalacePositionsJson,
  loadPalaceOverrides,
  PalaceOverridesMap,
  resetChamberOverrides,
  resetPalaceNodeOverride,
  updatePalaceNodeOverride,
} from '../data/palaceEditor';
import { buildChamberStrokeFlow } from '../data/palaceStrokePaths';
import { FrequencyTier } from '../data/palaceStrokes';
import {
  FREQUENCY_TIER_COLORS,
  getStrokeFlowTone,
  PalaceStrokeFlowOverlay,
  PDF_TIER_COLORS,
  StrokeCloudSelection,
  StrokeCloudStage,
  WASH_FREQUENCY_TIER_COLORS,
  WASH_PDF_TIER_COLORS,
} from './StrokeCloudStage';
import { synth } from '../audio/synth';
import {
  matchesScript,
  SCRIPT_MODE_OPTIONS,
  ScriptMode,
} from '../data/scriptFilter';
import { uiMnemonic, useUiScript, useUiText } from '../data/uiScript';
import { THEME_OPTIONS, ThemeMode, useThemeMode } from '../data/theme';

interface MemoryPalaceCloudProps {
  scriptMode: ScriptMode;
  onChangeScriptMode?: (mode: ScriptMode) => void;
  onChangeThemeMode?: (mode: ThemeMode) => void;
  onBack: () => void;
}

const VOWEL_POSTER_META: Record<string, { shortWord: string; note: string }> = {
  a: { shortWord: '了', note: '一簡「了」 · 韻腹 a 終止' },
  e: { shortWord: '的', note: '一簡「的」 · 韻腹 e 終止' },
  i: { shortWord: '是', note: '一簡「是」 · 韻腹 i 終止' },
  o: { shortWord: '我', note: '一簡「我」 · 韻腹 o / 無讀音字根取 o' },
  u: { shortWord: '不', note: '一簡「不」 · 韻腹 u 終止' },
};

function getTierForRank(rank: number): FrequencyTier {
  if (rank === 1) return 'primary';
  if (rank <= 5) return 'rank2_5';
  if (rank <= 9) return 'rank6_9';
  return 'rest';
}

function getClusterAccent(clusterId: string, isWash: boolean): string {
  const palette = isWash ? WASH_FREQUENCY_TIER_COLORS : FREQUENCY_TIER_COLORS;
  if (clusterId.endsWith('_primary')) return palette.primary;
  if (clusterId.endsWith('_t25')) return palette.rank2_5;
  if (clusterId.endsWith('_t69')) return palette.rank6_9;
  return palette.rest;
}

/** Crisp calligraphic SVG fallback for CJK Ext-B 「𠂇」 so M key never renders as a missing-font tofu box */
const InlineGlyph: React.FC<{ char: string; className?: string }> = ({ char, className = '' }) => {
  if (char === '𠂇') {
    return (
      <svg
        viewBox="0 0 24 24"
        className={`inline-block align-middle ${className}`}
        style={{ width: '1em', height: '1em' }}
        aria-label="𠂇"
      >
        <path
          fill="currentColor"
          d="M2.5 7.6 L18.8 7.0 Q20.1 6.9 21.1 7.9 Q21.3 8.4 20.6 8.7 L3.2 9.0 Q2.4 8.8 2.5 7.6 Z"
        />
        <path
          fill="currentColor"
          d="M12.3 2.8 Q13.7 3.2 14.1 4.2 C13.0 8.9 11.1 14.0 8.3 17.8 C6.4 20.3 4.1 21.8 2.5 22.4 C2.2 22.1 2.4 21.7 2.8 21.3 C5.4 19.2 8.2 15.3 10.0 10.7 C11.1 7.8 11.7 5.1 11.8 3.3 Q11.9 2.7 12.3 2.8 Z"
        />
      </svg>
    );
  }
  return <span className={className}>{char}</span>;
};

export const MemoryPalaceCloud: React.FC<MemoryPalaceCloudProps> = ({
  scriptMode,
  onChangeScriptMode,
  onChangeThemeMode,
  onBack,
}) => {
  const t = useUiText();
  const uiScript = useUiScript();
  const themeMode = useThemeMode();
  const isWash = themeMode === 'wash';
  const freqPalette = isWash ? WASH_FREQUENCY_TIER_COLORS : FREQUENCY_TIER_COLORS;
  const pdfPalette = isWash ? WASH_PDF_TIER_COLORS : PDF_TIER_COLORS;
  const [selectedKey, setSelectedKey] = useState<string>('q');
  const [selectedNode, setSelectedNode] = useState<StrokeCloudSelection | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [showStrokeFlow, setShowStrokeFlow] = useState(false);
  const [overrides, setOverrides] = useState<PalaceOverridesMap>(() => loadPalaceOverrides());
  const [jsonPanelOpen, setJsonPanelOpen] = useState(false);
  const [jsonDraft, setJsonDraft] = useState('');
  const [jsonStatus, setJsonStatus] = useState<string | null>(null);
  const [hoveredKeyInfo, setHoveredKeyInfo] = useState<{
    key: string;
    rect: { left: number; top: number; right: number; bottom: number; width: number; height: number };
  } | null>(null);

  const activeChamber: PalaceChamber =
    LINGMING_CHAMBER_BY_KEY[selectedKey] || LINGMING_CHAMBERS[0];
  const activePdfChamber = PALACE_PDF_CHAMBERS[activeChamber.key];

  useEffect(() => {
    setSelectedNode(null);
  }, [selectedKey]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLInputElement
      ) {
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        if (jsonPanelOpen) {
          setJsonPanelOpen(false);
          return;
        }
        onBack();
        return;
      }
      const k = e.key.toLowerCase();
      const nextChamber = LINGMING_CHAMBER_BY_KEY[k];
      if (nextChamber) {
        e.preventDefault();
        synth.playClick();
        setSelectedKey(k);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onBack, jsonPanelOpen]);

  const fingerLabel = FINGER_LABELS[KEY_FINGER_MAP[activeChamber.key]];
  const isLeft = activeChamber.handGroup.startsWith('left');
  const chamberColor = isLeft
    ? isWash
      ? '#181817'
      : '#38A885'
    : isWash
      ? '#4E4E4A'
      : '#4F86C6';
  const allChamberRadicals = activeChamber.clusters.flatMap((c) => c.radicals);
  const totalRadicals = allChamberRadicals.length;
  const activeRadicals = allChamberRadicals.filter((r) =>
    matchesScript(getLingmingRadicalScript(r.char, activeChamber.key, r.ma), scriptMode)
  ).length;
  const totalPdfGlyphs = activePdfChamber ? 1 + activePdfChamber.nodes.length : totalRadicals;

  const hasChamberEdits = useMemo(
    () => hasUserChamberOverrides(activeChamber.key),
    [activeChamber.key, overrides]
  );
  const selectedOverride = selectedNode
    ? overrides[selectedNode.id] || { dx: 0, dy: 0, scale: 1 }
    : null;

  const hoverPreviewData = useMemo(() => {
    if (!hoveredKeyInfo) return null;
    const key = hoveredKeyInfo.key;
    const chamber = LINGMING_CHAMBER_BY_KEY[key];
    const pdf = PALACE_PDF_CHAMBERS[key];
    const flow = buildChamberStrokeFlow(key, overrides);
    if (!chamber || !pdf || !flow) return null;
    return { key, rect: hoveredKeyInfo.rect, chamber, pdf, flow };
  }, [hoveredKeyInfo, overrides]);

  const handleKeyHoverStart = (
    key: string,
    el: HTMLElement
  ) => {
    const r = el.getBoundingClientRect();
    setHoveredKeyInfo({
      key,
      rect: {
        left: r.left,
        top: r.top,
        right: r.right,
        bottom: r.bottom,
        width: r.width,
        height: r.height,
      },
    });
  };

  const handleOpenExport = () => {
    setJsonDraft(exportPalacePositionsJson());
    setJsonStatus(t('已生成目前 20 宮殿完整座標定義 JSON（可直接複製或修改後匯入）'));
    setJsonPanelOpen(true);
  };

  const handleDownloadJson = () => {
    const content = exportPalacePositionsJson();
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lingming-memory-palace-layout.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setJsonStatus(t('已下載 lingming-memory-palace-layout.json'));
  };

  const handleImportJson = () => {
    const res = importPalacePositionsJson(jsonDraft);
    if (res.ok) {
      setOverrides(loadPalaceOverrides());
      setJsonStatus(t(`成功套用 ${res.count} 項雲圖座標微調`));
    } else {
      setJsonStatus(t(`匯入失敗：${res.error || '格式錯誤'}`));
    }
  };

  const rowOffsets = ['pl-0', 'pl-3 sm:pl-6', 'pl-7 sm:pl-14'];

  return (
    <div className="relative z-10 w-full h-full flex flex-col bg-[var(--dojo-canvas)] wash:bg-transparent text-[var(--dojo-text)] overflow-hidden wash-enter">
      {/* Compact top utility strip */}
      <header className="shrink-0 h-13 px-4 sm:px-6 bg-[var(--dojo-header)] wash:bg-[var(--dojo-header)]/88 wash:backdrop-blur-sm border-b border-[var(--dojo-border)] flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => {
              synth.playClick();
              onBack();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)] bg-[var(--dojo-surface)] hover:bg-[var(--dojo-surface-2)] border border-[var(--dojo-border)] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t('返回')}</span>
          </button>
          <div className="flex items-center gap-2 text-xs min-w-0">
            <span className="font-display text-base font-bold text-[var(--dojo-text-bright)] whitespace-nowrap">
              {t('靈明字根 · 記憶宮殿壁畫地圖')}
            </span>
            <span aria-hidden="true" className="hidden md:inline text-[var(--dojo-text-muted)]">·</span>
            <span className="hidden md:inline text-[var(--dojo-text-sub)] truncate">
              {t('每鍵以最高頻主根為骨架，其餘字根自第一筆起順著筆順按頻率排列')}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onChangeScriptMode && (
            <div
              className="hidden sm:inline-flex items-center gap-0.5 p-0.5 bg-[var(--dojo-surface)] border border-[var(--dojo-border)] rounded-lg"
              title={t('切換訓練與宮殿高亮字集；非本字集字根自動淡化顯示')}
            >
              {SCRIPT_MODE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    synth.playClick();
                    onChangeScriptMode(opt.id);
                  }}
                  className={`px-2 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    scriptMode === opt.id
                      ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-ochre)]'
                      : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                  }`}
                >
                  {t(opt.short)}
                </button>
              ))}
            </div>
          )}
          {onChangeThemeMode && (
            <div
              className="hidden sm:inline-flex items-center gap-0.5 p-0.5 bg-[var(--dojo-surface)] border border-[var(--dojo-border)] rounded-lg"
              title={t('切換視覺色調（玄墨 / 水墨）')}
            >
              {THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    synth.playClick();
                    onChangeThemeMode(opt.id);
                  }}
                  className={`px-2 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    themeMode === opt.id
                      ? 'bg-[var(--dojo-ochre-wash)] text-[var(--dojo-ochre)]'
                      : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                  }`}
                >
                  {t(opt.short)}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div
        className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4 flex flex-col gap-4 max-w-6xl w-full mx-auto"
        onScroll={() => {
          if (hoveredKeyInfo) setHoveredKeyInfo(null);
        }}
      >
        {/* Section 1: Spatial 25-Key Memory Palace Map */}
        <section aria-label={t('靈明25鍵空間記憶宮殿')}>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2 text-xs text-[var(--dojo-text-sub)]">
            <div className="flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <span className={`w-2.5 h-1 rounded-sm ${isWash ? 'bg-[#181817]' : 'bg-[#38A885]'}`} />
                <span>{t('A區左手大碼')}</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className={`w-2.5 h-1 rounded-sm ${isWash ? 'bg-[#5A5A56]' : 'bg-[#4F86C6]'}`} />
                <span>{t('A區右手大碼')}</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-1 rounded-sm bg-[var(--dojo-ochre)]" />
                <span>{t('B區元音韻腹（E的 U不 I是 O我 A了）')}</span>
              </span>
              <span className="text-[var(--dojo-text-muted)]">{t('Z 鍵不用（z/zh→V · q→K · 零聲母→J）')}</span>
            </div>
            <span className="font-mono-tabular text-[var(--dojo-text-muted)]">
              {t('懸停鍵位預覽筆畫路徑 · 敲擊實體鍵切換宮殿')}
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            {KEYBOARD_ROWS.map((row, rIdx) => (
              <div
                key={rIdx}
                className={`flex items-stretch justify-center gap-1.5 sm:gap-2 ${rowOffsets[rIdx]}`}
              >
                {row.map((k) => {
                  const isVowel = VOWEL_KEYS.has(k);
                  const isZ = k === 'z';
                  const chamber = LINGMING_CHAMBER_BY_KEY[k];
                  const isSelected = selectedKey === k;

                  if (isZ) {
                    return (
                      <div
                        key={k}
                        className="flex flex-col justify-between items-center rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface)] px-1.5 py-1.5 opacity-55"
                        style={{ width: 'clamp(56px, 8.6vw, 96px)', minHeight: '58px' }}
                      >
                        <span className="self-start font-mono-tabular text-[10px] font-bold text-[var(--dojo-text-muted)]">
                          Z
                        </span>
                        <span className="text-[11px] text-[var(--dojo-text-sub)] font-medium">{t('不用')}</span>
                        <span className="font-mono-tabular text-[9px] text-[var(--dojo-text-muted)]">z/zh→V</span>
                      </div>
                    );
                  }

                  if (isVowel) {
                    const vm = VOWEL_POSTER_META[k];
                    return (
                      <div
                        key={k}
                        title={t(vm.note)}
                        className="flex flex-col justify-between items-center rounded-lg border border-[var(--dojo-ochre)]/40 bg-[var(--dojo-ochre-wash)] px-1.5 py-1.5"
                        style={{ width: 'clamp(56px, 8.6vw, 96px)', minHeight: '58px' }}
                      >
                        <div className="w-full flex items-center justify-between">
                          <span className="font-mono-tabular text-[10px] font-bold text-[var(--dojo-ochre)]">
                            {k.toUpperCase()}
                          </span>
                          <span className="text-[9px] text-[var(--dojo-ochre)] opacity-90">
                            {t('韻')} {k}
                          </span>
                        </div>
                        <span className="font-display text-lg font-bold text-[var(--dojo-text-bright)] leading-none my-0.5">
                          {vm.shortWord}
                        </span>
                        <span className="text-[9px] text-[var(--dojo-ochre)] truncate max-w-full">
                          {t(k === 'o' ? 'o / 無音' : 'B區韻腹')}
                        </span>
                      </div>
                    );
                  }

                  const leftSide = chamber?.handGroup.startsWith('left');
                  const accent = leftSide
                    ? isWash
                      ? '#181817'
                      : '#38A885'
                    : isWash
                      ? '#4E4E4A'
                      : '#4F86C6';
                  const keyRadicals = chamber?.clusters.flatMap((c) => c.radicals) ?? [];
                  const keyTotalCount = keyRadicals.length;
                  const keyActiveCount = keyRadicals.filter((r) =>
                    matchesScript(getLingmingRadicalScript(r.char, k, r.ma), scriptMode)
                  ).length;
                  const subTokens = chamber?.subAnchors ? chamber.subAnchors.split(' ') : [];

                  return (
                    <button
                      key={k}
                      type="button"
                      data-palace-key={k}
                      onMouseEnter={(e) => handleKeyHoverStart(k, e.currentTarget)}
                      onMouseLeave={() =>
                        setHoveredKeyInfo((prev) => (prev?.key === k ? null : prev))
                      }
                      onFocus={(e) => handleKeyHoverStart(k, e.currentTarget)}
                      onBlur={() =>
                        setHoveredKeyInfo((prev) => (prev?.key === k ? null : prev))
                      }
                      onClick={() => {
                        synth.playClick();
                        setSelectedKey(k);
                      }}
                      className="keycap-surface relative flex flex-col justify-between items-center rounded-lg border px-1.5 py-1.5 text-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dojo-ochre)]"
                      style={{
                        width: 'clamp(56px, 8.6vw, 96px)',
                        minHeight: '58px',
                        backgroundColor: isSelected
                          ? isWash
                            ? leftSide
                              ? 'rgba(20, 20, 18, 0.14)'
                              : 'rgba(48, 48, 44, 0.12)'
                            : leftSide
                              ? 'rgba(56, 168, 133, 0.22)'
                              : 'rgba(79, 134, 198, 0.22)'
                          : isWash
                            ? '#F8F7F3'
                            : '#161C27',
                        backgroundImage: isWash
                          ? isSelected
                            ? leftSide
                              ? 'radial-gradient(circle at 50% 45%, rgba(20, 20, 18, 0.24) 0%, rgba(20, 20, 18, 0.08) 70%, transparent 100%)'
                              : 'radial-gradient(circle at 50% 45%, rgba(48, 48, 44, 0.22) 0%, rgba(48, 48, 44, 0.07) 70%, transparent 100%)'
                            : 'linear-gradient(180deg, #FAF9F6 0%, #EFECE5 100%)'
                          : 'none',
                        borderColor: isSelected
                          ? accent
                          : isWash
                            ? 'rgba(20, 20, 18, 0.16)'
                            : 'rgba(242, 238, 230, 0.11)',
                        boxShadow: isSelected
                          ? `0 0 0 1px ${accent}, 0 4px 16px ${isWash ? 'rgba(20, 20, 18, 0.14)' : 'rgba(0,0,0,0.4)'}`
                          : isWash
                            ? '0 2px 0 #C4C2BA, inset 0 1px 0 rgba(255, 255, 252, 0.65)'
                            : '0 2px 0 #090C11',
                      }}
                    >
                      <div className="w-full flex items-center justify-between">
                        <span
                          className="font-mono-tabular text-[10px] font-bold"
                          style={{ color: isSelected ? (isWash ? '#12110F' : '#FFFFFF') : accent }}
                        >
                          {k.toUpperCase()}
                        </span>
                        <span
                          className="inline-flex items-center gap-0.5 font-mono-tabular text-[9px] text-[var(--dojo-text-muted)]"
                          title={
                            keyActiveCount < keyTotalCount
                              ? `${keyActiveCount}/${keyTotalCount}${t('根')}`
                              : undefined
                          }
                        >
                          <span>
                            {keyActiveCount}
                            {t('根')}
                          </span>
                        </span>
                      </div>

                      <span className="font-display text-lg font-bold text-[var(--dojo-text-bright)] leading-none my-0.5">
                        <InlineGlyph char={chamber?.primaryAnchor || ''} />
                      </span>

                      <span className="text-[9px] text-[var(--dojo-text-sub)] truncate max-w-full leading-tight">
                        {subTokens.map((tok, tIdx) => {
                          const radMatch = keyRadicals.find((r) => r.char === tok);
                          const tokActive = matchesScript(
                            getLingmingRadicalScript(tok, k, radMatch?.ma),
                            scriptMode
                          );
                          return (
                            <span
                              key={`${k}_sub_${tIdx}`}
                              className={tokActive ? '' : 'opacity-25'}
                            >
                              {tIdx > 0 ? ` ${tok}` : tok}
                            </span>
                          );
                        })}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </section>

        {/* Section 2: Frequency-Ordered Stroke-Aligned Mural Palace */}
        <section className="flex-1 min-h-[300px] grid grid-cols-1 lg:grid-cols-12 gap-4 bg-[var(--dojo-surface)] wash:bg-[#EAE7DF]/88 wash:backdrop-blur-xs border border-[var(--dojo-border)] rounded-xl p-4 sm:p-5">
          {/* Left: Giant #1 主根 Silhouette + Frequency-Ordered Stroke Cloud (1:1 PDF + Interactive Editor) */}
          <div className="lg:col-span-5 flex flex-col justify-between bg-[var(--dojo-surface-inset)] wash:bg-[#F8F7F3]/90 wash:shadow-[inset_0_0_28px_rgba(20,20,18,0.05)] rounded-xl border border-[var(--dojo-border)] p-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="font-mono-tabular text-sm font-bold shrink-0"
                    style={{ color: chamberColor }}
                  >
                    {activeChamber.key.toUpperCase()} {t('鍵宮殿')}
                  </span>
                  <span aria-hidden="true" className="text-[var(--dojo-text-muted)]">·</span>
                  <span className="text-[var(--dojo-text-sub)] truncate">{t(fingerLabel)}</span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="font-mono-tabular text-[var(--dojo-text-muted)] mr-0.5">
                    {activeRadicals < totalRadicals ? `${activeRadicals}/${totalRadicals}` : totalRadicals}
                    {t('根')} · {totalPdfGlyphs}
                    {t('形')}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      synth.playClick();
                      setShowStrokeFlow((v) => !v);
                    }}
                    title={t('顯示或隱藏主根筆畫關聯路徑')}
                    className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
                      showStrokeFlow
                        ? 'bg-[var(--dojo-pine-wash)] border-[var(--dojo-pine)]/55 text-[var(--dojo-pine-text)]'
                        : 'bg-[var(--dojo-surface)] hover:bg-[var(--dojo-surface-2)] border-[var(--dojo-border)] text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)]'
                    }`}
                  >
                    <Route className="w-3 h-3" />
                    <span>{t('筆畫路徑')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      synth.playClick();
                      setEditMode((v) => !v);
                    }}
                    title={t('拖曳調整字根位置、大小或匯出雲圖座標 JSON')}
                    className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
                      editMode
                        ? 'bg-[var(--dojo-ochre-wash)] border-[var(--dojo-ochre)]/65 text-[var(--dojo-ochre)]'
                        : 'bg-[var(--dojo-surface)] hover:bg-[var(--dojo-surface-2)] border-[var(--dojo-border)] text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)]'
                    }`}
                  >
                    <Move className="w-3 h-3" />
                    <span>{t(editMode ? '完成編輯' : '編輯雲圖')}</span>
                  </button>
                </div>
              </div>

              {/* A4 Poster 5-Tier Frequency + Variant Legend */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--dojo-text-sub)] pt-0.5">
                <span className="inline-flex items-center gap-1">
                  <span
                    className="w-2 h-2 rounded-full opacity-75"
                    style={{ backgroundColor: freqPalette.primary }}
                  />
                  <span>{t('主根')}</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: freqPalette.rank2_5 }}
                  />
                  <span>{t('第 2–5')}</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: freqPalette.rank6_9 }}
                  />
                  <span>{t('第 6–9')}</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: freqPalette.rest }}
                  />
                  <span>{t('其餘')}</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: pdfPalette.var_2_5 }}
                  />
                  <span>{t('變體')}</span>
                </span>
                <span className="text-[var(--dojo-text-muted)]">· {t('順筆順按頻率排列')}</span>
                {scriptMode !== 'both' && (
                  <span className="text-[var(--dojo-text-muted)] opacity-90">· {t('半透明：非本字集對照')}</span>
                )}
              </div>
            </div>

            <div
              key={activeChamber.key}
              className="flex-1 min-h-[240px] flex items-center justify-center my-1 wash-enter"
            >
              <StrokeCloudStage
                chamberKey={activeChamber.key}
                variant="palace"
                scriptMode={scriptMode}
                showStrokeFlow={showStrokeFlow}
                selectedChar={selectedNode?.char || null}
                selectedNodeId={selectedNode?.id || null}
                overrides={overrides}
                editMode={editMode}
                onDragNode={(id, patch) => {
                  setOverrides(updatePalaceNodeOverride(id, patch));
                }}
                onSelectNode={(node) => {
                  if (!editMode) synth.playClick();
                  setSelectedNode(node);
                }}
              />
            </div>

            {/* Cloud Editor Controls (only shown when editMode is ON) */}
            {editMode && (
              <div className="mb-2.5 p-2.5 rounded-lg bg-[var(--dojo-surface)] border border-[var(--dojo-ochre)]/30 flex flex-col gap-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[var(--dojo-ochre)] font-medium">
                    {t(
                      selectedNode
                        ? '微調選中字根（可直接在圖上拖曳）'
                        : '在上方雲圖拖曳或點擊任一字根 / 主根以調整位置與縮放'
                    )}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {hasChamberEdits && (
                      <button
                        type="button"
                        onClick={() => {
                          synth.playClick();
                          setOverrides(resetChamberOverrides(activeChamber.key));
                        }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--dojo-surface-2)] hover:opacity-90 text-[11px] text-[var(--dojo-text)] cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>{t('還原此鍵')}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleOpenExport}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--dojo-surface-2)] hover:opacity-90 text-[11px] text-[var(--dojo-pine-text)] cursor-pointer"
                    >
                      <Upload className="w-3 h-3" />
                      <span>{t('匯出/匯入')}</span>
                    </button>
                  </div>
                </div>

                {selectedNode && selectedOverride && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-[var(--dojo-border)]">
                    <div className="flex items-center gap-2 font-mono-tabular text-[11px] text-[var(--dojo-text-sub)]">
                      <span>
                        X:{(selectedNode.cx + selectedOverride.dx).toFixed(1)}
                      </span>
                      <span>
                        Y:{(selectedNode.cy + selectedOverride.dy).toFixed(1)}
                      </span>
                    </div>

                    <label className="flex items-center gap-2 text-[11px] text-[var(--dojo-text-sub)] flex-1 min-w-[140px] max-w-[200px]">
                      <span>{t('縮放')}</span>
                      <input
                        type="range"
                        min={0.4}
                        max={2.2}
                        step={0.05}
                        value={selectedOverride.scale}
                        onChange={(e) => {
                          setOverrides(
                            updatePalaceNodeOverride(selectedNode.id, {
                              scale: parseFloat(e.target.value),
                            })
                          );
                        }}
                        className="w-full accent-[var(--dojo-ochre)] cursor-pointer"
                      />
                      <span className="font-mono-tabular w-9 text-right">
                        {selectedOverride.scale.toFixed(2)}x
                      </span>
                    </label>

                    <button
                      type="button"
                      onClick={() => {
                        synth.playClick();
                        setOverrides(resetPalaceNodeOverride(selectedNode.id));
                      }}
                      className="px-2 py-0.5 rounded bg-[var(--dojo-surface-2)] hover:opacity-90 text-[11px] text-[var(--dojo-ochre)] cursor-pointer"
                    >
                      {t('重設此字根')}
                    </button>
                  </div>
                )}

                {jsonPanelOpen && (
                  <div className="pt-2 border-t border-[var(--dojo-border)] flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-[var(--dojo-text-sub)]">
                        {t(`雲圖座標 JSON（${jsonStatus || '貼上即可匯入'}）`)}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handleDownloadJson}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--dojo-pine-wash)] text-[11px] text-[var(--dojo-pine-text)] cursor-pointer"
                        >
                          <Download className="w-3 h-3" />
                          <span>{t('下載')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleImportJson}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--dojo-ochre-wash)] text-[11px] text-[var(--dojo-ochre)] cursor-pointer"
                        >
                          <Check className="w-3 h-3" />
                          <span>{t('套用匯入')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setJsonPanelOpen(false)}
                          aria-label={t('關閉 JSON 面板')}
                          className="p-0.5 text-[var(--dojo-text-muted)] hover:text-[var(--dojo-text-bright)] cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <textarea
                      value={jsonDraft}
                      onChange={(e) => setJsonDraft(e.target.value)}
                      rows={4}
                      spellCheck={false}
                      className="w-full rounded bg-[var(--dojo-surface-inset)] border border-[var(--dojo-border)] p-2 font-mono-tabular text-[10px] text-[var(--dojo-text)] focus:outline-none focus:border-[var(--dojo-ochre)]"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-2 text-xs border-t border-[var(--dojo-border)] pt-2.5">
              {selectedNode ? (
                <div className="flex items-center gap-2 text-[var(--dojo-text)] min-w-0">
                  {selectedNode.path ? (
                    <svg
                      viewBox={`${selectedNode.cx - Math.max(4, selectedNode.r) * 1.25} ${selectedNode.cy - Math.max(4, selectedNode.r) * 1.25} ${Math.max(4, selectedNode.r) * 2.5} ${Math.max(4, selectedNode.r) * 2.5}`}
                      className="w-5 h-5 shrink-0 text-[var(--dojo-ochre)]"
                      aria-label={selectedNode.char}
                    >
                      <path d={selectedNode.path} fill="currentColor" />
                    </svg>
                  ) : (
                    <span className="font-display text-base font-bold text-[var(--dojo-ochre)]">
                      <InlineGlyph char={selectedNode.char} />
                    </span>
                  )}
                  <span className="font-mono-tabular text-[11px] text-[var(--dojo-text-muted)]">
                    #{selectedNode.rank}
                  </span>
                  {selectedNode.ma && (
                    <span className="font-mono-tabular font-semibold">
                      <span style={{ color: chamberColor }}>
                        {selectedNode.ma[0].toUpperCase()}
                      </span>
                      {!selectedNode.isXiao && (
                        <span className="text-[var(--dojo-text)]">{selectedNode.ma[1]}</span>
                      )}
                      <span className="text-[var(--dojo-ochre)]">
                        {selectedNode.ma[selectedNode.ma.length - 1]}
                      </span>
                    </span>
                  )}
                  <span className="text-[var(--dojo-text-sub)] truncate">
                    {t(
                      selectedNode.note ||
                        LINGMING_ROOT_MAP.get(selectedNode.parentChar)?.note ||
                        (selectedNode.isXiao ? '小根 2 碼' : '大根 3 碼')
                    )}
                    {(() => {
                      const ds = getLingmingRadicalScript(
                        selectedNode.char,
                        activeChamber.key,
                        selectedNode.ma
                      );
                      const eff =
                        ds !== 'common'
                          ? ds
                          : getLingmingRadicalScript(
                              selectedNode.parentChar,
                              activeChamber.key,
                              selectedNode.ma
                            );
                      return matchesScript(eff, scriptMode) ? '' : `（${t('非當前字集')}）`;
                    })()}
                  </span>
                </div>
              ) : (
                <span className="text-[var(--dojo-text-sub)] truncate">
                  {t('筆順口訣：')}
                  {uiMnemonic(activeChamber.mnemonic, uiScript)}
                </span>
              )}
              <span className="text-[11px] text-[var(--dojo-text-muted)] shrink-0">
                {t(editMode ? '拖曳調整位置' : '點擊字根檢視編碼')}
              </span>
            </div>
          </div>

          {/* Right: Frequency-Tier Cluster Cards + One-Click Palace Drills */}
          <div className="lg:col-span-7 flex flex-col justify-between gap-4">
            <div className="flex flex-col gap-3">
              {activeChamber.clusters.map((cl) => {
                const tierAccent = getClusterAccent(cl.id, isWash);
                const activeInCluster = cl.radicals.filter((rad) =>
                  matchesScript(
                    getLingmingRadicalScript(rad.char, activeChamber.key, rad.ma),
                    scriptMode
                  )
                ).length;
                return (
                  <div
                    key={cl.id}
                    className="pb-3 border-b border-[var(--dojo-border)] last:border-b-0 last:pb-0"
                  >
                    <div className="flex items-center gap-2 mb-2 text-xs">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: tierAccent }}
                      />
                      <span className="font-medium text-[var(--dojo-text)]">{t(cl.label)}</span>
                      <span aria-hidden="true" className="text-[var(--dojo-text-muted)]">·</span>
                      <span className="font-mono-tabular text-[var(--dojo-text-sub)]">
                        {activeInCluster < cl.radicals.length
                          ? `${activeInCluster}/${cl.radicals.length}`
                          : cl.radicals.length}{' '}
                        {t('個')}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {cl.radicals.map((rad) => {
                        const da = rad.ma[0].toUpperCase();
                        const sheng = rad.isXiao ? '' : rad.ma[1];
                        const yun = rad.ma[rad.ma.length - 1];
                        const isSel = selectedNode?.char === rad.char;
                        const tier = getTierForRank(rad.rank);
                        const radScript = getLingmingRadicalScript(
                          rad.char,
                          activeChamber.key,
                          rad.ma
                        );
                        const inScript = matchesScript(radScript, scriptMode);
                        return (
                          <button
                            key={`${cl.id}_${rad.char}_${rad.ma}`}
                            type="button"
                            onClick={() => {
                              synth.playClick();
                              const pdfMatch =
                                activePdfChamber?.monument.displayChar === rad.char
                                  ? activePdfChamber.monument
                                  : activePdfChamber?.nodes.find(
                                      (n) => n.displayChar === rad.char || n.rawChar === rad.char
                                    );
                              setSelectedNode({
                                id: pdfMatch?.id || `${activeChamber.key}_card_${rad.char}`,
                                char: rad.char,
                                rawChar: pdfMatch?.rawChar || rad.char,
                                parentChar: rad.char,
                                ma: rad.ma,
                                isXiao: rad.isXiao,
                                rank: rad.rank,
                                tier:
                                  rad.rank === 1
                                    ? 'primary'
                                    : rad.rank <= 5
                                      ? 'rank2_5'
                                      : rad.rank <= 9
                                        ? 'rank6_9'
                                        : 'rest',
                                isVariant: false,
                                isPua: false,
                                path: pdfMatch?.path || '',
                                cx: pdfMatch?.cx ?? 50,
                                cy: pdfMatch?.cy ?? 50,
                                r: pdfMatch?.r ?? 6,
                                pinyin: '',
                                note: rad.note,
                              });
                            }}
                            className={`px-2.5 py-1.5 rounded-lg border flex items-center gap-2 transition-all cursor-pointer ${
                              isSel
                                ? inScript
                                  ? 'bg-[var(--dojo-surface-2)] border-[var(--dojo-ochre)]'
                                  : 'bg-[var(--dojo-surface-2)] border-[var(--dojo-ochre)]/70 opacity-85'
                                : inScript
                                  ? 'bg-[var(--dojo-surface-inset)] border-[var(--dojo-border)] hover:border-[var(--dojo-border-strong)]'
                                  : 'bg-[var(--dojo-surface-inset)] border-[var(--dojo-border)] opacity-35 hover:opacity-75'
                            }`}
                          >
                            <span
                              className="font-display text-base font-bold leading-none"
                              style={{
                                color:
                                  rad.rank === 1
                                    ? isWash
                                      ? '#12110F'
                                      : '#FFF8EB'
                                    : freqPalette[tier],
                              }}
                            >
                              <InlineGlyph char={rad.char} />
                            </span>
                            <div className="flex flex-col items-start leading-tight">
                              <span className="font-mono-tabular text-xs font-semibold">
                                <span style={{ color: chamberColor }}>{da}</span>
                                {sheng && <span className="text-[var(--dojo-text)]">{sheng}</span>}
                                <span className="text-[var(--dojo-ochre)]">{yun}</span>
                              </span>
                              <span className="text-[10px] text-[var(--dojo-text-muted)]">
                                #{rad.rank} ·{' '}
                                {!inScript
                                  ? t(radScript === 'trad' ? '僅繁 · 對照' : '僅簡 · 對照')
                                  : t(rad.note ? rad.note : rad.isXiao ? '小根' : '大根')}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quiet Coding Legend */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[var(--dojo-border)] text-xs text-[var(--dojo-text-sub)]">
              <span>
                {t('編碼色標：')}
                <span style={{ color: chamberColor }}>{t('大碼')}</span> ·{' '}
                <span className="text-[var(--dojo-text)]">{t('聲碼')}</span> ·{' '}
                <span className="text-[var(--dojo-ochre)]">{t('韻碼(AEIOU)')}</span>
              </span>
              <span className="text-[var(--dojo-text-muted)] truncate">
                {uiMnemonic(activeChamber.mnemonic, uiScript)}
              </span>
            </div>
          </div>
        </section>
      </div>

      {/* Floating Memory Palace Stroke-Association Hover Tooltip (viewport-clamped, non-blocking) */}
      {hoverPreviewData && (() => {
        const { key, rect, chamber, pdf, flow } = hoverPreviewData;
        const tooltipWidth = 344;
        const estimatedHeight = Math.min(340, 185 + flow.strokes.length * 28);
        const margin = 12;
        const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
        const vh = typeof window !== 'undefined' ? window.innerHeight : 800;

        const keyCenterX = rect.left + rect.width / 2;
        const left = Math.max(margin, Math.min(vw - tooltipWidth - margin, keyCenterX - tooltipWidth / 2));
        const showAbove = rect.bottom + 10 + estimatedHeight > vh - margin && rect.top - 10 - estimatedHeight >= margin;
        const top = showAbove
          ? Math.max(margin, rect.top - estimatedHeight - 10)
          : Math.min(vh - estimatedHeight - margin, rect.bottom + 10);
        const caretLeft = Math.max(20, Math.min(tooltipWidth - 20, keyCenterX - left));

        const mOv = overrides[pdf.monument.id];
        const buildMiniTransform = (cx: number, cy: number, ov?: { dx: number; dy: number; scale: number }) => {
          if (!ov) return undefined;
          if (Math.abs(ov.dx) <= 0.01 && Math.abs(ov.dy) <= 0.01 && Math.abs(ov.scale - 1) <= 0.01) {
            return undefined;
          }
          return `translate(${(cx + ov.dx).toFixed(2)} ${(cy + ov.dy).toFixed(2)}) scale(${ov.scale.toFixed(3)}) translate(${(-cx).toFixed(2)} ${(-cy).toFixed(2)})`;
        };

        return (
          <div
            key={`palace_tooltip_${key}`}
            role="tooltip"
            data-palace-tooltip={key}
            className="palace-tooltip-enter fixed z-50 pointer-events-none rounded-xl border p-3.5"
            style={{
              left: `${left}px`,
              top: `${top}px`,
              width: `${tooltipWidth}px`,
              backgroundColor: isWash ? 'rgba(250, 249, 245, 0.97)' : 'rgba(14, 19, 29, 0.96)',
              borderColor: isWash ? 'rgba(24, 24, 22, 0.20)' : 'rgba(242, 238, 230, 0.16)',
              boxShadow: isWash
                ? '0 14px 36px rgba(20, 20, 18, 0.14), 0 2px 6px rgba(20, 20, 18, 0.06)'
                : '0 16px 40px rgba(0, 0, 0, 0.56), 0 0 0 1px rgba(255, 255, 255, 0.04)',
              backdropFilter: 'blur(10px)',
            }}
          >
            {/* Subtle directional anchor caret */}
            <div
              aria-hidden="true"
              className="absolute w-2.5 h-2.5 rotate-45"
              style={{
                left: `${caretLeft - 5}px`,
                ...(showAbove ? { bottom: '-6px' } : { top: '-6px' }),
                backgroundColor: isWash ? '#FAF9F5' : '#0E131D',
                borderRight: showAbove
                  ? `1px solid ${isWash ? 'rgba(24, 24, 22, 0.20)' : 'rgba(242, 238, 230, 0.16)'}`
                  : 'none',
                borderBottom: showAbove
                  ? `1px solid ${isWash ? 'rgba(24, 24, 22, 0.20)' : 'rgba(242, 238, 230, 0.16)'}`
                  : 'none',
                borderLeft: !showAbove
                  ? `1px solid ${isWash ? 'rgba(24, 24, 22, 0.20)' : 'rgba(242, 238, 230, 0.16)'}`
                  : 'none',
                borderTop: !showAbove
                  ? `1px solid ${isWash ? 'rgba(24, 24, 22, 0.20)' : 'rgba(242, 238, 230, 0.16)'}`
                  : 'none',
              }}
            />

            {/* Header: Key + Monument + Stroke Formula */}
            <div className="flex items-center justify-between gap-2 pb-2 mb-2.5 border-b border-[var(--dojo-border)]">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-mono-tabular text-xs font-bold text-[var(--dojo-text-bright)]">
                  {key.toUpperCase()} {t('鍵')}
                </span>
                <span aria-hidden="true" className="text-[var(--dojo-text-muted)]">·</span>
                <span className="text-xs font-semibold text-[var(--dojo-text)] whitespace-nowrap">
                  {t('主根')}「<InlineGlyph char={chamber.primaryAnchor} />」
                </span>
              </div>
              <span className="text-[11px] font-medium text-[var(--dojo-text-sub)] truncate">
                {t(flow.schema.strokeFormula)}
              </span>
            </div>

            {/* Body: Mini Stroke-Association Spatial Map + Ordered Stroke Breakdown */}
            <div className="grid grid-cols-12 gap-3 items-center">
              <div
                className="col-span-6 aspect-square rounded-lg border flex items-center justify-center p-1"
                style={{
                  backgroundColor: isWash ? 'rgba(243, 241, 236, 0.92)' : 'rgba(9, 13, 20, 0.85)',
                  borderColor: isWash ? 'rgba(24, 24, 22, 0.10)' : 'rgba(242, 238, 230, 0.08)',
                }}
              >
                <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
                  {/* Monument silhouette */}
                  <g transform={buildMiniTransform(pdf.monument.cx, pdf.monument.cy, mOv)}>
                    <path
                      d={pdf.monument.path}
                      fill={isWash ? '#161614' : '#DCE8E3'}
                      fillOpacity={isWash ? 0.18 : 0.20}
                      shapeRendering="geometricPrecision"
                    />
                  </g>

                  {/* Calligraphic Memory Palace Stroke-Association Path */}
                  <PalaceStrokeFlowOverlay flow={flow} isWash={isWash} compact animate />

                  {/* Harmonized radical nodes along the strokes */}
                  {pdf.nodes.map((node) => {
                    const ov = overrides[node.id];
                    const fill = isWash
                      ? WASH_PDF_TIER_COLORS[node.tier]
                      : PDF_TIER_COLORS[node.tier];
                    return (
                      <g key={node.id} transform={buildMiniTransform(node.cx, node.cy, ov)}>
                        <path
                          d={node.path}
                          fill={fill}
                          fillOpacity={node.isVariant ? 0.72 : 0.92}
                          shapeRendering="geometricPrecision"
                        />
                      </g>
                    );
                  })}
                </svg>
              </div>

              <div className="col-span-6 flex flex-col gap-1.5 min-w-0">
                <div className="text-[10px] font-semibold tracking-wider text-[var(--dojo-text-muted)]">
                  {t('記憶宮殿 · 筆畫關聯路徑')}
                </div>
                <div className="flex flex-col gap-1.5">
                  {flow.strokes.map((st, idx) => {
                    const tone = getStrokeFlowTone(idx, isWash);
                    return (
                      <div key={st.index} className="flex items-start gap-1.5 min-w-0">
                        <span
                          className="mt-0.5 w-3.5 h-3.5 rounded-sm shrink-0 inline-flex items-center justify-center font-mono-tabular text-[9px] font-bold"
                          style={{
                            backgroundColor: isWash ? 'rgba(20, 20, 18, 0.08)' : 'rgba(255, 255, 255, 0.07)',
                            color: tone,
                          }}
                        >
                          {st.index}
                        </span>
                        <div className="flex flex-col min-w-0 leading-tight">
                          <span className="text-[11px] font-semibold text-[var(--dojo-text)] truncate">
                            {t(st.label)}
                          </span>
                          {st.sampleChars.length > 0 && (
                            <span className="text-[10px] text-[var(--dojo-text-sub)] truncate">
                              {st.sampleChars.join(' ')}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] leading-snug text-[var(--dojo-text-muted)] pt-1 border-t border-[var(--dojo-border)]">
                  {t(flow.schema.spatialLogic)}
                </p>
              </div>
            </div>

            {/* Footer: Concise mnemonic cue */}
            <div className="mt-2.5 pt-2 border-t border-[var(--dojo-border)] text-[10px] text-[var(--dojo-text-sub)] truncate">
              {uiMnemonic(chamber.mnemonic, uiScript)}
            </div>
          </div>
        );
      })()}
    </div>
  );
};

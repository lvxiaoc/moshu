import React, { useMemo } from 'react';
import { Cloud, CloudOff } from 'lucide-react';
import { LINGMING_CHAMBER_BY_KEY } from '../data/lingming';
import { LINGMING_SHORT_CODES } from '../data/lingmingShortCodes';
import { matchesScript, ScriptMode } from '../data/scriptFilter';
import { useThemeMode } from '../data/theme';
import { useUiText } from '../data/uiScript';
import { KeystrokeCloudPulse, useKeystrokeCloud } from '../data/keystrokeCloud';
import { synth } from '../audio/synth';
import { lingmingLexicon } from '../engine/lingmingIme';
import { StrokeCloudStage } from './StrokeCloudStage';
import { RadicalSymbol } from './ColorSplitGlyph';

interface KeystrokeCloudToggleProps {
  /** Compact header variant used inside sub-dojo toolbars */
  compact?: boolean;
  className?: string;
}

export const KeystrokeCloudToggle: React.FC<KeystrokeCloudToggleProps> = ({
  compact = false,
  className = '',
}) => {
  const t = useUiText();
  const { enabled, toggle } = useKeystrokeCloud();

  return (
    <button
      type="button"
      onClick={() => {
        synth.playClick();
        toggle();
      }}
      title={t(
        enabled
          ? '擊鍵字根雲圖：已開啟（僅輸入字根首碼／大碼時在目標重合位浮現記憶宮殿雲圖，聲碼與韻碼不干擾；點擊關閉）'
          : '擊鍵字根雲圖：已關閉（點擊開啟，擊鍵輸入字根首碼時於目標重合位顯影宮殿雲圖）'
      )}
      aria-pressed={enabled}
      className={`inline-flex items-center gap-1.5 rounded-lg border font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
        compact ? 'px-2 py-1.5 text-[11px]' : 'px-3 py-2 text-xs'
      } ${
        enabled
          ? 'bg-[var(--dojo-pine-wash)] border-[var(--dojo-pine)]/40 text-[var(--dojo-pine-text)]'
          : 'bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)] border-[var(--dojo-border)] text-[var(--dojo-text-muted)] hover:text-[var(--dojo-text)]'
      } ${className}`}
    >
      {enabled ? (
        <Cloud className="w-3.5 h-3.5 shrink-0" />
      ) : (
        <CloudOff className="w-3.5 h-3.5 shrink-0 opacity-75" />
      )}
      <span>
        {compact
          ? t(enabled ? '雲圖開' : '雲圖關')
          : t(enabled ? '擊鍵雲圖：開' : '擊鍵雲圖：關')}
      </span>
    </button>
  );
};

interface KeystrokePalaceCloudProps {
  pulse: KeystrokeCloudPulse | null;
  visible: boolean;
  /** Active composing key sequence so right-wing short-code hints converge cleanly alongside the Palace */
  buffer?: string;
  scriptMode?: ScriptMode;
  includeShortCodes?: boolean;
  /**
   * - 'coincident': 100% target-overlapping Memory Palace cloud (anchorOnActive=true, variant="echo")
   *   centered mathematically on the target glyph so gaze never drifts away from the character.
   * - 'flank': Compact side-mounted preview (kept only as an optional fallback).
   */
  placement?: 'coincident' | 'flank';
  /** Preset diameter or explicit px override (`boxPx`) */
  size?: 'sm' | 'md' | 'lg' | 'coincident-sm' | 'coincident' | 'coincident-lg';
  boxPx?: number;
  /** Adjustable background hint opacity (0.05..0.85); defaults to context cloudOpacity */
  opacityScale?: number;
  /** Adjustable background fusion strength (0.05..1.0); controls ink-bleed dispersion, paper-grain opacity noise & edge feathering */
  blendStrength?: number;
  /** Removes floating rim seal badge for ultra-clean background whisper hint */
  whisperMode?: boolean;
  /** Optional style overrides for exact coordinate centering (e.g. stage coordinates) */
  style?: React.CSSProperties;
  className?: string;
}

const SIZE_MAP: Record<NonNullable<KeystrokePalaceCloudProps['size']>, number> = {
  sm: 184,
  md: 224,
  lg: 256,
  'coincident-sm': 320,
  coincident: 400,
  'coincident-lg': 460,
};

// Right-wing clockwise crescent outside the Memory Palace core so short codes never collide with radicals
const SHORT_ARC_KEY1: ReadonlyArray<{ x: number; y: number }> = [
  { x: 80.5, y: 31.5 },
  { x: 85.0, y: 45.5 },
  { x: 82.5, y: 59.5 },
  { x: 75.5, y: 71.5 },
];

// Converges gently inward toward the caret focus (50, 50) when narrowed on Key 2+
const SHORT_ARC_CONVERGE: ReadonlyArray<{ x: number; y: number }> = [
  { x: 64.5, y: 43.5 },
  { x: 72.5, y: 54.0 },
  { x: 74.5, y: 65.5 },
  { x: 68.5, y: 75.0 },
];

export const KeystrokePalaceCloud: React.FC<KeystrokePalaceCloudProps> = ({
  pulse,
  visible,
  buffer = '',
  scriptMode = 'both',
  includeShortCodes,
  placement = 'coincident',
  size = 'coincident',
  boxPx,
  opacityScale,
  blendStrength,
  whisperMode = true,
  style,
  className = '',
}) => {
  const t = useUiText();
  const isWash = useThemeMode() === 'wash';
  const {
    opacity: ctxOpacity,
    blend: ctxBlend,
    includeShortCodes: ctxIncludeShortCodes,
  } = useKeystrokeCloud();
  const effectiveOpacity = opacityScale ?? ctxOpacity;
  const effectiveBlend = blendStrength ?? ctxBlend;
  const showShortCodes = includeShortCodes ?? ctxIncludeShortCodes;

  const shortWingItems = useMemo(() => {
    const buf = buffer.trim().toLowerCase();
    if (!showShortCodes || !visible || !buf || /[aeiou]$/.test(buf)) {
      return [];
    }
    const candidates = LINGMING_SHORT_CODES.filter(
      (sc) =>
        sc.shortCode.startsWith(buf) &&
        sc.shortCode.length > buf.length &&
        sc.char !== pulse?.activeChar
    ).sort((a, b) => {
      const aScript = matchesScript(
        lingmingLexicon.byChar.get(a.char)?.script ?? 'common',
        scriptMode
      )
        ? 1
        : 0;
      const bScript = matchesScript(
        lingmingLexicon.byChar.get(b.char)?.script ?? 'common',
        scriptMode
      )
        ? 1
        : 0;
      if (aScript !== bScript) return bScript - aScript;
      if (a.level !== b.level) return a.level - b.level;
      if (a.isCore50 !== b.isCore50) return a.isCore50 ? -1 : 1;
      return 0;
    });

    const slots = buf.length === 1 ? SHORT_ARC_KEY1 : SHORT_ARC_CONVERGE;
    const picked = candidates.slice(0, slots.length);
    return picked.map((sc, idx) => {
      const pt = slots[idx];
      const weight = Math.max(0.32, 1 - idx * 0.18);
      return {
        char: sc.char,
        x: pt.x,
        y: pt.y,
        weight,
        isPrimary: idx === 0 && buf.length >= 2,
      };
    });
  }, [buffer, showShortCodes, visible, pulse?.activeChar, scriptMode]);

  if (!pulse) return null;

  const chamber = LINGMING_CHAMBER_BY_KEY[pulse.chamberKey];
  if (!chamber) return null;

  const isCoincident = placement === 'coincident';
  const px = boxPx ?? SIZE_MAP[size];
  const isMiss = pulse.status === 'miss';
  const keyUpper = pulse.chamberKey.toUpperCase();

  if (isCoincident) {
    const seed = pulse.noiseSeed || ((pulse.tick * 73) % 977) + 1;
    const filterId = `ink-cloud-bleed-${pulse.chamberKey}-${pulse.tick}`;
    const macroFreq = (0.024 + (seed % 19) * 0.0014).toFixed(4);
    const grainFreq = (0.24 + (seed % 13) * 0.014).toFixed(3);
    const dispScale = (1.0 + effectiveBlend * 5.8).toFixed(2);
    const blurStd = (0.22 + effectiveBlend * 1.55).toFixed(2);
    const haloSlope = (0.14 + effectiveBlend * 0.24).toFixed(2);
    // Dappled alpha matrix modulates ink density cleanly inside [grainBase .. 1.0]
    const grainGain = (0.16 + effectiveBlend * 0.22).toFixed(2);
    const grainBase = (0.72 - effectiveBlend * 0.30).toFixed(2);

    // StrokeCloudStage(variant="echo") internally renders radicals at 0.14..0.44 alpha;
    // scale the container alpha so default ~22% reads calmly with Huangting-Dojo legibility.
    const stageAlpha = Math.min(0.95, Math.max(0.14, effectiveOpacity * 2.25 * (1 - effectiveBlend * 0.16)));

    // Asymmetric directional field:
    // Left of caret (0..44%) gently dissolves so already-written text stays crisp and unobstructed;
    // Focal overlap point (50%, 50%) and right-extending Palace + short-code wing stay vivid.
    const leftEdgeMinAlpha = (0.14 - effectiveBlend * 0.06).toFixed(2);
    const leftFadeMask = `linear-gradient(90deg, rgba(0,0,0,${leftEdgeMinAlpha}) 0%, rgba(0,0,0,0.18) 28%, rgba(0,0,0,0.52) 42%, rgba(0,0,0,0.96) 47.5%, rgba(0,0,0,1) 52%, rgba(0,0,0,1) 100%)`;

    const radialCoreStop = Math.round(44 - effectiveBlend * 10);
    const radialMidStop = Math.round(70 - effectiveBlend * 8);
    const radialOuterStop = Math.round(92 - effectiveBlend * 4);
    const radialMask = `radial-gradient(ellipse 56% 52% at 54% 50%, rgba(0,0,0,1) ${radialCoreStop}%, rgba(0,0,0,0.56) ${radialMidStop}%, rgba(0,0,0,0) ${radialOuterStop}%)`;

    const shortArcPath =
      shortWingItems.length >= 2
        ? `M 54 50 Q ${((54 + shortWingItems[0].x) / 2).toFixed(1)} ${(
            (50 + shortWingItems[0].y) / 2 - 4
          ).toFixed(1)} ${shortWingItems
            .map((item) => `${item.x.toFixed(1)} ${item.y.toFixed(1)}`)
            .join(' L ')}`
        : shortWingItems.length === 1
          ? `M 54 50 Q 60 ${(50 + shortWingItems[0].y) / 2 - 2} ${shortWingItems[0].x.toFixed(1)} ${shortWingItems[0].y.toFixed(1)}`
          : '';

    return (
      <div
        aria-hidden="true"
        className={`pointer-events-none select-none ${className}`}
        style={{
          width: `${px}px`,
          height: `${px}px`,
          ...style,
        }}
      >
        <svg
          aria-hidden="true"
          width="0"
          height="0"
          style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}
        >
          <defs>
            <filter
              id={filterId}
              x="-14%"
              y="-14%"
              width="128%"
              height="128%"
              colorInterpolationFilters="sRGB"
            >
              <feTurbulence
                type="fractalNoise"
                baseFrequency={macroFreq}
                numOctaves={3}
                seed={seed}
                result="macroNoise"
              />
              <feDisplacementMap
                in="SourceGraphic"
                in2="macroNoise"
                scale={dispScale}
                xChannelSelector="R"
                yChannelSelector="G"
                result="bleedEdge"
              />
              <feTurbulence
                type="fractalNoise"
                baseFrequency={grainFreq}
                numOctaves={2}
                seed={((seed * 17) % 991) + 1}
                result="paperGrain"
              />
              <feColorMatrix
                in="paperGrain"
                type="matrix"
                values={`0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  ${grainGain} ${grainGain} ${grainGain} 0 ${grainBase}`}
                result="alphaGrain"
              />
              <feComposite
                in="bleedEdge"
                in2="alphaGrain"
                operator="in"
                result="dappledInk"
              />
              <feGaussianBlur
                in="dappledInk"
                stdDeviation={blurStd}
                result="capillaryBloom"
              />
              <feComponentTransfer in="capillaryBloom" result="softHalo">
                <feFuncA type="linear" slope={haloSlope} />
              </feComponentTransfer>
              <feMerge>
                <feMergeNode in="softHalo" />
                <feMergeNode in="dappledInk" />
              </feMerge>
            </filter>
          </defs>
        </svg>

        {/* Outer directional mask clears the left wing over already-written characters */}
        <div
          className="relative w-full h-full"
          style={{
            WebkitMaskImage: leftFadeMask,
            maskImage: leftFadeMask,
          }}
        >
          <div
            className="relative w-full h-full flex items-center justify-center rounded-full"
            style={{
              opacity: visible ? stageAlpha : 0,
              transform: visible ? 'scale(1)' : 'scale(0.96)',
              mixBlendMode: isWash ? 'multiply' : effectiveBlend >= 0.35 ? 'screen' : 'normal',
              WebkitMaskImage: radialMask,
              maskImage: radialMask,
              transition: visible
                ? 'opacity 200ms cubic-bezier(0.16, 1, 0.3, 1), transform 240ms cubic-bezier(0.16, 1, 0.3, 1)'
                : 'opacity 420ms ease-out, transform 420ms ease-out',
              background: isWash
                ? `radial-gradient(circle at 52% 50%, rgba(28,28,26,${(0.025 + effectiveBlend * 0.025).toFixed(3)}) 0%, rgba(243,241,236,0) 64%)`
                : `radial-gradient(circle at 52% 50%, rgba(160,175,198,${(0.02 + effectiveBlend * 0.022).toFixed(3)}) 0%, rgba(11,15,23,0) 64%)`,
            }}
          >
            <div className="w-full h-full relative" style={{ filter: `url(#${filterId})` }}>
              <StrokeCloudStage
                key={`${pulse.chamberKey}_${pulse.tick}`}
                chamberKey={pulse.chamberKey}
                activeChar={pulse.activeChar}
                variant="echo"
                scaffoldLevel={whisperMode ? 2 : 1}
                anchorOnActive
                scriptMode={scriptMode}
              />

              {/* Harmonious clockwise right-wing short-code crescent (zero collision with Palace radicals) */}
              {shortWingItems.length > 0 && (
                <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
                  {shortArcPath && (
                    <svg
                      viewBox="0 0 100 100"
                      className="absolute inset-0 w-full h-full overflow-visible"
                    >
                      <path
                        d={shortArcPath}
                        fill="none"
                        stroke={isWash ? '#7C4E1D' : '#D8B16A'}
                        strokeWidth="0.36"
                        strokeOpacity={0.24}
                        strokeLinecap="round"
                      />
                    </svg>
                  )}

                  {shortWingItems.map((sc, idx) => {
                    const sizePx = Math.round((isCoincident ? px * 0.044 : 18) * (0.8 + sc.weight * 0.28));
                    return (
                      <span
                        key={`sc_${sc.char}`}
                        className="absolute font-display leading-none select-none"
                        style={{
                          left: `${sc.x}%`,
                          top: `${sc.y}%`,
                          transform: 'translate(-50%, -50%)',
                          fontSize: `${Math.max(14, Math.min(23, sizePx))}px`,
                          color: isWash
                            ? idx === 0
                              ? '#5E3810'
                              : '#8A6438'
                            : idx === 0
                              ? '#E8C988'
                              : '#B29664',
                          opacity: sc.isPrimary ? 0.78 : Math.max(0.28, sc.weight * 0.56),
                          transition:
                            'left 260ms cubic-bezier(0.22, 1, 0.36, 1), top 260ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms ease',
                        }}
                      >
                        {sc.char}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            {!whisperMode && (
              <div
                className={`absolute top-2.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] whitespace-nowrap ${
                  isMiss
                    ? 'text-[var(--dojo-crimson-text)]'
                    : 'text-[var(--dojo-text-muted)]'
                }`}
              >
                <span className="font-mono-tabular font-bold text-[var(--dojo-ochre)]">
                  {keyUpper}
                </span>
                <span className="font-display font-semibold">
                  {chamber.primaryAnchor}
                  {t('宮')}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none select-none flex flex-col items-center ${className}`}
      style={{
        opacity: visible ? 0.94 : 0,
        transform: visible ? 'scale(1) translateY(0px)' : 'scale(0.93) translateY(6px)',
        filter: isWash ? (visible ? 'blur(0px)' : 'blur(4px)') : 'none',
        transition: visible
          ? 'opacity 190ms cubic-bezier(0.16, 1, 0.3, 1), transform 220ms cubic-bezier(0.16, 1, 0.3, 1), filter 220ms ease-out'
          : 'opacity 360ms ease-out, transform 360ms ease-out, filter 300ms ease-out',
        ...style,
      }}
    >
      <div
        className="relative flex items-center justify-center rounded-full"
        style={{
          width: `${px}px`,
          height: `${px}px`,
          background: isWash
            ? isMiss
              ? 'radial-gradient(circle at 50% 50%, rgba(184,59,42,0.08) 0%, rgba(243,241,236,0.72) 54%, rgba(243,241,236,0) 76%)'
              : 'radial-gradient(circle at 50% 50%, rgba(243,241,236,0.88) 0%, rgba(243,241,236,0.68) 54%, rgba(243,241,236,0) 76%)'
            : isMiss
              ? 'radial-gradient(circle at 50% 50%, rgba(201,62,45,0.12) 0%, rgba(11,15,23,0.76) 54%, rgba(11,15,23,0) 76%)'
              : 'radial-gradient(circle at 50% 50%, rgba(17,24,38,0.84) 0%, rgba(11,15,23,0.62) 54%, rgba(11,15,23,0) 76%)',
        }}
      >
        <div className="w-[88%] h-[88%]">
          <StrokeCloudStage
            key={`${pulse.chamberKey}_${pulse.tick}`}
            chamberKey={pulse.chamberKey}
            activeChar={pulse.activeChar}
            variant="palace"
            anchorOnActive={false}
            scriptMode={scriptMode}
          />
        </div>
      </div>

      <div
        className={`-mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] backdrop-blur-xs ${
          isMiss
            ? isWash
              ? 'bg-[#FDF6F5]/92 border-[#B83B2A]/35 text-[#B83B2A]'
              : 'bg-[#251318]/90 border-[#E25A48]/40 text-[#F28B7D]'
            : isWash
              ? 'bg-[#F8F6F0]/90 border-[#141413]/15 text-[#2E2E2A]'
              : 'bg-[#121927]/88 border-[#F2EEE6]/14 text-[#D6DCE8]'
        }`}
      >
        {isMiss && pulse.pressedKey && (
          <>
            <span className="font-mono-tabular opacity-75">
              {t('誤')} {pulse.pressedKey.toUpperCase()}
            </span>
            <span aria-hidden="true" className="opacity-45">→</span>
          </>
        )}
        <span className="font-mono-tabular font-bold text-[var(--dojo-ochre)]">
          {keyUpper}
        </span>
        <span className="font-display font-semibold">
          {chamber.primaryAnchor}
          {t('宮')}
        </span>
        {pulse.activeChar && pulse.activeChar !== chamber.primaryAnchor && (
          <>
            <span aria-hidden="true" className="opacity-35">·</span>
            <RadicalSymbol
              glyph={pulse.activeChar}
              className="font-display font-bold text-xs text-[var(--dojo-text-bright)]"
            />
          </>
        )}
      </div>
    </div>
  );
};

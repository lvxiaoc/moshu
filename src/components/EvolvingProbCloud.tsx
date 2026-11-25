import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useKeystrokeCloud } from '../data/keystrokeCloud';
import { PALACE_PDF_CHAMBERS } from '../data/palacePdfData';
import { ScriptMode } from '../data/scriptFilter';
import { useThemeMode } from '../data/theme';
import {
  buildCommittedCloudNode,
  buildEvolvingCloudNodes,
  CloudBranch,
  EvolvingCloudNode,
  resolveLeadStructuralGlyph,
} from '../engine/evolvingCloud';
import { StrokeCloudStage } from './StrokeCloudStage';

interface EvolvingProbCloudProps {
  buffer: string;
  committedChar: string | null;
  committedTick: number;
  glyphPx?: number;
  scriptMode?: ScriptMode;
  includeShortCodes?: boolean;
  opacityScale?: number;
  blendStrength?: number;
  style?: React.CSSProperties;
  className?: string;
}

type ItemPhase = 'entering' | 'active' | 'exiting' | 'exhaling';

interface PooledNode {
  node: EvolvingCloudNode;
  phase: ItemPhase;
  exitedAt?: number;
}

function isPuaGlyph(glyph: string): boolean {
  if (!glyph) return false;
  const cp = glyph.codePointAt(0) ?? 0;
  return (cp >= 0xe000 && cp <= 0xf8ff) || (cp >= 0xf0000 && cp <= 0x10ffff);
}

function lerpRgb(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): string {
  const k = Math.max(0, Math.min(1, t));
  const r = Math.round(a[0] + (b[0] - a[0]) * k);
  const g = Math.round(a[1] + (b[1] - a[1]) * k);
  const bl = Math.round(a[2] + (b[2] - a[2]) * k);
  return `rgb(${r}, ${g}, ${bl})`;
}

/**
 * Chromatic aerial perspective (`色度漸退`):
 * Near foreground items hold crisp warm/ink saturation; distant depth ranks desaturate
 * and shift cool/misty into the surrounding night obsidian or Xuan paper backdrop.
 */
function getDepthChromaticTone(
  probability: number,
  branch: CloudBranch,
  isWash: boolean
): string {
  const depth = 1 - Math.max(0, Math.min(1, probability));

  if (branch === 'lowerRight') {
    if (isWash) {
      // 宣紙水墨簡碼景深：近景焦赭 (#783812) -> 中景茶褐 (#8E6648) -> 遠景紙灰 (#BEBBAE)
      return depth < 0.45
        ? lerpRgb([120, 56, 18], [142, 102, 72], depth / 0.45)
        : lerpRgb([142, 102, 72], [190, 187, 174], (depth - 0.45) / 0.55);
    }
    // 玄墨簡碼景深：近景亮金 (#F5CC7A) -> 中景淡赭 (#B89E72) -> 遠景冷靛灰 (#54627A)
    return depth < 0.45
      ? lerpRgb([245, 204, 122], [184, 158, 114], depth / 0.45)
      : lerpRgb([184, 158, 114], [84, 98, 122], (depth - 0.45) / 0.55);
  }

  if (isWash) {
    // 宣紙水墨結構投影：近景焦墨 (#141413) -> 中景重墨 (#54544E) -> 遠景清霧 (#98978F)
    return depth < 0.5
      ? lerpRgb([20, 20, 19], [84, 84, 78], depth / 0.5)
      : lerpRgb([84, 84, 78], [152, 151, 143], (depth - 0.5) / 0.5);
  }
  // 玄墨結構投影：近景月白 (#ECE6D6) -> 中景青銀 (#AEBACB) -> 遠景夜藍灰 (#60708A)
  return depth < 0.5
    ? lerpRgb([236, 230, 214], [174, 186, 203], depth / 0.5)
    : lerpRgb([174, 186, 203], [96, 112, 138], (depth - 0.5) / 0.5);
}

const EvolvingGlyphLabel: React.FC<{
  node: EvolvingCloudNode;
  tone: string;
  nearGlow?: string;
}> = React.memo(({ node, tone, nearGlow }) => {
  if (isPuaGlyph(node.glyph) && node.pdfVector?.path) {
    const { path, cx, cy, r } = node.pdfVector;
    const half = Math.max(r * 1.24, 3.2);
    const vb = `${(cx - half).toFixed(2)} ${(cy - half).toFixed(2)} ${(half * 2).toFixed(2)} ${(half * 2).toFixed(2)}`;
    return (
      <svg
        viewBox={vb}
        style={{
          width: `${node.fontPx.toFixed(1)}px`,
          height: `${node.fontPx.toFixed(1)}px`,
          transition:
            'width 260ms cubic-bezier(0.22, 1, 0.36, 1), height 260ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
        className="overflow-visible"
        aria-hidden="true"
      >
        <path d={path} fill={tone} shapeRendering="geometricPrecision" />
      </svg>
    );
  }

  return (
    <span
      aria-hidden="true"
      className="select-none whitespace-nowrap"
      style={{
        fontFamily: 'var(--font-display)',
        fontSize: `${node.fontPx.toFixed(1)}px`,
        lineHeight: 1,
        fontWeight: 400,
        letterSpacing: '0.02em',
        color: tone,
        textShadow: nearGlow,
        transition: 'font-size 260ms cubic-bezier(0.22, 1, 0.36, 1), color 240ms ease',
      }}
    >
      {node.glyph}
    </span>
  );
});

EvolvingGlyphLabel.displayName = 'EvolvingGlyphLabel';

export const EvolvingProbCloud: React.FC<EvolvingProbCloudProps> = ({
  buffer,
  committedChar,
  committedTick,
  glyphPx = 32,
  scriptMode = 'both',
  includeShortCodes: propIncludeShortCodes,
  opacityScale,
  blendStrength,
  style,
  className = '',
}) => {
  const isWash = useThemeMode() === 'wash';
  const {
    opacity: ctxOpacity,
    blend: ctxBlend,
    includeShortCodes: ctxIncludeShortCodes,
  } = useKeystrokeCloud();
  const effectiveOpacity = opacityScale ?? ctxOpacity;
  const effectiveBlend = blendStrength ?? ctxBlend;
  const useShortCodes = propIncludeShortCodes ?? ctxIncludeShortCodes;

  const uid = useId().replace(/:/g, '');
  const filterId = `evolving-depth-ink-${uid}`;

  const seedRef = useRef<number>(Math.floor(Math.random() * 997) + 1);
  const prevBufLenRef = useRef<number>(0);
  if (buffer.length === 1 && prevBufLenRef.current === 0) {
    seedRef.current = ((seedRef.current * 73 + 19) % 991) + 1;
  }
  prevBufLenRef.current = buffer.length;

  const normalizedBuf = buffer.trim().toLowerCase();
  const key1ChamberKey =
    normalizedBuf.length === 1 && PALACE_PDF_CHAMBERS[normalizedBuf]
      ? normalizedBuf
      : null;

  // Keep the Key-1 original palace cloud alive briefly during exit fade so Key 1 -> Key 2 dissolves seamlessly
  const [palaceCloudState, setPalaceCloudState] = useState<{
    chamberKey: string;
    activeChar: string | null;
    visible: boolean;
  } | null>(null);
  const palaceClearTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (palaceClearTimerRef.current !== null) {
      window.clearTimeout(palaceClearTimerRef.current);
      palaceClearTimerRef.current = null;
    }
    if (key1ChamberKey) {
      const lead = resolveLeadStructuralGlyph(key1ChamberKey, scriptMode, 0);
      setPalaceCloudState({
        chamberKey: key1ChamberKey,
        activeChar: lead,
        visible: true,
      });
    } else {
      setPalaceCloudState((prev) => (prev ? { ...prev, visible: false } : null));
      palaceClearTimerRef.current = window.setTimeout(() => {
        setPalaceCloudState(null);
      }, 280);
    }
    return () => {
      if (palaceClearTimerRef.current !== null) {
        window.clearTimeout(palaceClearTimerRef.current);
      }
    };
  }, [key1ChamberKey, scriptMode]);

  const targetNodes = useMemo(
    () => buildEvolvingCloudNodes(buffer, scriptMode, useShortCodes, glyphPx),
    [buffer, scriptMode, useShortCodes, glyphPx]
  );

  const [pool, setPool] = useState<PooledNode[]>([]);
  const lastCommitTickRef = useRef<number>(committedTick);
  const rafRef = useRef<number | null>(null);
  const pruneTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const isFreshCommit =
      !buffer &&
      Boolean(committedChar) &&
      committedTick !== lastCommitTickRef.current;
    if (isFreshCommit) {
      lastCommitTickRef.current = committedTick;
    }

    const now = performance.now();

    setPool((prev) => {
      const nextMap = new Map<string, PooledNode>();
      const targetIds = new Set(targetNodes.map((n) => n.id));
      const prevMap = new Map(prev.map((item) => [item.node.id, item]));

      for (const node of targetNodes) {
        const existing = prevMap.get(node.id);
        if (existing) {
          nextMap.set(node.id, {
            node,
            phase: existing.phase === 'entering' ? 'entering' : 'active',
          });
        } else {
          nextMap.set(node.id, {
            node,
            phase: 'entering',
          });
        }
      }

      let committedTargetId: string | null = null;
      if (isFreshCommit && committedChar) {
        const upperId = `u:${committedChar}`;
        const shortId = `sc:${committedChar}`;
        const pickedExisting = prevMap.has(upperId)
          ? prevMap.get(upperId)
          : prevMap.has(shortId)
            ? prevMap.get(shortId)
            : undefined;
        committedTargetId = pickedExisting ? pickedExisting.node.id : upperId;

        const baseNode = buildCommittedCloudNode(committedChar, glyphPx);
        const exhaleNode = baseNode
          ? {
              ...baseNode,
              id: committedTargetId,
              branch: pickedExisting?.node.branch ?? 'upperRight',
            }
          : pickedExisting?.node;

        if (exhaleNode) {
          nextMap.set(committedTargetId, {
            node: exhaleNode,
            phase: 'exhaling',
            exitedAt: now,
          });
        }
      }

      for (const item of prev) {
        if (targetIds.has(item.node.id)) continue;
        if (committedTargetId && item.node.id === committedTargetId) continue;

        if (item.phase === 'exiting' || item.phase === 'exhaling') {
          if (item.exitedAt && now - item.exitedAt < 380) {
            nextMap.set(item.node.id, item);
          }
        } else {
          nextMap.set(item.node.id, {
            node: item.node,
            phase: 'exiting',
            exitedAt: now,
          });
        }
      }

      return Array.from(nextMap.values());
    });

    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = window.requestAnimationFrame(() => {
        setPool((prev) => {
          let changed = false;
          const updated = prev.map((item) => {
            if (item.phase === 'entering') {
              changed = true;
              return { ...item, phase: 'active' as const };
            }
            return item;
          });
          return changed ? updated : prev;
        });
      });
    });

    if (pruneTimerRef.current !== null) {
      window.clearTimeout(pruneTimerRef.current);
    }
    pruneTimerRef.current = window.setTimeout(() => {
      const cutoff = performance.now();
      setPool((prev) =>
        prev.filter((item) => {
          if (item.phase === 'exiting' || item.phase === 'exhaling') {
            return Boolean(item.exitedAt && cutoff - item.exitedAt < 350);
          }
          return true;
        })
      );
    }, 370);
  }, [targetNodes, buffer, committedChar, committedTick, glyphPx]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
      if (pruneTimerRef.current !== null) window.clearTimeout(pruneTimerRef.current);
    };
  }, []);

  if (pool.length === 0 && !palaceCloudState) return null;

  const seed = seedRef.current;
  const macroFreq = (0.025 + (seed % 17) * 0.0014).toFixed(4);
  const grainFreq = (0.24 + (seed % 13) * 0.014).toFixed(3);
  const dispScale = (0.5 + effectiveBlend * 2.1).toFixed(2);
  const blurStd = (0.12 + effectiveBlend * 0.6).toFixed(2);
  const haloSlope = (0.12 + effectiveBlend * 0.18).toFixed(2);
  const grainGain = (0.1 + effectiveBlend * 0.15).toFixed(2);
  const grainBase = (0.83 - effectiveBlend * 0.22).toFixed(2);

  const rayMasterOpacity = Math.min(0.96, effectiveOpacity * 1.48 * (1 - effectiveBlend * 0.1));
  // Compact upper-right Memory Palace cloud footprint: sub-radicals stay well under 1x target glyph size
  const key1PalaceBoxPx = Math.round(glyphPx * 4.1);
  const key1PalaceCenterX = Math.round(glyphPx * 2.35);
  const key1PalaceCenterY = -Math.round(glyphPx * 1.95);
  const key1PalaceAlpha = Math.min(0.95, Math.max(0.22, effectiveOpacity * 2.1 * (1 - effectiveBlend * 0.14)));

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none select-none w-0 h-0 overflow-visible ${className}`}
      style={style}
    >
      {/* Ink-bleed filter definition anchored outside 0x0 layer and applied per-glyph wrapper */}
      <svg
        aria-hidden="true"
        width="0"
        height="0"
        style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}
      >
        <defs>
          <filter
            id={filterId}
            x="-45%"
            y="-45%"
            width="190%"
            height="190%"
            colorInterpolationFilters="sRGB"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency={macroFreq}
              numOctaves={2}
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

      {/* Upper-Right Compact Original Key Memory Palace Cloud on Key 1 */}
      {palaceCloudState && (
        <div
          className="absolute"
          style={{
            left: `${key1PalaceCenterX}px`,
            top: `${key1PalaceCenterY}px`,
            width: `${key1PalaceBoxPx}px`,
            height: `${key1PalaceBoxPx}px`,
            opacity: palaceCloudState.visible ? key1PalaceAlpha : 0,
            transform: palaceCloudState.visible
              ? 'translate(-50%, -50%) scale(1)'
              : 'translate(-50%, -50%) scale(0.92)',
            mixBlendMode: isWash
              ? 'multiply'
              : effectiveBlend >= 0.35
                ? 'screen'
                : 'normal',
            WebkitMaskImage:
              'radial-gradient(circle at 50% 50%, rgba(0,0,0,1) 52%, rgba(0,0,0,0.72) 76%, rgba(0,0,0,0) 98%)',
            maskImage:
              'radial-gradient(circle at 50% 50%, rgba(0,0,0,1) 52%, rgba(0,0,0,0.72) 76%, rgba(0,0,0,0) 98%)',
            transition: palaceCloudState.visible
              ? 'opacity 180ms cubic-bezier(0.16, 1, 0.3, 1), transform 220ms cubic-bezier(0.16, 1, 0.3, 1)'
              : 'opacity 250ms ease-out, transform 250ms ease-out',
            zIndex: 18,
          }}
        >
          <div
            className="w-full h-full"
            style={
              effectiveBlend >= 0.14
                ? { filter: `url(#${filterId})` }
                : undefined
            }
          >
            <StrokeCloudStage
              key={`key1_palace_${palaceCloudState.chamberKey}`}
              chamberKey={palaceCloudState.chamberKey}
              activeChar={palaceCloudState.activeChar}
              variant="echo"
              scaffoldLevel={1}
              anchorOnActive={false}
              scriptMode={scriptMode}
            />
          </div>
        </div>
      )}

      {/* 3D Depth-of-Field & Chromatic Recession Nodes (Upper-Right Key 2+ & Lower-Right Short Codes) */}
      {pool.map(({ node, phase }) => {
        const tone = getDepthChromaticTone(node.probability, node.branch, isWash);

        let phaseScale = 1;
        let phaseOpacity = node.curveOpacity * rayMasterOpacity;
        let phaseBlur = node.curveBlurPx;

        if (phase === 'entering') {
          phaseScale = 0.84;
          phaseOpacity = 0;
          phaseBlur = node.curveBlurPx + 1.8;
        } else if (phase === 'exiting') {
          phaseScale = 0.78;
          phaseOpacity = 0;
          phaseBlur = node.curveBlurPx + 2.2;
        } else if (phase === 'exhaling') {
          phaseScale = 1.08;
          phaseOpacity = 0;
          phaseBlur = 1.5;
        }

        // Subtle focal plane glow for rank-0 so foreground vs distant background depth separates crisply
        const nearGlow =
          node.rank === 0 && phase === 'active'
            ? node.branch === 'lowerRight'
              ? isWash
                ? '0 0 10px rgba(120, 56, 18, 0.10)'
                : '0 0 14px rgba(245, 204, 122, 0.22)'
              : isWash
                ? '0 0 8px rgba(20, 20, 19, 0.08)'
                : '0 0 12px rgba(236, 230, 214, 0.16)'
            : undefined;

        const applyBleedFilter =
          effectiveBlend >= 0.16 && (node.rank > 0 || effectiveBlend >= 0.7);

        return (
          <div
            key={node.id}
            className="absolute flex items-center justify-center"
            style={{
              left: `${node.dx}px`,
              top: `${node.dy}px`,
              transform: `translate(-50%, -50%) scale(${phaseScale})`,
              opacity: phaseOpacity,
              mixBlendMode: isWash
                ? 'multiply'
                : effectiveBlend >= 0.35
                  ? 'screen'
                  : 'normal',
              filter: phaseBlur > 0.02 ? `blur(${phaseBlur.toFixed(2)}px)` : undefined,
              zIndex: 25 - node.rank,
              transition:
                phase === 'exhaling'
                  ? 'left 260ms cubic-bezier(0.16, 1, 0.3, 1), top 260ms cubic-bezier(0.16, 1, 0.3, 1), transform 300ms cubic-bezier(0.16, 1, 0.3, 1), opacity 280ms ease-out, filter 280ms ease-out'
                  : 'left 260ms cubic-bezier(0.22, 1, 0.36, 1), top 260ms cubic-bezier(0.22, 1, 0.36, 1), transform 260ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms ease-out, filter 220ms ease-out',
            }}
          >
            <div
              className="flex items-center justify-center"
              style={
                applyBleedFilter
                  ? { filter: `url(#${filterId})` }
                  : undefined
              }
            >
              <EvolvingGlyphLabel node={node} tone={tone} nearGlow={nearGlow} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

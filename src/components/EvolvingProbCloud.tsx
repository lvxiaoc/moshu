import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useKeystrokeCloud } from '../data/keystrokeCloud';
import { ScriptMode } from '../data/scriptFilter';
import { useThemeMode } from '../data/theme';
import {
  buildCommittedCloudNode,
  buildEvolvingCloudNodes,
  CloudBranch,
  EvolvingCloudNode,
} from '../engine/evolvingCloud';

interface EvolvingProbCloudProps {
  buffer: string;
  committedChar: string | null;
  committedTick: number;
  scriptMode?: ScriptMode;
  includeShortCodes?: boolean;
  boxPx?: number;
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

function getSumiTone(probability: number, branch: CloudBranch, isWash: boolean): string {
  const p = Math.max(0, Math.min(1, probability));
  if (branch === 'shortcode') {
    if (isWash) {
      // 宣紙水墨簡碼：焦赭 (#5C3B14) -> 淡赭 (#9B7A4E)
      const r = Math.round(155 - p * 63);
      const g = Math.round(122 - p * 63);
      const b = Math.round(78 - p * 58);
      return `rgb(${r}, ${g}, ${b})`;
    }
    // 玄墨簡碼：柔金帛色 (#D8B878) -> 煙赭 (#9E875E)
    const r = Math.round(158 + p * 58);
    const g = Math.round(135 + p * 49);
    const b = Math.round(94 + p * 26);
    return `rgb(${r}, ${g}, ${b})`;
  }

  if (isWash) {
    // 宣紙水墨字根：焦墨 (#141413) -> 淡煙 (#7A7A72)
    const v = Math.round(122 - p * 102);
    return `rgb(${v}, ${v}, ${Math.max(18, v - 3)})`;
  }
  // 玄墨字根：月白 (#EDE7D8) -> 煙青銀灰 (#8896AA)
  const r = Math.round(136 + p * 101);
  const g = Math.round(150 + p * 81);
  const b = Math.round(170 + p * 46);
  return `rgb(${r}, ${g}, ${b})`;
}

function buildBranchFilamentPath(
  apex: EvolvingCloudNode | undefined,
  branchNodes: EvolvingCloudNode[]
): string {
  if (!apex || branchNodes.length === 0) return '';
  const pts = [apex, ...branchNodes];
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const mx = ((prev.x + curr.x) / 2).toFixed(1);
    const my = ((prev.y + curr.y) / 2).toFixed(1);
    if (i === 1) {
      d += ` Q ${prev.x.toFixed(1)} ${prev.y.toFixed(1)} ${mx} ${my}`;
    } else {
      d += ` T ${mx} ${my}`;
    }
  }
  const last = pts[pts.length - 1];
  d += ` L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
  return d;
}

const EvolvingGlyphLabel: React.FC<{
  node: EvolvingCloudNode;
  fontPx: number;
  tone: string;
}> = React.memo(({ node, fontPx, tone }) => {
  if (isPuaGlyph(node.glyph) && node.pdfVector?.path) {
    const { path, cx, cy, r } = node.pdfVector;
    const half = Math.max(r * 1.24, 3.2);
    const vb = `${(cx - half).toFixed(2)} ${(cy - half).toFixed(2)} ${(half * 2).toFixed(2)} ${(half * 2).toFixed(2)}`;
    return (
      <svg
        viewBox={vb}
        style={{ width: `${fontPx.toFixed(1)}px`, height: `${fontPx.toFixed(1)}px` }}
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
        fontSize: `${fontPx.toFixed(1)}px`,
        lineHeight: 1,
        fontWeight: 400,
        letterSpacing: '0.02em',
        color: tone,
        transition: 'font-size 300ms cubic-bezier(0.22, 1, 0.36, 1), color 260ms ease',
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
  scriptMode = 'both',
  includeShortCodes: propIncludeShortCodes,
  boxPx = 460,
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
  const filterId = `evolving-ink-bleed-${uid}`;

  // Refresh noise grain seed gently on fresh character onset
  const seedRef = useRef<number>(Math.floor(Math.random() * 997) + 1);
  const prevBufLenRef = useRef<number>(0);
  if (buffer.length === 1 && prevBufLenRef.current === 0) {
    seedRef.current = ((seedRef.current * 73 + 19) % 991) + 1;
  }
  prevBufLenRef.current = buffer.length;

  const targetNodes = useMemo(
    () => buildEvolvingCloudNodes(buffer, scriptMode, useShortCodes),
    [buffer, scriptMode, useShortCodes]
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

      if (isFreshCommit && committedChar) {
        const commitId = `char:${committedChar}`;
        const existing = prevMap.get(commitId);
        const exhaleNode = buildCommittedCloudNode(committedChar) ?? existing?.node;
        if (exhaleNode) {
          nextMap.set(commitId, {
            node: exhaleNode,
            phase: 'exhaling',
            exitedAt: now,
          });
        }
      }

      for (const item of prev) {
        if (targetIds.has(item.node.id)) continue;
        if (isFreshCommit && committedChar && item.node.id === `char:${committedChar}`) {
          continue;
        }
        if (item.phase === 'exiting' || item.phase === 'exhaling') {
          if (item.exitedAt && now - item.exitedAt < 420) {
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
            return Boolean(item.exitedAt && cutoff - item.exitedAt < 380);
          }
          return true;
        })
      );
    }, 410);
  }, [targetNodes, buffer, committedChar, committedTick]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
      if (pruneTimerRef.current !== null) window.clearTimeout(pruneTimerRef.current);
    };
  }, []);

  const { ccwRadicalFilament, cwShortFilament } = useMemo(() => {
    if (!buffer || targetNodes.length === 0) {
      return { ccwRadicalFilament: '', cwShortFilament: '' };
    }
    const apex = targetNodes.find((n) => n.branch === 'apex') ?? targetNodes[0];
    const rads = targetNodes.filter((n) => n.branch === 'radical');
    const shorts = targetNodes.filter((n) => n.branch === 'shortcode');
    return {
      ccwRadicalFilament: buildBranchFilamentPath(apex, rads),
      cwShortFilament: buildBranchFilamentPath(apex, shorts),
    };
  }, [buffer, targetNodes]);

  if (pool.length === 0) return null;

  const seed = seedRef.current;
  const macroFreq = (0.022 + (seed % 17) * 0.0014).toFixed(4);
  const grainFreq = (0.24 + (seed % 13) * 0.014).toFixed(3);
  const dispScale = (1.0 + effectiveBlend * 6.8).toFixed(2);
  const blurStd = (0.22 + effectiveBlend * 1.8).toFixed(2);
  const haloSlope = (0.15 + effectiveBlend * 0.26).toFixed(2);
  const grainGain = (0.18 + effectiveBlend * 0.24).toFixed(2);
  const grainBase = (0.68 - effectiveBlend * 0.34).toFixed(2);
  const blendedAlpha = effectiveOpacity * (1 - effectiveBlend * 0.16);
  const radialCoreStop = Math.round(48 - effectiveBlend * 10);
  const radialMidStop = Math.round(74 - effectiveBlend * 8);
  const radialOuterStop = Math.round(94 - effectiveBlend * 4);
  const radialMask = `radial-gradient(circle at 46% 46%, rgba(0,0,0,1) ${radialCoreStop}%, rgba(0,0,0,0.62) ${radialMidStop}%, rgba(0,0,0,0) ${radialOuterStop}%)`;

  const hasActive = targetNodes.length > 0;

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none select-none ${className}`}
      style={{
        width: `${boxPx}px`,
        height: `${boxPx}px`,
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
            x="-16%"
            y="-16%"
            width="132%"
            height="132%"
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

      <div
        className="relative w-full h-full"
        style={{
          opacity: blendedAlpha,
          mixBlendMode: isWash ? 'multiply' : effectiveBlend >= 0.35 ? 'screen' : 'normal',
          WebkitMaskImage: radialMask,
          maskImage: radialMask,
          background: hasActive
            ? isWash
              ? `radial-gradient(circle at 46% 46%, rgba(28,28,26,${(0.025 + effectiveBlend * 0.028).toFixed(3)}) 0%, rgba(243,241,236,0) 64%)`
              : `radial-gradient(circle at 46% 46%, rgba(160,178,204,${(0.025 + effectiveBlend * 0.026).toFixed(3)}) 0%, rgba(11,15,23,0) 64%)`
            : 'none',
          transition: 'opacity 240ms ease-out',
        }}
      >
        <div
          className="relative w-full h-full"
          style={{ filter: `url(#${filterId})` }}
        >
          {/* Separate dual spiral filaments: CCW upward for radicals/structure, CW downward for short codes */}
          {(ccwRadicalFilament || cwShortFilament) && (
            <svg
              viewBox="0 0 100 100"
              className="absolute inset-0 w-full h-full overflow-visible"
              aria-hidden="true"
            >
              {ccwRadicalFilament && (
                <path
                  d={ccwRadicalFilament}
                  fill="none"
                  stroke={isWash ? '#2D2D2A' : '#B7C4D8'}
                  strokeWidth="0.48"
                  strokeOpacity={0.18}
                  strokeLinecap="round"
                  strokeDasharray="1.5 2.2"
                  style={{ transition: 'd 300ms ease, opacity 260ms ease' }}
                />
              )}
              {cwShortFilament && (
                <path
                  d={cwShortFilament}
                  fill="none"
                  stroke={isWash ? '#8C5B20' : '#C8A464'}
                  strokeWidth="0.46"
                  strokeOpacity={0.22}
                  strokeLinecap="round"
                  strokeDasharray="1.0 2.0"
                  style={{ transition: 'd 300ms ease, opacity 260ms ease' }}
                />
              )}
            </svg>
          )}

          {pool.map(({ node, phase }) => {
            const nodePx = (node.size / 100) * boxPx;
            const tone = getSumiTone(node.probability, node.branch, isWash);

            let phaseScale = 1;
            let phaseOpacity = node.curveOpacity;
            let phaseBlur = node.curveBlurPx;

            if (phase === 'entering') {
              phaseScale = 0.8;
              phaseOpacity = 0;
              phaseBlur = node.curveBlurPx + 2.6;
            } else if (phase === 'exiting') {
              phaseScale = 0.74;
              phaseOpacity = 0;
              phaseBlur = node.curveBlurPx + 3.0;
            } else if (phase === 'exhaling') {
              phaseScale = 1.15;
              phaseOpacity = 0;
              phaseBlur = 2.8;
            }

            return (
              <div
                key={node.id}
                className="absolute flex items-center justify-center"
                style={{
                  left: `${node.x}%`,
                  top: `${node.y}%`,
                  transform: `translate(-50%, -50%) scale(${phaseScale})`,
                  opacity: phaseOpacity,
                  filter: phaseBlur > 0.02 ? `blur(${phaseBlur.toFixed(2)}px)` : undefined,
                  zIndex: 25 - node.rank,
                  transition:
                    phase === 'exhaling'
                      ? 'transform 380ms cubic-bezier(0.16, 1, 0.3, 1), opacity 360ms ease-out, filter 360ms ease-out'
                      : 'left 320ms cubic-bezier(0.22, 1, 0.36, 1), top 320ms cubic-bezier(0.22, 1, 0.36, 1), transform 300ms cubic-bezier(0.22, 1, 0.36, 1), opacity 280ms ease-out, filter 280ms ease-out',
                }}
              >
                <EvolvingGlyphLabel node={node} fontPx={nodePx} tone={tone} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

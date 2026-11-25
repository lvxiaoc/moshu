import { LINGMING_CHAMBER_BY_KEY } from '../data/lingming';
import { LINGMING_SHORT_CODES } from '../data/lingmingShortCodes';
import { PALACE_PDF_CHAMBERS } from '../data/palacePdfData';
import { matchesScript, ScriptMode } from '../data/scriptFilter';
import { LexiconEntry, lingmingLexicon, resolveImeDaSlot } from './lingmingIme';

export interface PdfVectorGlyph {
  path: string;
  cx: number;
  cy: number;
  r: number;
}

export type CloudBranch = 'upperRight' | 'lowerRight';

export interface EvolvingCloudNode {
  /** Unified semantic ID across keystrokes so matching roots smoothly glide & scale into chars */
  id: string;
  kind: 'radical' | 'char';
  branch: CloudBranch;
  glyph: string;
  /** Monotonically decreasing probability weight in (0, 1] */
  probability: number;
  rank: number;
  /** Pixel offset relative to target glyph center (0, 0) */
  dx: number;
  dy: number;
  /** Exact rendered font/SVG size in px (rank 0 matches target glyph size 1:1) */
  fontPx: number;
  /** Density multiplier along the perspective ray */
  curveOpacity: number;
  /** Progressive depth blur in px */
  curveBlurPx: number;
  /** True when the current buffer already matches this item */
  isExactMatch?: boolean;
  pdfVector?: PdfVectorGlyph;
}

let chamberVectorMap: Map<string, Map<string, PdfVectorGlyph>> | null = null;
function getChamberRadicalVector(chamberKey: string, glyph: string): PdfVectorGlyph | undefined {
  if (!chamberVectorMap) {
    chamberVectorMap = new Map();
    for (const [key, chamber] of Object.entries(PALACE_PDF_CHAMBERS)) {
      const m = new Map<string, PdfVectorGlyph>();
      const monVec: PdfVectorGlyph = {
        path: chamber.monument.path,
        cx: chamber.monument.cx,
        cy: chamber.monument.cy,
        r: chamber.monument.r,
      };
      m.set(chamber.monument.rawChar, monVec);
      m.set(chamber.monument.displayChar, monVec);
      for (const n of chamber.nodes) {
        if (!n.path) continue;
        const vec: PdfVectorGlyph = { path: n.path, cx: n.cx, cy: n.cy, r: n.r };
        if (!m.has(n.rawChar)) m.set(n.rawChar, vec);
        if (!m.has(n.displayChar)) m.set(n.displayChar, vec);
      }
      chamberVectorMap.set(key, m);
    }
  }
  return chamberVectorMap.get(chamberKey.toLowerCase())?.get(glyph);
}

function getRankedStructuralEntries(buf: string, scriptMode: ScriptMode): LexiconEntry[] {
  const pool: Array<{ entry: LexiconEntry; score: number; exactFull: boolean }> = [];
  const seen = new Set<string>();

  for (const entry of lingmingLexicon.entries) {
    const fcExact = entry.code === buf;
    const fcPrefix = entry.code.length > buf.length && entry.code.startsWith(buf);
    if (!fcExact && !fcPrefix) continue;
    if (seen.has(entry.char)) continue;
    seen.add(entry.char);

    const freq = Math.max(0.15, entry.priority / 1000);
    const scriptBoost = matchesScript(entry.script, scriptMode) ? 1.45 : 0.36;
    const exactBoost = fcExact ? 3.2 : 1.0;
    const radPenalty = entry.isRadical && !fcExact ? 0.35 : 1.0;
    const closeness = fcExact
      ? 1.25
      : Math.max(0.85, 1.12 - (entry.code.length - buf.length) * 0.08);

    pool.push({
      entry,
      exactFull: fcExact,
      score: freq * scriptBoost * exactBoost * radPenalty * closeness,
    });
  }

  pool.sort((a, b) => {
    if (a.exactFull !== b.exactFull) return a.exactFull ? -1 : 1;
    return b.score - a.score;
  });

  return pool.map((p) => p.entry);
}

function getRankedShortCodeEntries(buf: string, scriptMode: ScriptMode) {
  if (!buf || /[aeiou]$/.test(buf)) return [];
  const seen = new Set<string>();
  return LINGMING_SHORT_CODES.filter((sc) => {
    if (!sc.shortCode.startsWith(buf) || sc.shortCode.length <= buf.length) return false;
    if (seen.has(sc.char)) return false;
    seen.add(sc.char);
    return true;
  }).sort((a, b) => {
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
}

/**
 * Resolves the single foreground target character/radical (`主目標字`) so that
 * the target glyph at the caret and the projection apex along the upper-right 45° ray stay 100% consistent.
 */
export function resolveLeadStructuralGlyph(
  rawBuffer: string,
  scriptMode: ScriptMode,
  selectedIdx = 0
): string | null {
  const buf = rawBuffer.trim().toLowerCase();
  if (!buf) return null;

  if (selectedIdx > 0) {
    const q = lingmingLexicon.query(buf, scriptMode, 7);
    const picked = q.all[selectedIdx];
    if (picked) return picked.entry.char;
  }

  if (buf.length === 1) {
    const chamber = LINGMING_CHAMBER_BY_KEY[buf];
    if (chamber) return chamber.primaryAnchor;
  }

  const ranked = getRankedStructuralEntries(buf, scriptMode);
  if (ranked.length > 0) return ranked[0].char;

  const q = lingmingLexicon.query(buf, scriptMode, 7);
  const top = q.exact[0] ?? q.all[0];
  return top ? top.entry.char : null;
}

/**
 * Resolves the leading short-code character (`簡碼首選`) approaching along the lower-right 45° ray,
 * committed cleanly on Space.
 */
export function resolveLeadShortCodeCandidate(
  rawBuffer: string,
  scriptMode: ScriptMode
): LexiconEntry | null {
  const buf = rawBuffer.trim().toLowerCase();
  if (!buf) return null;
  const shorts = getRankedShortCodeEntries(buf, scriptMode);
  if (shorts.length === 0) return null;
  return lingmingLexicon.byChar.get(shorts[0].char) ?? null;
}

function layoutPerspectiveRayNode(
  branch: CloudBranch,
  rank: number,
  bufLen: number,
  glyphPx: number,
  maxUpperCount: number
): {
  dx: number;
  dy: number;
  fontPx: number;
  curveOpacity: number;
  curveBlurPx: number;
} {
  const u = Math.max(18, glyphPx);
  const isUpper = branch === 'upperRight';

  if (!isUpper) {
    // Lower-right short-code 3D depth corridor (shallower ~23° perspective receding toward right horizon, not a flat 45° line)
    const advance = Math.min(2, Math.max(0, bufLen - 1));
    const nearX = u * (1.28 - advance * 0.14);
    const nearY = u * (0.76 - advance * 0.1);
    const vanishX = u * 5.75;
    const vanishY = u * 2.65;

    // Nonlinear z-projection: deeper ranks compress toward vanishing point with accelerating foreshortening
    const zDepth = rank * 0.4;
    const perspT = rank === 0 ? 0 : 1 - 1 / (1 + zDepth);
    // Subtle perspective arc bend so depth corridor feels spatial rather than ruler-straight
    const arcLiftY = rank === 0 ? 0 : -Math.sin(perspT * Math.PI) * u * 0.12;

    const dx = Number((nearX + (vanishX - nearX) * perspT).toFixed(1));
    const dy = Number((nearY + (vanishY - nearY) * perspT + arcLiftY).toFixed(1));

    // True perspective scale contraction: foreground short code looms near 1:1 target size; distant ranks shrink with 1/(1+z)
    const nearScale = Math.min(1.02, 0.92 + advance * 0.05);
    const sizeRatio = rank === 0 ? nearScale : Math.max(0.35, nearScale / (1 + rank * 0.44));
    const fontPx = Number((u * sizeRatio).toFixed(1));

    // Optical depth-of-field (景深) & atmospheric fade
    const curveOpacity =
      rank === 0
        ? Math.min(0.98, 0.88 + advance * 0.05)
        : Number(Math.max(0.16, 0.88 / Math.pow(1.56, rank)).toFixed(3));
    const curveBlurPx =
      rank === 0 ? 0 : Number(Math.min(2.65, 0.62 * Math.pow(rank, 1.24)).toFixed(2));

    return { dx, dy, fontPx, curveOpacity, curveBlurPx };
  }

  // Upper-right (Key 2+): narrowed structural candidate projections converging along an ascending perspective curve
  const narrowBonus = bufLen >= 2 && maxUpperCount <= 3 ? 0.16 : 0;
  const approachFactor = Math.min(1, Math.max(0, bufLen - 2) * 0.45 + narrowBonus);

  const nearX = u * (1.16 - approachFactor * 0.28);
  const nearY = -u * (0.92 - approachFactor * 0.22);
  const vanishX = u * 6.2;
  const vanishY = -u * 3.2;

  const perspT = rank === 0 ? 0 : 1 - 1 / (1 + rank * 0.34);
  const arcBendY = rank === 0 ? 0 : Math.sin(perspT * Math.PI) * u * 0.12;

  const dx = Number((nearX + (vanishX - nearX) * perspT).toFixed(1));
  const dy = Number((nearY + (vanishY - nearY) * perspT + arcBendY).toFixed(1));

  // Rank 0 matches target glyph size 1:1; trailing structural echoes recede in depth
  const sizeRatio = rank === 0 ? 1.0 : Math.max(0.34, 1.0 / (1 + rank * 0.46));
  const fontPx = Number((u * sizeRatio).toFixed(1));
  const curveOpacity =
    rank === 0 ? 0.96 : Number(Math.max(0.16, 0.84 / Math.pow(1.52, rank)).toFixed(3));
  const curveBlurPx =
    rank === 0 ? 0 : Number(Math.min(2.4, 0.56 * Math.pow(rank, 1.22)).toFixed(2));

  return { dx, dy, fontPx, curveOpacity, curveBlurPx };
}

export function buildCommittedCloudNode(
  char: string,
  glyphPx = 32
): EvolvingCloudNode | null {
  if (!char) return null;
  return {
    id: `u:${char}`,
    kind: 'char',
    branch: 'upperRight',
    glyph: char,
    probability: 1.0,
    rank: 0,
    dx: 0,
    dy: 0,
    fontPx: glyphPx,
    curveOpacity: 1.0,
    curveBlurPx: 0,
    isExactMatch: true,
  };
}

export function buildEvolvingCloudNodes(
  rawBuffer: string,
  scriptMode: ScriptMode,
  includeShortCodes: boolean,
  glyphPx = 32
): EvolvingCloudNode[] {
  const buf = rawBuffer.trim().toLowerCase();
  if (!buf) return [];

  const nodes: EvolvingCloudNode[] = [];
  const seenUpper = new Set<string>();

  // On Key 1 (`buf.length === 1`), EvolvingProbCloud displays the compact original Key Memory Palace cloud
  // at the upper-right; on Key 2+ (`buf.length >= 2`), seamlessly morph into narrowed surviving structural projections.
  if (buf.length >= 2) {
    const rankedChars = getRankedStructuralEntries(buf, scriptMode);
    const upperItems: Array<{
      glyph: string;
      kind: 'radical' | 'char';
      isExact: boolean;
      pdfVec?: PdfVectorGlyph;
    }> = [];

    for (const entry of rankedChars) {
      if (upperItems.length >= 5) break;
      if (seenUpper.has(entry.char)) continue;
      seenUpper.add(entry.char);
      upperItems.push({
        glyph: entry.char,
        kind: entry.isRadical ? 'radical' : 'char',
        isExact: entry.code === buf,
        pdfVec: entry.isRadical ? getChamberRadicalVector(entry.code[0] ?? '', entry.char) : undefined,
      });
    }

    const daSlot = resolveImeDaSlot(
      rankedChars[0] ? { entry: rankedChars[0], matchedBy: 'prefix' } : undefined,
      buf,
      buf.length - 1
    );
    if (daSlot?.radical && !seenUpper.has(daSlot.radical) && upperItems.length < 5) {
      seenUpper.add(daSlot.radical);
      const insertAt = upperItems.length > 1 ? 1 : upperItems.length;
      upperItems.splice(insertAt, 0, {
        glyph: daSlot.radical,
        kind: 'radical',
        isExact: false,
        pdfVec: getChamberRadicalVector(daSlot.chamberKey, daSlot.radical),
      });
    }

    for (let i = 0; i < upperItems.length; i++) {
      const item = upperItems[i];
      const prob = Number(Math.max(0.14, 1 - i * 0.24).toFixed(3));
      const geom = layoutPerspectiveRayNode(
        'upperRight',
        i,
        buf.length,
        glyphPx,
        upperItems.length
      );
      nodes.push({
        id: `u:${item.glyph}`,
        kind: item.kind,
        branch: 'upperRight',
        glyph: item.glyph,
        probability: prob,
        rank: i,
        isExactMatch: item.isExact,
        ...geom,
        pdfVector: item.pdfVec,
      });
    }
  }

  // Lower-right short-code depth corridor (Space commits rank 0)
  if (includeShortCodes) {
    const shortMatches = getRankedShortCodeEntries(buf, scriptMode).slice(0, 4);
    for (let i = 0; i < shortMatches.length; i++) {
      const sc = shortMatches[i];
      const geom = layoutPerspectiveRayNode(
        'lowerRight',
        i,
        buf.length,
        glyphPx,
        shortMatches.length
      );
      // Steep chromatic/depth weight falloff across ranks [1.0, 0.66, 0.36, 0.14]
      const prob = Number(Math.max(0.14, 1 - i * 0.29).toFixed(3));

      nodes.push({
        id: `sc:${sc.char}`,
        kind: 'char',
        branch: 'lowerRight',
        glyph: sc.char,
        probability: prob,
        rank: i,
        ...geom,
      });
    }
  }

  return nodes;
}

import { HUANGTING_CHAR_MAP } from '../data/huangtingjing';
import { getLingmingRadicalScript, LINGMING_CHAMBER_BY_KEY } from '../data/lingming';
import { LINGMING_SHORT_CODES } from '../data/lingmingShortCodes';
import { PALACE_PDF_CHAMBERS } from '../data/palacePdfData';
import { matchesScript, ScriptMode } from '../data/scriptFilter';
import { LexiconEntry, lingmingLexicon } from './lingmingIme';

export interface PdfVectorGlyph {
  path: string;
  cx: number;
  cy: number;
  r: number;
}

export type CloudBranch = 'apex' | 'radical' | 'shortcode';

export interface EvolvingCloudNode {
  /** Stable semantic ID across keystrokes so glyphs smoothly glide & morph in place */
  id: string;
  kind: 'radical' | 'char';
  branch: CloudBranch;
  glyph: string;
  /** Monotonically decreasing probability weight in (0, 1] */
  probability: number;
  rank: number;
  /** Target center X in 0..100 cloud stage space */
  x: number;
  /** Target center Y in 0..100 cloud stage space */
  y: number;
  /** Visual box size in 0..100 cloud stage units */
  size: number;
  /** Density multiplier along the probability curve (0.12..1.00) */
  curveOpacity: number;
  /** Progressive capillary mist blur in px (0 at apex -> ~2.4px at mist tail) */
  curveBlurPx: number;
  /** True when the current buffer exactly matches this character's code */
  isExactMatch?: boolean;
  pdfVector?: PdfVectorGlyph;
  charStrokes?: string[];
}

let charStrokeMap: Map<string, string[]> | null = null;
export function getCharCalligraphyStrokes(char: string): string[] | undefined {
  if (!charStrokeMap) {
    charStrokeMap = new Map();
    for (const sc of LINGMING_SHORT_CODES) {
      if (sc.strokes && sc.strokes.length > 0) {
        charStrokeMap.set(sc.char, sc.strokes);
      }
    }
    for (const [ch, info] of Object.entries(HUANGTING_CHAR_MAP)) {
      if (info.strokes && info.strokes.length > 0 && !charStrokeMap.has(ch)) {
        charStrokeMap.set(ch, info.strokes);
      }
    }
  }
  return charStrokeMap.get(char);
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

// 置於游標右側空白處（x >= 24），絕不遮擋左側已寫好的正文內容
const APEX_ANCHOR = { x: 24.0, y: 46.0 };

// 逆時針往上旋：自焦點右側逆時針經右上、正上旋向左上方收尾（字根／本碼結構分佈）
const CCW_UP_SPIRAL: ReadonlyArray<{ x: number; y: number }> = [
  { x: 43.0, y: 42.0 },
  { x: 60.5, y: 36.5 },
  { x: 73.5, y: 26.0 },
  { x: 71.0, y: 14.0 },
  { x: 54.0, y: 10.5 },
  { x: 37.0, y: 15.5 },
  { x: 27.5, y: 26.5 },
];

// 順時針往下旋：自焦點右側順時針經右下、底部旋向左下方收尾（簡碼分佈）
const CW_DOWN_SPIRAL: ReadonlyArray<{ x: number; y: number }> = [
  { x: 42.5, y: 53.5 },
  { x: 59.5, y: 62.5 },
  { x: 68.5, y: 74.5 },
  { x: 55.0, y: 84.0 },
  { x: 36.5, y: 78.5 },
];

function layoutBranchNode(
  branch: CloudBranch,
  branchIndex: number,
  probability: number,
  prevBranchSize: number
): {
  x: number;
  y: number;
  size: number;
  curveOpacity: number;
  curveBlurPx: number;
} {
  const p = Math.max(0.08, Math.min(1.0, probability));

  if (branch === 'apex') {
    return {
      x: APEX_ANCHOR.x,
      y: APEX_ANCHOR.y,
      size: 22.5,
      curveOpacity: 1.0,
      curveBlurPx: 0,
    };
  }

  const anchors = branch === 'shortcode' ? CW_DOWN_SPIRAL : CCW_UP_SPIRAL;
  const anchor = anchors[Math.min(branchIndex, anchors.length - 1)];

  const pull = (p - 0.5) * 0.10;
  const x = Number((anchor.x + (APEX_ANCHOR.x - anchor.x) * pull).toFixed(2));
  const y = Number((anchor.y + (APEX_ANCHOR.y - anchor.y) * pull).toFixed(2));

  const maxSpan = branch === 'shortcode' ? 12.2 : 14.2;
  let size = Number((7.5 + Math.pow(p, 1.05) * maxSpan).toFixed(2));
  size = Math.min(size, Number((prevBranchSize - 0.85).toFixed(2)));
  size = Math.max(7.2, size);

  const curveOpacity = Number(Math.max(0.14, Math.pow(p, 1.18)).toFixed(3));
  const curveBlurPx =
    p >= 0.92 ? 0 : Number((0.2 + Math.pow(1 - p, 1.3) * 2.25).toFixed(2));

  return { x, y, size, curveOpacity, curveBlurPx };
}

export function buildCommittedCloudNode(char: string): EvolvingCloudNode | null {
  if (!char) return null;
  const geom = layoutBranchNode('apex', 0, 1.0, 24.0);
  return {
    id: `char:${char}`,
    kind: 'char',
    branch: 'apex',
    glyph: char,
    probability: 1.0,
    rank: 0,
    isExactMatch: true,
    ...geom,
    charStrokes: getCharCalligraphyStrokes(char),
  };
}

export function buildEvolvingCloudNodes(
  rawBuffer: string,
  scriptMode: ScriptMode,
  includeShortCodes: boolean
): EvolvingCloudNode[] {
  const buf = rawBuffer.trim().toLowerCase();
  if (!buf) return [];

  // Key 1: Monumental primary radical at center apex;
  // other radicals spiral counter-clockwise upward (逆時針往上旋);
  // short-code characters spiral clockwise downward (順時針往下旋).
  if (buf.length === 1) {
    const key = buf[0];
    const chamber = LINGMING_CHAMBER_BY_KEY[key];
    if (!chamber) return [];

    const allRadicals = chamber.clusters.flatMap((cl) => cl.radicals);
    const sorted = [...allRadicals].sort((a, b) => {
      if (a.rank === 1 && b.rank !== 1) return -1;
      if (b.rank === 1 && a.rank !== 1) return 1;
      const aMatch = matchesScript(getLingmingRadicalScript(a.char), scriptMode) ? 1 : 0;
      const bMatch = matchesScript(getLingmingRadicalScript(b.char), scriptMode) ? 1 : 0;
      if (aMatch !== bMatch) return bMatch - aMatch;
      return a.rank - b.rank;
    });

    const pickedRadicals = sorted.slice(0, 8);
    const nodes: EvolvingCloudNode[] = [];
    const seenIds = new Set<string>();
    let prevRadProb = 1.05;
    let prevRadSize = 23.0;

    for (let i = 0; i < pickedRadicals.length; i++) {
      const rad = pickedRadicals[i];
      const tierBoost = rad.rank <= 1 ? 1.0 : rad.rank <= 5 ? 1.02 : 0.88;
      let prob = i === 0 ? 1.0 : Math.max(0.18, Math.pow(0.78, i) * tierBoost);
      prob = Math.min(prob, prevRadProb - 0.04);
      prevRadProb = prob;

      const id = `rad:${key}:${rad.char}`;
      if (seenIds.has(id)) continue;
      seenIds.add(id);

      const branch: CloudBranch = i === 0 ? 'apex' : 'radical';
      const branchIdx = i === 0 ? 0 : i - 1;
      const geom = layoutBranchNode(branch, branchIdx, prob, prevRadSize);
      prevRadSize = geom.size;

      nodes.push({
        id,
        kind: 'radical',
        branch,
        glyph: rad.char,
        probability: Number(prob.toFixed(3)),
        rank: nodes.length,
        ...geom,
        pdfVector: getChamberRadicalVector(key, rad.char),
      });
    }

    if (includeShortCodes) {
      const shortMatches = LINGMING_SHORT_CODES.filter(
        (sc) =>
          sc.shortCode.startsWith(key) &&
          !pickedRadicals.some((r) => r.char === sc.char)
      )
        .sort((a, b) => {
          const aLevel = a.level;
          const bLevel = b.level;
          if (aLevel !== bLevel) return aLevel - bLevel;
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
          return 0;
        })
        .slice(0, CW_DOWN_SPIRAL.length);

      let prevScProb = 0.82;
      let prevScSize = 21.0;

      for (let i = 0; i < shortMatches.length; i++) {
        const sc = shortMatches[i];
        const id = `char:${sc.char}`;
        if (seenIds.has(id)) continue;
        seenIds.add(id);

        const baseProb = sc.level <= 2 ? 0.72 * Math.pow(0.82, i) : 0.44 * Math.pow(0.84, i);
        const prob = Math.max(0.16, Math.min(prevScProb - 0.05, baseProb));
        prevScProb = prob;

        const geom = layoutBranchNode('shortcode', i, prob, prevScSize);
        prevScSize = geom.size;

        nodes.push({
          id,
          kind: 'char',
          branch: 'shortcode',
          glyph: sc.char,
          probability: Number(prob.toFixed(3)),
          rank: nodes.length,
          ...geom,
          charStrokes: getCharCalligraphyStrokes(sc.char),
        });
      }
    }

    return nodes;
  }

  // Key 2+: continuously morph into probabilistic whole-character hypotheses.
  // Top hypothesis occupies the center apex;
  // full-code / structural hypotheses follow the counter-clockwise upward spiral;
  // short-code hypotheses follow the clockwise downward spiral.
  interface ScoredCandidate {
    entry: LexiconEntry;
    score: number;
    isExact: boolean;
    isStructural: boolean;
    isShortBranch: boolean;
  }

  const scored: ScoredCandidate[] = [];
  const seenChars = new Set<string>();

  for (const entry of lingmingLexicon.entries) {
    const scMatchExact = includeShortCodes && entry.shortCode === buf;
    const fcMatchExact = entry.code === buf;
    const scMatchPrefix =
      includeShortCodes &&
      Boolean(
        entry.shortCode && entry.shortCode.length > buf.length && entry.shortCode.startsWith(buf)
      );
    const fcMatchPrefix = entry.code.length > buf.length && entry.code.startsWith(buf);

    if (!scMatchExact && !fcMatchExact && !scMatchPrefix && !fcMatchPrefix) {
      continue;
    }
    if (seenChars.has(entry.char)) continue;
    seenChars.add(entry.char);

    const isStructural = (fcMatchExact || fcMatchPrefix) && !(scMatchExact && !fcMatchExact);
    const isExact = fcMatchExact || scMatchExact;
    const isShortBranch = Boolean(
      includeShortCodes &&
        (scMatchExact || (!isStructural && scMatchPrefix && (entry.shortCode?.length ?? 9) <= 3))
    );
    const matchedLen = isStructural ? entry.code.length : entry.shortCode!.length;
    const remaining = Math.max(0, matchedLen - buf.length);

    const freqFactor = Math.max(0.15, entry.priority / 1000);
    const scriptFactor = matchesScript(entry.script, scriptMode) ? 1.32 : 0.42;
    const exactFactor = fcMatchExact ? 2.6 : scMatchExact ? 1.85 : 1.0;
    const closenessFactor =
      remaining === 0 ? 1.12 : remaining === 1 ? 1.05 : remaining === 2 ? 1.0 : 0.94;
    const radicalPenalty = entry.isRadical && !fcMatchExact ? 0.42 : 1.0;

    const score = freqFactor * scriptFactor * exactFactor * closenessFactor * radicalPenalty;
    scored.push({ entry, score, isExact, isStructural, isShortBranch });
  }

  if (scored.length === 0) return [];

  // Structural full-code path takes priority for the apex & CCW-upward evolution;
  // short-code matches sit cleanly on the CW-downward spiral unless no structural path exists.
  const structuralPool = scored.filter((item) => item.isStructural);
  const sortByScore = (a: ScoredCandidate, b: ScoredCandidate) => {
    const aFcExact = a.entry.code === buf ? 1 : 0;
    const bFcExact = b.entry.code === buf ? 1 : 0;
    if (aFcExact !== bFcExact) return bFcExact - aFcExact;
    return b.score - a.score;
  };

  structuralPool.sort(sortByScore);
  scored.sort(sortByScore);

  const apexItem = structuralPool[0] ?? scored[0];
  const remainingScored = scored.filter((item) => item.entry.char !== apexItem.entry.char);

  const out: EvolvingCloudNode[] = [];
  const maxScore = Math.max(0.0001, apexItem.score);

  // Apex node
  const apexGeom = layoutBranchNode('apex', 0, 1.0, 24.0);
  const apexPdf = apexItem.entry.isRadical
    ? getChamberRadicalVector(apexItem.entry.code[0] ?? '', apexItem.entry.char)
    : undefined;
  out.push({
    id: `char:${apexItem.entry.char}`,
    kind: apexItem.entry.isRadical && apexPdf ? 'radical' : 'char',
    branch: 'apex',
    glyph: apexItem.entry.char,
    probability: 1.0,
    rank: 0,
    isExactMatch: apexItem.isExact,
    ...apexGeom,
    pdfVector: apexPdf,
    charStrokes: getCharCalligraphyStrokes(apexItem.entry.char),
  });

  let ccwIdx = 0;
  let cwIdx = 0;
  let prevCcwProb = 0.96;
  let prevCcwSize = 22.0;
  let prevCwProb = 0.94;
  let prevCwSize = 21.0;

  for (let i = 0; i < remainingScored.length; i++) {
    const item = remainingScored[i];
    const hasShortTag = Boolean(
      includeShortCodes &&
        item.entry.shortCode &&
        item.entry.shortCode.startsWith(buf) &&
        item.entry.shortCode.length <= 3
    );
    const useShort = (item.isShortBranch || (hasShortTag && !item.isExact)) && cwIdx < CW_DOWN_SPIRAL.length;
    const useMain = !useShort && ccwIdx < CCW_UP_SPIRAL.length;
    if (!useShort && !useMain) {
      if (ccwIdx >= CCW_UP_SPIRAL.length && cwIdx >= CW_DOWN_SPIRAL.length) break;
      continue;
    }

    const branch: CloudBranch = useShort ? 'shortcode' : 'radical';
    const bIdx = useShort ? cwIdx : ccwIdx;
    const ratio = item.score / maxScore;
    let prob = Math.max(0.14, Math.min(0.90, ratio * 0.76 + Math.pow(0.75, bIdx + 1) * 0.24));

    if (useShort) {
      prob = Math.max(0.14, Math.min(prob, prevCwProb - 0.05));
      prevCwProb = prob;
      const geom = layoutBranchNode('shortcode', cwIdx, prob, prevCwSize);
      prevCwSize = geom.size;
      cwIdx++;

      out.push({
        id: `char:${item.entry.char}`,
        kind: 'char',
        branch,
        glyph: item.entry.char,
        probability: Number(prob.toFixed(3)),
        rank: out.length,
        isExactMatch: item.isExact,
        ...geom,
        charStrokes: getCharCalligraphyStrokes(item.entry.char),
      });
    } else {
      prob = Math.max(0.14, Math.min(prob, prevCcwProb - 0.05));
      prevCcwProb = prob;
      const geom = layoutBranchNode('radical', ccwIdx, prob, prevCcwSize);
      prevCcwSize = geom.size;
      ccwIdx++;

      const ch = item.entry.char;
      const pdfVec = item.entry.isRadical
        ? getChamberRadicalVector(item.entry.code[0] ?? '', ch)
        : undefined;

      out.push({
        id: `char:${ch}`,
        kind: item.entry.isRadical && pdfVec ? 'radical' : 'char',
        branch,
        glyph: ch,
        probability: Number(prob.toFixed(3)),
        rank: out.length,
        isExactMatch: item.isExact,
        ...geom,
        pdfVector: pdfVec,
        charStrokes: getCharCalligraphyStrokes(ch),
      });
    }
  }

  return out;
}

// Calligraphic Stroke-Association Path Engine for all 20 Lingming Memory Palace chambers.
// Maps each consonant chamber's #1 主根 brush stroke order to its frequency-ordered radicals
// and generates smooth Catmull-Rom / quadratic Bézier spatial paths from live node coordinates.

import { PALACE_PDF_CHAMBERS } from './palacePdfData';
import { DEFAULT_PALACE_LAYOUT_REFINEMENTS, PalaceLayoutOffset } from './palaceLayoutRefinements';

export interface PalaceStrokeSegmentDef {
  /** Brush stroke label in Traditional Chinese (auto-converted via useUiText) */
  label: string;
  /** Exact ordered indices into PALACE_PDF_CHAMBERS[key].nodes along this stroke */
  nodeIndices: number[];
  /** Optional subtle arch curvature (SVG units) for 2-node segments */
  arch?: number;
}

export interface PalaceChamberStrokeSchema {
  key: string;
  monumentChar: string;
  strokeFormula: string;
  spatialLogic: string;
  strokes: PalaceStrokeSegmentDef[];
}

export interface ComputedStrokePath {
  index: number; // 1-based brush stroke sequence
  label: string;
  d: string;
  start: { x: number; y: number };
  end: { x: number; y: number };
  arrowPath: string;
  sampleChars: string[];
  nodeCount: number;
}

export interface ComputedStrokeBridge {
  fromIndex: number;
  toIndex: number;
  d: string;
}

export interface ChamberStrokeFlow {
  schema: PalaceChamberStrokeSchema;
  strokes: ComputedStrokePath[];
  bridges: ComputedStrokeBridge[];
}

export const PALACE_STROKE_SCHEMAS: Record<string, PalaceChamberStrokeSchema> = {
  q: {
    key: 'q',
    monumentChar: '又',
    strokeFormula: '橫撇 → 斜捺',
    spatialLogic: '上橫自左向右起勢，再順右斜捺貫穿至尾端',
    strokes: [
      { label: '橫撇上緣', nodeIndices: [0, 1, 2, 3, 4] },
      { label: '長捺下展', nodeIndices: [5, 6, 7, 8, 9, 10] },
    ],
  },
  w: {
    key: 'w',
    monumentChar: '辶',
    strokeFormula: '點 → 橫折折撇 → 平捺',
    spatialLogic: '起點墜下盤折中腰，底托雙層波勢平捺，全程嚴格依頻率遞進',
    strokes: [
      { label: '起筆點', nodeIndices: [0, 1, 2] },
      { label: '橫折折撇', nodeIndices: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
      { label: '平捺上緣', nodeIndices: [13, 14, 15, 16, 17, 18, 19, 20] },
      { label: '平捺下勢', nodeIndices: [21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32] },
    ],
  },
  r: {
    key: 'r',
    monumentChar: '二',
    strokeFormula: '上橫（上→下） → 下橫（上→下）',
    spatialLogic: '依上下雙橫為軸，四列字根自左向右層層鋪開',
    strokes: [
      { label: '上橫上沿', nodeIndices: [0, 1, 2, 3, 4, 5] },
      { label: '上橫下沿', nodeIndices: [6, 7, 8, 9, 10, 11, 12] },
      { label: '下橫上沿', nodeIndices: [13, 14, 15, 16, 17, 18, 19, 20, 21, 22] },
      { label: '下橫下沿', nodeIndices: [23, 24, 25, 26, 27, 28, 29] },
    ],
  },
  t: {
    key: 't',
    monumentChar: '丶',
    strokeFormula: '斜落頓筆（單筆貫穿）',
    spatialLogic: '沿頓點斜脊自左上向右下如水滴順流排列',
    strokes: [
      { label: '斜點主脈', nodeIndices: [0, 1, 2, 3, 4, 5] },
    ],
  },
  y: {
    key: 'y',
    monumentChar: '大',
    strokeFormula: '上橫 → 左撇 → 右捺',
    spatialLogic: '先橫托兩肩，再分撇捺兩翼左右開展',
    strokes: [
      { label: '上橫', nodeIndices: [0, 1], arch: -2.2 },
      { label: '左撇', nodeIndices: [2, 3, 4] },
      { label: '右捺', nodeIndices: [5, 6], arch: 2.4 },
    ],
  },
  p: {
    key: 'p',
    monumentChar: '勹',
    strokeFormula: '左撇 → 橫折鉤',
    spatialLogic: '先落左撇引領，再繞頂橫折轉外環成鉤',
    strokes: [
      { label: '左撇', nodeIndices: [0, 1, 2, 3, 4] },
      { label: '橫折鉤', nodeIndices: [5, 6, 7, 8, 9, 10, 11, 12, 13] },
    ],
  },
  s: {
    key: 's',
    monumentChar: '土',
    strokeFormula: '上橫 → 中豎 → 底橫（上沿→下沿）',
    spatialLogic: '短橫起筆，中豎直貫而下，底橫雙列嚴格按頻率自左向右穩托',
    strokes: [
      { label: '上橫', nodeIndices: [0, 1, 2, 3, 4] },
      { label: '中豎', nodeIndices: [5, 6, 7, 8, 9, 10] },
      { label: '底橫上沿', nodeIndices: [13, 14, 15, 16, 12, 11] },
      { label: '底橫下沿', nodeIndices: [18, 19, 20, 21, 22, 17] },
    ],
  },
  d: {
    key: 'd',
    monumentChar: '口',
    strokeFormula: '左豎 → 橫折 → 底橫',
    spatialLogic: '順「口」字封閉筆順，左落、上折、右垂、底合',
    strokes: [
      { label: '左豎', nodeIndices: [0, 1, 2] },
      { label: '橫折', nodeIndices: [3, 4, 5, 6, 7, 8] },
      { label: '底橫', nodeIndices: [9, 10, 11] },
    ],
  },
  f: {
    key: 'f',
    monumentChar: '一',
    strokeFormula: '長橫上沿 → 長橫下沿',
    spatialLogic: '貼合長橫微昂筆勢，上下雙行由左向右貫通',
    strokes: [
      { label: '長橫上沿', nodeIndices: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] },
      { label: '長橫下沿', nodeIndices: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23] },
    ],
  },
  g: {
    key: 'g',
    monumentChar: '厶',
    strokeFormula: '撇折 → 右點',
    spatialLogic: '斜撇左降急折底橫，再以右斜點勢收束全宮',
    strokes: [
      { label: '撇折主脈', nodeIndices: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] },
      { label: '右斜點', nodeIndices: [10, 11, 12, 13, 14] },
    ],
  },
  h: {
    key: 'h',
    monumentChar: '日',
    strokeFormula: '左豎 → 上橫 → 右豎折',
    spatialLogic: '沿日字框左柱直下，越頂橫折轉右柱貫底',
    strokes: [
      { label: '左豎', nodeIndices: [0, 1, 2, 3, 4, 5, 6, 7] },
      { label: '上橫', nodeIndices: [8, 9, 10, 11, 12, 13] },
      { label: '右豎折', nodeIndices: [14, 15, 16, 17, 18, 19, 20] },
    ],
  },
  j: {
    key: 'j',
    monumentChar: '亻',
    strokeFormula: '斜撇（右翼→主線） → 垂豎',
    spatialLogic: '先沿單人斜撇下緣依高頻起勢，再走斜撇主線，末順長豎貫底',
    strokes: [
      { label: '斜撇上翼', nodeIndices: [0, 1, 2] },
      { label: '斜撇下翼', nodeIndices: [3, 4], arch: 1.4 },
      { label: '斜撇主線', nodeIndices: [5, 6, 7, 8, 9, 10, 11, 12] },
      { label: '長豎', nodeIndices: [13, 14, 15, 16, 17, 18, 19, 20] },
    ],
  },
  k: {
    key: 'k',
    monumentChar: '白',
    strokeFormula: '頂撇 → 左豎 → 橫折 → 中橫 → 底橫',
    spatialLogic: '起自白字頂撇，依頻率順左豎、橫折，再填入中橫與底橫收官',
    strokes: [
      { label: '頂撇', nodeIndices: [0, 1, 2] },
      { label: '左豎', nodeIndices: [3, 4, 5, 6, 7, 8, 9, 10] },
      { label: '橫折', nodeIndices: [11, 12, 13, 14, 15, 16, 17, 18, 19, 22, 23] },
      { label: '中橫', nodeIndices: [24, 25, 26, 27, 28] },
      { label: '底橫', nodeIndices: [29, 30, 31, 20, 21, 32, 33] },
    ],
  },
  l: {
    key: 'l',
    monumentChar: '月',
    strokeFormula: '左豎撇 → 橫折鉤 → 內上橫 → 內下橫',
    spatialLogic: '先隨彎月左撇撇出，再繞橫折長鉤，末填內雙橫',
    strokes: [
      { label: '左豎撇', nodeIndices: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
      { label: '橫折鉤', nodeIndices: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26] },
      { label: '內上橫', nodeIndices: [27, 28], arch: -1.1 },
      { label: '內下橫', nodeIndices: [29, 30], arch: -1.1 },
    ],
  },
  x: {
    key: 'x',
    monumentChar: '木',
    strokeFormula: '上橫 → 左撇 → 右捺',
    spatialLogic: '上橫承托左右，再順撇捺分叉向下舒展',
    strokes: [
      { label: '上橫', nodeIndices: [0, 1], arch: -2.0 },
      { label: '左撇', nodeIndices: [2, 3], arch: -2.2 },
      { label: '右捺', nodeIndices: [4, 5], arch: 2.2 },
    ],
  },
  c: {
    key: 'c',
    monumentChar: '丷',
    strokeFormula: '左點雙翼 → 右撇雙翼',
    spatialLogic: '呼應倒八字張力，左點內外相依，右撇雙弧斜收',
    strokes: [
      { label: '左點內沿', nodeIndices: [0, 1, 2, 3] },
      { label: '左點外沿', nodeIndices: [4, 5, 6, 7, 8] },
      { label: '右撇內沿', nodeIndices: [9, 10, 11, 12, 13, 14] },
      { label: '右撇外沿', nodeIndices: [15, 16, 17, 18, 19, 20, 21, 22, 23] },
    ],
  },
  v: {
    key: 'v',
    monumentChar: '水',
    strokeFormula: '中豎鉤 → 左橫撇 → 右撇捺',
    spatialLogic: '中豎如主幹貫中，左右分走橫撇與折捺兩翼',
    strokes: [
      { label: '中豎鉤', nodeIndices: [0, 1, 2, 3, 4, 5, 6, 7] },
      { label: '左橫撇', nodeIndices: [8, 9, 10, 11] },
      { label: '右撇捺', nodeIndices: [12, 13, 14, 15, 16] },
    ],
  },
  b: {
    key: 'b',
    monumentChar: '冖',
    strokeFormula: '左點豎 → 橫鉤',
    spatialLogic: '左垂短豎起勢，頂橫平展一字排開後折鉤收尾',
    strokes: [
      { label: '左點豎', nodeIndices: [0, 1, 2, 3] },
      { label: '橫鉤', nodeIndices: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] },
    ],
  },
  n: {
    key: 'n',
    monumentChar: '人',
    strokeFormula: '長撇 → 長捺',
    spatialLogic: '起筆沿長撇舒弧左落，腰部引出長捺斜展右下',
    strokes: [
      { label: '長撇', nodeIndices: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
      { label: '長捺', nodeIndices: [12, 13, 14, 15, 16, 17, 18] },
    ],
  },
  m: {
    key: 'm',
    monumentChar: '𠂇',
    strokeFormula: '上橫 → 長撇',
    spatialLogic: '先走上橫貫穿左右，再由頂端順長撇弧線斜瀉而下',
    strokes: [
      { label: '上橫', nodeIndices: [0, 1, 2, 3, 4, 5, 6] },
      { label: '長撇', nodeIndices: [7, 8, 9, 10, 11, 12, 13, 14, 15] },
    ],
  },
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Convert an ordered polyline into a smooth Catmull-Rom → Cubic Bézier SVG path */
function buildSmoothSplinePath(
  pts: Array<{ x: number; y: number }>,
  arch = 0
): { d: string; endAngle: number } {
  if (pts.length === 0) return { d: '', endAngle: 0 };
  if (pts.length === 1) {
    const p = pts[0];
    return {
      d: `M ${round2(p.x - 1.5)} ${round2(p.y)} L ${round2(p.x + 1.5)} ${round2(p.y)}`,
      endAngle: 0,
    };
  }
  if (pts.length === 2) {
    const [a, b] = pts;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const bend = arch || Math.min(3.0, len * 0.06);
    const cx = (a.x + b.x) * 0.5 + nx * bend;
    const cy = (a.y + b.y) * 0.5 + ny * bend;
    const endAngle = Math.atan2(b.y - cy, b.x - cx);
    return {
      d: `M ${round2(a.x)} ${round2(a.y)} Q ${round2(cx)} ${round2(cy)} ${round2(b.x)} ${round2(b.y)}`,
      endAngle,
    };
  }

  // Smooth Catmull-Rom spline converted to cubic Bézier segments (tension = 0.28 prevents overshoot on tight folds)
  const tension = 0.28;
  let d = `M ${round2(pts[0].x)} ${round2(pts[0].y)}`;
  let lastC2x = pts[pts.length - 2].x;
  let lastC2y = pts[pts.length - 2].y;

  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];

    const c1x = p1.x + (p2.x - p0.x) * tension;
    const c1y = p1.y + (p2.y - p0.y) * tension;
    const c2x = p2.x - (p3.x - p1.x) * tension;
    const c2y = p2.y - (p3.y - p1.y) * tension;

    d += ` C ${round2(c1x)} ${round2(c1y)} ${round2(c2x)} ${round2(c2y)} ${round2(p2.x)} ${round2(p2.y)}`;
    if (i === pts.length - 2) {
      lastC2x = c2x;
      lastC2y = c2y;
    }
  }

  const end = pts[pts.length - 1];
  const endAngle = Math.atan2(end.y - lastC2y, end.x - lastC2x);
  return { d, endAngle };
}

function buildArrowhead(tip: { x: number; y: number }, angle: number, size = 3.1): string {
  const spread = 0.52;
  const x1 = tip.x - Math.cos(angle - spread) * size;
  const y1 = tip.y - Math.sin(angle - spread) * size;
  const x2 = tip.x - Math.cos(angle + spread) * size;
  const y2 = tip.y - Math.sin(angle + spread) * size;
  return `M ${round2(x1)} ${round2(y1)} L ${round2(tip.x)} ${round2(tip.y)} L ${round2(x2)} ${round2(y2)}`;
}

/**
 * Builds live calligraphic stroke-association paths for any consonant chamber,
 * automatically synced with default refinements + user drag overrides.
 */
export function buildChamberStrokeFlow(
  chamberKey: string,
  overrides?: Record<string, PalaceLayoutOffset>
): ChamberStrokeFlow | null {
  const key = chamberKey.toLowerCase();
  const schema = PALACE_STROKE_SCHEMAS[key];
  const pdf = PALACE_PDF_CHAMBERS[key];
  if (!schema || !pdf) return null;

  const lookupOv = (id: string): PalaceLayoutOffset | undefined =>
    overrides?.[id] ?? DEFAULT_PALACE_LAYOUT_REFINEMENTS[id];

  const strokes: ComputedStrokePath[] = [];

  schema.strokes.forEach((seg, sIdx) => {
    const pts: Array<{ x: number; y: number }> = [];
    const chars: string[] = [];
    const seenChars = new Set<string>();

    for (const idx of seg.nodeIndices) {
      const node = pdf.nodes[idx];
      if (!node) continue;
      const ov = lookupOv(node.id);
      pts.push({
        x: node.cx + (ov?.dx ?? 0),
        y: node.cy + (ov?.dy ?? 0),
      });
      const readable = node.isPua ? node.parentChar : node.displayChar;
      if (readable && !seenChars.has(readable) && readable !== pdf.monument.displayChar) {
        seenChars.add(readable);
        chars.push(readable);
      }
    }

    if (pts.length === 0) return;

    const { d, endAngle } = buildSmoothSplinePath(pts, seg.arch);
    const start = pts[0];
    const end = pts[pts.length - 1];

    strokes.push({
      index: sIdx + 1,
      label: seg.label,
      d,
      start,
      end,
      arrowPath: buildArrowhead(end, endAngle, 3.0),
      sampleChars: chars.slice(0, 6),
      nodeCount: pts.length,
    });
  });

  const bridges: ComputedStrokeBridge[] = [];
  for (let i = 0; i < strokes.length - 1; i++) {
    const a = strokes[i].end;
    const b = strokes[i + 1].start;
    const mx = (a.x + b.x) * 0.5;
    const my = (a.y + b.y) * 0.5;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    // Gentle airy lift representing brush lift between strokes
    const lift = Math.min(7, len * 0.14);
    const cx = mx - (dy / len) * lift;
    const cy = my + (dx / len) * lift;
    bridges.push({
      fromIndex: strokes[i].index,
      toIndex: strokes[i + 1].index,
      d: `M ${round2(a.x)} ${round2(a.y)} Q ${round2(cx)} ${round2(cy)} ${round2(b.x)} ${round2(b.y)}`,
    });
  }

  return { schema, strokes, bridges };
}

// Frequency-ordered stroke-aligned Memory Palace mural geometry for all 20 Lingming consonant keys.
// Faithfully reproduces the user's A4 「靈明字根 · 記憶宮殿」 mural map:
// - The monumental silhouette is ALWAYS the #1 highest-frequency radical (主根) of that key.
// - All other radicals flow strictly in frequency order starting from Stroke 1 of the 主根 along its brush stroke order!
// - Color tiers match the poster legend: 主根 (#1) · 第 2–5 (Emerald) · 第 6–9 (Indigo) · 其餘 (Cinnabar)

import { LINGMING_CHAMBER_BY_KEY, LingmingRadical } from './lingming';

export type FrequencyTier = 'primary' | 'rank2_5' | 'rank6_9' | 'rest';

export interface StrokePoint {
  x: number; // 0..100 SVG viewBox coordinates
  y: number;
  rot?: number; // subtle calligraphic tilt in degrees
}

export interface StrokeCloudNode {
  char: string;
  ma: string;
  isXiao: boolean;
  rank: number;
  tier: FrequencyTier;
  x: number;
  y: number;
  scale: number;
  rot: number;
  opacity: number;
  note?: string;
}

export interface ChamberStrokeLayout {
  chamberKey: string;
  monumentChar: string;
  nodes: StrokeCloudNode[];
}

export interface MonumentDefinition {
  monumentChar: string;
  /** Stroke-order anchor slots starting from Stroke 1 of monumentChar, ordered strictly by frequency (rank 2, 3, 4...) */
  slots: StrokePoint[];
}

// Handcrafted stroke-order mural coordinates tracing each #1 主根 from its FIRST brush stroke onward
export const CHAMBER_MONUMENTS: Record<string, MonumentDefinition> = {
  // Q: 主根「又」(橫撇 → 捺): 上橫卌卅艹廾，右捺尾其
  q: {
    monumentChar: '又',
    slots: [
      { x: 28, y: 17, rot: -2 },
      { x: 43, y: 16, rot: 0 },
      { x: 58, y: 16, rot: 1 },
      { x: 56, y: 40, rot: -3 },
      { x: 76, y: 74, rot: 6 },
    ],
  },
  // W: 主根「辶」(點 → 橫折折撇 → 平捺)
  w: {
    monumentChar: '辶',
    slots: [
      { x: 38, y: 18, rot: 4 },
      { x: 24, y: 40, rot: -3 },
      { x: 35, y: 52, rot: 2 },
      { x: 46, y: 67, rot: 0 },
      { x: 58, y: 69, rot: 0 },
      { x: 70, y: 70, rot: 1 },
      { x: 82, y: 71, rot: 2 },
      { x: 20, y: 80, rot: -2 },
      { x: 32, y: 83, rot: 0 },
      { x: 44, y: 85, rot: 0 },
      { x: 56, y: 86, rot: 1 },
      { x: 68, y: 86, rot: 1 },
      { x: 80, y: 86, rot: 2 },
      { x: 90, y: 85, rot: 2 },
    ],
  },
  // R: 主根「二」(上橫上方/下方 → 下橫上方/下方)
  r: {
    monumentChar: '二',
    slots: [
      { x: 26, y: 20, rot: -1 },
      { x: 39, y: 20, rot: 0 },
      { x: 52, y: 20, rot: 0 },
      { x: 66, y: 20, rot: 1 },
      { x: 32, y: 38, rot: -1 },
      { x: 46, y: 38, rot: 0 },
      { x: 60, y: 38, rot: 0 },
      { x: 74, y: 38, rot: 1 },
      { x: 16, y: 60, rot: -1 },
      { x: 28, y: 60, rot: 0 },
      { x: 40, y: 60, rot: 0 },
      { x: 52, y: 60, rot: 0 },
      { x: 64, y: 60, rot: 0 },
      { x: 76, y: 60, rot: 1 },
      { x: 88, y: 60, rot: 1 },
      { x: 22, y: 80, rot: 0 },
      { x: 38, y: 80, rot: 0 },
      { x: 54, y: 80, rot: 0 },
      { x: 70, y: 80, rot: 0 },
      { x: 84, y: 80, rot: 1 },
    ],
  },
  // T: 主根「丶」(斜落頓筆，沿點勢順排 乀扌匕用欠)
  t: {
    monumentChar: '丶',
    slots: [
      { x: 34, y: 28, rot: 10 },
      { x: 45, y: 39, rot: 12 },
      { x: 56, y: 50, rot: 14 },
      { x: 67, y: 61, rot: 14 },
      { x: 78, y: 72, rot: 16 },
    ],
  },
  // Y: 主根「大」(橫 → 撇 → 捺)
  y: {
    monumentChar: '大',
    slots: [
      { x: 31, y: 34, rot: -2 },
      { x: 64, y: 25, rot: 2 },
      { x: 34, y: 55, rot: -8 },
      { x: 24, y: 74, rot: -10 },
      { x: 70, y: 76, rot: 10 },
    ],
  },
  // P: 主根「勹」(撇 → 橫折鉤)
  p: {
    monumentChar: '勹',
    slots: [
      { x: 34, y: 25, rot: -10 },
      { x: 24, y: 40, rot: -10 },
      { x: 52, y: 21, rot: 0 },
      { x: 68, y: 21, rot: 1 },
      { x: 82, y: 34, rot: 3 },
      { x: 82, y: 50, rot: 2 },
      { x: 80, y: 66, rot: 1 },
      { x: 74, y: 81, rot: -2 },
    ],
  },
  // S: 主根「土」(上橫 → 中豎 → 下橫)
  s: {
    monumentChar: '土',
    slots: [
      { x: 26, y: 34, rot: -2 },
      { x: 40, y: 21, rot: -1 },
      { x: 60, y: 21, rot: 1 },
      { x: 74, y: 34, rot: 2 },
      { x: 58, y: 46, rot: 0 },
      { x: 58, y: 59, rot: 0 },
      { x: 42, y: 59, rot: 0 },
      { x: 22, y: 72, rot: -1 },
      { x: 35, y: 72, rot: 0 },
      { x: 66, y: 72, rot: 0 },
      { x: 80, y: 72, rot: 1 },
      { x: 28, y: 88, rot: -1 },
      { x: 50, y: 88, rot: 0 },
      { x: 72, y: 88, rot: 1 },
    ],
  },
  // D: 主根「口」(左豎 → 上橫 → 右折 → 底橫)
  d: {
    monumentChar: '口',
    slots: [
      { x: 17, y: 34, rot: 0 },
      { x: 17, y: 52, rot: 0 },
      { x: 17, y: 70, rot: 0 },
      { x: 30, y: 18, rot: -1 },
      { x: 50, y: 18, rot: 0 },
      { x: 70, y: 18, rot: 1 },
      { x: 84, y: 34, rot: 0 },
      { x: 84, y: 52, rot: 0 },
      { x: 84, y: 70, rot: 0 },
      { x: 36, y: 85, rot: 0 },
      { x: 64, y: 85, rot: 0 },
    ],
  },
  // F: 主根「一」(橫上排 → 橫下排)
  f: {
    monumentChar: '一',
    slots: [
      { x: 14, y: 39, rot: -1 },
      { x: 25, y: 39, rot: 0 },
      { x: 36, y: 39, rot: 0 },
      { x: 48, y: 39, rot: 0 },
      { x: 60, y: 39, rot: 0 },
      { x: 72, y: 39, rot: 0 },
      { x: 84, y: 39, rot: 1 },
      { x: 14, y: 63, rot: -1 },
      { x: 25, y: 63, rot: 0 },
      { x: 36, y: 63, rot: 0 },
      { x: 47, y: 63, rot: 0 },
      { x: 58, y: 63, rot: 0 },
      { x: 69, y: 63, rot: 0 },
      { x: 80, y: 63, rot: 0 },
      { x: 90, y: 63, rot: 1 },
    ],
  },
  // G: 主根「厶」(左斜撇 → 底橫折 → 右長點)
  g: {
    monumentChar: '厶',
    slots: [
      { x: 39, y: 24, rot: -8 },
      { x: 32, y: 39, rot: -8 },
      { x: 25, y: 54, rot: -8 },
      { x: 18, y: 68, rot: -8 },
      { x: 24, y: 85, rot: -1 },
      { x: 38, y: 85, rot: 0 },
      { x: 52, y: 85, rot: 0 },
      { x: 66, y: 85, rot: 0 },
      { x: 80, y: 85, rot: 1 },
      { x: 70, y: 40, rot: 10 },
      { x: 76, y: 53, rot: 10 },
      { x: 82, y: 66, rot: 10 },
      { x: 88, y: 78, rot: 10 },
    ],
  },
  // H: 主根「日」(左豎 → 上橫 → 右豎 → 中橫與底)
  h: {
    monumentChar: '日',
    slots: [
      { x: 18, y: 28, rot: 0 },
      { x: 18, y: 42, rot: 0 },
      { x: 18, y: 56, rot: 0 },
      { x: 18, y: 70, rot: 0 },
      { x: 18, y: 83, rot: 0 },
      { x: 26, y: 16, rot: 0 },
      { x: 38, y: 16, rot: 0 },
      { x: 50, y: 16, rot: 0 },
      { x: 62, y: 16, rot: 0 },
      { x: 74, y: 16, rot: 0 },
      { x: 84, y: 16, rot: 0 },
      { x: 84, y: 30, rot: 0 },
      { x: 84, y: 43, rot: 0 },
      { x: 84, y: 56, rot: 0 },
      { x: 84, y: 69, rot: 0 },
      { x: 84, y: 82, rot: 0 },
      { x: 40, y: 51, rot: 0 },
      { x: 62, y: 51, rot: 0 },
    ],
  },
  // J: 主根「亻」(斜撇 → 長豎)
  j: {
    monumentChar: '亻',
    slots: [
      { x: 68, y: 18, rot: -10 },
      { x: 59, y: 27, rot: -10 },
      { x: 50, y: 36, rot: -10 },
      { x: 40, y: 45, rot: -10 },
      { x: 29, y: 54, rot: -10 },
      { x: 64, y: 36, rot: 0 },
      { x: 64, y: 48, rot: 0 },
      { x: 64, y: 60, rot: 0 },
      { x: 64, y: 72, rot: 0 },
      { x: 64, y: 84, rot: 0 },
      { x: 46, y: 54, rot: 0 },
      { x: 46, y: 66, rot: 0 },
      { x: 46, y: 78, rot: 0 },
      { x: 46, y: 89, rot: 0 },
      { x: 80, y: 58, rot: 0 },
      { x: 80, y: 74, rot: 0 },
    ],
  },
  // K: 主根「白」(短撇 → 左豎 → 上橫 → 右豎 → 內底)
  k: {
    monumentChar: '白',
    slots: [
      { x: 18, y: 32, rot: 0 },
      { x: 18, y: 46, rot: 0 },
      { x: 18, y: 60, rot: 0 },
      { x: 18, y: 74, rot: 0 },
      { x: 18, y: 86, rot: 0 },
      { x: 34, y: 20, rot: 0 },
      { x: 48, y: 20, rot: 0 },
      { x: 62, y: 20, rot: 0 },
      { x: 76, y: 20, rot: 0 },
      { x: 84, y: 34, rot: 0 },
      { x: 84, y: 48, rot: 0 },
      { x: 84, y: 62, rot: 0 },
      { x: 84, y: 76, rot: 0 },
      { x: 84, y: 88, rot: 0 },
      { x: 38, y: 48, rot: 0 },
      { x: 52, y: 48, rot: 0 },
      { x: 66, y: 48, rot: 0 },
      { x: 38, y: 76, rot: 0 },
      { x: 62, y: 76, rot: 0 },
    ],
  },
  // L: 主根「月」(左長撇 → 上橫 → 右豎鉤 → 內雙橫)
  l: {
    monumentChar: '月',
    slots: [
      { x: 24, y: 32, rot: -2 },
      { x: 23, y: 44, rot: -3 },
      { x: 22, y: 56, rot: -4 },
      { x: 20, y: 68, rot: -6 },
      { x: 17, y: 80, rot: -8 },
      { x: 14, y: 90, rot: -10 },
      { x: 32, y: 17, rot: 0 },
      { x: 45, y: 17, rot: 0 },
      { x: 58, y: 17, rot: 0 },
      { x: 70, y: 17, rot: 0 },
      { x: 82, y: 17, rot: 0 },
      { x: 85, y: 29, rot: 0 },
      { x: 85, y: 40, rot: 0 },
      { x: 85, y: 51, rot: 0 },
      { x: 85, y: 62, rot: 0 },
      { x: 85, y: 73, rot: 0 },
      { x: 85, y: 84, rot: 0 },
      { x: 46, y: 42, rot: 0 },
      { x: 62, y: 42, rot: 0 },
      { x: 46, y: 62, rot: 0 },
      { x: 62, y: 62, rot: 0 },
      { x: 52, y: 84, rot: 0 },
    ],
  },
  // X: 主根「木」(橫 → 豎 → 撇 → 捺)
  x: {
    monumentChar: '木',
    slots: [
      { x: 26, y: 32, rot: -2 },
      { x: 35, y: 52, rot: 0 },
      { x: 24, y: 68, rot: -8 },
      { x: 68, y: 58, rot: 8 },
      { x: 76, y: 74, rot: 10 },
    ],
  },
  // C: 主根「丷」(左點翼 → 右長撇)
  c: {
    monumentChar: '丷',
    slots: [
      { x: 20, y: 36, rot: 8 },
      { x: 25, y: 52, rot: 8 },
      { x: 31, y: 68, rot: 8 },
      { x: 36, y: 82, rot: 6 },
      { x: 76, y: 22, rot: -10 },
      { x: 71, y: 34, rot: -10 },
      { x: 66, y: 46, rot: -10 },
      { x: 60, y: 58, rot: -10 },
      { x: 54, y: 70, rot: -10 },
      { x: 48, y: 82, rot: -10 },
      { x: 84, y: 44, rot: -8 },
      { x: 78, y: 60, rot: -8 },
      { x: 70, y: 76, rot: -8 },
    ],
  },
  // V: 主根「水」(中豎鉤 → 左橫撇 → 右撇捺)
  v: {
    monumentChar: '水',
    slots: [
      { x: 45, y: 20, rot: 0 },
      { x: 45, y: 36, rot: 0 },
      { x: 45, y: 52, rot: 0 },
      { x: 45, y: 68, rot: 0 },
      { x: 45, y: 84, rot: 0 },
      { x: 25, y: 52, rot: -6 },
      { x: 20, y: 68, rot: -10 },
      { x: 74, y: 44, rot: 8 },
      { x: 78, y: 60, rot: 10 },
      { x: 84, y: 76, rot: 12 },
    ],
  },
  // B: 主根「冖」(左點豎 → 橫鉤)
  b: {
    monumentChar: '冖',
    slots: [
      { x: 16, y: 54, rot: -4 },
      { x: 28, y: 33, rot: -1 },
      { x: 39, y: 33, rot: 0 },
      { x: 50, y: 33, rot: 0 },
      { x: 61, y: 33, rot: 0 },
      { x: 72, y: 33, rot: 0 },
      { x: 83, y: 33, rot: 1 },
      { x: 78, y: 56, rot: -3 },
      { x: 68, y: 68, rot: -2 },
    ],
  },
  // N: 主根「人」(左長撇 → 右長捺)
  n: {
    monumentChar: '人',
    slots: [
      { x: 40, y: 24, rot: -8 },
      { x: 34, y: 40, rot: -10 },
      { x: 28, y: 56, rot: -12 },
      { x: 22, y: 72, rot: -14 },
      { x: 16, y: 84, rot: -14 },
      { x: 56, y: 40, rot: 10 },
      { x: 63, y: 51, rot: 12 },
      { x: 70, y: 62, rot: 12 },
      { x: 77, y: 73, rot: 14 },
      { x: 84, y: 82, rot: 14 },
      { x: 46, y: 62, rot: 8 },
      { x: 56, y: 76, rot: 10 },
    ],
  },
  // M: 主根「𠂇」(上橫 → 長撇，完全對應海報 M 鍵壁畫)
  m: {
    monumentChar: '𠂇',
    slots: [
      { x: 22, y: 31, rot: -1 },
      { x: 36, y: 31, rot: 0 },
      { x: 50, y: 31, rot: 0 },
      { x: 64, y: 31, rot: 0 },
      { x: 78, y: 31, rot: 1 },
      { x: 56, y: 46, rot: -10 },
      { x: 50, y: 58, rot: -10 },
      { x: 43, y: 70, rot: -12 },
      { x: 34, y: 82, rot: -12 },
      { x: 72, y: 56, rot: 8 },
      { x: 66, y: 70, rot: 8 },
      { x: 58, y: 83, rot: 6 },
      { x: 22, y: 86, rot: -8 },
    ],
  },
};

export const PALACE_LEARNING_ORDER: string[] = [
  'q', 'w', 'r', 't', 'y', 'p',
  's', 'd', 'f', 'g', 'h', 'j', 'k', 'l',
  'x', 'c', 'v', 'b', 'n', 'm',
];

export function getNextPalaceKey(currentKey: string): string {
  const idx = PALACE_LEARNING_ORDER.indexOf(currentKey.toLowerCase());
  if (idx === -1) return PALACE_LEARNING_ORDER[0];
  return PALACE_LEARNING_ORDER[(idx + 1) % PALACE_LEARNING_ORDER.length];
}

function getFrequencyTier(rank: number): FrequencyTier {
  if (rank === 1) return 'primary';
  if (rank <= 5) return 'rank2_5';
  if (rank <= 9) return 'rank6_9';
  return 'rest';
}

export function buildChamberStrokeLayout(chamberKey: string): ChamberStrokeLayout {
  const k = chamberKey.toLowerCase();
  const chamber = LINGMING_CHAMBER_BY_KEY[k];
  const def = CHAMBER_MONUMENTS[k] || {
    monumentChar: chamber?.primaryAnchor || k.toUpperCase(),
    slots: [],
  };

  if (!chamber) {
    return { chamberKey: k, monumentChar: def.monumentChar, nodes: [] };
  }

  // Strictly sort all non-primary radicals by frequency rank (2, 3, 4, ...)
  const ordered: LingmingRadical[] = chamber.clusters
    .flatMap((c) => c.radicals)
    .filter((r) => r.rank > 1)
    .sort((a, b) => a.rank - b.rank);

  const nodes: StrokeCloudNode[] = ordered.map((rad, idx) => {
    const slot = def.slots[idx] || {
      x: 18 + ((idx * 17) % 68),
      y: 22 + ((idx * 19) % 62),
      rot: 0,
    };
    const tier = getFrequencyTier(rad.rank);
    const scale =
      tier === 'rank2_5' ? 1.12 : tier === 'rank6_9' ? 1.0 : 0.9;
    const opacity =
      tier === 'rank2_5' ? 0.96 : tier === 'rank6_9' ? 0.88 : 0.80;

    return {
      char: rad.char,
      ma: rad.ma,
      isXiao: rad.isXiao,
      rank: rad.rank,
      tier,
      x: slot.x,
      y: slot.y,
      scale,
      rot: slot.rot ?? 0,
      opacity,
      note: rad.note,
    };
  });

  return {
    chamberKey: k,
    monumentChar: def.monumentChar,
    nodes,
  };
}

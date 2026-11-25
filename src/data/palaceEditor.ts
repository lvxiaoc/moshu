// Persistence & import/export utilities for the Memory Palace Cloud Editor (雲圖位置與縮放微調)
// Layers user customizations cleanly on top of DEFAULT_PALACE_LAYOUT_REFINEMENTS
// (zero-overlap, stroke-curve-harmonized coordinates across all 20 chambers).

import { PALACE_PDF_CHAMBERS } from './palacePdfData';
import { DEFAULT_PALACE_LAYOUT_REFINEMENTS } from './palaceLayoutRefinements';

export interface PalaceNodeOverride {
  dx: number; // Offset in 0..100 SVG viewBox coordinates
  dy: number;
  scale: number; // Multiplier around the glyph's own center (default 1)
}

export type PalaceOverridesMap = Record<string, PalaceNodeOverride>;

const STORAGE_KEY = 'inkkey_palace_overrides_v1';
export const PALACE_OVERRIDES_EVENT = 'inkkey:palace-overrides-changed';

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function round2(val: number): number {
  return Math.round(val * 100) / 100;
}

function getBaselineOverride(nodeId: string): PalaceNodeOverride {
  return DEFAULT_PALACE_LAYOUT_REFINEMENTS[nodeId] || { dx: 0, dy: 0, scale: 1 };
}

function isSameOverride(a: PalaceNodeOverride, b: PalaceNodeOverride): boolean {
  return (
    Math.abs(a.dx - b.dx) <= 0.01 &&
    Math.abs(a.dy - b.dy) <= 0.01 &&
    Math.abs(a.scale - b.scale) <= 0.01
  );
}

/** Loads ONLY user-customized overrides stored in localStorage */
export function loadUserPalaceOverrides(): PalaceOverridesMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const clean: PalaceOverridesMap = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (v && typeof v === 'object') {
        const rec = v as Partial<PalaceNodeOverride>;
        const dx = typeof rec.dx === 'number' && Number.isFinite(rec.dx) ? clamp(rec.dx, -45, 45) : 0;
        const dy = typeof rec.dy === 'number' && Number.isFinite(rec.dy) ? clamp(rec.dy, -45, 45) : 0;
        const scale =
          typeof rec.scale === 'number' && Number.isFinite(rec.scale)
            ? clamp(rec.scale, 0.4, 2.2)
            : 1;
        const normalized = { dx: round2(dx), dy: round2(dy), scale: round2(scale) };
        if (!isSameOverride(normalized, getBaselineOverride(k))) {
          clean[k] = normalized;
        }
      }
    }
    return clean;
  } catch {
    return {};
  }
}

/** Loads effective overrides = curated stroke-curve baseline + user customizations */
export function loadPalaceOverrides(): PalaceOverridesMap {
  return {
    ...DEFAULT_PALACE_LAYOUT_REFINEMENTS,
    ...loadUserPalaceOverrides(),
  };
}

export function hasUserChamberOverrides(chamberKey: string): boolean {
  const prefix = `${chamberKey.toLowerCase()}_`;
  const userMap = loadUserPalaceOverrides();
  return Object.keys(userMap).some((id) => id.startsWith(prefix));
}

export function savePalaceOverrides(userMap: PalaceOverridesMap): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userMap));
    window.dispatchEvent(new CustomEvent(PALACE_OVERRIDES_EVENT));
  } catch {
    // Ignore storage quota errors
  }
}

export function updatePalaceNodeOverride(
  nodeId: string,
  patch: Partial<PalaceNodeOverride>
): PalaceOverridesMap {
  const userMap = loadUserPalaceOverrides();
  const prev = userMap[nodeId] || getBaselineOverride(nodeId);
  const nextItem: PalaceNodeOverride = {
    dx: round2(clamp(patch.dx ?? prev.dx, -45, 45)),
    dy: round2(clamp(patch.dy ?? prev.dy, -45, 45)),
    scale: round2(clamp(patch.scale ?? prev.scale, 0.4, 2.2)),
  };

  const nextUser = { ...userMap };
  if (isSameOverride(nextItem, getBaselineOverride(nodeId))) {
    delete nextUser[nodeId];
  } else {
    nextUser[nodeId] = nextItem;
  }
  savePalaceOverrides(nextUser);
  return { ...DEFAULT_PALACE_LAYOUT_REFINEMENTS, ...nextUser };
}

export function resetPalaceNodeOverride(nodeId: string): PalaceOverridesMap {
  const userMap = loadUserPalaceOverrides();
  if (!(nodeId in userMap)) {
    return { ...DEFAULT_PALACE_LAYOUT_REFINEMENTS, ...userMap };
  }
  const nextUser = { ...userMap };
  delete nextUser[nodeId];
  savePalaceOverrides(nextUser);
  return { ...DEFAULT_PALACE_LAYOUT_REFINEMENTS, ...nextUser };
}

export function resetChamberOverrides(chamberKey: string): PalaceOverridesMap {
  const prefix = `${chamberKey.toLowerCase()}_`;
  const userMap = loadUserPalaceOverrides();
  const nextUser: PalaceOverridesMap = {};
  for (const [k, v] of Object.entries(userMap)) {
    if (!k.startsWith(prefix)) {
      nextUser[k] = v;
    }
  }
  savePalaceOverrides(nextUser);
  return { ...DEFAULT_PALACE_LAYOUT_REFINEMENTS, ...nextUser };
}

export function resetAllPalaceOverrides(): PalaceOverridesMap {
  savePalaceOverrides({});
  return { ...DEFAULT_PALACE_LAYOUT_REFINEMENTS };
}

export function exportPalacePositionsJson(): string {
  const overrides = loadPalaceOverrides();
  const chambers: Record<
    string,
    {
      monument: { id: string; char: string; x: number; y: number; scale: number };
      nodes: Array<{ id: string; char: string; ma: string; tier: string; x: number; y: number; scale: number }>;
    }
  > = {};

  for (const [key, ch] of Object.entries(PALACE_PDF_CHAMBERS)) {
    const mOv = overrides[ch.monument.id] || { dx: 0, dy: 0, scale: 1 };
    chambers[key] = {
      monument: {
        id: ch.monument.id,
        char: ch.monument.displayChar,
        x: round2(ch.monument.cx + mOv.dx),
        y: round2(ch.monument.cy + mOv.dy),
        scale: mOv.scale,
      },
      nodes: ch.nodes.map((n) => {
        const ov = overrides[n.id] || { dx: 0, dy: 0, scale: 1 };
        return {
          id: n.id,
          char: n.displayChar,
          ma: n.ma,
          tier: n.tier,
          x: round2(n.cx + ov.dx),
          y: round2(n.cy + ov.dy),
          scale: ov.scale,
        };
      }),
    };
  }

  return JSON.stringify(
    {
      version: 1,
      scheme: 'lingming-memory-palace',
      overrides,
      chambers,
    },
    null,
    2
  );
}

export function importPalacePositionsJson(raw: string): {
  ok: boolean;
  count: number;
  error?: string;
} {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return { ok: false, count: 0, error: 'JSON 格式無效' };
    }

    const next: PalaceOverridesMap = {};

    // Case 1: direct overrides object or { overrides: ... }
    const ovObj =
      parsed.overrides && typeof parsed.overrides === 'object' ? parsed.overrides : null;
    if (ovObj) {
      for (const [id, v] of Object.entries(ovObj)) {
        if (v && typeof v === 'object') {
          const rec = v as Partial<PalaceNodeOverride>;
          next[id] = {
            dx: round2(clamp(Number(rec.dx) || 0, -45, 45)),
            dy: round2(clamp(Number(rec.dy) || 0, -45, 45)),
            scale: round2(clamp(Number(rec.scale) || 1, 0.4, 2.2)),
          };
        }
      }
    } else if (parsed.chambers && typeof parsed.chambers === 'object') {
      // Case 2: compute deltas from absolute { chambers } coordinates
      for (const [key, chData] of Object.entries(parsed.chambers)) {
        const ref = PALACE_PDF_CHAMBERS[key.toLowerCase()];
        if (!ref || !chData || typeof chData !== 'object') continue;
        const c = chData as {
          monument?: { id?: string; x?: number; y?: number; scale?: number };
          nodes?: Array<{ id?: string; x?: number; y?: number; scale?: number }>;
        };
        if (c.monument && typeof c.monument.x === 'number' && typeof c.monument.y === 'number') {
          const dx = round2(c.monument.x - ref.monument.cx);
          const dy = round2(c.monument.y - ref.monument.cy);
          const scale = round2(clamp(Number(c.monument.scale) || 1, 0.4, 2.2));
          if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01 || Math.abs(scale - 1) > 0.01) {
            next[ref.monument.id] = { dx, dy, scale };
          }
        }
        if (Array.isArray(c.nodes)) {
          const byId = new Map(ref.nodes.map((n) => [n.id, n]));
          for (const item of c.nodes) {
            if (!item.id || typeof item.x !== 'number' || typeof item.y !== 'number') continue;
            const orig = byId.get(item.id);
            if (!orig) continue;
            const dx = round2(clamp(item.x - orig.cx, -45, 45));
            const dy = round2(clamp(item.y - orig.cy, -45, 45));
            const scale = round2(clamp(Number(item.scale) || 1, 0.4, 2.2));
            if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01 || Math.abs(scale - 1) > 0.01) {
              next[orig.id] = { dx, dy, scale };
            }
          }
        }
      }
    } else {
      return { ok: false, count: 0, error: '找不到有效的 overrides 或 chambers 欄位' };
    }

    savePalaceOverrides(next);
    return { ok: true, count: Object.keys(next).length };
  } catch (err) {
    return {
      ok: false,
      count: 0,
      error: err instanceof Error ? err.message : '解析失敗',
    };
  }
}

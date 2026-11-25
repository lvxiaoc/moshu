import { HUANGTING_CHAR_MAP, HuangtingCharInfo } from './huangtingjing';

export interface HuangtingCharOverride {
  code?: string;
  shortCode?: string;
  roots?: string[];
  rootCodes?: string[];
  /** Per-stroke root index (0..N-1), or -1 for omitted/neutral middle strokes */
  strokeRootIndices?: number[];
  note?: string;
  updatedAt?: number;
}

export type HuangtingOverrideMap = Record<string, HuangtingCharOverride>;

const USER_OVERRIDES_STORAGE_KEY = 'lingming_huangting_overrides_v1';

/**
 * Version-controlled permanent fixes merged on top of the auto-generated HUANGTING_CHAR_MAP.
 * Users can copy a ready-to-paste patch from the in-app 「拆字校訂」 modal and commit here.
 */
export const BUILTIN_HUANGTING_OVERRIDES: HuangtingOverrideMap = {
  霞: {
    // 雨(0..7) + (8..10, 叚左上三筆) + 二(11..12, 叚左下二橫) + 略コ(13..14, 中間省略部) + 又(15..16)
    strokeRootIndices: [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 2, 2, -1, -1, 3, 3],
    note: '雨(0-7) + (8-10) + 二(11-12) + 略コ(13-14) + 又(15-16)',
  },
};

export function loadUserHuangtingOverrides(): HuangtingOverrideMap {
  try {
    const raw = localStorage.getItem(USER_OVERRIDES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return sanitizeOverrideMap(parsed as Record<string, unknown>);
  } catch {
    return {};
  }
}

export function saveUserHuangtingOverrides(map: HuangtingOverrideMap): void {
  try {
    localStorage.setItem(USER_OVERRIDES_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore storage quota errors
  }
}

export function sanitizeOverrideMap(raw: Record<string, unknown>): HuangtingOverrideMap {
  const clean: HuangtingOverrideMap = {};
  for (const [char, val] of Object.entries(raw)) {
    if (!char || !val || typeof val !== 'object' || Array.isArray(val)) continue;
    const obj = val as Record<string, unknown>;
    const entry: HuangtingCharOverride = {};
    if (typeof obj.code === 'string' && /^[a-zA-Z]{1,6}$/.test(obj.code.trim())) {
      entry.code = obj.code.trim().toLowerCase();
    }
    if (typeof obj.shortCode === 'string') {
      const sc = obj.shortCode.trim().toLowerCase();
      if (sc === '' || /^[a-z]{1,4}$/.test(sc)) {
        entry.shortCode = sc;
      }
    }
    if (Array.isArray(obj.roots) && obj.roots.every((r) => typeof r === 'string')) {
      const roots = obj.roots.map((r) => r.trim()).filter(Boolean);
      if (roots.length > 0) entry.roots = roots;
    }
    if (Array.isArray(obj.rootCodes) && obj.rootCodes.every((r) => typeof r === 'string')) {
      entry.rootCodes = obj.rootCodes.map((r) => r.trim().toLowerCase());
    }
    if (
      Array.isArray(obj.strokeRootIndices) &&
      obj.strokeRootIndices.every((n) => typeof n === 'number' && Number.isInteger(n) && n >= -1 && n <= 12)
    ) {
      entry.strokeRootIndices = obj.strokeRootIndices;
    }
    if (typeof obj.note === 'string' && obj.note.trim()) {
      entry.note = obj.note.trim();
    }
    if (typeof obj.updatedAt === 'number') {
      entry.updatedAt = obj.updatedAt;
    }
    if (Object.keys(entry).length > 0) {
      clean[char] = entry;
    }
  }
  return clean;
}

export function applyOverrideToCharInfo(
  base: HuangtingCharInfo,
  override?: HuangtingCharOverride
): HuangtingCharInfo {
  if (!override) return base;
  const next: HuangtingCharInfo = { ...base };
  if (override.code) next.code = override.code;
  if (override.shortCode !== undefined) {
    if (override.shortCode) next.shortCode = override.shortCode;
    else delete next.shortCode;
  }
  if (override.roots && override.roots.length > 0) next.roots = override.roots;
  if (override.rootCodes && override.rootCodes.length > 0) next.rootCodes = override.rootCodes;
  if (
    override.strokeRootIndices &&
    base.strokes &&
    override.strokeRootIndices.length === base.strokes.length
  ) {
    next.strokeRootIndices = override.strokeRootIndices;
  }
  return next;
}

/**
 * Resolve the effective HuangtingCharInfo for a character:
 * Static base -> Built-in repo overrides -> User localStorage overrides.
 */
export function resolveHuangtingCharInfo(
  char: string,
  userOverrides: HuangtingOverrideMap
): HuangtingCharInfo | undefined {
  const base = HUANGTING_CHAR_MAP[char];
  if (!base) return undefined;
  const withBuiltin = applyOverrideToCharInfo(base, BUILTIN_HUANGTING_OVERRIDES[char]);
  return applyOverrideToCharInfo(withBuiltin, userOverrides[char]);
}

/**
 * Generate a clean, commit-ready TypeScript snippet for src/data/huangtingOverrides.ts
 * combining all user overrides so corrections can be permanently versioned in git.
 */
export function generateOverridesTsPatch(userOverrides: HuangtingOverrideMap): string {
  const keys = Object.keys(userOverrides);
  if (keys.length === 0) return '// 尚無自訂拆字校訂紀錄';
  const lines = keys.map((ch) => {
    const o = userOverrides[ch];
    const compact: Record<string, unknown> = {};
    if (o.code) compact.code = o.code;
    if (o.shortCode !== undefined) compact.shortCode = o.shortCode;
    if (o.roots) compact.roots = o.roots;
    if (o.rootCodes) compact.rootCodes = o.rootCodes;
    if (o.strokeRootIndices) compact.strokeRootIndices = o.strokeRootIndices;
    if (o.note) compact.note = o.note;
    return `  ${JSON.stringify(ch)}: ${JSON.stringify(compact)},`;
  });
  return `// 可貼入 src/data/huangtingOverrides.ts 的 BUILTIN_HUANGTING_OVERRIDES\n{\n${lines.join('\n')}\n}`;
}

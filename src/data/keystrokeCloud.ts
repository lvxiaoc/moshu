import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  CodeRole,
  encodeLingmingRoots,
  LINGMING_CHAMBER_BY_KEY,
  LINGMING_ROOT_MAP,
} from './lingming';
import { PALACE_PDF_CHAMBERS } from './palacePdfData';

const STORAGE_KEY = 'inkkey_keystroke_cloud_v1';
const OPACITY_STORAGE_KEY = 'inkkey_keystroke_cloud_opacity_v1';
const BLEND_STORAGE_KEY = 'inkkey_keystroke_cloud_blend_v1';
const MODE_STORAGE_KEY = 'inkkey_keystroke_cloud_mode_v3';
const SHORT_CODES_STORAGE_KEY = 'inkkey_keystroke_cloud_short_codes_v1';
export const DEFAULT_CLOUD_OPACITY = 0.28;
export const DEFAULT_CLOUD_BLEND = 0.55;
export type CloudRenderMode = 'evolving' | 'palace';
export const DEFAULT_CLOUD_MODE: CloudRenderMode = 'evolving';
export const DEFAULT_CLOUD_INCLUDE_SHORT_CODES = true;

export function loadKeystrokeCloudEnabled(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'false') return false;
    if (raw === 'true') return true;
  } catch {
    // ignore storage errors
  }
  return true;
}

export function saveKeystrokeCloudEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(enabled));
  } catch {
    // ignore storage errors
  }
}

export function loadKeystrokeCloudOpacity(): number {
  try {
    const raw = localStorage.getItem(OPACITY_STORAGE_KEY);
    if (raw !== null) {
      const num = Number(raw);
      if (Number.isFinite(num) && num >= 0.05 && num <= 0.85) {
        return num;
      }
    }
  } catch {
    // ignore storage errors
  }
  return DEFAULT_CLOUD_OPACITY;
}

export function saveKeystrokeCloudOpacity(opacity: number): void {
  try {
    localStorage.setItem(OPACITY_STORAGE_KEY, String(opacity));
  } catch {
    // ignore storage errors
  }
}

export function loadKeystrokeCloudBlend(): number {
  try {
    const raw = localStorage.getItem(BLEND_STORAGE_KEY);
    if (raw !== null) {
      const num = Number(raw);
      if (Number.isFinite(num) && num >= 0.05 && num <= 1.0) {
        return num;
      }
    }
  } catch {
    // ignore storage errors
  }
  return DEFAULT_CLOUD_BLEND;
}

export function saveKeystrokeCloudBlend(blend: number): void {
  try {
    localStorage.setItem(BLEND_STORAGE_KEY, String(blend));
  } catch {
    // ignore storage errors
  }
}

export function loadKeystrokeCloudMode(): CloudRenderMode {
  try {
    const raw = localStorage.getItem(MODE_STORAGE_KEY);
    if (raw === 'palace' || raw === 'evolving') {
      return raw;
    }
  } catch {
    // ignore storage errors
  }
  return DEFAULT_CLOUD_MODE;
}

export function saveKeystrokeCloudMode(mode: CloudRenderMode): void {
  try {
    localStorage.setItem(MODE_STORAGE_KEY, mode);
  } catch {
    // ignore storage errors
  }
}

export function loadKeystrokeCloudIncludeShortCodes(): boolean {
  try {
    const raw = localStorage.getItem(SHORT_CODES_STORAGE_KEY);
    if (raw === 'false') return false;
    if (raw === 'true') return true;
  } catch {
    // ignore storage errors
  }
  return DEFAULT_CLOUD_INCLUDE_SHORT_CODES;
}

export function saveKeystrokeCloudIncludeShortCodes(include: boolean): void {
  try {
    localStorage.setItem(SHORT_CODES_STORAGE_KEY, String(include));
  } catch {
    // ignore storage errors
  }
}

export interface KeystrokeCloudContextValue {
  enabled: boolean;
  setEnabled: (next: boolean) => void;
  toggle: () => void;
  opacity: number;
  setOpacity: (next: number) => void;
  blend: number;
  setBlend: (next: number) => void;
  mode: CloudRenderMode;
  setMode: (next: CloudRenderMode) => void;
  includeShortCodes: boolean;
  setIncludeShortCodes: (next: boolean) => void;
}

export const KeystrokeCloudContext = createContext<KeystrokeCloudContextValue>({
  enabled: true,
  setEnabled: () => {},
  toggle: () => {},
  opacity: DEFAULT_CLOUD_OPACITY,
  setOpacity: () => {},
  blend: DEFAULT_CLOUD_BLEND,
  setBlend: () => {},
  mode: DEFAULT_CLOUD_MODE,
  setMode: () => {},
  includeShortCodes: DEFAULT_CLOUD_INCLUDE_SHORT_CODES,
  setIncludeShortCodes: () => {},
});

export function useKeystrokeCloud(): KeystrokeCloudContextValue {
  return useContext(KeystrokeCloudContext);
}

export function isPalaceChamberKey(key: string | null | undefined): boolean {
  if (!key) return false;
  const k = key.toLowerCase();
  return Boolean(LINGMING_CHAMBER_BY_KEY[k] && PALACE_PDF_CHAMBERS[k]);
}

function chamberContainsGlyph(chamberKey: string, glyph: string): boolean {
  if (!glyph) return false;
  const k = chamberKey.toLowerCase();
  const rootMeta = LINGMING_ROOT_MAP.get(glyph);
  if (rootMeta && rootMeta.chamberKey === k) return true;
  const pdf = PALACE_PDF_CHAMBERS[k];
  if (!pdf) return false;
  if (pdf.monument.displayChar === glyph || pdf.monument.rawChar === glyph) return true;
  return pdf.nodes.some(
    (n) => n.displayChar === glyph || n.rawChar === glyph || n.parentChar === glyph
  );
}

/**
 * Finds the best matching radical glyph from a character's decomposition list
 * for highlighting inside the given consonant key's Memory Palace cloud.
 */
export function resolveRadicalForChamberKey(
  roots: string[] | undefined,
  chamberKey: string,
  preferredIdx?: number
): string | null {
  if (!roots || roots.length === 0 || !isPalaceChamberKey(chamberKey)) return null;
  if (
    preferredIdx !== undefined &&
    preferredIdx >= 0 &&
    preferredIdx < roots.length &&
    chamberContainsGlyph(chamberKey, roots[preferredIdx])
  ) {
    return roots[preferredIdx];
  }
  for (const r of roots) {
    if (chamberContainsGlyph(chamberKey, r)) {
      return r;
    }
  }
  return null;
}

export interface TakenRootSpan {
  /** Start index (inclusive) in rootCodes[i] that is taken into full code */
  matchStart: number;
  /** End index (exclusive) in rootCodes[i] that is taken into full code */
  matchEnd: number;
  /** Start index (inclusive) in character's full code (-1 if root contributes no letters) */
  codeStart: number;
  /** End index (exclusive) in character's full code (-1 if root contributes no letters) */
  codeEnd: number;
}

/**
 * Computes which exact letters of each root's own code (`rootCodes[i]`) are taken
 * into the character's official Lingming full `code` (e.g. 玉: 王 ya -> Y, 丶 tu -> TU => YTU).
 */
export function computeTakenRootSpans(code: string, rootCodes: string[]): TakenRootSpan[] {
  const n = rootCodes.length;
  if (n === 0) return [];
  const r = rootCodes.map((x) => (x || '').toLowerCase());
  const c = (code || '').toLowerCase();

  type Candidate = Array<{ start: number; end: number }>;
  const buildFromLens = (lens: number[]): Candidate =>
    lens.map((len, i) => ({ start: 0, end: Math.min(len, r[i].length) }));

  const candidates: Candidate[] = [];
  if (n === 1) {
    candidates.push(buildFromLens([r[0].length]));
  } else if (n === 2) {
    candidates.push(buildFromLens([1, r[1].length]));
    candidates.push(buildFromLens([2, 2]));
    candidates.push(buildFromLens([2, 1]));
  } else if (n === 3) {
    candidates.push(buildFromLens([1, 1, 2]));
    candidates.push(buildFromLens([2, 1, 1]));
    candidates.push(buildFromLens([1, 2, 1]));
    // Edge case where 3rd root contributes its final vowel (e.g. 暉 hrbe: hri + bi + kce)
    if (r[2].length >= 1) {
      candidates.push([
        { start: 0, end: Math.min(2, r[0].length) },
        { start: 0, end: Math.min(1, r[1].length) },
        { start: r[2].length - 1, end: r[2].length },
      ]);
    }
  } else {
    const last = n - 1;
    // 1st root 2 consonants + 2nd root 1st + last root 1st (大根免三)
    candidates.push(
      r.map((rc, i) => ({
        start: 0,
        end: i === 0 ? Math.min(2, rc.length) : i === 1 || i === last ? Math.min(1, rc.length) : 0,
      }))
    );
    // 1st, 2nd, 3rd, last each 1st key (一二三末)
    candidates.push(
      r.map((rc, i) => ({
        start: 0,
        end: i <= 2 || i === last ? Math.min(1, rc.length) : 0,
      }))
    );
    // 1st 1, 2nd 2, last 1
    candidates.push(
      r.map((rc, i) => ({
        start: 0,
        end: i === 1 ? Math.min(2, rc.length) : i === 0 || i === last ? Math.min(1, rc.length) : 0,
      }))
    );
  }

  for (const cand of candidates) {
    const joined = cand.map((sp, i) => r[i].slice(sp.start, sp.end)).join('');
    if (joined === c) {
      let offset = 0;
      return cand.map((sp) => {
        const len = sp.end - sp.start;
        const out: TakenRootSpan = {
          matchStart: sp.start,
          matchEnd: sp.end,
          codeStart: len > 0 ? offset : -1,
          codeEnd: len > 0 ? offset + len : -1,
        };
        offset += len;
        return out;
      });
    }
  }

  // Safe fallback if a rare override doesn't match standard templates
  return r.map((rc) => ({ matchStart: 0, matchEnd: rc.length, codeStart: -1, codeEnd: -1 }));
}

export interface DaKeySlot {
  /** The Memory Palace consonant key for this radical's 1st key (大碼) */
  chamberKey: string;
  /** Exact radical glyph to highlight inside that palace cloud */
  radical: string | null;
}

/**
 * Resolves whether position `pos` of `code` is a radical's 1st key (大碼 / 字根鍵位碼),
 * strictly returning `null` for phonetic secondary keys (聲碼) and final vowel keys (韻碼).
 */
export function resolveDaSlotFromRoles(
  code: string,
  roots: string[] | undefined,
  roles: CodeRole[] | undefined,
  pos: number
): DaKeySlot | null {
  const c = (code || '').toLowerCase();
  if (pos < 0 || pos >= c.length) return null;

  const ch = c[pos];
  if (!isPalaceChamberKey(ch)) return null;

  const safeRoots = roots || [];
  let effectiveRoles = roles && roles.length > pos ? roles : undefined;

  if (!effectiveRoles && safeRoots.length > 0) {
    const encoded = encodeLingmingRoots(safeRoots);
    if (encoded.code === c && encoded.roles.length === c.length) {
      effectiveRoles = encoded.roles;
    }
  }

  if (effectiveRoles) {
    if (effectiveRoles[pos] !== 'da') return null;

    // Map this 'da' position to its exact constituent root index
    let daOrdinal = 0;
    for (let i = 0; i < pos; i++) {
      if (effectiveRoles[i] === 'da') daOrdinal++;
    }
    const totalDaCount = effectiveRoles.filter((role) => role === 'da').length;
    const isLastDa = daOrdinal === totalDaCount - 1;
    const preferredIdx =
      safeRoots.length > 1 && isLastDa && daOrdinal >= 2
        ? safeRoots.length - 1
        : Math.min(safeRoots.length - 1, daOrdinal);

    return {
      chamberKey: ch,
      radical: resolveRadicalForChamberKey(safeRoots, ch, preferredIdx),
    };
  }

  // Conservative fallback when no role metadata exists: only pos 0 is guaranteed to be a root's 1st key
  if (pos !== 0) return null;
  return {
    chamberKey: ch,
    radical: resolveRadicalForChamberKey(safeRoots, ch, 0),
  };
}

/**
 * Resolves whether position `pos` of a Lingming full `code` (with explicit `rootCodes`)
 * is a radical's 1st key (大碼, i.e., `inRootOffset === 0`).
 * Strictly returns `null` for any root's 2nd key (聲碼) or final vowel key (韻碼).
 */
export function resolveDaSlotFromRootCodes(
  fullCode: string,
  roots: string[],
  rootCodes: string[],
  pos: number,
  precomputedSpans?: TakenRootSpan[]
): DaKeySlot | null {
  const c = (fullCode || '').toLowerCase();
  if (pos < 0 || pos >= c.length) return null;

  const ch = c[pos];
  if (!isPalaceChamberKey(ch)) return null;

  const spans = precomputedSpans ?? computeTakenRootSpans(c, rootCodes);
  const spanIdx = spans.findIndex(
    (sp) => sp.codeStart >= 0 && pos >= sp.codeStart && pos < sp.codeEnd
  );

  if (spanIdx >= 0) {
    const sp = spans[spanIdx];
    const inRootOffset = sp.matchStart + (pos - sp.codeStart);
    // Only the 1st letter (offset 0) of a radical is its Memory Palace key (大碼)
    if (inRootOffset !== 0) return null;
    return {
      chamberKey: ch,
      radical: resolveRadicalForChamberKey(roots, ch, spanIdx) ?? roots[spanIdx] ?? null,
    };
  }

  return resolveDaSlotFromRoles(c, roots, undefined, pos);
}

/**
 * Resolves whether position `pos` of a Lingming short code (`1/2/3`-key direct commit)
 * is a radical's 1st key (大碼). Final self-delimiting vowels and 2nd-letter 聲碼 return `null`.
 */
export function resolveDaSlotForShortCode(
  shortCode: string,
  fullCode: string,
  roots: string[],
  rootCodes: string[],
  pos: number
): DaKeySlot | null {
  const sc = (shortCode || '').toLowerCase();
  const fc = (fullCode || '').toLowerCase();
  if (pos < 0 || pos >= sc.length) return null;

  const ch = sc[pos];
  // 1-key short codes and the terminating vowel of 2/3-key short codes are never palace keys
  if (!isPalaceChamberKey(ch)) return null;

  // Prefix consonant positions (0, or 1 in 3-key short codes) inherit their exact role from fullCode
  if (fc[pos] === ch) {
    return resolveDaSlotFromRootCodes(fc, roots, rootCodes, pos);
  }

  return null;
}

export interface KeystrokeCloudPulse {
  chamberKey: string;
  activeChar: string | null;
  status: 'hit' | 'miss' | 'pressed_only';
  pressedKey?: string;
  tick: number;
  noiseSeed: number;
}

export function useKeystrokeCloudPulse(enabled: boolean) {
  const [pulse, setPulse] = useState<KeystrokeCloudPulse | null>(null);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const clear = useCallback(() => {
    clearTimer();
    setVisible((prev) => (prev ? false : prev));
  }, [clearTimer]);

  const trigger = useCallback(
    (
      chamberKey: string,
      activeChar: string | null,
      status: 'hit' | 'miss' | 'pressed_only' = 'hit',
      pressedKey?: string,
      holdMs?: number
    ) => {
      if (!enabled) return;
      const k = chamberKey.toLowerCase();
      if (!isPalaceChamberKey(k)) return;

      clearTimer();
      const noiseSeed = Math.floor(Math.random() * 997) + 1;
      setPulse((prev) => ({
        chamberKey: k,
        activeChar,
        status,
        pressedKey: pressedKey?.toLowerCase(),
        tick: (prev?.tick ?? 0) + 1,
        noiseSeed,
      }));
      setVisible(true);

      const duration = holdMs ?? (status === 'miss' ? 2800 : 2100);
      timerRef.current = window.setTimeout(() => {
        setVisible(false);
      }, duration);
    },
    [enabled, clearTimer]
  );

  useEffect(() => {
    if (!enabled) {
      clearTimer();
      setVisible((prev) => (prev ? false : prev));
    }
  }, [enabled, clearTimer]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  return { pulse, visible: enabled && visible && Boolean(pulse), trigger, clear };
}

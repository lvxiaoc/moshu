import {
  CodeRole,
  encodeLingmingRoots,
  getLingmingCharScript,
  getLingmingRadicalScript,
  LINGMING_CHAMBERS,
  LINGMING_CHAR_SPLITS,
} from './lingming';
import { CharScript } from './scriptFilter';

export type FingerId =
  | 'L5'
  | 'L4'
  | 'L3'
  | 'L2'
  | 'R2'
  | 'R3'
  | 'R4'
  | 'R5';

export const FINGER_LABELS: Record<FingerId, string> = {
  L5: '左手小指',
  L4: '左手無名指',
  L3: '左手中指',
  L2: '左手食指',
  R2: '右手食指',
  R3: '右手中指',
  R4: '右手無名指',
  R5: '右手小指',
};

export const KEY_FINGER_MAP: Record<string, FingerId> = {
  q: 'L5', a: 'L5', z: 'L5',
  w: 'L4', s: 'L4', x: 'L4',
  e: 'L3', d: 'L3', c: 'L3',
  r: 'L2', f: 'L2', v: 'L2', t: 'L2', g: 'L2', b: 'L2',
  y: 'R2', h: 'R2', n: 'R2', u: 'R2', j: 'R2', m: 'R2',
  i: 'R3', k: 'R3',
  o: 'R4', l: 'R4',
  p: 'R5',
};

export const KEYBOARD_ROWS: string[][] = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
];

export const VOWEL_KEYS = new Set(['a', 'e', 'i', 'o', 'u']);

export interface ZoneDef {
  id: string;
  label: string;
  color: string;
  bgTint: string;
}

export interface KeyDef {
  key: string;
  primary: string;
  sub?: string;
  zoneId: string;
  isVowel?: boolean;
  isDisabled?: boolean;
}

export interface PalaceMeta {
  chamberKey: string;
  anchorChar: string;
  clusterLabel: string;
  siblings: string[];
  isXiao?: boolean;
  note?: string;
}

export type EntryKind = 'da' | 'root' | 'char';

export interface XrayRenderSpec {
  hanziChar: string;
  strokes: string[];
  activeIndices: number[];
  completedIndices?: number[];
  radicalChar: string;
  stepIndex?: number;
  totalSteps?: number;
}

export interface GlyphEntry {
  id: string;
  char: string;
  code: string;
  parts: string[];
  tier: 1 | 2 | 3;
  kind?: EntryKind;
  script?: CharScript;
  roles?: CodeRole[];
  palace?: PalaceMeta;
  xray?: XrayRenderSpec;
  wordPair?: string;
  wordCharIdx?: number;
}

export interface ShapeCodeScheme {
  id: string;
  name: string;
  shortName: string;
  description: string;
  isLingming?: boolean;
  zones: ZoneDef[];
  keyMap: Record<string, KeyDef>;
  entries: GlyphEntry[];
}

// ==================== 1. 靈明輸入法（預設主方案） ====================
const LINGMING_ZONES: ZoneDef[] = [
  { id: 'left-con', label: 'A區・左手大碼', color: '#38A885', bgTint: 'rgba(56, 168, 133, 0.16)' },
  { id: 'right-con', label: 'A區・右手大碼', color: '#4F86C6', bgTint: 'rgba(79, 134, 198, 0.16)' },
  { id: 'vowel', label: 'B區・韻腹終止 (AEIOU)', color: '#D89B3C', bgTint: 'rgba(216, 155, 60, 0.18)' },
  { id: 'unused', label: 'Z鍵不用 (z/zh→V)', color: '#586070', bgTint: 'rgba(88, 96, 112, 0.10)' },
];

const LINGMING_KEYMAP: Record<string, KeyDef> = {
  a: { key: 'a', primary: '了', sub: 'a 韻腹', zoneId: 'vowel', isVowel: true },
  e: { key: 'e', primary: '的', sub: 'e 韻腹', zoneId: 'vowel', isVowel: true },
  i: { key: 'i', primary: '是', sub: 'i 韻腹', zoneId: 'vowel', isVowel: true },
  o: { key: 'o', primary: '我', sub: 'o / 無音', zoneId: 'vowel', isVowel: true },
  u: { key: 'u', primary: '不', sub: 'u 韻腹', zoneId: 'vowel', isVowel: true },
  z: { key: 'z', primary: '不用', sub: 'z/zh→V', zoneId: 'unused', isDisabled: true },
};

for (const ch of LINGMING_CHAMBERS) {
  const isLeft = ch.handGroup.startsWith('left');
  LINGMING_KEYMAP[ch.key] = {
    key: ch.key,
    primary: ch.primaryAnchor,
    sub: ch.subAnchors,
    zoneId: isLeft ? 'left-con' : 'right-con',
  };
}

function buildLingmingEntries(): GlyphEntry[] {
  const entries: GlyphEntry[] = [];
  let seq = 0;

  // Tier 1 (kind: 'da'): 記憶宮殿・大碼1鍵反射（從衍生字根直覺連回基礎字根所屬宮殿）
  for (const ch of LINGMING_CHAMBERS) {
    for (const cl of ch.clusters) {
      const sibs = cl.radicals.map((r) => r.char);
      for (const rad of cl.radicals) {
        entries.push({
          id: `lm_da_${seq++}_${rad.char}`,
          char: rad.char,
          code: ch.key,
          parts: [
            rad.char === cl.anchor
              ? `${ch.key.toUpperCase()} 宮殿核心根`
              : `基礎根「${cl.anchor}」衍生`,
          ],
          tier: 1,
          kind: 'da',
          script: getLingmingRadicalScript(rad.char, ch.key, rad.ma),
          roles: ['da'],
          palace: {
            chamberKey: ch.key,
            anchorChar: cl.anchor,
            clusterLabel: cl.label,
            siblings: sibs,
            isXiao: rad.isXiao,
            note: rad.note,
          },
        });
      }
    }
  }

  // Tier 2 (kind: 'root'): 靈明完整字根碼（小根 2碼 大+韻 / 大根 3碼 大+聲+韻）
  for (const ch of LINGMING_CHAMBERS) {
    for (const cl of ch.clusters) {
      const sibs = cl.radicals.map((r) => r.char);
      for (const rad of cl.radicals) {
        const roles: CodeRole[] = rad.isXiao ? ['da', 'yun'] : ['da', 'sheng', 'yun'];
        entries.push({
          id: `lm_rt_${seq++}_${rad.char}`,
          char: rad.char,
          code: rad.ma,
          parts: rad.isXiao
            ? [`大碼 ${ch.key.toUpperCase()}(${cl.anchor})`, `韻碼 ${rad.ma[1]} · 小根`]
            : [`大碼 ${ch.key.toUpperCase()}(${cl.anchor})`, `聲 ${rad.ma[1]}`, `韻 ${rad.ma[2]}`],
          tier: 2,
          kind: 'root',
          script: getLingmingRadicalScript(rad.char, ch.key, rad.ma),
          roles,
          palace: {
            chamberKey: ch.key,
            anchorChar: cl.anchor,
            clusterLabel: cl.label,
            siblings: sibs,
            isXiao: rad.isXiao,
            note: rad.note,
          },
        });
      }
    }
  }

  // Tier 3 (kind: 'char'): 靈明單字自分割實戰（官方演算法即時精確生成，附繁簡標記）
  for (const [char, roots] of LINGMING_CHAR_SPLITS) {
    const encoded = encodeLingmingRoots(roots);
    entries.push({
      id: `lm_ch_${seq++}_${char}`,
      char,
      code: encoded.code,
      parts: roots,
      tier: 3,
      kind: 'char',
      script: getLingmingCharScript(char),
      roles: encoded.roles,
    });
  }

  return entries;
}

export const LINGMING_SCHEME: ShapeCodeScheme = {
  id: 'lingming',
  name: '靈明輸入法（25鍵自分割 · 記憶宮殿）',
  shortName: '靈明輸入法',
  description:
    '宇浩系列 25 鍵自分割純形碼：20 個輔音大碼鍵（以基礎字根構築記憶宮殿雲圖）＋ 5 個元音韻腹終止鍵（AEIOU），無須空格盲打。',
  isLingming: true,
  zones: LINGMING_ZONES,
  keyMap: LINGMING_KEYMAP,
  entries: buildLingmingEntries(),
};

// ==================== 2. 倉頡五代（備選方案） ====================
const CANGJIE_ZONES: ZoneDef[] = [
  { id: 'phil', label: '哲理類', color: '#D9604C', bgTint: 'rgba(217, 96, 76, 0.14)' },
  { id: 'stroke', label: '筆劃類', color: '#38A885', bgTint: 'rgba(56, 168, 133, 0.14)' },
  { id: 'body', label: '人體類', color: '#4F86C6', bgTint: 'rgba(79, 134, 198, 0.14)' },
  { id: 'shape', label: '字形類', color: '#D89B3C', bgTint: 'rgba(216, 155, 60, 0.14)' },
  { id: 'aux', label: '輔助鍵', color: '#9B75C2', bgTint: 'rgba(155, 117, 194, 0.14)' },
];

const CANGJIE_KEYMAP: Record<string, KeyDef> = {
  a: { key: 'a', primary: '日', sub: '曰', zoneId: 'phil' },
  b: { key: 'b', primary: '月', sub: '爫冖', zoneId: 'phil' },
  c: { key: 'c', primary: '金', sub: '八儿', zoneId: 'phil' },
  d: { key: 'd', primary: '木', sub: '寸皮', zoneId: 'phil' },
  e: { key: 'e', primary: '水', sub: '氵又', zoneId: 'phil' },
  f: { key: 'f', primary: '火', sub: '灬小', zoneId: 'phil' },
  g: { key: 'g', primary: '土', sub: '士', zoneId: 'phil' },
  h: { key: 'h', primary: '竹', sub: '丿彳', zoneId: 'stroke' },
  i: { key: 'i', primary: '戈', sub: '丶广', zoneId: 'stroke' },
  j: { key: 'j', primary: '十', sub: '宀', zoneId: 'stroke' },
  k: { key: 'k', primary: '大', sub: '乂疒', zoneId: 'stroke' },
  l: { key: 'l', primary: '中', sub: '丨衤', zoneId: 'stroke' },
  m: { key: 'm', primary: '一', sub: '工厂', zoneId: 'stroke' },
  n: { key: 'n', primary: '弓', sub: '乙乛', zoneId: 'stroke' },
  o: { key: 'o', primary: '人', sub: '亻入', zoneId: 'body' },
  p: { key: 'p', primary: '心', sub: '忄匕', zoneId: 'body' },
  q: { key: 'q', primary: '手', sub: '扌夫', zoneId: 'body' },
  r: { key: 'r', primary: '口', sub: '吅', zoneId: 'body' },
  s: { key: 's', primary: '尸', sub: '匚己', zoneId: 'shape' },
  t: { key: 't', primary: '廿', sub: '艹並', zoneId: 'shape' },
  u: { key: 'u', primary: '山', sub: '凵乚', zoneId: 'shape' },
  v: { key: 'v', primary: '女', sub: 'く巛', zoneId: 'shape' },
  w: { key: 'w', primary: '田', sub: '囗母', zoneId: 'shape' },
  x: { key: 'x', primary: '難', sub: '重難', zoneId: 'aux' },
  y: { key: 'y', primary: '卜', sub: '亠辶', zoneId: 'shape' },
  z: { key: 'z', primary: '重', sub: '標點', zoneId: 'aux' },
};

const CANGJIE_RAW: Array<[string, string, string[], 1 | 2 | 3]> = [
  ['日', 'a', ['日'], 1], ['月', 'b', ['月'], 1], ['金', 'c', ['金'], 1], ['木', 'd', ['木'], 1],
  ['水', 'e', ['水'], 1], ['火', 'f', ['火'], 1], ['土', 'g', ['土'], 1], ['竹', 'h', ['竹'], 1],
  ['戈', 'i', ['戈'], 1], ['十', 'j', ['十'], 1], ['大', 'k', ['大'], 1], ['中', 'l', ['中'], 1],
  ['一', 'm', ['一'], 1], ['弓', 'n', ['弓'], 1], ['人', 'o', ['人'], 1], ['心', 'p', ['心'], 1],
  ['手', 'q', ['手'], 1], ['口', 'r', ['口'], 1], ['尸', 's', ['尸'], 1], ['廿', 't', ['廿'], 1],
  ['山', 'u', ['山'], 1], ['女', 'v', ['女'], 1], ['田', 'w', ['田'], 1], ['卜', 'y', ['卜'], 1],
  ['明', 'ab', ['日', '月'], 2], ['林', 'dd', ['木', '木'], 2], ['休', 'od', ['人', '木'], 2],
  ['思', 'wp', ['田', '心'], 2], ['忠', 'lp', ['中', '心'], 2], ['天', 'mk', ['一', '大'], 2],
  ['古', 'jr', ['十', '口'], 2], ['早', 'aj', ['日', '十'], 2], ['安', 'jv', ['十', '女'], 2],
  ['門', 'an', ['日', '弓'], 2], ['東', 'dw', ['木', '田'], 2], ['苗', 'tw', ['廿', '田'], 2],
  ['好', 'vnd', ['女', '弓', '木'], 3], ['字', 'jnd', ['十', '弓', '木'], 3],
  ['香', 'hda', ['竹', '木', '日'], 3], ['秋', 'hdf', ['竹', '木', '火'], 3],
  ['音', 'yta', ['卜', '廿', '日'], 3], ['意', 'ytap', ['卜', '廿', '日', '心'], 3],
  ['墨', 'wfg', ['田', '火', '土'], 3], ['道', 'ythu', ['卜', '廿', '竹', '山'], 3],
  ['學', 'hbnd', ['竹', '月', '弓', '木'], 3], ['鍵', 'cnkf', ['金', '弓', '大', '火'], 3],
];

// ==================== 3. 五筆 86（備選方案） ====================
const WUBI_ZONES: ZoneDef[] = [
  { id: 'heng', label: '橫區', color: '#D9604C', bgTint: 'rgba(217, 96, 76, 0.14)' },
  { id: 'shu', label: '豎區', color: '#38A885', bgTint: 'rgba(56, 168, 133, 0.14)' },
  { id: 'pie', label: '撇區', color: '#4F86C6', bgTint: 'rgba(79, 134, 198, 0.14)' },
  { id: 'na', label: '捺區', color: '#D89B3C', bgTint: 'rgba(216, 155, 60, 0.14)' },
  { id: 'zhe', label: '折區', color: '#9B75C2', bgTint: 'rgba(155, 117, 194, 0.14)' },
];

const WUBI_KEYMAP: Record<string, KeyDef> = {
  g: { key: 'g', primary: '王', sub: '一五', zoneId: 'heng' },
  f: { key: 'f', primary: '土', sub: '士二干寸', zoneId: 'heng' },
  d: { key: 'd', primary: '大', sub: '三古石厂', zoneId: 'heng' },
  s: { key: 's', primary: '木', sub: '丁西', zoneId: 'heng' },
  a: { key: 'a', primary: '工', sub: '戈艹七', zoneId: 'heng' },
  h: { key: 'h', primary: '目', sub: '上止卜', zoneId: 'shu' },
  j: { key: 'j', primary: '日', sub: '早蟲', zoneId: 'shu' },
  k: { key: 'k', primary: '口', sub: '川', zoneId: 'shu' },
  l: { key: 'l', primary: '田', sub: '甲囗四力', zoneId: 'shu' },
  m: { key: 'm', primary: '山', sub: '由貝几', zoneId: 'shu' },
  t: { key: 't', primary: '禾', sub: '竹彳反', zoneId: 'pie' },
  r: { key: 'r', primary: '白', sub: '手斤', zoneId: 'pie' },
  e: { key: 'e', primary: '月', sub: '彡乃用', zoneId: 'pie' },
  w: { key: 'w', primary: '人', sub: '八登頭', zoneId: 'pie' },
  q: { key: 'q', primary: '金', sub: '勹欠夕', zoneId: 'pie' },
  y: { key: 'y', primary: '言', sub: '文方廣', zoneId: 'na' },
  u: { key: 'u', primary: '立', sub: '辛六門', zoneId: 'na' },
  i: { key: 'i', primary: '水', sub: '氵小', zoneId: 'na' },
  o: { key: 'o', primary: '火', sub: '灬米', zoneId: 'na' },
  p: { key: 'p', primary: '之', sub: '宀冖辶', zoneId: 'na' },
  n: { key: 'n', primary: '已', sub: '己尸心羽', zoneId: 'zhe' },
  b: { key: 'b', primary: '子', sub: '了也耳', zoneId: 'zhe' },
  v: { key: 'v', primary: '女', sub: '刀九臼', zoneId: 'zhe' },
  c: { key: 'c', primary: '又', sub: '巴馬厶', zoneId: 'zhe' },
  x: { key: 'x', primary: '幺', sub: '糹母弓匕', zoneId: 'zhe' },
  z: { key: 'z', primary: '萬', sub: '學習鍵', zoneId: 'zhe' },
};

const WUBI_RAW: Array<[string, string, string[], 1 | 2 | 3]> = [
  ['一', 'g', ['王區'], 1], ['地', 'f', ['土區'], 1], ['在', 'd', ['大區'], 1], ['要', 's', ['木區'], 1],
  ['工', 'a', ['工區'], 1], ['上', 'h', ['目區'], 1], ['是', 'j', ['日區'], 1], ['中', 'k', ['口區'], 1],
  ['国', 'l', ['田區'], 1], ['同', 'm', ['山區'], 1], ['和', 't', ['禾區'], 1], ['的', 'r', ['白區'], 1],
  ['有', 'e', ['月區'], 1], ['人', 'w', ['人區'], 1], ['我', 'q', ['金區'], 1], ['主', 'y', ['言區'], 1],
  ['产', 'u', ['立區'], 1], ['不', 'i', ['水區'], 1], ['为', 'o', ['火區'], 1], ['这', 'p', ['之區'], 1],
  ['民', 'n', ['已區'], 1], ['了', 'b', ['子區'], 1], ['发', 'v', ['女區'], 1], ['以', 'c', ['又區'], 1],
  ['经', 'x', ['幺區'], 1],
  ['明', 'je', ['日', '月'], 2], ['休', 'ws', ['人', '木'], 2], ['林', 'ss', ['木', '木'], 2],
  ['好', 'vb', ['女', '子'], 2], ['天', 'gd', ['一', '大'], 2], ['早', 'jh', ['日', '十'], 2],
  ['香', 'tj', ['禾', '日'], 2], ['秋', 'to', ['禾', '火'], 2], ['思', 'ln', ['田', '心'], 2],
  ['字', 'pb', ['宀', '子'], 2], ['安', 'pv', ['宀', '女'], 2], ['花', 'aw', ['艹', '化'], 2],
  ['晶', 'jjj', ['日', '日', '日'], 3], ['森', 'sss', ['木', '木', '木'], 3],
  ['音', 'ujf', ['立', '日', '一'], 3], ['意', 'ujn', ['立', '日', '心'], 3],
  ['墨', 'lfof', ['田', '土', '灬', '土'], 3], ['道', 'uthp', ['立', '丿', '目', '辶'], 3],
];

function hydrateEntries(
  schemeId: string,
  raw: Array<[string, string, string[], 1 | 2 | 3]>
): GlyphEntry[] {
  return raw.map(([char, code, parts, tier], idx) => ({
    id: `${schemeId}_${idx}_${char}`,
    char,
    code: code.toLowerCase(),
    parts,
    tier,
  }));
}

export const BUILTIN_SCHEMES: ShapeCodeScheme[] = [
  LINGMING_SCHEME,
  {
    id: 'cangjie5',
    name: '倉頡五代（精選高頻）',
    shortName: '倉頡五代',
    description: '涵蓋 24 個核心字根與高頻拆字，依哲理、筆劃、人體、字形分區鍛煉。',
    zones: CANGJIE_ZONES,
    keyMap: CANGJIE_KEYMAP,
    entries: hydrateEntries('cangjie5', CANGJIE_RAW),
  },
  {
    id: 'wubi86',
    name: '五筆 86（五區字根與簡全碼）',
    shortName: '五筆 86',
    description: '橫豎撇捺折五區分布，收錄全部 25 個一級簡碼與高頻詞根。',
    zones: WUBI_ZONES,
    keyMap: WUBI_KEYMAP,
    entries: hydrateEntries('wubi86', WUBI_RAW),
  },
];

const CUSTOM_SCHEME_STORAGE_KEY = 'inkkey_custom_scheme_v1';

export interface CustomSchemeDraft {
  name: string;
  keyMapText: string;
  entriesText: string;
}

export const DEFAULT_CUSTOM_DRAFT: CustomSchemeDraft = {
  name: '我的自定義靈明擴充表',
  keyMapText: LINGMING_CHAMBERS.map(
    (c) => `${c.key}:${c.primaryAnchor}:${c.handGroup.startsWith('left') ? '左手大碼' : '右手大碼'}:${c.subAnchors}`
  ).join('\n'),
  entriesText: [
    '# 格式：漢字  編碼  拆解(可選，用+分隔)',
    '灵\tbpo\t彐+火',
    '明\thrle\t日+月',
    '好\tfhvi\t女+子',
    '拿\tnhls\t合+手',
    '引\tggki\t弓+丨',
    '墨\tshsu\t黑+土',
  ].join('\n'),
};

const ZONE_PALETTE = [
  { color: '#38A885', bgTint: 'rgba(56, 168, 133, 0.14)' },
  { color: '#4F86C6', bgTint: 'rgba(79, 134, 198, 0.14)' },
  { color: '#D89B3C', bgTint: 'rgba(216, 155, 60, 0.14)' },
  { color: '#D9604C', bgTint: 'rgba(217, 96, 76, 0.14)' },
  { color: '#9B75C2', bgTint: 'rgba(155, 117, 194, 0.14)' },
];

export function parseCustomScheme(draft: CustomSchemeDraft): {
  scheme: ShapeCodeScheme | null;
  error: string | null;
} {
  const zonesMap = new Map<string, ZoneDef>();
  const keyMap: Record<string, KeyDef> = {};

  const getOrCreateZone = (label: string): string => {
    const clean = label.trim() || '預設區';
    if (!zonesMap.has(clean)) {
      const pal = ZONE_PALETTE[zonesMap.size % ZONE_PALETTE.length];
      zonesMap.set(clean, {
        id: `z_${zonesMap.size}`,
        label: clean,
        color: pal.color,
        bgTint: pal.bgTint,
      });
    }
    return zonesMap.get(clean)!.id;
  };

  for (const rawLine of draft.keyMapText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) continue;
    const parts = line.split(/[:\t,]+/).map((s) => s.trim());
    const key = (parts[0] || '').toLowerCase();
    if (!/^[a-z]$/.test(key)) continue;
    const primary = parts[1] || key.toUpperCase();
    const zoneLabel = parts[2] || '自定義區';
    const sub = parts[3] || '';
    keyMap[key] = {
      key,
      primary,
      sub,
      zoneId: getOrCreateZone(zoneLabel),
    };
  }

  const defaultZoneId = getOrCreateZone('韻腹 / 預設');
  for (const row of KEYBOARD_ROWS) {
    for (const k of row) {
      if (!keyMap[k]) {
        keyMap[k] = {
          key: k,
          primary: VOWEL_KEYS.has(k) ? `韻 ${k.toUpperCase()}` : k.toUpperCase(),
          zoneId: defaultZoneId,
          isVowel: VOWEL_KEYS.has(k),
        };
      }
    }
  }

  const entries: GlyphEntry[] = [];
  for (const rawLine of draft.entriesText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) continue;
    const cols = line.split(/[\t, ]+/).filter(Boolean);
    if (cols.length < 2) continue;
    const char = cols[0];
    const code = cols[1].toLowerCase().replace(/[^a-z]/g, '');
    if (!char || !code) continue;
    const partsRaw = cols.slice(2).join(' ');
    const parts = partsRaw
      ? partsRaw.split(/[+＋/／・\s]+/).filter(Boolean)
      : code.split('').map((c) => keyMap[c]?.primary || c.toUpperCase());
    const tier: 1 | 2 | 3 = code.length === 1 ? 1 : code.length === 2 ? 2 : 3;
    entries.push({
      id: `custom_${entries.length}_${char}`,
      char,
      code,
      parts,
      tier,
    });
  }

  if (entries.length < 3) {
    return { scheme: null, error: '請至少輸入 3 條有效碼表條目（格式：漢字 編碼 拆解）。' };
  }

  return {
    scheme: {
      id: 'custom',
      name: draft.name.trim() || '我的自定義形碼',
      shortName: (draft.name.trim() || '自定義').slice(0, 6),
      description: `已匯入 ${entries.length} 個自定義條目，支援漸隱鷹架與弱鍵靶向特訓。`,
      zones: Array.from(zonesMap.values()),
      keyMap,
      entries,
    },
    error: null,
  };
}

export function loadSavedCustomDraft(): CustomSchemeDraft {
  try {
    const raw = localStorage.getItem(CUSTOM_SCHEME_STORAGE_KEY);
    if (!raw) return DEFAULT_CUSTOM_DRAFT;
    const parsed = JSON.parse(raw) as Partial<CustomSchemeDraft>;
    if (parsed.keyMapText && parsed.entriesText) {
      return {
        name: parsed.name || DEFAULT_CUSTOM_DRAFT.name,
        keyMapText: parsed.keyMapText,
        entriesText: parsed.entriesText,
      };
    }
  } catch {
    // Ignore storage read errors
  }
  return DEFAULT_CUSTOM_DRAFT;
}

export function saveCustomDraft(draft: CustomSchemeDraft): void {
  try {
    localStorage.setItem(CUSTOM_SCHEME_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Ignore storage write errors
  }
}

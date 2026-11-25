import type { CharScript } from './scriptFilter';

export interface LingmingRadical {
  char: string;
  ma: string; // e.g. "hri", "fi", "lso"
  isXiao: boolean; // true = 2-code 小根 (da+yun), false = 3-code 大根 (da+sheng+yun)
  rank: number; // 1 = 主根（最高頻）, 2..5 = 高頻, 6..9 = 中頻, 10+ = 其餘
  note?: string;
}

export interface PalaceCluster {
  id: string;
  anchor: string; // 分組標記（依頻率層級）
  label: string; // 說明
  radicals: LingmingRadical[];
}

export interface PalaceChamber {
  key: string; // lowercase consonant key (b,c,d,f,g,h,j,k,l,m,n,p,q,r,s,t,v,w,x,y)
  primaryAnchor: string; // 該鍵使用頻率最高的「主根」（壁畫骨架）
  subAnchors: string; // 第 2–5 高頻字根速覽
  handGroup: 'left-top' | 'left-home' | 'left-bot' | 'right-top' | 'right-home' | 'right-bot';
  mnemonic: string; // 記憶宮殿順筆口訣
  clusters: PalaceCluster[];
}

const mk = (char: string, ma: string, rank: number, note?: string): LingmingRadical => ({
  char,
  ma: ma.toLowerCase(),
  isXiao: ma.length === 2,
  rank,
  note,
});

function buildFreqClusters(key: string, primary: string, list: LingmingRadical[]): PalaceCluster[] {
  const rank1 = list.filter((r) => r.rank === 1);
  const rank25 = list.filter((r) => r.rank >= 2 && r.rank <= 5);
  const rank69 = list.filter((r) => r.rank >= 6 && r.rank <= 9);
  const rankRest = list.filter((r) => r.rank >= 10);

  const clusters: PalaceCluster[] = [];
  if (rank1.length > 0) {
    clusters.push({
      id: `${key}-primary`,
      anchor: primary,
      label: '主根（最高頻骨架）',
      radicals: rank1,
    });
  }
  if (rank25.length > 0) {
    clusters.push({
      id: `${key}-r25`,
      anchor: primary,
      label: '第 2–5 高頻字根',
      radicals: rank25,
    });
  }
  if (rank69.length > 0) {
    clusters.push({
      id: `${key}-r69`,
      anchor: primary,
      label: '第 6–9 中頻字根',
      radicals: rank69,
    });
  }
  if (rankRest.length > 0) {
    clusters.push({
      id: `${key}-rest`,
      anchor: primary,
      label: '其餘字根（順筆排布）',
      radicals: rankRest,
    });
  }
  return clusters;
}

// 100% verified from official 宇浩·靈明輸入法 (shurufa.app/zigen-ling.csv)
// + 嚴格按用戶「靈明字根 · 記憶宮殿」A4 壁畫地圖的主根與頻率順位排布
export const LINGMING_CHAMBERS: PalaceChamber[] = [
  {
    key: 'q',
    primaryAnchor: '又',
    subAnchors: '卌 卅 艹 廾',
    handGroup: 'left-top',
    mnemonic: '主根「又」居中，上橫承卌卅艹廾，末捺接其',
    clusters: buildFreqClusters('q', '又', [
      mk('又', 'qo', 1, '主根 · 小根'),
      mk('卌', 'qi', 2, '卌母根'),
      mk('卅', 'qi', 3, '同卌歸併'),
      mk('艹', 'qi', 4, '草頭 · 同卌'),
      mk('廾', 'qi', 5, '同卌歸併'),
      mk('其', 'qki', 6, 'q 聲母作 k'),
    ]),
  },
  {
    key: 'w',
    primaryAnchor: '辶',
    subAnchors: '亅 讠 禾 犬',
    handGroup: 'left-top',
    mnemonic: '主根「辶」走之領頭，點折引亅讠禾犬，長捺托乙片革',
    clusters: buildFreqClusters('w', '辶', [
      mk('辶', 'wo', 1, '主根 · 走之底'),
      mk('亅', 'wi', 2, '折筆同乙'),
      mk('讠', 'wa', 3, '言字旁'),
      mk('禾', 'whe', 4),
      mk('犬', 'wa', 5),
      mk('乙', 'wi', 6, '一切折筆'),
      mk('乚', 'wi', 7, '豎彎鉤'),
      mk('乃', 'wna', 8),
      mk('犭', 'wka', 9, '反犬旁 · q→k'),
      mk('片', 'wpa', 10),
      mk('卯', 'wma', 11),
      mk('夭', 'wya', 12),
      mk('禺', 'wyu', 13),
      mk('革', 'wge', 14),
      mk('爿', 'wa', 15),
    ]),
  },
  {
    key: 'r',
    primaryAnchor: '二',
    subAnchors: '⺀ 冫 见 卜',
    handGroup: 'left-top',
    mnemonic: '主根「二」上下雙橫，上排冫見卜羊，下橫載業馬言病虎',
    clusters: buildFreqClusters('r', '二', [
      mk('二', 'rje', 1, '主根 · 零聲母作 j'),
      mk('⺀', 'rje', 2, '同二歸併'),
      mk('冫', 'rje', 3, '兩點水 · 同二'),
      mk('见', 'rja', 4),
      mk('卜', 'rpu', 5),
      mk('羊', 'rya', 6),
      mk('丂', 'rka', 7),
      mk('业', 'rye', 8),
      mk('丬', 'ra', 9),
      mk('马', 'rma', 10),
      mk('之', 'ri', 11),
      mk('罒', 'rwa', 12, '網字頭'),
      mk('皿', 'rmi', 13),
      mk('言', 'ra', 14),
      mk('疒', 'rne', 15, '病字頭'),
      mk('虎', 'rhu', 16),
      mk('虍', 'rhu', 17, '虎字頭'),
      mk('辰', 'rce', 18),
      mk('來', 'rla', 19),
      mk('鹵', 'rlu', 20),
    ]),
  },
  {
    key: 't',
    primaryAnchor: '丶',
    subAnchors: '乀 扌 匕 用',
    handGroup: 'left-top',
    mnemonic: '主根「丶」一筆斜落，順勢串起乀扌匕用欠',
    clusters: buildFreqClusters('t', '丶', [
      mk('丶', 'tu', 1, '主根 · 點'),
      mk('乀', 'tu', 2, '捺'),
      mk('扌', 'to', 3, '提手旁'),
      mk('匕', 'ti', 4),
      mk('用', 'to', 5),
      mk('欠', 'tka', 6, 'q 聲母作 k'),
    ]),
  },
  {
    key: 'y',
    primaryAnchor: '大',
    subAnchors: '王 夫 非 糸',
    handGroup: 'right-top',
    mnemonic: '主根「大」橫撇捺開展，王夫懸橫、非糸垂撇、瓦落捺尾',
    clusters: buildFreqClusters('y', '大', [
      mk('大', 'yda', 1, '主根'),
      mk('王', 'ya', 2),
      mk('夫', 'yfu', 3),
      mk('非', 'yfe', 4),
      mk('糸', 'yi', 5),
      mk('瓦', 'ywa', 6),
    ]),
  },
  {
    key: 'p',
    primaryAnchor: '勹',
    subAnchors: '儿 灬 火 巴',
    handGroup: 'right-top',
    mnemonic: '主根「勹」撇起兒四點火，折鉤外環巴石川臼',
    clusters: buildFreqClusters('p', '勹', [
      mk('勹', 'pa', 1, '主根 · 包字頭'),
      mk('儿', 'pe', 2),
      mk('灬', 'pba', 3, '四點底'),
      mk('火', 'po', 4),
      mk('巴', 'pa', 5),
      mk('石', 'psi', 6),
      mk('川', 'pca', 7),
      mk('巛', 'pca', 8, '同川歸併'),
      mk('臼', 'pu', 9),
    ]),
  },
  {
    key: 's',
    primaryAnchor: '土',
    subAnchors: '也 耂 尤 豕',
    handGroup: 'left-home',
    mnemonic: '主根「土」上橫托也耂，中豎串牛士山黑，底橫載鳥烏魚',
    clusters: buildFreqClusters('s', '土', [
      mk('土', 'su', 1, '主根'),
      mk('也', 'se', 2),
      mk('耂', 'sla', 3, '老字頭'),
      mk('尤', 'syo', 4),
      mk('豕', 'ssi', 5),
      mk('牛', 'snu', 6),
      mk('士', 'si', 7),
      mk('山', 'ssa', 8),
      mk('廴', 'si', 9, '建之底'),
      mk('黑', 'she', 10),
      mk('九', 'sju', 11),
      mk('尢', 'so', 12, '尤本字'),
      mk('鳥', 'sna', 13),
      mk('烏', 'swu', 14),
      mk('魚', 'syu', 15),
      mk('乜', 'sme', 16),
    ]),
  },
  {
    key: 'd',
    primaryAnchor: '口',
    subAnchors: '〇 目 斤 耳',
    handGroup: 'left-home',
    mnemonic: '主根「口」左豎列〇目斤，上橫排耳而皮，右折面雨早，底托舟曲',
    clusters: buildFreqClusters('d', '口', [
      mk('口', 'do', 1, '主根'),
      mk('〇', 'do', 2, '同口歸併'),
      mk('目', 'dmu', 3),
      mk('斤', 'dji', 4),
      mk('耳', 'dje', 5, '零聲母作 j'),
      mk('而', 'de', 6),
      mk('皮', 'dpi', 7),
      mk('面', 'dma', 8),
      mk('雨', 'dyu', 9),
      mk('早', 'da', 10),
      mk('舟', 'dvo', 11, 'zh 作 v'),
      mk('曲', 'dku', 12, 'q 作 k'),
    ]),
  },
  {
    key: 'f',
    primaryAnchor: '一',
    subAnchors: '女 厂 丆 足',
    handGroup: 'left-home',
    mnemonic: '主根「一」一字排開，上列女厂足正衤母，下排亥世牙鳥見頁',
    clusters: buildFreqClusters('f', '一', [
      mk('一', 'fi', 1, '主根'),
      mk('女', 'fu', 2),
      mk('厂', 'fa', 3),
      mk('丆', 'fa', 4),
      mk('足', 'fvu', 5, 'z 作 v'),
      mk('正', 'fe', 6),
      mk('衤', 'fyi', 7, '衣字旁'),
      mk('母', 'fmu', 8),
      mk('亥', 'fha', 9),
      mk('世', 'fsi', 10),
      mk('牙', 'fya', 11),
      mk('鸟', 'fna', 12),
      mk('彑', 'fo', 13, '生僻取 o'),
      mk('乌', 'fwu', 14),
      mk('見', 'fja', 15),
      mk('頁', 'fye', 16),
    ]),
  },
  {
    key: 'g',
    primaryAnchor: '厶',
    subAnchors: '阝 艮 工 田',
    handGroup: 'left-home',
    mnemonic: '主根「厶」左斜列阝艮工田，底橫弓丰由電申，右點幺氣魚馬',
    clusters: buildFreqClusters('g', '厶', [
      mk('厶', 'gi', 1, '主根 · 私本字'),
      mk('阝', 'gu', 2, '掛耳旁'),
      mk('艮', 'gge', 3),
      mk('工', 'go', 4),
      mk('田', 'gta', 5),
      mk('弓', 'ggo', 6),
      mk('丰', 'ge', 7),
      mk('由', 'gyo', 8),
      mk('电', 'gda', 9),
      mk('申', 'gse', 10),
      mk('幺', 'gya', 11),
      mk('气', 'gki', 12, 'q 作 k'),
      mk('鱼', 'gyu', 13),
      mk('馬', 'gma', 14),
    ]),
  },
  {
    key: 'h',
    primaryAnchor: '日',
    subAnchors: '子 文 丁 丅',
    handGroup: 'right-home',
    mnemonic: '主根「日」左豎子文丁了示，上橫礻广隹走下钅，右折身予長曰髟孑',
    clusters: buildFreqClusters('h', '日', [
      mk('日', 'hri', 1, '主根'),
      mk('子', 'hvi', 2, 'z 作 v'),
      mk('文', 'hwe', 3),
      mk('丁', 'hdi', 4),
      mk('丅', 'hdi', 5, '同丁歸併'),
      mk('了', 'hla', 6),
      mk('示', 'hsi', 7),
      mk('礻', 'hsi', 8, '示字旁'),
      mk('广', 'hga', 9),
      mk('隹', 'hi', 10),
      mk('走', 'hvo', 11, 'z 作 v'),
      mk('下', 'ha', 12),
      mk('钅', 'hi', 13, '金字旁'),
      mk('身', 'hse', 14),
      mk('予', 'hu', 15),
      mk('長', 'hca', 16),
      mk('曰', 'hye', 17),
      mk('髟', 'hba', 18),
      mk('孑', 'hje', 19),
    ]),
  },
  {
    key: 'j',
    primaryAnchor: '亻',
    subAnchors: '寸 夂 夊 攵',
    handGroup: 'right-home',
    mnemonic: '主根「亻」單人旁起筆，斜撇串寸夂攵亠凵，長豎列生丩三入向饣風',
    clusters: buildFreqClusters('j', '亻', [
      mk('亻', 'je', 1, '主根 · 單人旁'),
      mk('寸', 'jcu', 2),
      mk('夂', 'jvi', 3, '折文 · zh→v'),
      mk('夊', 'jvi', 4, '同夂歸併'),
      mk('攵', 'jvi', 5, '反文 · 同夂'),
      mk('亠', 'jo', 6, '京字頭'),
      mk('凵', 'ja', 7),
      mk('生', 'je', 8),
      mk('丩', 'ju', 9),
      mk('屮', 'jca', 10),
      mk('卩', 'jje', 11),
      mk('三', 'jsa', 12),
      mk('入', 'jru', 13),
      mk('向', 'jxa', 14),
      mk('饣', 'jsi', 15, '食字旁'),
      mk('風', 'jfe', 16),
      mk('丱', 'jga', 17),
    ]),
  },
  {
    key: 'k',
    primaryAnchor: '白',
    subAnchors: '丨 丿 宀 力',
    handGroup: 'right-home',
    mnemonic: '主根「白」左列丨丿宀力彳上，頂至几彡矢，右穴尚長亡，內外缶骨丑車',
    clusters: buildFreqClusters('k', '白', [
      mk('白', 'kba', 1, '主根'),
      mk('丨', 'ki', 2, '豎'),
      mk('丿', 'ke', 3, '撇'),
      mk('宀', 'ka', 4, '寶蓋頭'),
      mk('力', 'kli', 5),
      mk('彳', 'ki', 6, '雙人旁'),
      mk('上', 'ka', 7),
      mk('殳', 'ku', 8),
      mk('至', 'kvi', 9, 'zh 作 v'),
      mk('几', 'kji', 10),
      mk('彡', 'ka', 11),
      mk('矢', 'ksi', 12),
      mk('穴', 'kxe', 13),
      mk('尚', 'ksa', 14),
      mk('长', 'kca', 15),
      mk('亡', 'kwa', 16),
      mk('缶', 'kfo', 17),
      mk('骨', 'kgu', 18),
      mk('丑', 'kco', 19),
      mk('車', 'kce', 20),
      mk('亍', 'kcu', 21),
      mk('咼', 'ka', 22),
    ]),
  },
  {
    key: 'l',
    primaryAnchor: '月',
    subAnchors: '止 不 八 十',
    handGroup: 'right-home',
    mnemonic: '主根「月」左撇止不八十夕冂，頂橫手古舌干戶，右折千壬未冊毛甫末',
    clusters: buildFreqClusters('l', '月', [
      mk('月', 'le', 1, '主根'),
      mk('止', 'lvi', 2, 'zh 作 v'),
      mk('不', 'lbu', 3),
      mk('八', 'la', 4),
      mk('十', 'li', 5),
      mk('夕', 'lxi', 6),
      mk('冂', 'ljo', 7),
      mk('手', 'lso', 8),
      mk('古', 'lgu', 9),
      mk('舌', 'lse', 10),
      mk('干', 'lga', 11),
      mk('戶', 'lu', 12),
      mk('千', 'lka', 13, 'q 作 k'),
      mk('户', 'lhu', 14),
      mk('壬', 'lre', 15),
      mk('未', 'lwe', 16),
      mk('冊', 'lce', 17),
      mk('毛', 'lma', 18),
      mk('甫', 'lfu', 19),
      mk('末', 'lmo', 20),
      mk('鬥', 'ldo', 21),
      mk('飛', 'lfe', 22),
      mk('齒', 'lci', 23),
    ]),
  },
  {
    key: 'x',
    primaryAnchor: '木',
    subAnchors: '朩 里 匚 习',
    handGroup: 'left-bot',
    mnemonic: '主根「木」橫托朩，豎串里，撇落匚，捺收習與甲',
    clusters: buildFreqClusters('x', '木', [
      mk('木', 'xu', 1, '主根'),
      mk('朩', 'xu', 2, '同木歸併'),
      mk('里', 'xli', 3),
      mk('匚', 'xfa', 4),
      mk('习', 'xi', 5),
      mk('甲', 'xja', 6),
    ]),
  },
  {
    key: 'c',
    primaryAnchor: '丷',
    subAnchors: '纟 贝 己 页',
    handGroup: 'left-bot',
    mnemonic: '主根「丷」雙腿倒八，左翼垂纟貝己，右撇頁巳高金麻鹿門',
    clusters: buildFreqClusters('c', '丷', [
      mk('丷', 'ca', 1, '主根 · 雙腿八'),
      mk('纟', 'ci', 2, '絞絲旁'),
      mk('贝', 'cbe', 3),
      mk('己', 'cji', 4),
      mk('页', 'cye', 5),
      mk('巳', 'csi', 6),
      mk('高', 'cga', 7),
      mk('㔾', 'cje', 8),
      mk('已', 'cyi', 9),
      mk('金', 'ci', 10),
      mk('麻', 'cma', 11),
      mk('丌', 'ci', 12),
      mk('鹿', 'clu', 13),
      mk('門', 'cme', 14),
    ]),
  },
  {
    key: 'v',
    primaryAnchor: '水',
    subAnchors: '氺 氵 刂 米',
    handGroup: 'left-bot',
    mnemonic: '主根「水」中豎串氺氵刂米巾刀，左撇且亦，右捺鬼甶',
    clusters: buildFreqClusters('v', '水', [
      mk('水', 'vi', 1, '主根'),
      mk('氺', 'vi', 2, '同水歸併'),
      mk('氵', 'vi', 3, '三點水'),
      mk('刂', 'vda', 4, '立刀旁'),
      mk('米', 'vmi', 5),
      mk('巾', 'vji', 6),
      mk('刀', 'va', 7),
      mk('且', 'vke', 8, 'q 作 k'),
      mk('亦', 'vyi', 9),
      mk('鬼', 'vgi', 10),
      mk('甶', 'vfu', 11),
    ]),
  },
  {
    key: 'b',
    primaryAnchor: '冖',
    subAnchors: '乂 立 门 彐',
    handGroup: 'left-bot',
    mnemonic: '主根「冖」禿寶蓋起左乂，橫頂排立門彐肀虫辛臣隸',
    clusters: buildFreqClusters('b', '冖', [
      mk('冖', 'bi', 1, '主根 · 禿寶蓋'),
      mk('乂', 'bi', 2),
      mk('立', 'bli', 3),
      mk('门', 'bme', 4),
      mk('彐', 'bo', 5, '生僻取 o'),
      mk('肀', 'bo', 6, '同彐歸併'),
      mk('虫', 'bo', 7),
      mk('辛', 'bxi', 8),
      mk('臣', 'be', 9),
      mk('隶', 'bi', 10),
    ]),
  },
  {
    key: 'n',
    primaryAnchor: '人',
    subAnchors: '小 ⺌ 囗 竹',
    handGroup: 'right-bot',
    mnemonic: '主根「人」撇落小⺌囗竹合，捺展自西兀酉食僉貝',
    clusters: buildFreqClusters('n', '人', [
      mk('人', 'ne', 1, '主根'),
      mk('小', 'nxa', 2),
      mk('⺌', 'na', 3),
      mk('囗', 'nwe', 4, '圍框'),
      mk('竹', 'nu', 5),
      mk('自', 'nvi', 6, 'z 作 v'),
      mk('西', 'ni', 7),
      mk('合', 'nhe', 8),
      mk('兀', 'nwu', 9),
      mk('酉', 'nyo', 10),
      mk('食', 'nsi', 11),
      mk('僉', 'na', 12),
      mk('貝', 'nbe', 13),
    ]),
  },
  {
    key: 'm',
    primaryAnchor: '𠂇',
    subAnchors: '戈 心 忄 尸',
    handGroup: 'right-bot',
    mnemonic: '主根「𠂇」左本字，上橫戈心忄尸方，長撇車七戊爪弋瓜癶豸',
    clusters: buildFreqClusters('m', '𠂇', [
      mk('𠂇', 'mvo', 1, '主根 · 左本字'),
      mk('戈', 'mge', 2),
      mk('心', 'mxi', 3),
      mk('忄', 'mi', 4, '豎心旁'),
      mk('尸', 'msi', 5),
      mk('方', 'mfa', 6),
      mk('车', 'mce', 7),
      mk('七', 'mi', 8),
      mk('戊', 'mwu', 9),
      mk('爪', 'ma', 10),
      mk('弋', 'myi', 11),
      mk('瓜', 'mga', 12),
      mk('癶', 'mo', 13),
      mk('豸', 'mvi', 14, 'zh 作 v'),
    ]),
  },
];

export const LINGMING_CHAMBER_BY_KEY: Record<string, PalaceChamber> = Object.fromEntries(
  LINGMING_CHAMBERS.map((c) => [c.key, c])
);

export const LINGMING_ROOT_MAP: Map<
  string,
  LingmingRadical & { chamberKey: string; anchor: string; clusterLabel: string; siblings: string[] }
> = new Map();

for (const chamber of LINGMING_CHAMBERS) {
  const allSiblings = chamber.clusters.flatMap((c) => c.radicals.map((r) => r.char));
  for (const cluster of chamber.clusters) {
    for (const rad of cluster.radicals) {
      if (!LINGMING_ROOT_MAP.has(rad.char)) {
        LINGMING_ROOT_MAP.set(rad.char, {
          ...rad,
          chamberKey: chamber.key,
          anchor: chamber.primaryAnchor,
          clusterLabel: cluster.label,
          siblings: allSiblings,
        });
      }
    }
  }
}

export type CodeRole = 'da' | 'sheng' | 'yun';

export interface EncodedLingmingChar {
  code: string;
  roles: CodeRole[];
}

// Official 靈明輸入法單字取碼演算法：一二三末，大根免三。首末大聲，末韻末參。
export function encodeLingmingRoots(roots: string[]): EncodedLingmingChar {
  const resolved = roots.map((r) => {
    const info = LINGMING_ROOT_MAP.get(r);
    const ma = info?.ma || '';
    return { char: r, ma, isXiao: ma.length === 2 };
  });

  const letters: string[] = [];
  const roles: CodeRole[] = [];

  const pushPart = (idx: number, part: CodeRole) => {
    const ma = resolved[idx]?.ma || '';
    const pos = part === 'da' ? 0 : part === 'sheng' ? (ma.length === 3 ? 1 : -1) : ma.length - 1;
    if (pos >= 0 && ma[pos]) {
      letters.push(ma[pos].toLowerCase());
      roles.push(part);
    }
  };

  const len = resolved.length;
  const o = 0;
  const d = 1;
  const h = 2;
  const a = len - 1;
  const firstIsXiao = resolved[o]?.isXiao ?? false;
  const lastIsXiao = resolved[a]?.isXiao ?? false;

  if (firstIsXiao) {
    if (len === 1) {
      pushPart(o, 'da');
      pushPart(o, 'yun');
    } else if (len === 2) {
      pushPart(o, 'da');
      pushPart(a, 'da');
      if (!lastIsXiao) pushPart(a, 'sheng');
      pushPart(a, 'yun');
    } else if (len === 3) {
      pushPart(o, 'da');
      pushPart(d, 'da');
      pushPart(a, 'da');
      pushPart(a, lastIsXiao ? 'yun' : 'sheng');
    } else {
      pushPart(o, 'da');
      pushPart(d, 'da');
      pushPart(h, 'da');
      pushPart(a, 'da');
    }
  } else {
    if (len === 1) {
      pushPart(o, 'da');
      pushPart(o, 'sheng');
      pushPart(o, 'yun');
    } else if (len === 2) {
      pushPart(o, 'da');
      pushPart(o, 'sheng');
      pushPart(a, 'da');
      pushPart(a, lastIsXiao ? 'yun' : 'sheng');
    } else {
      pushPart(o, 'da');
      pushPart(o, 'sheng');
      pushPart(d, 'da');
      pushPart(a, 'da');
    }
  }

  return {
    code: letters.join(''),
    roles,
  };
}

// Verified official 靈明單字拆分列表（涵蓋繁簡雙向字集）
export const LINGMING_CHAR_SPLITS: Array<[string, string[]]> = [
  ['本', ['木', '一']],
  ['友', ['𠂇', '又']],
  ['速', ['木', '口', '辶']],
  ['昙', ['日', '二', '厶']],
  ['嗓', ['口', '又', '又', '又', '木']],
  ['灵', ['彐', '火']],
  ['明', ['日', '月']],
  ['好', ['女', '子']],
  ['林', ['木', '木']],
  ['森', ['木', '木', '木']],
  ['拿', ['合', '手']],
  ['引', ['弓', '丨']],
  ['韶', ['立', '日', '刀', '口']],
  ['字', ['宀', '子']],
  ['安', ['宀', '女']],
  ['思', ['田', '心']],
  ['忠', ['口', '丨', '心']],
  ['志', ['士', '心']],
  ['杏', ['木', '口']],
  ['呆', ['口', '木']],
  ['困', ['囗', '木']],
  ['因', ['囗', '大']],
  ['回', ['囗', '口']],
  ['旦', ['日', '一']],
  ['天', ['一', '大']],
  ['吐', ['口', '土']],
  ['如', ['女', '口']],
  ['香', ['禾', '日']],
  ['秋', ['禾', '火']],
  ['和', ['禾', '口']],
  ['知', ['矢', '口']],
  ['音', ['立', '日']],
  ['意', ['立', '日', '心']],
  ['间', ['门', '日']],
  ['问', ['门', '口']],
  ['闪', ['门', '人']],
  ['草', ['艹', '早']],
  ['茶', ['艹', '人', '木']],
  ['光', ['⺌', '兀']],
  ['功', ['工', '力']],
  ['时', ['日', '寸']],
  ['星', ['日', '生']],
  ['墨', ['黑', '土']],
  ['码', ['石', '马']],
  ['中', ['口', '丨']],
  ['国', ['囗', '王', '丶']],
  ['风', ['几', '乂']],
  ['云', ['二', '厶']],
  ['夏', ['丆', '目', '夊']],
  ['冬', ['夊', '⺀']],
  ['东', ['七', '小']],
  ['北', ['丬', '匕']],
  ['晶', ['日', '日', '日']],
  ['品', ['口', '口', '口']],
  ['炎', ['火', '火']],
  ['昌', ['日', '日']],
  ['朋', ['月', '月']],
  ['圭', ['土', '土']],
  ['尖', ['小', '大']],
  ['男', ['田', '力']],
  ['众', ['人', '人', '人']],
  ['从', ['人', '人']],
  ['尘', ['小', '土']],
  ['岩', ['山', '石']],
  ['鸣', ['口', '鸟']],
  ['鲜', ['鱼', '羊']],
  ['休', ['人', '木']],
  ['仙', ['人', '山']],
  ['右', ['𠂇', '口']],
  ['有', ['𠂇', '月']],
  ['句', ['勹', '口']],
  ['勺', ['勹', '丶']],
  ['匀', ['勹', '二']],
  ['勾', ['勹', '厶']],
  ['旬', ['勹', '日']],
  ['柏', ['木', '白']],
  ['杜', ['木', '土']],
  ['权', ['木', '又']],
  ['泉', ['白', '水']],
  ['太', ['大', '丶']],
  ['叹', ['口', '又']],
  ['双', ['又', '又']],
  ['圣', ['又', '土']],
  ['桑', ['又', '又', '又', '木']],
  ['达', ['大', '辶']],
  ['迫', ['白', '辶']],
  ['运', ['二', '厶', '辶']],
  ['送', ['丷', '一', '大', '辶']],
  ['仁', ['亻', '二']],
  ['仅', ['亻', '又']],
  ['伯', ['亻', '白']],
  ['侣', ['亻', '口', '口']],
  ['倡', ['亻', '日', '日']],
  ['保', ['亻', '口', '木']],
  ['体', ['亻', '木', '一']],
  ['但', ['亻', '日', '一']],
  ['查', ['木', '日', '一']],
  ['坐', ['人', '人', '土']],
  ['吕', ['口', '口']],
  ['的', ['白', '勹', '丶']],
  ['肚', ['月', '土']],
  ['关', ['丷', '一', '大']],
  ['台', ['厶', '口']],
  ['去', ['土', '厶']],
  ['坛', ['土', '二', '厶']],
  ['会', ['人', '二', '厶']],
  ['亘', ['一', '日', '一']],
  ['头', ['丶', '丶', '大']],
  ['垚', ['土', '土', '土']],
  ['花', ['艹', '亻', '匕']],
  ['空', ['穴', '工']],
  ['怕', ['忄', '白']],
  ['打', ['扌', '丁']],
  ['认', ['讠', '人']],
  ['红', ['纟', '工']],
  ['故', ['古', '攵']],
  ['房', ['户', '方']],
  ['找', ['扌', '戈']],
  ['居', ['尸', '古']],
  ['笑', ['竹', '夭']],
  ['放', ['方', '攵']],
  ['穿', ['穴', '牙']],
  ['信', ['亻', '言']],
  // 通用與繁體專屬漢字拆分
  ['百', ['一', '白']],
  ['杲', ['日', '木']],
  ['杳', ['木', '日']],
  ['淼', ['水', '水', '水']],
  ['雪', ['雨', '彐']],
  ['雷', ['雨', '田']],
  ['侶', ['亻', '口', '口']],
  ['呂', ['口', '口']],
  ['勻', ['勹', '二']],
  ['時', ['日', '土', '寸']],
  ['間', ['門', '日']],
  ['問', ['門', '口']],
  ['閃', ['門', '人']],
  ['開', ['門', '廾']],
  ['悶', ['門', '心']],
  ['鳴', ['口', '鳥']],
  ['鮮', ['魚', '羊']],
  ['碼', ['石', '馬']],
  ['紅', ['糸', '工']],
  ['塵', ['鹿', '土']],
  ['雲', ['雨', '二', '厶']],
  ['銀', ['金', '艮']],
  ['針', ['金', '十']],
  ['頂', ['丁', '頁']],
  ['順', ['川', '頁']],
  ['須', ['彡', '頁']],
  ['煩', ['火', '頁']],
  ['視', ['礻', '見']],
  ['規', ['夫', '見']],
  ['飲', ['食', '欠']],
  ['庫', ['广', '車']],
  ['軍', ['冖', '車']],
  ['話', ['言', '舌']],
  ['雙', ['隹', '隹', '又']],
];

export const SIMP_ONLY_HANZI = new Set<string>([
  '昙', '灵', '间', '问', '闪', '时', '码', '国', '风', '云', '东', '众', '从', '尘',
  '鸣', '鲜', '权', '叹', '双', '圣', '达', '运', '仅', '侣', '体', '关', '坛', '会',
  '头', '认', '红', '匀', '吕', '猫',
]);

export const TRAD_ONLY_HANZI = new Set<string>([
  '侶', '呂', '勻', '時', '間', '問', '閃', '開', '悶', '鳴', '鮮', '碼', '紅', '塵',
  '雲', '銀', '針', '頂', '順', '須', '煩', '視', '規', '飲', '庫', '軍', '話', '雙',
  '國', '曇', '靈', '體', '會', '頭', '關', '認', '風', '東', '眾', '從', '聖', '達',
  '運', '權', '歎', '壇', '貓',
]);

export function getLingmingCharScript(char: string): CharScript {
  if (TRAD_ONLY_HANZI.has(char)) return 'trad';
  if (SIMP_ONLY_HANZI.has(char)) return 'simp';
  return 'common';
}

// Traditional-exclusive radicals (e.g. pairs whose Simplified form moved to a different consonant key or is unused in Simplified Hanzi)
export const TRAD_ONLY_RADICALS = new Set<string>([
  '鳥', // S (sna) vs 鸟 F (fna)
  '烏', // S (swu) vs 乌 F (fwu)
  '魚', // S (syu) vs 鱼 G (gyu)
  '馬', // G (gma) vs 马 R (rma)
  '車', // K (kce) vs 车 M (mce)
  '見', // F (fja) vs 见 R (rja)
  '頁', // F (fye) vs 页 C (cye)
  '貝', // N (nbe) vs 贝 C (cbe)
  '門', // C (cme) vs 门 B (bme)
  '長', // H (hca) vs 长 K (kca)
  '镸', // H (hca) PDF variant of 長
  '風', // J (jfe) vs 风 (几+乂)
  '飛', // L (lfe) vs 飞
  '齒', // L (lci) vs 齿
  '鹵', // R (rlu) vs 卤
  '僉', // N (na) vs 佥
  '來', // R (rla) vs 来
  '鬥', // L (ldo) vs 斗/门
  '冊', // L (lce) vs 册
  '咼', // K (ka) vs 呙/过
  '戶', // L (lu) vs 户 (lhu)
]);

// Simplified-exclusive radicals (unused in Traditional Hanzi; prevents dual-key interference when learning Traditional)
export const SIMP_ONLY_RADICALS = new Set<string>([
  '鸟', // F (fna) vs 鳥 S (sna)
  '乌', // F (fwu) vs 烏 S (swu)
  '鱼', // G (gyu) vs 魚 S (syu)
  '马', // R (rma) vs 馬 G (gma)
  '车', // M (mce) vs 車 K (kce)
  '见', // R (rja) vs 見 F (fja)
  '页', // C (cye) vs 頁 F (fye)
  '贝', // C (cbe) vs 貝 N (nbe)
  '门', // B (bme) vs 門 C (cme)
  '长', // K (kca) vs 長 H (hca)
  '讠', // W (wa) vs 言 R (ra)
  '钅', // H (hi) vs 金 C (ci)
  '饣', // J (jsi) vs 食 N (nsi)
  '纟', // C (ci) vs 糸 Y (yi)
  '业', // R (rye) vs 業
  '电', // G (gda) vs 電
  '习', // X (xi) vs 習
  '戸', // L (lhu) PDF variant alongside 户
]);

export function getLingmingRadicalScript(
  char: string,
  chamberKey?: string,
  ma?: string
): CharScript {
  // In F chamber PDF data, PUA fye variants belong to Traditional 頁 (fye)
  if (chamberKey === 'f' && ma === 'fye') return 'trad';
  if (TRAD_ONLY_RADICALS.has(char)) return 'trad';
  if (SIMP_ONLY_RADICALS.has(char)) return 'simp';
  return 'common';
}



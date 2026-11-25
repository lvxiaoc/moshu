import {
  CodeRole,
  encodeLingmingRoots,
  getLingmingCharScript,
  LINGMING_CHAMBER_BY_KEY,
  LINGMING_CHAMBERS,
  LINGMING_CHAR_SPLITS,
  LINGMING_ROOT_MAP,
} from '../data/lingming';
import { HUANGTING_CHAR_MAP } from '../data/huangtingjing';
import {
  BUILTIN_HUANGTING_OVERRIDES,
  loadUserHuangtingOverrides,
} from '../data/huangtingOverrides';
import { LINGMING_SHORT_CODES } from '../data/lingmingShortCodes';
import {
  DaKeySlot,
  isPalaceChamberKey,
  resolveDaSlotForShortCode,
  resolveDaSlotFromRoles,
  resolveDaSlotFromRootCodes,
  resolveRadicalForChamberKey,
} from '../data/keystrokeCloud';
import { CharScript, matchesScript, ScriptMode } from '../data/scriptFilter';

export interface LexiconEntry {
  char: string;
  code: string;
  shortCode?: string;
  roots: string[];
  rootCodes?: string[];
  roles?: CodeRole[];
  script: CharScript;
  priority: number;
  isRadical?: boolean;
}

export interface ImeCandidate {
  entry: LexiconEntry;
  matchedBy: 'short' | 'full' | 'prefix';
}

export interface ImeQueryResult {
  exact: ImeCandidate[];
  predictions: ImeCandidate[];
  all: ImeCandidate[];
  hasLongerPrefix: boolean;
  shouldAutoCommit: boolean;
}

// Common everyday Traditional & Simplified splits (offline static supplement)
const COMMON_WRITER_SPLITS: Array<{
  char: string;
  roots: string[];
  script: CharScript;
}> = [
  { char: '我', roots: ['丿', '扌', '戈'], script: 'common' },
  { char: '你', roots: ['亻', '勹', '小'], script: 'common' },
  { char: '他', roots: ['亻', '也'], script: 'common' },
  { char: '她', roots: ['女', '也'], script: 'common' },
  { char: '它', roots: ['宀', '匕'], script: 'common' },
  { char: '們', roots: ['亻', '門'], script: 'trad' },
  { char: '们', roots: ['亻', '门'], script: 'simp' },
  { char: '是', roots: ['日', '一', '卜', '人'], script: 'common' },
  { char: '在', roots: ['𠂇', '丨', '土'], script: 'common' },
  { char: '這', roots: ['言', '辶'], script: 'trad' },
  { char: '这', roots: ['文', '辶'], script: 'simp' },
  { char: '那', roots: ['刀', '二', '阝'], script: 'common' },
  { char: '個', roots: ['亻', '囗', '古'], script: 'trad' },
  { char: '个', roots: ['人', '丨'], script: 'simp' },
  { char: '與', roots: ['臼', '一', '八'], script: 'trad' },
  { char: '与', roots: ['一', '乙', '一'], script: 'simp' },
  { char: '為', roots: ['丶', '丿', '乙', '灬'], script: 'trad' },
  { char: '为', roots: ['丶', '力', '丶'], script: 'simp' },
  { char: '之', roots: ['之'], script: 'common' },
  { char: '也', roots: ['也'], script: 'common' },
  { char: '了', roots: ['了'], script: 'common' },
  { char: '不', roots: ['不'], script: 'common' },
  { char: '人', roots: ['人'], script: 'common' },
  { char: '大', roots: ['大'], script: 'common' },
  { char: '小', roots: ['小'], script: 'common' },
  { char: '中', roots: ['口', '丨'], script: 'common' },
  { char: '上', roots: ['上'], script: 'common' },
  { char: '下', roots: ['下'], script: 'common' },
  { char: '左', roots: ['𠂇', '工'], script: 'common' },
  { char: '一', roots: ['一'], script: 'common' },
  { char: '二', roots: ['二'], script: 'common' },
  { char: '三', roots: ['三'], script: 'common' },
  { char: '四', roots: ['囗', '儿'], script: 'common' },
  { char: '五', roots: ['一', '丨', '乙', '一'], script: 'common' },
  { char: '六', roots: ['亠', '八'], script: 'common' },
  { char: '七', roots: ['七'], script: 'common' },
  { char: '八', roots: ['八'], script: 'common' },
  { char: '九', roots: ['九'], script: 'common' },
  { char: '十', roots: ['十'], script: 'common' },
  { char: '千', roots: ['千'], script: 'common' },
  { char: '萬', roots: ['艹', '禺'], script: 'trad' },
  { char: '万', roots: ['一', '勹', '丿'], script: 'simp' },
  { char: '多', roots: ['夕', '夕'], script: 'common' },
  { char: '少', roots: ['小', '丿'], script: 'common' },
  { char: '全', roots: ['人', '王'], script: 'common' },
  { char: '半', roots: ['丷', '十', '一'], script: 'common' },
  { char: '早', roots: ['早'], script: 'common' },
  { char: '晚', roots: ['日', '勹', '口', '儿'], script: 'common' },
  { char: '今', roots: ['人', '丶', '乙'], script: 'common' },
  { char: '古', roots: ['古'], script: 'common' },
  { char: '新', roots: ['立', '木', '斤'], script: 'common' },
  { char: '舊', roots: ['艹', '隹', '臼'], script: 'trad' },
  { char: '旧', roots: ['丨', '日'], script: 'simp' },
  { char: '長', roots: ['長'], script: 'trad' },
  { char: '长', roots: ['长'], script: 'simp' },
  { char: '高', roots: ['高'], script: 'common' },
  { char: '低', roots: ['亻', '氏', '一'], script: 'common' },
  { char: '近', roots: ['斤', '辶'], script: 'common' },
  { char: '遠', roots: ['土', '口', '衤', '辶'], script: 'trad' },
  { char: '远', roots: ['二', '儿', '辶'], script: 'simp' },
  { char: '進', roots: ['隹', '辶'], script: 'trad' },
  { char: '进', roots: ['二', '丿', '丨', '辶'], script: 'simp' },
  { char: '退', roots: ['艮', '辶'], script: 'common' },
  { char: '過', roots: ['咼', '辶'], script: 'trad' },
  { char: '过', roots: ['寸', '辶'], script: 'simp' },
  { char: '還', roots: ['罒', '口', '衤', '辶'], script: 'trad' },
  { char: '还', roots: ['不', '辶'], script: 'simp' },
  { char: '道', roots: ['丷', '一', '自', '辶'], script: 'common' },
  { char: '通', roots: ['乙', '丶', '用', '辶'], script: 'common' },
  { char: '造', roots: ['牛', '口', '辶'], script: 'common' },
  { char: '邊', roots: ['自', '穴', '方', '辶'], script: 'trad' },
  { char: '边', roots: ['力', '辶'], script: 'simp' },
  { char: '隨', roots: ['阝', '𠂇', '月', '辶'], script: 'trad' },
  { char: '随', roots: ['阝', '𠂇', '月', '辶'], script: 'simp' },
  { char: '來', roots: ['來'], script: 'trad' },
  { char: '来', roots: ['一', '米'], script: 'simp' },
  { char: '出', roots: ['山', '凵'], script: 'common' },
  { char: '入', roots: ['入'], script: 'common' },
  { char: '行', roots: ['彳', '二', '亅'], script: 'common' },
  { char: '走', roots: ['走'], script: 'common' },
  { char: '步', roots: ['止', '小'], script: 'common' },
  { char: '止', roots: ['止'], script: 'common' },
  { char: '正', roots: ['正'], script: 'common' },
  { char: '歸', roots: ['刂', '白', '彐', '巾'], script: 'trad' },
  { char: '归', roots: ['刂', '彐'], script: 'simp' },
  { char: '成', roots: ['戊', '乙'], script: 'common' },
  { char: '或', roots: ['戈', '口', '一'], script: 'common' },
  { char: '威', roots: ['戊', '一', '女'], script: 'common' },
  { char: '感', roots: ['戊', '一', '口', '心'], script: 'common' },
  { char: '歲', roots: ['山', '止', '戈', '小'], script: 'trad' },
  { char: '岁', roots: ['山', '夕'], script: 'simp' },
  { char: '可', roots: ['丁', '口'], script: 'common' },
  { char: '以', roots: ['乙', '丶', '人'], script: 'common' },
  { char: '能', roots: ['厶', '月', '匕', '匕'], script: 'common' },
  { char: '想', roots: ['木', '目', '心'], script: 'common' },
  { char: '念', roots: ['人', '丶', '乙', '心'], script: 'common' },
  { char: '忘', roots: ['亡', '心'], script: 'common' },
  { char: '忙', roots: ['忄', '亡'], script: 'common' },
  { char: '盲', roots: ['亡', '目'], script: 'common' },
  { char: '亡', roots: ['亡'], script: 'common' },
  { char: '情', roots: ['忄', '丰', '月'], script: 'common' },
  { char: '靜', roots: ['丰', '月', '爪', '亅'], script: 'trad' },
  { char: '静', roots: ['丰', '月', '刀', '亅'], script: 'simp' },
  { char: '晴', roots: ['日', '丰', '月'], script: 'common' },
  { char: '精', roots: ['米', '丰', '月'], script: 'common' },
  { char: '請', roots: ['言', '丰', '月'], script: 'trad' },
  { char: '请', roots: ['讠', '丰', '月'], script: 'simp' },
  { char: '青', roots: ['丰', '月'], script: 'common' },
  { char: '快', roots: ['忄', '乙', '大'], script: 'common' },
  { char: '慢', roots: ['忄', '日', '罒', '又'], script: 'common' },
  { char: '苦', roots: ['艹', '古'], script: 'common' },
  { char: '樂', roots: ['幺', '白', '幺', '木'], script: 'trad' },
  { char: '乐', roots: ['丿', '乙', '小'], script: 'simp' },
  { char: '喜', roots: ['士', '口', '丷', '口'], script: 'common' },
  { char: '怒', roots: ['女', '又', '心'], script: 'common' },
  { char: '哀', roots: ['亠', '口', '衤'], script: 'common' },
  { char: '愛', roots: ['爪', '冖', '心', '夂'], script: 'trad' },
  { char: '爱', roots: ['爪', '冖', '𠂇', '又'], script: 'simp' },
  { char: '學', roots: ['臼', '乂', '冖', '子'], script: 'trad' },
  { char: '学', roots: ['⺌', '冖', '子'], script: 'simp' },
  { char: '習', roots: ['乙', '丶', '白'], script: 'trad' },
  { char: '习', roots: ['习'], script: 'simp' },
  { char: '練', roots: ['糸', '木', '日', '丷'], script: 'trad' },
  { char: '练', roots: ['纟', '一', '乙', '小'], script: 'simp' },
  { char: '書', roots: ['肀', '一', '日'], script: 'trad' },
  { char: '书', roots: ['乙', '乙', '丨', '丶'], script: 'simp' },
  { char: '寫', roots: ['宀', '臼', '勹', '灬'], script: 'trad' },
  { char: '写', roots: ['冖', '乙', '一'], script: 'simp' },
  { char: '讀', roots: ['言', '士', '罒', '貝'], script: 'trad' },
  { char: '读', roots: ['讠', '十', '乙', '大'], script: 'simp' },
  { char: '說', roots: ['言', '丷', '口', '儿'], script: 'trad' },
  { char: '说', roots: ['讠', '丷', '口', '儿'], script: 'simp' },
  { char: '語', roots: ['言', '一', '乙', '口'], script: 'trad' },
  { char: '语', roots: ['讠', '一', '乙', '口'], script: 'simp' },
  { char: '記', roots: ['言', '己'], script: 'trad' },
  { char: '记', roots: ['讠', '己'], script: 'simp' },
  { char: '識', roots: ['言', '立', '日', '戈'], script: 'trad' },
  { char: '识', roots: ['讠', '口', '八'], script: 'simp' },
  { char: '詞', roots: ['言', '乙', '一', '口'], script: 'trad' },
  { char: '词', roots: ['讠', '乙', '一', '口'], script: 'simp' },
  { char: '詩', roots: ['言', '土', '寸'], script: 'trad' },
  { char: '诗', roots: ['讠', '土', '寸'], script: 'simp' },
  { char: '文', roots: ['文'], script: 'common' },
  { char: '章', roots: ['立', '早'], script: 'common' },
  { char: '筆', roots: ['竹', '肀', '一'], script: 'trad' },
  { char: '笔', roots: ['竹', '毛'], script: 'simp' },
  { char: '紙', roots: ['糸', '丿', '乙', '一'], script: 'trad' },
  { char: '纸', roots: ['纟', '丿', '乙', '一'], script: 'simp' },
  { char: '硯', roots: ['石', '見'], script: 'trad' },
  { char: '砚', roots: ['石', '见'], script: 'simp' },
  { char: '畫', roots: ['肀', '田', '一'], script: 'trad' },
  { char: '画', roots: ['一', '田', '凵'], script: 'simp' },
  { char: '鍵', roots: ['金', '廴', '肀', '二'], script: 'trad' },
  { char: '键', roots: ['钅', '廴', '肀', '二'], script: 'simp' },
  { char: '鐵', roots: ['金', '土', '口', '戈'], script: 'trad' },
  { char: '铁', roots: ['钅', '丿', '大'], script: 'simp' },
  { char: '銅', roots: ['金', '冂', '一', '口'], script: 'trad' },
  { char: '铜', roots: ['钅', '冂', '一', '口'], script: 'simp' },
  { char: '玉', roots: ['王', '丶'], script: 'common' },
  { char: '寶', roots: ['宀', '王', '缶', '貝'], script: 'trad' },
  { char: '宝', roots: ['宀', '王', '丶'], script: 'simp' },
  { char: '金', roots: ['金'], script: 'common' },
  { char: '木', roots: ['木'], script: 'common' },
  { char: '水', roots: ['水'], script: 'common' },
  { char: '火', roots: ['火'], script: 'common' },
  { char: '土', roots: ['土'], script: 'common' },
  { char: '山', roots: ['山'], script: 'common' },
  { char: '石', roots: ['石'], script: 'common' },
  { char: '日', roots: ['日'], script: 'common' },
  { char: '月', roots: ['月'], script: 'common' },
  { char: '手', roots: ['手'], script: 'common' },
  { char: '口', roots: ['口'], script: 'common' },
  { char: '目', roots: ['目'], script: 'common' },
  { char: '耳', roots: ['耳'], script: 'common' },
  { char: '心', roots: ['心'], script: 'common' },
  { char: '田', roots: ['田'], script: 'common' },
  { char: '白', roots: ['白'], script: 'common' },
  { char: '黑', roots: ['黑'], script: 'common' },
  { char: '竹', roots: ['竹'], script: 'common' },
  { char: '米', roots: ['米'], script: 'common' },
  { char: '王', roots: ['王'], script: 'common' },
  { char: '見', roots: ['見'], script: 'trad' },
  { char: '见', roots: ['见'], script: 'simp' },
  { char: '看', roots: ['手', '目'], script: 'common' },
  { char: '聽', roots: ['耳', '壬', '罒', '心'], script: 'trad' },
  { char: '听', roots: ['口', '斤'], script: 'simp' },
  { char: '聞', roots: ['門', '耳'], script: 'trad' },
  { char: '闻', roots: ['门', '耳'], script: 'simp' },
  { char: '開', roots: ['門', '廾'], script: 'trad' },
  { char: '开', roots: ['二', '丿', '丨'], script: 'simp' },
  { char: '閉', roots: ['門', '十', '丿'], script: 'trad' },
  { char: '闭', roots: ['门', '十', '丿'], script: 'simp' },
  { char: '關', roots: ['門', '幺', '幺', '廾'], script: 'trad' },
  { char: '閣', roots: ['門', '夂', '口'], script: 'trad' },
  { char: '阁', roots: ['门', '夂', '口'], script: 'simp' },
  { char: '國', roots: ['囗', '戈', '口', '一'], script: 'trad' },
  { char: '圍', roots: ['囗', '乙', '口', '丨'], script: 'trad' },
  { char: '围', roots: ['囗', '二', '乙'], script: 'simp' },
  { char: '園', roots: ['囗', '土', '口', '衤'], script: 'trad' },
  { char: '园', roots: ['囗', '二', '儿'], script: 'simp' },
  { char: '圖', roots: ['囗', '口', '亠', '囗'], script: 'trad' },
  { char: '图', roots: ['囗', '夂', '⺀'], script: 'simp' },
  { char: '同', roots: ['冂', '一', '口'], script: 'common' },
  { char: '周', roots: ['冂', '土', '口'], script: 'common' },
  { char: '向', roots: ['向'], script: 'common' },
  { char: '區', roots: ['匚', '口', '口', '口'], script: 'trad' },
  { char: '区', roots: ['匚', '乂'], script: 'simp' },
  { char: '巨', roots: ['匚', '乙'], script: 'common' },
  { char: '臣', roots: ['臣'], script: 'common' },
  { char: '匠', roots: ['匚', '斤'], script: 'common' },
  { char: '醫', roots: ['匚', '矢', '殳', '酉'], script: 'trad' },
  { char: '医', roots: ['匚', '矢'], script: 'simp' },
  { char: '幽', roots: ['山', '幺', '幺'], script: 'common' },
  { char: '幾', roots: ['幺', '幺', '戊', '人'], script: 'trad' },
  { char: '几', roots: ['几'], script: 'common' },
  { char: '凡', roots: ['几', '丶'], script: 'common' },
  { char: '處', roots: ['虍', '夂', '几'], script: 'trad' },
  { char: '处', roots: ['夂', '卜'], script: 'simp' },
  { char: '嵐', roots: ['山', '風'], script: 'trad' },
  { char: '岚', roots: ['山', '几', '乂'], script: 'simp' },
  { char: '晨', roots: ['日', '辰'], script: 'common' },
  { char: '海', roots: ['氵', '丿', '一', '母'], script: 'common' },
  { char: '湖', roots: ['氵', '古', '月'], script: 'common' },
  { char: '江', roots: ['氵', '工'], script: 'common' },
  { char: '波', roots: ['氵', '皮'], script: 'common' },
  { char: '流', roots: ['氵', '亠', '厶', '川'], script: 'common' },
  { char: '深', roots: ['氵', '冖', '八', '木'], script: 'common' },
  { char: '淺', roots: ['氵', '戈', '戈'], script: 'trad' },
  { char: '浅', roots: ['氵', '戈', '戈'], script: 'simp' },
  { char: '洗', roots: ['氵', '丿', '土', '儿'], script: 'common' },
  { char: '注', roots: ['氵', '丶', '王'], script: 'common' },
  { char: '法', roots: ['氵', '土', '厶'], script: 'common' },
  { char: '治', roots: ['氵', '厶', '口'], script: 'common' },
  { char: '活', roots: ['氵', '舌'], script: 'common' },
  { char: '清', roots: ['氵', '丰', '月'], script: 'common' },
  { char: '濁', roots: ['氵', '罒', '勹', '虫'], script: 'trad' },
  { char: '浊', roots: ['氵', '虫'], script: 'simp' },
  { char: '松', roots: ['木', '八', '厶'], script: 'common' },
  { char: '樹', roots: ['木', '士', '口', '寸'], script: 'trad' },
  { char: '树', roots: ['木', '又', '寸'], script: 'simp' },
  { char: '枝', roots: ['木', '十', '又'], script: 'common' },
  { char: '葉', roots: ['艹', '世', '木'], script: 'trad' },
  { char: '叶', roots: ['口', '十'], script: 'simp' },
  { char: '根', roots: ['木', '艮'], script: 'common' },
  { char: '果', roots: ['日', '木'], script: 'common' },
  { char: '末', roots: ['末'], script: 'common' },
  { char: '未', roots: ['未'], script: 'common' },
  { char: '春', roots: ['三', '人', '日'], script: 'common' },
  { char: '秋', roots: ['禾', '火'], script: 'common' },
  { char: '光', roots: ['⺌', '兀'], script: 'common' },
  { char: '暗', roots: ['日', '立', '日'], script: 'common' },
  { char: '影', roots: ['日', '亠', '口', '彡'], script: 'common' },
  { char: '照', roots: ['日', '刀', '口', '灬'], script: 'common' },
  { char: '點', roots: ['黑', '口', '卜'], script: 'trad' },
  { char: '点', roots: ['卜', '口', '灬'], script: 'simp' },
  { char: '然', roots: ['夕', '犬', '灬'], script: 'common' },
  { char: '熱', roots: ['土', '儿', '九', '灬'], script: 'trad' },
  { char: '热', roots: ['扌', '九', '丶', '灬'], script: 'simp' },
  { char: '無', roots: ['丿', '一', '卌', '灬'], script: 'trad' },
  { char: '无', roots: ['二', '丿', '乙'], script: 'simp' },
  { char: '舞', roots: ['丿', '一', '卌', '夕'], script: 'common' },
  { char: '年', roots: ['丿', '一', '干', '丨'], script: 'common' },
  { char: '生', roots: ['生'], script: 'common' },
  { char: '產', roots: ['立', '丿', '厂', '生'], script: 'trad' },
  { char: '产', roots: ['立', '厂'], script: 'simp' },
  { char: '辰', roots: ['辰'], script: 'common' },
  { char: '電', roots: ['雨', '电'], script: 'trad' },
  { char: '电', roots: ['电'], script: 'simp' },
  { char: '雷', roots: ['雨', '田'], script: 'common' },
  { char: '雪', roots: ['雨', '彐'], script: 'common' },
  { char: '雲', roots: ['雨', '二', '厶'], script: 'trad' },
  { char: '風', roots: ['風'], script: 'trad' },
  { char: '夢', roots: ['艹', '罒', '冖', '夕'], script: 'trad' },
  { char: '梦', roots: ['木', '木', '夕'], script: 'simp' },
  { char: '真', roots: ['十', '目', '一', '八'], script: 'common' },
  { char: '假', roots: ['亻', '彐', '又'], script: 'common' },
  { char: '善', roots: ['羊', '丷', '一', '口'], script: 'common' },
  { char: '美', roots: ['羊', '大'], script: 'common' },
  { char: '惡', roots: ['一', '丨', '一', '心'], script: 'trad' },
  { char: '恶', roots: ['一', '丨', '一', '心'], script: 'simp' },
  { char: '理', roots: ['王', '里'], script: 'common' },
  { char: '則', roots: ['貝', '刂'], script: 'trad' },
  { char: '则', roots: ['贝', '刂'], script: 'simp' },
  { char: '度', roots: ['广', '廿', '又'], script: 'common' },
  { char: '量', roots: ['日', '一', '里'], script: 'common' },
  { char: '計', roots: ['言', '十'], script: 'trad' },
  { char: '计', roots: ['讠', '十'], script: 'simp' },
  { char: '算', roots: ['竹', '目', '廾'], script: 'common' },
  { char: '數', roots: ['口', '女', '攵'], script: 'trad' },
  { char: '数', roots: ['米', '女', '攵'], script: 'simp' },
  { char: '分', roots: ['八', '刀'], script: 'common' },
  { char: '合', roots: ['合'], script: 'common' },
  { char: '單', roots: ['口', '口', '甲', '一'], script: 'trad' },
  { char: '单', roots: ['丷', '甲', '一'], script: 'simp' },
  { char: '經', roots: ['糸', '乙', '川', '工'], script: 'trad' },
  { char: '经', roots: ['纟', '又', '工'], script: 'simp' },
  { char: '結', roots: ['糸', '士', '口'], script: 'trad' },
  { char: '结', roots: ['纟', '士', '口'], script: 'simp' },
  { char: '組', roots: ['糸', '且'], script: 'trad' },
  { char: '组', roots: ['纟', '且'], script: 'simp' },
  { char: '維', roots: ['糸', '隹'], script: 'trad' },
  { char: '维', roots: ['纟', '隹'], script: 'simp' },
  { char: '線', roots: ['糸', '白', '水'], script: 'trad' },
  { char: '线', roots: ['纟', '戈', '戈'], script: 'simp' },
  { char: '細', roots: ['糸', '田'], script: 'trad' },
  { char: '细', roots: ['纟', '田'], script: 'simp' },
  { char: '純', roots: ['糸', '一', '乙', '丨'], script: 'trad' },
  { char: '纯', roots: ['纟', '一', '乙', '丨'], script: 'simp' },
  { char: '綠', roots: ['糸', '彑', '氺'], script: 'trad' },
  { char: '绿', roots: ['纟', '彑', '氺'], script: 'simp' },
  { char: '絕', roots: ['糸', '刀', '巴'], script: 'trad' },
  { char: '绝', roots: ['纟', '刀', '巴'], script: 'simp' },
  { char: '續', roots: ['糸', '士', '罒', '貝'], script: 'trad' },
  { char: '续', roots: ['纟', '十', '乙', '大'], script: 'simp' },
  { char: '總', roots: ['糸', '白', '心'], script: 'trad' },
  { char: '总', roots: ['丷', '口', '心'], script: 'simp' },
  { char: '給', roots: ['糸', '合'], script: 'trad' },
  { char: '给', roots: ['纟', '合'], script: 'simp' },
  { char: '望', roots: ['亡', '月', '王'], script: 'common' },
  { char: '命', roots: ['人', '一', '口', '卩'], script: 'common' },
  { char: '令', roots: ['人', '丶', '乙'], script: 'common' },
  { char: '題', roots: ['日', '正', '頁'], script: 'trad' },
  { char: '题', roots: ['日', '正', '页'], script: 'simp' },
  { char: '飛', roots: ['飛'], script: 'trad' },
  { char: '飞', roots: ['乙', '丶'], script: 'simp' },
  { char: '默', roots: ['黑', '犬'], script: 'common' },
  { char: '立', roots: ['立'], script: 'common' },
  { char: '用', roots: ['用'], script: 'common' },
  { char: '有', roots: ['𠂇', '月'], script: 'common' },
  { char: '得', roots: ['彳', '日', '一', '寸'], script: 'common' },
  { char: '著', roots: ['艹', '耂', '日'], script: 'common' },
  { char: '地', roots: ['土', '也'], script: 'common' },
  { char: '把', roots: ['扌', '巴'], script: 'common' },
  { char: '使', roots: ['亻', '一', '口', '乂'], script: 'common' },
  { char: '作', roots: ['亻', '丿', '一', '丨'], script: 'common' },
  { char: '做', roots: ['亻', '古', '攵'], script: 'common' },
  { char: '加', roots: ['力', '口'], script: 'common' },
  { char: '對', roots: ['业', '一', '寸'], script: 'trad' },
  { char: '对', roots: ['又', '寸'], script: 'simp' },
  { char: '並', roots: ['丷', '一', '业', '一'], script: 'trad' },
  { char: '并', roots: ['丷', '二', '丿', '丨'], script: 'simp' },
  { char: '從', roots: ['彳', '人', '人', '止'], script: 'trad' },
  { char: '發', roots: ['癶', '弓', '殳'], script: 'trad' },
  { char: '发', roots: ['乙', '丿', '又'], script: 'simp' },
  { char: '實', roots: ['宀', '田', '貝'], script: 'trad' },
  { char: '实', roots: ['宀', '丶', '丶', '大'], script: 'simp' },
  { char: '當', roots: ['尚', '田'], script: 'trad' },
  { char: '当', roots: ['⺌', '彐'], script: 'simp' },
  { char: '動', roots: ['丿', '里', '力'], script: 'trad' },
  { char: '动', roots: ['二', '厶', '力'], script: 'simp' },
  { char: '定', roots: ['宀', '一', '止'], script: 'common' },
  { char: '家', roots: ['宀', '豕'], script: 'common' },
  { char: '事', roots: ['一', '口', '彐', '亅'], script: 'common' },
  { char: '公', roots: ['八', '厶'], script: 'common' },
  { char: '共', roots: ['廿', '八'], script: 'common' },
  { char: '其', roots: ['其'], script: 'common' },
  { char: '但', roots: ['亻', '日', '一'], script: 'common' },
  { char: '所', roots: ['戶', '斤'], script: 'trad' },
  { char: '所', roots: ['户', '斤'], script: 'simp' },
  { char: '本', roots: ['木', '一'], script: 'common' },
  { char: '現', roots: ['王', '見'], script: 'trad' },
  { char: '现', roots: ['王', '见'], script: 'simp' },
  { char: '前', roots: ['丷', '一', '月', '刂'], script: 'common' },
  { char: '後', roots: ['彳', '幺', '夂'], script: 'trad' },
  { char: '后', roots: ['厂', '一', '口'], script: 'simp' },
  { char: '外', roots: ['夕', '卜'], script: 'common' },
  { char: '內', roots: ['冂', '人'], script: 'trad' },
  { char: '内', roots: ['冂', '人'], script: 'simp' },
  { char: '只', roots: ['口', '八'], script: 'common' },
  { char: '力', roots: ['力'], script: 'common' },
  { char: '氣', roots: ['气', '米'], script: 'trad' },
  { char: '气', roots: ['气'], script: 'simp' },
  { char: '音', roots: ['立', '日'], script: 'common' },
  { char: '韻', roots: ['立', '日', '口', '貝'], script: 'trad' },
  { char: '韵', roots: ['立', '日', '勹', '丶'], script: 'simp' },
  { char: '聲', roots: ['士', '尸', '殳', '耳'], script: 'trad' },
  { char: '声', roots: ['士', '尸', '丿'], script: 'simp' },
  { char: '形', roots: ['二', '丿', '丨', '彡'], script: 'common' },
  { char: '態', roots: ['厶', '月', '匕', '心'], script: 'trad' },
  { char: '态', roots: ['大', '丶', '心'], script: 'simp' },
  { char: '神', roots: ['礻', '申'], script: 'common' },
  { char: '奇', roots: ['大', '丁', '口'], script: 'common' },
  { char: '妙', roots: ['女', '小', '丿'], script: 'common' },
  { char: '簡', roots: ['竹', '門', '日'], script: 'trad' },
  { char: '简', roots: ['竹', '门', '日'], script: 'simp' },
  { char: '繁', roots: ['丿', '母', '攵', '糸'], script: 'common' },
  { char: '體', roots: ['骨', '曲', '一', '口'], script: 'trad' },
  { char: '体', roots: ['亻', '木', '一'], script: 'simp' },
  { char: '直', roots: ['十', '目', '乙'], script: 'common' },
  { char: '覺', roots: ['臼', '乂', '冖', '見'], script: 'trad' },
  { char: '觉', roots: ['⺌', '冖', '见'], script: 'simp' },
  { char: '空', roots: ['穴', '工'], script: 'common' },
  { char: '位', roots: ['亻', '立'], script: 'common' },
  { char: '變', roots: ['言', '糸', '糸', '攵'], script: 'trad' },
  { char: '变', roots: ['亦', '又'], script: 'simp' },
  { char: '化', roots: ['亻', '匕'], script: 'common' },
  { char: '重', roots: ['丿', '一', '里'], script: 'common' },
  { char: '指', roots: ['扌', '匕', '日'], script: 'common' },
  { char: '節', roots: ['竹', '艮', '卩'], script: 'trad' },
  { char: '节', roots: ['艹', '卩'], script: 'simp' },
  { char: '落', roots: ['艹', '氵', '夂', '口'], script: 'common' },
  { char: '起', roots: ['走', '己'], script: 'common' },
  { char: '留', roots: ['卯', '刀', '田'], script: 'common' },
  { char: '回', roots: ['囗', '口'], script: 'common' },
  { char: '到', roots: ['至', '刂'], script: 'common' },
  { char: '失', roots: ['丿', '夫'], script: 'common' },
  { char: '唯', roots: ['口', '隹'], script: 'common' },
  { char: '而', roots: ['而'], script: 'common' },
  { char: '已', roots: ['已'], script: 'common' },
  { char: '條', roots: ['亻', '夂', '木'], script: 'trad' },
  { char: '条', roots: ['夂', '木'], script: 'simp' },
  { char: '路', roots: ['足', '夂', '口'], script: 'common' },
  { char: '要', roots: ['西', '女'], script: 'common' },
  { char: '每', roots: ['丿', '一', '母'], script: 'common' },
  { char: '住', roots: ['亻', '丶', '王'], script: 'common' },
  { char: '名', roots: ['夕', '口'], script: 'common' },
  { char: '者', roots: ['耂', '日'], script: 'common' },
  { char: '門', roots: ['門'], script: 'trad' },
  { char: '门', roots: ['门'], script: 'simp' },
  { char: '難', roots: ['艹', '口', '夫', '隹'], script: 'trad' },
  { char: '难', roots: ['又', '隹'], script: 'simp' },
  { char: '先', roots: ['丿', '土', '儿'], script: 'common' },
  { char: '首', roots: ['丷', '一', '自'], script: 'common' },
  { char: '再', roots: ['一', '冂', '土'], script: 'common' },
  { char: '自', roots: ['自'], script: 'common' },
  { char: '即', roots: ['艮', '卩'], script: 'common' },
  { char: '夜', roots: ['亠', '亻', '夕', '丶'], script: 'common' },
  { char: '亮', roots: ['亠', '口', '冖', '几'], script: 'common' },
  { char: '吹', roots: ['口', '欠'], script: 'common' },
  { char: '河', roots: ['氵', '丁', '口'], script: 'common' },
  { char: '於', roots: ['方', '人', '⺀'], script: 'trad' },
  { char: '于', roots: ['一', '十', '亅'], script: 'simp' },
  { char: '色', roots: ['勹', '巴'], script: 'common' },
  { char: '久', roots: ['勹', '丶'], script: 'common' },
  { char: '言', roots: ['言'], script: 'common' },
  { char: '皆', roots: ['匕', '匕', '白'], script: 'common' },
];

class LingmingLexiconIndex {
  public readonly entries: LexiconEntry[] = [];
  public readonly byChar = new Map<string, LexiconEntry>();
  private readonly exactShort = new Map<string, LexiconEntry[]>();
  private readonly exactFull = new Map<string, LexiconEntry[]>();

  constructor() {
    const map = new Map<string, LexiconEntry>();
    const userOverrides = loadUserHuangtingOverrides();

    const upsert = (next: LexiconEntry) => {
      const existing = map.get(next.char);
      if (!existing) {
        map.set(next.char, next);
        return;
      }
      // Keep higher priority metadata while enriching missing shortCode/rootCodes
      if (next.priority > existing.priority) {
        map.set(next.char, {
          ...existing,
          ...next,
          shortCode: next.shortCode ?? existing.shortCode,
          rootCodes: next.rootCodes ?? existing.rootCodes,
          roles: next.roles ?? existing.roles,
        });
      } else {
        if (!existing.shortCode && next.shortCode) existing.shortCode = next.shortCode;
        if (!existing.rootCodes && next.rootCodes) existing.rootCodes = next.rootCodes;
        if (!existing.roles && next.roles) existing.roles = next.roles;
      }
    };

    // 1. Official 214 direct-commit short codes (highest frequency priority)
    for (let i = 0; i < LINGMING_SHORT_CODES.length; i++) {
      const sc = LINGMING_SHORT_CODES[i];
      const priority =
        sc.level === 1
          ? 1000 - i
          : sc.isCore50
            ? 880 - i
            : 760 - i;
      upsert({
        char: sc.char,
        code: sc.fullCode.toLowerCase(),
        shortCode: sc.shortCode.toLowerCase(),
        roots: sc.roots,
        rootCodes: sc.rootCodes,
        script: getLingmingCharScript(sc.char),
        priority,
      });
    }

    // 2. Complete 1,115-char Huangting dictionary + local overrides
    for (const [char, baseInfo] of Object.entries(HUANGTING_CHAR_MAP)) {
      const ov = userOverrides[char] ?? BUILTIN_HUANGTING_OVERRIDES[char];
      const code = (ov?.code ?? baseInfo.code).toLowerCase();
      const shortCode = ov?.shortCode !== undefined ? ov.shortCode : baseInfo.shortCode;
      const roots = ov?.roots && ov.roots.length > 0 ? ov.roots : baseInfo.roots;
      const rootCodes =
        ov?.rootCodes && ov.rootCodes.length > 0 ? ov.rootCodes : baseInfo.rootCodes;
      upsert({
        char,
        code,
        shortCode: shortCode ? shortCode.toLowerCase() : undefined,
        roots,
        rootCodes,
        script: getLingmingCharScript(char),
        priority: 420,
      });
    }

    // 3. Official Lingming splits
    for (const [char, roots] of LINGMING_CHAR_SPLITS) {
      if (roots.some((r) => !LINGMING_ROOT_MAP.has(r))) continue;
      const enc = encodeLingmingRoots(roots);
      if (!enc.code) continue;
      upsert({
        char,
        code: enc.code,
        roots,
        rootCodes: roots.map((r) => LINGMING_ROOT_MAP.get(r)!.ma),
        roles: enc.roles,
        script: getLingmingCharScript(char),
        priority: 520,
      });
    }

    // 4. Common everyday Traditional & Simplified writer splits
    for (let i = 0; i < COMMON_WRITER_SPLITS.length; i++) {
      const item = COMMON_WRITER_SPLITS[i];
      if (item.roots.some((r) => !LINGMING_ROOT_MAP.has(r))) continue;
      const enc = encodeLingmingRoots(item.roots);
      if (!enc.code) continue;
      upsert({
        char: item.char,
        code: enc.code,
        roots: item.roots,
        rootCodes: item.roots.map((r) => LINGMING_ROOT_MAP.get(r)!.ma),
        roles: enc.roles,
        script: item.script === 'common' ? getLingmingCharScript(item.char) : item.script,
        priority: 560 - Math.min(200, Math.floor(i / 2)),
      });
    }

    // 5. Individual 269 radicals as gentle fallback when typing a standalone radical
    for (const chamber of LINGMING_CHAMBERS) {
      for (const cl of chamber.clusters) {
        for (const rad of cl.radicals) {
          if (rad.char.codePointAt(0)! >= 0xe000 && rad.char.codePointAt(0)! <= 0xf8ff) {
            continue;
          }
          upsert({
            char: rad.char,
            code: rad.ma.toLowerCase(),
            roots: [rad.char],
            rootCodes: [rad.ma.toLowerCase()],
            roles: rad.isXiao ? ['da', 'yun'] : ['da', 'sheng', 'yun'],
            script: getLingmingCharScript(rad.char),
            priority: 120 - Math.min(60, rad.rank),
            isRadical: true,
          });
        }
      }
    }

    this.entries = Array.from(map.values()).sort((a, b) => b.priority - a.priority);

    for (const entry of this.entries) {
      this.byChar.set(entry.char, entry);
      if (entry.shortCode) {
        const list = this.exactShort.get(entry.shortCode) || [];
        list.push(entry);
        this.exactShort.set(entry.shortCode, list);
      }
      const flist = this.exactFull.get(entry.code) || [];
      flist.push(entry);
      this.exactFull.set(entry.code, flist);
    }
  }

  public query(rawBuffer: string, scriptMode: ScriptMode, limit = 7): ImeQueryResult {
    const buffer = rawBuffer.trim().toLowerCase();
    if (!buffer) {
      return {
        exact: [],
        predictions: [],
        all: [],
        hasLongerPrefix: false,
        shouldAutoCommit: false,
      };
    }

    const sortBucket = (list: LexiconEntry[]) =>
      [...list].sort((a, b) => {
        const aScript = matchesScript(a.script, scriptMode) ? 1 : 0;
        const bScript = matchesScript(b.script, scriptMode) ? 1 : 0;
        if (aScript !== bScript) return bScript - aScript;
        const aRad = a.isRadical ? 0 : 1;
        const bRad = b.isRadical ? 0 : 1;
        if (aRad !== bRad) return bRad - aRad;
        return b.priority - a.priority;
      });

    const seen = new Set<string>();
    const exact: ImeCandidate[] = [];

    for (const e of sortBucket(this.exactShort.get(buffer) || [])) {
      if (!seen.has(e.char)) {
        seen.add(e.char);
        exact.push({ entry: e, matchedBy: 'short' });
      }
    }

    for (const e of sortBucket(this.exactFull.get(buffer) || [])) {
      if (!seen.has(e.char)) {
        seen.add(e.char);
        exact.push({ entry: e, matchedBy: 'full' });
      }
    }

    const predictions: ImeCandidate[] = [];
    let hasLongerPrefix = false;

    // Scan prefix matches (dictionary size ~1,400 entries -> <0.15ms per keystroke)
    const prefixPool: LexiconEntry[] = [];
    for (const e of this.entries) {
      const scMatch = e.shortCode && e.shortCode.length > buffer.length && e.shortCode.startsWith(buffer);
      const fcMatch = e.code.length > buffer.length && e.code.startsWith(buffer);
      if (scMatch || fcMatch) {
        hasLongerPrefix = true;
        if (!seen.has(e.char)) {
          prefixPool.push(e);
        }
      }
    }

    for (const e of sortBucket(prefixPool)) {
      if (exact.length + predictions.length >= limit) break;
      if (!seen.has(e.char)) {
        seen.add(e.char);
        predictions.push({ entry: e, matchedBy: 'prefix' });
      }
    }

    // Filter out-of-script entries if we have enough in-script exact matches
    const scriptExact = exact.filter((c) => matchesScript(c.entry.script, scriptMode));
    const finalExact = scriptExact.length > 0 ? scriptExact : exact;
    const all = [...finalExact, ...predictions].slice(0, limit);

    // Self-delimiting auto-commit when exact match is unique and no longer code extends the buffer
    const shouldAutoCommit = finalExact.length === 1 && !hasLongerPrefix;

    return {
      exact: finalExact,
      predictions,
      all,
      hasLongerPrefix,
      shouldAutoCommit,
    };
  }
}

export const lingmingLexicon = new LingmingLexiconIndex();

export function lookupCharCodeInfo(char: string): LexiconEntry | undefined {
  return lingmingLexicon.byChar.get(char);
}

/**
 * Resolves whether keystroke position `pos` of `buffer` represents a radical's 1st key (大碼),
 * returning the matching Memory Palace chamber & radical so KeystrokePalaceCloud never fires on 聲碼/韻碼.
 */
export function resolveImeDaSlot(
  topCandidate: ImeCandidate | undefined,
  buffer: string,
  pos: number
): DaKeySlot | null {
  const b = buffer.toLowerCase();
  if (pos < 0 || pos >= b.length) return null;
  const key = b[pos];
  if (!isPalaceChamberKey(key)) return null;

  if (!topCandidate) {
    if (pos === 0) {
      return {
        chamberKey: key,
        radical: LINGMING_CHAMBER_BY_KEY[key]?.primaryAnchor ?? null,
      };
    }
    return null;
  }

  const entry = topCandidate.entry;
  if (entry.shortCode && entry.shortCode.startsWith(b) && entry.rootCodes && entry.rootCodes.length > 0) {
    const slot = resolveDaSlotForShortCode(
      entry.shortCode,
      entry.code,
      entry.roots,
      entry.rootCodes,
      pos
    );
    if (slot) return slot;
  }

  if (entry.code.startsWith(b)) {
    if (entry.rootCodes && entry.rootCodes.length > 0) {
      return resolveDaSlotFromRootCodes(entry.code, entry.roots, entry.rootCodes, pos);
    }
    return resolveDaSlotFromRoles(entry.code, entry.roots, entry.roles, pos);
  }

  if (pos === 0) {
    return {
      chamberKey: key,
      radical:
        resolveRadicalForChamberKey(entry.roots, key, 0) ??
        LINGMING_CHAMBER_BY_KEY[key]?.primaryAnchor ??
        null,
    };
  }
  return null;
}

function pickPairedQuote(
  textBeforeCaret: string,
  openChar: string,
  closeChar: string
): string {
  let openCount = 0;
  let closeCount = 0;
  for (const ch of textBeforeCaret) {
    if (ch === openChar) openCount++;
    else if (ch === closeChar) closeCount++;
  }
  return openCount > closeCount ? closeChar : openChar;
}

export function mapChinesePunctuation(
  key: string,
  textBeforeCaret: string,
  scriptMode: ScriptMode
): string | null {
  switch (key) {
    case ',':
      return '，';
    case '.':
      return '。';
    case ';':
      return '；';
    case ':':
      return '：';
    case '?':
      return '？';
    case '!':
      return '！';
    case '\\':
    case '/':
      return '、';
    case '<':
      return '《';
    case '>':
      return '》';
    case '(':
      return '（';
    case ')':
      return '）';
    case '[':
      return '「';
    case ']':
      return '」';
    case '{':
      return '『';
    case '}':
      return '』';
    case '_':
      return '——';
    case '~':
      return '～';
    case '"':
      return scriptMode === 'simp'
        ? pickPairedQuote(textBeforeCaret, '“', '”')
        : pickPairedQuote(textBeforeCaret, '「', '」');
    case "'":
      return scriptMode === 'simp'
        ? pickPairedQuote(textBeforeCaret, '‘', '’')
        : pickPairedQuote(textBeforeCaret, '『', '』');
    default:
      return null;
  }
}

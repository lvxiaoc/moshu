import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Cloud,
  CloudOff,
  Compass,
  Copy,
  Download,
  FilePlus2,
  FolderOpen,
  Keyboard,
  RotateCcw,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { synth } from '../audio/synth';
import {
  lingmingLexicon,
  mapChinesePunctuation,
  resolveImeDaSlot,
} from '../engine/lingmingIme';
import { LINGMING_CHAMBER_BY_KEY } from '../data/lingming';
import { useKeystrokeCloud, useKeystrokeCloudPulse } from '../data/keystrokeCloud';
import { SCRIPT_MODE_OPTIONS, ScriptMode } from '../data/scriptFilter';
import { THEME_OPTIONS, ThemeMode, useThemeMode } from '../data/theme';
import { useUiText } from '../data/uiScript';
import { EvolvingProbCloud } from './EvolvingProbCloud';
import { KeystrokePalaceCloud } from './KeystrokePalaceCloud';
import { TouchPalaceKeyboard } from './TouchPalaceKeyboard';

export interface WriterDraft {
  id: string;
  title: string;
  content: string;
  updatedAt: number;
}

interface DraftStore {
  activeId: string;
  drafts: WriterDraft[];
}

interface HistorySnapshot {
  content: string;
  caretPos: number;
}

interface WriterCanvasProps {
  scriptMode: ScriptMode;
  onChangeScriptMode: (mode: ScriptMode) => void;
  onChangeThemeMode: (mode: ThemeMode) => void;
  onOpenPalace: () => void;
  muted: boolean;
  onToggleMute: () => void;
}

const DRAFTS_STORAGE_KEY = 'inkkey_writer_drafts_v1';
const IME_MODE_STORAGE_KEY = 'inkkey_writer_ime_mode_v1';
const SOFT_KEYBOARD_STORAGE_KEY = 'inkkey_soft_keyboard_v1';
const SENTINEL = '\u200B';

const CLOUD_PRESETS = [
  { label: '極微', value: 0.12 },
  { label: '淡墨', value: 0.22 },
  { label: '輕顯', value: 0.38 },
  { label: '清晰', value: 0.58 },
];

const CLOUD_BLEND_PRESETS = [
  { label: '輕暈', value: 0.3 },
  { label: '墨染', value: 0.65 },
  { label: '隱墨', value: 0.9 },
];

function makeDraftId(): string {
  return `draft_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function createEmptyDraft(title = ''): WriterDraft {
  return {
    id: makeDraftId(),
    title,
    content: '',
    updatedAt: Date.now(),
  };
}

function loadDraftStore(): DraftStore {
  try {
    const raw = localStorage.getItem(DRAFTS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DraftStore>;
      if (Array.isArray(parsed.drafts) && parsed.drafts.length > 0) {
        const valid = parsed.drafts.filter(
          (d): d is WriterDraft =>
            Boolean(d && typeof d.id === 'string' && typeof d.content === 'string')
        );
        if (valid.length > 0) {
          const activeExists = valid.some((d) => d.id === parsed.activeId);
          return {
            activeId: activeExists ? (parsed.activeId as string) : valid[0].id,
            drafts: valid.map((d) => ({
              id: d.id,
              title: typeof d.title === 'string' ? d.title : '',
              content: d.content,
              updatedAt: typeof d.updatedAt === 'number' ? d.updatedAt : Date.now(),
            })),
          };
        }
      }
    }
  } catch {
    // Ignore storage errors
  }
  const initial = createEmptyDraft('');
  return { activeId: initial.id, drafts: [initial] };
}

function saveDraftStore(store: DraftStore): void {
  try {
    localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage errors
  }
}

function loadImeMode(): 'lingming' | 'passthrough' {
  try {
    const raw = localStorage.getItem(IME_MODE_STORAGE_KEY);
    if (raw === 'passthrough' || raw === 'lingming') return raw;
  } catch {
    // Ignore
  }
  return 'lingming';
}

function loadSoftKeyboard(): boolean {
  try {
    return localStorage.getItem(SOFT_KEYBOARD_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function countWriterGlyphs(text: string): number {
  if (!text) return 0;
  return text.replace(/\s+/g, '').length;
}

function formatDraftTimestamp(ts: number): string {
  try {
    const d = new Date(ts);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${mm}/${dd} ${hh}:${min}`;
  } catch {
    return '';
  }
}

function getParagraphOffsetFromPoint(
  paraEl: HTMLElement,
  clientX: number,
  clientY: number
): number | null {
  let targetNode: Node | null = null;
  let targetOffset = 0;

  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };

  if (typeof doc.caretPositionFromPoint === 'function') {
    const pos = doc.caretPositionFromPoint(clientX, clientY);
    if (pos) {
      targetNode = pos.offsetNode;
      targetOffset = pos.offset;
    }
  } else if (typeof doc.caretRangeFromPoint === 'function') {
    const range = doc.caretRangeFromPoint(clientX, clientY);
    if (range) {
      targetNode = range.startContainer;
      targetOffset = range.startOffset;
    }
  }

  if (!targetNode || !paraEl.contains(targetNode)) return null;

  const walker = document.createTreeWalker(paraEl, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (parent && parent.closest('[data-ignored-caret="true"]')) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let acc = 0;
  let cur: Node | null = walker.nextNode();
  while (cur) {
    const len = cur.textContent?.length ?? 0;
    if (cur === targetNode) {
      return acc + Math.min(len, targetOffset);
    }
    acc += len;
    cur = walker.nextNode();
  }

  return acc;
}

// Progressive depth-of-field styling modeled after 黃庭抄經閣:
// active paragraph stays razor-sharp; surrounding paragraphs recede smoothly with depth.
function getParagraphDepthStyle(distance: number, scrolledAway: boolean): React.CSSProperties {
  if (distance === 0) {
    return { opacity: 1, filter: 'none' };
  }
  if (scrolledAway) {
    return {
      opacity: Math.max(0.55, 1 - distance * 0.08),
      filter: 'none',
    };
  }
  if (distance === 1) {
    return { opacity: 0.62, filter: 'none' };
  }
  if (distance === 2) {
    return { opacity: 0.36, filter: 'blur(0.35px)' };
  }
  if (distance === 3) {
    return { opacity: 0.2, filter: 'blur(0.75px)' };
  }
  return { opacity: 0.11, filter: 'blur(1.15px)' };
}

export const WriterCanvas: React.FC<WriterCanvasProps> = ({
  scriptMode,
  onChangeScriptMode,
  onChangeThemeMode,
  onOpenPalace,
  muted,
  onToggleMute,
}) => {
  const t = useUiText();
  const themeMode = useThemeMode();
  const isWash = themeMode === 'wash';
  const {
    enabled: keystrokeCloudEnabled,
    setEnabled: setKeystrokeCloudEnabled,
    opacity: cloudOpacity,
    setOpacity: setCloudOpacity,
    blend: cloudBlend,
    setBlend: setCloudBlend,
    mode: cloudMode,
    setMode: setCloudMode,
    includeShortCodes: cloudIncludeShortCodes,
    setIncludeShortCodes: setCloudIncludeShortCodes,
  } = useKeystrokeCloud();
  const cloudPulse = useKeystrokeCloudPulse(keystrokeCloudEnabled && cloudMode === 'palace');
  const { trigger: triggerCloud, clear: clearCloud } = cloudPulse;

  const [store, setStore] = useState<DraftStore>(() => loadDraftStore());
  const activeDraft = useMemo(
    () => store.drafts.find((d) => d.id === store.activeId) ?? store.drafts[0],
    [store]
  );

  const [caretPos, setCaretPos] = useState<number>(() => activeDraft.content.length);
  const [buffer, setBuffer] = useState<string>('');
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [committedCloud, setCommittedCloud] = useState<{ char: string; tick: number } | null>(null);
  const [imeMode, setImeMode] = useState<'lingming' | 'passthrough'>(() => loadImeMode());
  const [showSoftKeyboard, setShowSoftKeyboard] = useState<boolean>(() => loadSoftKeyboard());
  const [chromeVisible, setChromeVisible] = useState<boolean>(true);
  const [draftDrawerOpen, setDraftDrawerOpen] = useState<boolean>(false);
  const [exportMenuOpen, setExportMenuOpen] = useState<boolean>(false);
  const [cloudPopoverOpen, setCloudPopoverOpen] = useState<boolean>(false);
  const [copiedNotice, setCopiedNotice] = useState<boolean>(false);
  const [scrolledAway, setScrolledAway] = useState<boolean>(false);
  const [cloudAnchor, setCloudAnchor] = useState<{ x: number; y: number } | null>(null);

  const [vvBox, setVvBox] = useState<{ height: number; offsetTop: number; width: number }>(() => ({
    height: typeof window !== 'undefined' ? window.visualViewport?.height ?? window.innerHeight : 800,
    offsetTop: typeof window !== 'undefined' ? window.visualViewport?.offsetTop ?? 0 : 0,
    width: typeof window !== 'undefined' ? window.visualViewport?.width ?? window.innerWidth : 1280,
  }));

  const liveRef = useRef({
    draftId: activeDraft.id,
    content: activeDraft.content,
    caretPos: activeDraft.content.length,
    buffer: '',
    selectedIdx: 0,
  });
  liveRef.current.draftId = activeDraft.id;
  liveRef.current.content = activeDraft.content;
  liveRef.current.caretPos = caretPos;
  liveRef.current.buffer = buffer;
  liveRef.current.selectedIdx = selectedIdx;

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const focalRuleRef = useRef<HTMLDivElement | null>(null);
  const caretMarkerRef = useRef<HTMLSpanElement | null>(null);
  const inputSinkRef = useRef<HTMLTextAreaElement | null>(null);
  const isAutoScrollingRef = useRef<boolean>(false);
  const userScrolledAwayRef = useRef<boolean>(false);
  const idleChromeTimerRef = useRef<number | null>(null);
  const undoStackRef = useRef<Record<string, HistorySnapshot[]>>({});
  const redoStackRef = useRef<Record<string, HistorySnapshot[]>>({});
  const shiftTapRef = useRef<{ downAt: number; tainted: boolean } | null>(null);
  const isComposingRef = useRef<boolean>(false);
  const compLastRawRef = useRef<string>('');

  const anyMenuOpen = draftDrawerOpen || exportMenuOpen || cloudPopoverOpen;

  useEffect(() => {
    saveDraftStore(store);
  }, [store]);

  useEffect(() => {
    try {
      localStorage.setItem(IME_MODE_STORAGE_KEY, imeMode);
    } catch {
      // Ignore
    }
  }, [imeMode]);

  useEffect(() => {
    try {
      localStorage.setItem(SOFT_KEYBOARD_STORAGE_KEY, String(showSoftKeyboard));
    } catch {
      // Ignore
    }
  }, [showSoftKeyboard]);

  useEffect(() => {
    const syncVv = () => {
      const vv = window.visualViewport;
      const next = {
        height: vv ? Math.round(vv.height) : window.innerHeight,
        offsetTop: vv ? Math.round(vv.offsetTop) : 0,
        width: vv ? Math.round(vv.width) : window.innerWidth,
      };
      setVvBox((prev) =>
        prev.height === next.height &&
        prev.offsetTop === next.offsetTop &&
        prev.width === next.width
          ? prev
          : next
      );
    };
    syncVv();
    window.addEventListener('resize', syncVv);
    window.visualViewport?.addEventListener('resize', syncVv);
    window.visualViewport?.addEventListener('scroll', syncVv);
    return () => {
      window.removeEventListener('resize', syncVv);
      window.visualViewport?.removeEventListener('resize', syncVv);
      window.visualViewport?.removeEventListener('scroll', syncVv);
    };
  }, []);

  // Auto-hide all chrome & explanatory UI smoothly when entering pure writing state
  const scheduleHideChrome = useCallback(
    (delayMs = 1800) => {
      if (anyMenuOpen) return;
      if (idleChromeTimerRef.current !== null) {
        window.clearTimeout(idleChromeTimerRef.current);
      }
      idleChromeTimerRef.current = window.setTimeout(() => {
        setChromeVisible(false);
      }, delayMs);
    },
    [anyMenuOpen]
  );

  const wakeChrome = useCallback(
    (autoFadeDelayMs = 3400) => {
      setChromeVisible(true);
      if (idleChromeTimerRef.current !== null) {
        window.clearTimeout(idleChromeTimerRef.current);
        idleChromeTimerRef.current = null;
      }
      if (!anyMenuOpen) {
        idleChromeTimerRef.current = window.setTimeout(() => {
          setChromeVisible(false);
        }, autoFadeDelayMs);
      }
    },
    [anyMenuOpen]
  );

  const hideChromeImmediately = useCallback(() => {
    if (anyMenuOpen) return;
    if (idleChromeTimerRef.current !== null) {
      window.clearTimeout(idleChromeTimerRef.current);
      idleChromeTimerRef.current = null;
    }
    setChromeVisible(false);
  }, [anyMenuOpen]);

  // Initial auto-hide shortly after opening so the workspace settles into serene writing mode
  useEffect(() => {
    scheduleHideChrome(2400);
    return () => {
      if (idleChromeTimerRef.current !== null) {
        window.clearTimeout(idleChromeTimerRef.current);
      }
    };
  }, [scheduleHideChrome]);

  const resetSink = useCallback(() => {
    const el = inputSinkRef.current;
    if (!el) return;
    if (el.value !== SENTINEL) {
      el.value = SENTINEL;
    }
    try {
      if (document.activeElement === el) {
        el.setSelectionRange(1, 1);
      }
    } catch {
      // Ignore
    }
  }, []);

  const focusSink = useCallback(
    (forceEvenWithSoftKbd = false) => {
      const el = inputSinkRef.current;
      if (!el) return;
      if (showSoftKeyboard && !forceEvenWithSoftKbd) {
        const isCoarsePointer =
          typeof window !== 'undefined' &&
          window.matchMedia?.('(pointer: coarse)').matches;
        if (isCoarsePointer) return;
      }
      if (document.activeElement !== el) {
        el.focus({ preventScroll: true });
      }
      resetSink();
    },
    [showSoftKeyboard, resetSink]
  );

  useEffect(() => {
    resetSink();
    const isCoarsePointer =
      typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
    if (!isCoarsePointer) {
      focusSink(true);
    }
  }, [activeDraft.id, focusSink, resetSink]);

  const imeQuery = useMemo(
    () => lingmingLexicon.query(buffer, scriptMode, 7),
    [buffer, scriptMode]
  );

  useEffect(() => {
    if (selectedIdx >= imeQuery.all.length && imeQuery.all.length > 0) {
      setSelectedIdx(0);
    }
  }, [imeQuery.all.length, selectedIdx]);

  // Snap active caret line onto the lower-middle focal baseline
  const snapCaretToFocalBaseline = useCallback((behavior: ScrollBehavior = 'auto') => {
    const scroller = scrollContainerRef.current;
    const rule = focalRuleRef.current;
    const marker = caretMarkerRef.current;
    if (!scroller || !rule || !marker) return;

    const ruleRect = rule.getBoundingClientRect();
    const markerRect = marker.getBoundingClientRect();
    const targetBottom = ruleRect.top - 10;
    const delta = markerRect.bottom - targetBottom;

    if (Math.abs(delta) > 1.5) {
      isAutoScrollingRef.current = true;
      scroller.scrollBy({ top: delta, behavior });
      window.setTimeout(() => {
        isAutoScrollingRef.current = false;
      }, 60);
    }

    const updatedRect = marker.getBoundingClientRect();
    setCloudAnchor({
      x: updatedRect.left,
      y: updatedRect.top + updatedRect.height / 2,
    });
    if (inputSinkRef.current) {
      inputSinkRef.current.style.left = `${Math.max(12, Math.min(window.innerWidth - 40, updatedRect.left))}px`;
      inputSinkRef.current.style.top = `${Math.max(12, Math.min(window.innerHeight - 40, updatedRect.bottom))}px`;
    }
  }, []);

  useEffect(() => {
    if (!userScrolledAwayRef.current) {
      snapCaretToFocalBaseline('auto');
    } else if (caretMarkerRef.current) {
      const r = caretMarkerRef.current.getBoundingClientRect();
      setCloudAnchor({ x: r.left, y: r.top + r.height / 2 });
    }
  }, [
    activeDraft.content,
    activeDraft.id,
    caretPos,
    buffer,
    vvBox.height,
    showSoftKeyboard,
    snapCaretToFocalBaseline,
  ]);

  const applyTextEdit = useCallback(
    (nextContent: string, nextCaret: number, recordUndo = true) => {
      const cur = liveRef.current;
      const draftId = cur.draftId;
      if (recordUndo) {
        const stack = undoStackRef.current[draftId] || [];
        stack.push({ content: cur.content, caretPos: cur.caretPos });
        if (stack.length > 200) stack.shift();
        undoStackRef.current[draftId] = stack;
        redoStackRef.current[draftId] = [];
      }

      const clampedCaret = Math.max(0, Math.min(nextContent.length, nextCaret));
      liveRef.current.content = nextContent;
      liveRef.current.caretPos = clampedCaret;

      userScrolledAwayRef.current = false;
      setScrolledAway(false);

      setStore((prev) => ({
        ...prev,
        drafts: prev.drafts.map((d) =>
          d.id === draftId ? { ...d, content: nextContent, updatedAt: Date.now() } : d
        ),
      }));
      setCaretPos(clampedCaret);
      hideChromeImmediately();
    },
    [hideChromeImmediately]
  );

  const setLiveBuffer = useCallback((nextBuf: string, nextIdx = 0) => {
    liveRef.current.buffer = nextBuf;
    liveRef.current.selectedIdx = nextIdx;
    setBuffer(nextBuf);
    setSelectedIdx(nextIdx);
  }, []);

  const insertTextAtCaret = useCallback(
    (text: string) => {
      if (!text) return;
      const { content, caretPos: pos } = liveRef.current;
      const before = content.slice(0, pos);
      const after = content.slice(pos);
      applyTextEdit(before + text + after, pos + text.length, true);
    },
    [applyTextEdit]
  );

  const deleteBeforeCaret = useCallback(() => {
    const { content, caretPos: pos } = liveRef.current;
    if (pos <= 0) return;
    const prevSlice = content.slice(0, pos);
    const chars = Array.from(prevSlice);
    const removed = chars.pop() ?? '';
    const newCaret = pos - removed.length;
    const nextContent = chars.join('') + content.slice(pos);
    applyTextEdit(nextContent, newCaret, true);
  }, [applyTextEdit]);

  const deleteAfterCaret = useCallback(() => {
    const { content, caretPos: pos } = liveRef.current;
    if (pos >= content.length) return;
    const afterSlice = content.slice(pos);
    const chars = Array.from(afterSlice);
    chars.shift();
    const nextContent = content.slice(0, pos) + chars.join('');
    applyTextEdit(nextContent, pos, true);
  }, [applyTextEdit]);

  const handleUndo = useCallback(() => {
    const { draftId, content, caretPos: pos } = liveRef.current;
    const stack = undoStackRef.current[draftId];
    if (!stack || stack.length === 0) return;
    const snap = stack.pop()!;
    const redo = redoStackRef.current[draftId] || [];
    redo.push({ content, caretPos: pos });
    redoStackRef.current[draftId] = redo;

    liveRef.current.content = snap.content;
    liveRef.current.caretPos = snap.caretPos;
    setLiveBuffer('', 0);
    userScrolledAwayRef.current = false;
    setScrolledAway(false);
    setStore((prev) => ({
      ...prev,
      drafts: prev.drafts.map((d) =>
        d.id === draftId ? { ...d, content: snap.content, updatedAt: Date.now() } : d
      ),
    }));
    setCaretPos(snap.caretPos);
  }, [setLiveBuffer]);

  const handleRedo = useCallback(() => {
    const { draftId, content, caretPos: pos } = liveRef.current;
    const redo = redoStackRef.current[draftId];
    if (!redo || redo.length === 0) return;
    const snap = redo.pop()!;
    const undo = undoStackRef.current[draftId] || [];
    undo.push({ content, caretPos: pos });
    undoStackRef.current[draftId] = undo;

    liveRef.current.content = snap.content;
    liveRef.current.caretPos = snap.caretPos;
    setLiveBuffer('', 0);
    userScrolledAwayRef.current = false;
    setScrolledAway(false);
    setStore((prev) => ({
      ...prev,
      drafts: prev.drafts.map((d) =>
        d.id === draftId ? { ...d, content: snap.content, updatedAt: Date.now() } : d
      ),
    }));
    setCaretPos(snap.caretPos);
  }, [setLiveBuffer]);

  const pulseCommittedCloud = useCallback((char: string) => {
    if (!char) return;
    setCommittedCloud((prev) => ({ char, tick: (prev?.tick ?? 0) + 1 }));
  }, []);

  const commitCandidate = useCallback(
    (idx: number) => {
      const { buffer: curBuf } = liveRef.current;
      if (!curBuf) return;
      const res = lingmingLexicon.query(curBuf, scriptMode, 7);
      const cand = res.all[idx] ?? res.all[0];
      if (cand) {
        synth.playKeyHit(curBuf.length || 1, true);
        pulseCommittedCloud(cand.entry.char);
        insertTextAtCaret(cand.entry.char);
      } else {
        insertTextAtCaret(curBuf);
      }
      setLiveBuffer('', 0);
    },
    [scriptMode, insertTextAtCaret, setLiveBuffer, pulseCommittedCloud]
  );

  const moveCaretLine = useCallback((dir: -1 | 1) => {
    const { content, caretPos: pos } = liveRef.current;
    const lines = content.split('\n');
    let remaining = pos;
    let curLine = 0;
    let col = 0;
    for (let i = 0; i < lines.length; i++) {
      if (remaining <= lines[i].length) {
        curLine = i;
        col = remaining;
        break;
      }
      remaining -= lines[i].length + 1;
    }
    const nextLine = Math.max(0, Math.min(lines.length - 1, curLine + dir));
    let nextPos = 0;
    if (nextLine === curLine) {
      nextPos = dir < 0 ? 0 : content.length;
    } else {
      for (let i = 0; i < nextLine; i++) {
        nextPos += lines[i].length + 1;
      }
      nextPos += Math.min(col, lines[nextLine].length);
    }
    liveRef.current.caretPos = nextPos;
    userScrolledAwayRef.current = false;
    setScrolledAway(false);
    setCaretPos(nextPos);
  }, []);

  const handleLingmingLetter = useCallback(
    (lowerKey: string) => {
      if (lowerKey === 'z') {
        synth.playKeyMiss();
        return;
      }

      const {
        buffer: curBuf,
        content: curContent,
        caretPos: curPos,
        selectedIdx: curIdx,
      } = liveRef.current;

      let baseBuffer = curBuf;
      let textBefore = curContent.slice(0, curPos);
      const textAfter = curContent.slice(curPos);
      let didDingZi = false;

      if (baseBuffer.length > 0) {
        const curRes = lingmingLexicon.query(baseBuffer, scriptMode, 7);
        const testRes = lingmingLexicon.query(baseBuffer + lowerKey, scriptMode, 7);
        const curExact = curRes.exact[curIdx] ?? curRes.exact[0];
        const isFullCommitReady =
          Boolean(curExact) && curExact.matchedBy === 'full' && baseBuffer.length >= 3;
        const terminalMulti = !curRes.hasLongerPrefix && curRes.exact.length > 0 && isFullCommitReady;
        const maxCodeReached = baseBuffer.length >= 4 && Boolean(curExact);
        const deadEndExtend =
          testRes.all.length === 0 && !testRes.hasLongerPrefix && isFullCommitReady;

        if (terminalMulti || maxCodeReached || deadEndExtend) {
          textBefore += curExact.entry.char;
          baseBuffer = '';
          didDingZi = true;
        } else if (
          baseBuffer.length >= 4 ||
          (testRes.all.length === 0 && !testRes.hasLongerPrefix)
        ) {
          baseBuffer = '';
        }
      }

      const nextBuf = baseBuffer + lowerKey;
      const nextRes = lingmingLexicon.query(nextBuf, scriptMode, 7);
      const daSlot = resolveImeDaSlot(nextRes.all[0], nextBuf, nextBuf.length - 1);

      if (nextRes.shouldAutoCommit) {
        const committedChar = nextRes.exact[0].entry.char;
        if (daSlot) {
          triggerCloud(daSlot.chamberKey, daSlot.radical, 'hit');
        }
        pulseCommittedCloud(committedChar);
        synth.playKeyHit(nextBuf.length, true);
        applyTextEdit(textBefore + committedChar + textAfter, textBefore.length + committedChar.length, true);
        setLiveBuffer('', 0);
        return;
      }

      if (daSlot) {
        triggerCloud(daSlot.chamberKey, daSlot.radical, 'hit');
      }
      synth.playKeyHit(nextBuf.length, false);

      if (didDingZi) {
        applyTextEdit(textBefore + textAfter, textBefore.length, true);
      } else {
        userScrolledAwayRef.current = false;
        setScrolledAway(false);
        hideChromeImmediately();
      }
      setLiveBuffer(nextBuf, 0);
    },
    [scriptMode, triggerCloud, applyTextEdit, hideChromeImmediately, setLiveBuffer, pulseCommittedCloud]
  );

  const handleBackspaceAction = useCallback(() => {
    const { buffer: curBuf } = liveRef.current;
    if (curBuf) {
      const next = curBuf.slice(0, -1);
      setLiveBuffer(next, 0);
      if (!next) clearCloud();
      synth.playClick();
    } else {
      deleteBeforeCaret();
    }
  }, [setLiveBuffer, clearCloud, deleteBeforeCaret]);

  const handleSpaceAction = useCallback(() => {
    const { buffer: curBuf, selectedIdx: curIdx } = liveRef.current;
    if (imeMode === 'lingming' && curBuf) {
      commitCandidate(curIdx);
    } else {
      insertTextAtCaret(' ');
    }
  }, [imeMode, commitCandidate, insertTextAtCaret]);

  const handleEnterAction = useCallback(() => {
    const { buffer: curBuf } = liveRef.current;
    if (curBuf) {
      insertTextAtCaret(curBuf);
      setLiveBuffer('', 0);
      clearCloud();
    } else {
      insertTextAtCaret('\n');
    }
  }, [insertTextAtCaret, setLiveBuffer, clearCloud]);

  const handlePunctuationAction = useCallback(
    (key: string) => {
      const { buffer: curBuf, selectedIdx: curIdx, content: curContent, caretPos: curPos } =
        liveRef.current;

      if (imeMode === 'passthrough') {
        insertTextAtCaret(key);
        return;
      }

      const punct = mapChinesePunctuation(key, curContent.slice(0, curPos), scriptMode) ?? key;
      if (curBuf) {
        const res = lingmingLexicon.query(curBuf, scriptMode, 7);
        const top = res.exact[curIdx] ?? res.all[0];
        const committed = top ? top.entry.char : curBuf;
        if (top) pulseCommittedCloud(top.entry.char);
        insertTextAtCaret(committed + punct);
        setLiveBuffer('', 0);
      } else {
        insertTextAtCaret(punct);
      }
      synth.playKeyHit(1, true);
    },
    [imeMode, scriptMode, insertTextAtCaret, setLiveBuffer, pulseCommittedCloud]
  );

  const processInputChar = useCallback(
    (ch: string) => {
      if (imeMode === 'passthrough') {
        insertTextAtCaret(ch);
        return;
      }

      if (ch === '\n') {
        handleEnterAction();
        return;
      }
      if (ch === ' ') {
        handleSpaceAction();
        return;
      }
      if (/^[a-z]$/.test(ch)) {
        handleLingmingLetter(ch);
        return;
      }
      if (/^[A-Z]$/.test(ch)) {
        const { buffer: curBuf, selectedIdx: curIdx } = liveRef.current;
        if (curBuf) {
          const res = lingmingLexicon.query(curBuf, scriptMode, 7);
          const top = res.exact[curIdx] ?? res.all[0];
          insertTextAtCaret((top ? top.entry.char : curBuf) + ch);
          setLiveBuffer('', 0);
        } else {
          insertTextAtCaret(ch);
        }
        return;
      }
      if (liveRef.current.buffer && /^[1-7]$/.test(ch)) {
        const idx = Number(ch) - 1;
        const res = lingmingLexicon.query(liveRef.current.buffer, scriptMode, 7);
        if (idx < res.all.length) {
          commitCandidate(idx);
          return;
        }
      }

      const punct = mapChinesePunctuation(
        ch,
        liveRef.current.content.slice(0, liveRef.current.caretPos),
        scriptMode
      );
      if (punct) {
        handlePunctuationAction(ch);
        return;
      }

      if (liveRef.current.buffer) {
        const res = lingmingLexicon.query(liveRef.current.buffer, scriptMode, 7);
        const top = res.exact[liveRef.current.selectedIdx] ?? res.all[0];
        insertTextAtCaret((top ? top.entry.char : liveRef.current.buffer) + ch);
        setLiveBuffer('', 0);
      } else {
        insertTextAtCaret(ch);
      }
    },
    [
      imeMode,
      scriptMode,
      insertTextAtCaret,
      handleEnterAction,
      handleSpaceAction,
      handleLingmingLetter,
      setLiveBuffer,
      commitCandidate,
      handlePunctuationAction,
    ]
  );

  const toggleImeMode = useCallback(() => {
    const { buffer: curBuf } = liveRef.current;
    if (curBuf) {
      insertTextAtCaret(curBuf);
      setLiveBuffer('', 0);
      clearCloud();
    }
    setImeMode((m) => (m === 'lingming' ? 'passthrough' : 'lingming'));
    synth.playClick();
  }, [insertTextAtCaret, setLiveBuffer, clearCloud]);

  const handleSinkKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Unidentified' || e.key === 'Process' || e.keyCode === 229) {
        return;
      }

      if (e.key === 'Shift') {
        if (!e.repeat) {
          shiftTapRef.current = { downAt: Date.now(), tainted: false };
        }
        return;
      }
      if (shiftTapRef.current) {
        shiftTapRef.current.tainted = true;
      }

      if (isComposingRef.current) return;

      if (e.metaKey || e.ctrlKey) {
        const k = e.key.toLowerCase();
        if (k === ' ' || e.code === 'Space') {
          e.preventDefault();
          toggleImeMode();
          return;
        }
        if (k === 'z') {
          e.preventDefault();
          if (e.shiftKey) handleRedo();
          else handleUndo();
          return;
        }
        if (k === 'y') {
          e.preventDefault();
          handleRedo();
          return;
        }
        return;
      }

      if (e.altKey) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        if (liveRef.current.buffer) {
          setLiveBuffer('', 0);
          clearCloud();
        } else if (anyMenuOpen) {
          setDraftDrawerOpen(false);
          setExportMenuOpen(false);
          setCloudPopoverOpen(false);
        } else if (chromeVisible) {
          hideChromeImmediately();
        } else {
          wakeChrome();
        }
        return;
      }

      if (anyMenuOpen) return;

      if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspaceAction();
        resetSink();
        return;
      }
      if (e.key === 'Delete') {
        e.preventDefault();
        if (!liveRef.current.buffer) deleteAfterCaret();
        resetSink();
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const { buffer: curBuf, caretPos: curPos } = liveRef.current;
        const len = curBuf ? lingmingLexicon.query(curBuf, scriptMode, 7).all.length : 0;
        if (curBuf && len > 0) {
          const next = (liveRef.current.selectedIdx - 1 + len) % len;
          liveRef.current.selectedIdx = next;
          setSelectedIdx(next);
        } else {
          const nextPos = Math.max(0, curPos - 1);
          liveRef.current.caretPos = nextPos;
          userScrolledAwayRef.current = false;
          setScrolledAway(false);
          setCaretPos(nextPos);
        }
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        const { buffer: curBuf, content: curContent, caretPos: curPos } = liveRef.current;
        const len = curBuf ? lingmingLexicon.query(curBuf, scriptMode, 7).all.length : 0;
        if (curBuf && len > 0) {
          const next = (liveRef.current.selectedIdx + 1) % len;
          liveRef.current.selectedIdx = next;
          setSelectedIdx(next);
        } else {
          const nextPos = Math.min(curContent.length, curPos + 1);
          liveRef.current.caretPos = nextPos;
          userScrolledAwayRef.current = false;
          setScrolledAway(false);
          setCaretPos(nextPos);
        }
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (!liveRef.current.buffer) moveCaretLine(-1);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (!liveRef.current.buffer) moveCaretLine(1);
        return;
      }
      if (e.key === 'Home') {
        e.preventDefault();
        if (!liveRef.current.buffer) {
          const idx = liveRef.current.content.lastIndexOf('\n', Math.max(0, liveRef.current.caretPos - 1));
          const nextPos = idx === -1 ? 0 : idx + 1;
          liveRef.current.caretPos = nextPos;
          setCaretPos(nextPos);
        }
        return;
      }
      if (e.key === 'End') {
        e.preventDefault();
        if (!liveRef.current.buffer) {
          const idx = liveRef.current.content.indexOf('\n', liveRef.current.caretPos);
          const nextPos = idx === -1 ? liveRef.current.content.length : idx;
          liveRef.current.caretPos = nextPos;
          setCaretPos(nextPos);
        }
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        handleEnterAction();
        resetSink();
        return;
      }

      // Tab silently cycles blind homocode preview if composing; otherwise indents cleanly
      if (e.key === 'Tab') {
        e.preventDefault();
        if (liveRef.current.buffer) {
          const res = lingmingLexicon.query(liveRef.current.buffer, scriptMode, 7);
          if (res.all.length > 1) {
            const next = (liveRef.current.selectedIdx + 1) % res.all.length;
            liveRef.current.selectedIdx = next;
            setSelectedIdx(next);
          } else {
            commitCandidate(liveRef.current.selectedIdx);
          }
        } else {
          insertTextAtCaret('　　');
        }
        resetSink();
        return;
      }

      if (e.key === ' ') {
        e.preventDefault();
        handleSpaceAction();
        resetSink();
        return;
      }

      if (e.key.length === 1) {
        e.preventDefault();
        processInputChar(e.key);
        resetSink();
      }
    },
    [
      anyMenuOpen,
      chromeVisible,
      scriptMode,
      toggleImeMode,
      handleRedo,
      handleUndo,
      setLiveBuffer,
      clearCloud,
      hideChromeImmediately,
      wakeChrome,
      handleBackspaceAction,
      resetSink,
      deleteAfterCaret,
      moveCaretLine,
      handleEnterAction,
      commitCandidate,
      insertTextAtCaret,
      handleSpaceAction,
      processInputChar,
    ]
  );

  const handleSinkKeyUp = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Shift' && shiftTapRef.current) {
        const { downAt, tainted } = shiftTapRef.current;
        shiftTapRef.current = null;
        if (!tainted && Date.now() - downAt < 380) {
          toggleImeMode();
        }
      }
    },
    [toggleImeMode]
  );

  const syncLingmingCompositionDiff = useCallback(
    (rawText: string) => {
      const clean = rawText.replace(/\u200B/g, '');
      const prev = compLastRawRef.current;
      if (clean === prev) return;

      if (clean.startsWith(prev)) {
        const added = clean.slice(prev.length);
        for (const ch of Array.from(added)) {
          processInputChar(ch);
        }
      } else if (prev.startsWith(clean)) {
        const removedCount = Array.from(prev.slice(clean.length)).length;
        for (let i = 0; i < removedCount; i++) {
          handleBackspaceAction();
        }
      } else {
        let common = 0;
        const prevChars = Array.from(prev);
        const cleanChars = Array.from(clean);
        while (
          common < prevChars.length &&
          common < cleanChars.length &&
          prevChars[common] === cleanChars[common]
        ) {
          common++;
        }
        for (let i = common; i < prevChars.length; i++) {
          handleBackspaceAction();
        }
        for (let i = common; i < cleanChars.length; i++) {
          processInputChar(cleanChars[i]);
        }
      }
      compLastRawRef.current = clean;
    },
    [processInputChar, handleBackspaceAction]
  );

  const handleSinkCompositionStart = useCallback(() => {
    isComposingRef.current = true;
    compLastRawRef.current = '';
  }, []);

  const handleSinkCompositionUpdate = useCallback(
    (e: React.CompositionEvent<HTMLTextAreaElement>) => {
      if (imeMode === 'lingming') {
        syncLingmingCompositionDiff(e.data || '');
      }
    },
    [imeMode, syncLingmingCompositionDiff]
  );

  const handleSinkCompositionEnd = useCallback(
    (e: React.CompositionEvent<HTMLTextAreaElement>) => {
      isComposingRef.current = false;
      const raw = (e.data || e.currentTarget.value || '').replace(/\u200B/g, '');
      if (imeMode === 'lingming') {
        syncLingmingCompositionDiff(raw);
        compLastRawRef.current = '';
      } else if (raw) {
        insertTextAtCaret(raw);
      }
      window.setTimeout(resetSink, 0);
    },
    [imeMode, syncLingmingCompositionDiff, insertTextAtCaret, resetSink]
  );

  const handleSinkInput = useCallback(
    (e: React.FormEvent<HTMLTextAreaElement>) => {
      const nativeEv = e.nativeEvent as InputEvent;
      if (isComposingRef.current || nativeEv.isComposing) return;

      const el = e.currentTarget;
      const val = el.value;

      if (val === '') {
        handleBackspaceAction();
        resetSink();
        return;
      }

      const inserted = val.replace(/\u200B/g, '');
      resetSink();
      if (!inserted) return;

      for (const ch of Array.from(inserted)) {
        processInputChar(ch);
      }
    },
    [handleBackspaceAction, resetSink, processInputChar]
  );

  const handleSinkPaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      e.preventDefault();
      const pasted = e.clipboardData?.getData('text/plain');
      if (!pasted) return;
      const cleaned = pasted.replace(/\r\n/g, '\n');
      const { buffer: curBuf, selectedIdx: curIdx } = liveRef.current;
      if (curBuf) {
        const res = lingmingLexicon.query(curBuf, scriptMode, 7);
        const top = res.exact[curIdx] ?? res.all[0];
        insertTextAtCaret((top ? top.entry.char : curBuf) + cleaned);
        setLiveBuffer('', 0);
      } else {
        insertTextAtCaret(cleaned);
      }
      resetSink();
    },
    [scriptMode, insertTextAtCaret, setLiveBuffer, resetSink]
  );

  const handleSelectDraft = useCallback(
    (id: string) => {
      if (liveRef.current.buffer) {
        commitCandidate(liveRef.current.selectedIdx);
      }
      const nextDraft = store.drafts.find((d) => d.id === id);
      if (!nextDraft) return;
      setStore((prev) => ({ ...prev, activeId: id }));
      setCaretPos(nextDraft.content.length);
      setLiveBuffer('', 0);
      setDraftDrawerOpen(false);
      userScrolledAwayRef.current = false;
      setScrolledAway(false);
      window.setTimeout(() => focusSink(), 0);
    },
    [commitCandidate, store.drafts, setLiveBuffer, focusSink]
  );

  const handleCreateDraft = useCallback(() => {
    synth.playClick();
    const fresh = createEmptyDraft('');
    setStore((prev) => ({
      activeId: fresh.id,
      drafts: [fresh, ...prev.drafts],
    }));
    setCaretPos(0);
    setLiveBuffer('', 0);
    setDraftDrawerOpen(false);
    userScrolledAwayRef.current = false;
    setScrolledAway(false);
    window.setTimeout(() => focusSink(), 0);
  }, [setLiveBuffer, focusSink]);

  const handleDeleteDraft = useCallback((id: string) => {
    synth.playClick();
    setStore((prev) => {
      const remaining = prev.drafts.filter((d) => d.id !== id);
      if (remaining.length === 0) {
        const fresh = createEmptyDraft('');
        setCaretPos(0);
        return { activeId: fresh.id, drafts: [fresh] };
      }
      const nextActive = prev.activeId === id ? remaining[0].id : prev.activeId;
      if (prev.activeId === id) {
        setCaretPos(remaining[0].content.length);
      }
      return { activeId: nextActive, drafts: remaining };
    });
  }, []);

  const handleTitleChange = useCallback(
    (nextTitle: string) => {
      setStore((prev) => ({
        ...prev,
        drafts: prev.drafts.map((d) =>
          d.id === activeDraft.id ? { ...d, title: nextTitle, updatedAt: Date.now() } : d
        ),
      }));
    },
    [activeDraft.id]
  );

  const handleCopyAll = useCallback(async () => {
    synth.playClick();
    try {
      await navigator.clipboard.writeText(activeDraft.content);
      setCopiedNotice(true);
      window.setTimeout(() => setCopiedNotice(false), 1800);
    } catch {
      // Clipboard unavailable
    }
    setExportMenuOpen(false);
  }, [activeDraft.content]);

  const handleDownloadFile = useCallback(
    (ext: 'md' | 'txt') => {
      synth.playClick();
      const baseName = (activeDraft.title.trim() || '手稿').replace(/[\\/:*?"<>|]/g, '_');
      const payload =
        ext === 'md' && activeDraft.title.trim()
          ? `# ${activeDraft.title.trim()}\n\n${activeDraft.content}`
          : activeDraft.content;
      const blob = new Blob([payload], {
        type: ext === 'md' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${baseName}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportMenuOpen(false);
    },
    [activeDraft.title, activeDraft.content]
  );

  const { paragraphSlices, activeParaIdx } = useMemo(() => {
    const text = activeDraft.content;
    const rawParas = text.split('\n');
    const out: Array<{ start: number; end: number; text: string; hasCaret: boolean }> = [];
    let cursor = 0;
    let foundIdx = 0;
    for (let i = 0; i < rawParas.length; i++) {
      const pText = rawParas[i];
      const start = cursor;
      const end = start + pText.length;
      const hasCaret = caretPos >= start && caretPos <= end;
      if (hasCaret) foundIdx = i;
      out.push({ start, end, text: pText, hasCaret });
      cursor = end + 1;
    }
    return { paragraphSlices: out, activeParaIdx: foundIdx };
  }, [activeDraft.content, caretPos]);

  // Subtle inline preview glyph at caret: prioritize structural radicals -> full-code progression;
  // short-code words sit in the CW spiral and replace the target slot cleanly on Space.
  const inlineGhostChar = useMemo(() => {
    if (!buffer) return null;
    if (selectedIdx > 0) {
      const picked = imeQuery.all[selectedIdx];
      if (picked) return picked.entry.char;
    }
    if (buffer.length === 1) {
      const chamber = LINGMING_CHAMBER_BY_KEY[buffer];
      if (chamber) return chamber.primaryAnchor;
    } else {
      const exactFull = imeQuery.exact.find((c) => c.matchedBy === 'full');
      if (exactFull) return exactFull.entry.char;
      const structural = imeQuery.all.find(
        (c) => c.matchedBy !== 'short' && c.entry.code.startsWith(buffer)
      );
      if (structural) return structural.entry.char;
    }
    const top = imeQuery.exact[0] ?? imeQuery.all[0];
    return top ? top.entry.char : null;
  }, [buffer, imeQuery.exact, imeQuery.all, selectedIdx]);

  const wordCount = useMemo(() => countWriterGlyphs(activeDraft.content), [activeDraft.content]);
  const isCompactViewport = vvBox.width < 640 || vvBox.height < 560;
  const cloudBoxPx = isCompactViewport
    ? Math.max(220, Math.min(340, Math.round(Math.min(vvBox.width * 0.84, vvBox.height * 0.56))))
    : 460;
  const clampedCloudX = cloudAnchor
    ? Math.max(cloudBoxPx * 0.12, Math.min(vvBox.width - cloudBoxPx * 0.78, cloudAnchor.x))
    : vvBox.width * 0.38;
  const clampedCloudY = cloudAnchor
    ? Math.max(
        vvBox.offsetTop + cloudBoxPx * 0.34,
        Math.min(vvBox.offsetTop + vvBox.height - cloudBoxPx * 0.36, cloudAnchor.y)
      )
    : vvBox.offsetTop + vvBox.height * 0.64;

  const cloudOpacityPct = Math.round(cloudOpacity * 100);
  const cloudBlendPct = Math.round(cloudBlend * 100);

  return (
    <div
      className="fixed inset-x-0 z-10 flex flex-col overflow-hidden select-text"
      style={{ top: `${vvBox.offsetTop}px`, height: `${vvBox.height}px` }}
      onMouseMove={(e) => {
        if (
          e.clientY <= vvBox.offsetTop + 56 ||
          e.clientY >= vvBox.offsetTop + vvBox.height - 44
        ) {
          wakeChrome();
        }
      }}
    >
      {/* Hidden input sink with sentinel \u200B for reliable iOS/Android 26-key & desktop input */}
      <textarea
        ref={inputSinkRef}
        aria-label={t('正文寫作輸入區')}
        defaultValue={SENTINEL}
        inputMode={showSoftKeyboard ? 'none' : 'text'}
        enterKeyHint="enter"
        onInput={handleSinkInput}
        onKeyDown={handleSinkKeyDown}
        onKeyUp={handleSinkKeyUp}
        onCompositionStart={handleSinkCompositionStart}
        onCompositionUpdate={handleSinkCompositionUpdate}
        onCompositionEnd={handleSinkCompositionEnd}
        onPaste={handleSinkPaste}
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        className="fixed w-px h-px text-[16px] leading-none opacity-0 pointer-events-none resize-none overflow-hidden"
        style={{ left: '50%', top: '50%' }}
      />

      {/* Top tap/hover zone to wake auto-hidden controls on mobile or desktop */}
      {!chromeVisible && !anyMenuOpen && (
        <button
          type="button"
          aria-label={t('顯示工具列')}
          onClick={() => wakeChrome()}
          className="absolute top-0 inset-x-0 h-12 z-25 bg-transparent cursor-default focus:outline-none"
        />
      )}

      {/* Top horizon mist fade so distant ascended lines melt softly into paper/ink */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 inset-x-0 h-28 sm:h-36 z-10"
        style={{
          background: isWash
            ? 'linear-gradient(180deg, rgba(243,241,236,0.97) 0%, rgba(243,241,236,0.72) 48%, rgba(243,241,236,0) 100%)'
            : 'linear-gradient(180deg, rgba(11,15,23,0.97) 0%, rgba(11,15,23,0.68) 48%, rgba(11,15,23,0) 100%)',
        }}
      />

      {/* Fully auto-hiding top studio bar */}
      <header
        onMouseEnter={() => wakeChrome()}
        className={`absolute top-0 inset-x-0 z-30 h-12 sm:h-13 px-3 sm:px-7 flex items-center justify-between gap-2 transition-opacity duration-300 ${
          chromeVisible || anyMenuOpen
            ? 'opacity-100'
            : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => {
              synth.playClick();
              setDraftDrawerOpen((v) => !v);
              setExportMenuOpen(false);
              setCloudPopoverOpen(false);
            }}
            title={t('本地手稿')}
            className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)] rounded-lg border border-transparent hover:border-[var(--dojo-border)] hover:bg-[var(--dojo-surface)]/80 transition-colors whitespace-nowrap cursor-pointer shrink-0"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('手稿')}</span>
            <span className="font-mono-tabular text-[11px] text-[var(--dojo-text-muted)]">
              {store.drafts.length}
            </span>
          </button>

          <input
            type="text"
            value={activeDraft.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            onBlur={() => window.setTimeout(() => focusSink(), 0)}
            placeholder={t('無題手稿')}
            aria-label={t('手稿標題')}
            className="w-24 sm:w-48 bg-transparent border-b border-transparent focus:border-[var(--dojo-border-strong)] px-1 py-0.5 font-display text-base sm:text-sm font-semibold text-[var(--dojo-text-bright)] placeholder:text-[var(--dojo-text-muted)] focus:outline-none truncate"
          />

          <span className="hidden md:inline font-mono-tabular text-xs text-[var(--dojo-text-muted)] whitespace-nowrap">
            {wordCount.toLocaleString()} {t('字')}
          </span>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <div
            className="hidden md:inline-flex items-center gap-0.5 p-0.5 bg-[var(--dojo-surface)]/75 border border-[var(--dojo-border)] rounded-lg backdrop-blur-xs"
            title={t('繁簡字集')}
          >
            {SCRIPT_MODE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  synth.playClick();
                  onChangeScriptMode(opt.id);
                  focusSink();
                }}
                className={`px-2 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  scriptMode === opt.id
                    ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-ochre)]'
                    : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                }`}
              >
                {t(opt.short)}
              </button>
            ))}
          </div>

          {/* 玄墨 / 水墨 模式切換 */}
          <div
            className="inline-flex items-center gap-0.5 p-0.5 bg-[var(--dojo-surface)]/75 border border-[var(--dojo-border)] rounded-lg backdrop-blur-xs"
            title={t('玄墨 / 宣紙水墨')}
          >
            {THEME_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  onChangeThemeMode(opt.id);
                  focusSink();
                }}
                className={`px-1.5 sm:px-2 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  themeMode === opt.id
                    ? 'bg-[var(--dojo-ochre-wash)] text-[var(--dojo-ochre)]'
                    : 'text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text)]'
                }`}
              >
                {t(opt.short)}
              </button>
            ))}
          </div>

          {/* 雲圖開關 + 干擾度微調 Popover */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                synth.playClick();
                setCloudPopoverOpen((v) => !v);
                setDraftDrawerOpen(false);
                setExportMenuOpen(false);
              }}
              aria-expanded={cloudPopoverOpen}
              title={t('設定鍵碼雲圖顯示與背景干擾度')}
              className={`inline-flex items-center gap-1 px-2 py-1.5 text-[11px] font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                keystrokeCloudEnabled
                  ? 'bg-[var(--dojo-pine-wash)] border-[var(--dojo-pine)]/35 text-[var(--dojo-pine-text)]'
                  : 'bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)] border-[var(--dojo-border)] text-[var(--dojo-text-muted)]'
              }`}
            >
              {keystrokeCloudEnabled ? (
                <Cloud className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <CloudOff className="w-3.5 h-3.5 shrink-0 opacity-75" />
              )}
              <span>
                {keystrokeCloudEnabled ? `${t('雲圖')} ${cloudOpacityPct}%` : t('雲圖關')}
              </span>
            </button>

            {cloudPopoverOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 mt-1.5 w-68 rounded-xl border border-[var(--dojo-border-strong)] bg-[var(--dojo-surface)] wash:bg-[#F5F3EE] shadow-xl p-3 z-40 flex flex-col gap-3"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[var(--dojo-text-bright)]">
                    {t('鍵碼雲圖')}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      synth.playClick();
                      setKeystrokeCloudEnabled(!keystrokeCloudEnabled);
                    }}
                    className={`px-2 py-0.5 rounded-md border text-[11px] font-medium cursor-pointer ${
                      keystrokeCloudEnabled
                        ? 'bg-[var(--dojo-pine-wash)] border-[var(--dojo-pine)]/40 text-[var(--dojo-pine-text)]'
                        : 'bg-[var(--dojo-surface-2)] border-[var(--dojo-border)] text-[var(--dojo-text-muted)]'
                    }`}
                  >
                    {t(keystrokeCloudEnabled ? '已開啟' : '已關閉')}
                  </button>
                </div>

                <div className="flex flex-col gap-1.5 pt-2 border-t border-[var(--dojo-border)]">
                  <span className="text-[11px] text-[var(--dojo-text-sub)]">
                    {t('推演形態')}
                  </span>
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        synth.playClick();
                        if (!keystrokeCloudEnabled) setKeystrokeCloudEnabled(true);
                        setCloudMode('evolving');
                      }}
                      className={`py-1 rounded text-[11px] border cursor-pointer ${
                        cloudMode === 'evolving'
                          ? 'bg-[var(--dojo-ochre-wash)] border-[var(--dojo-ochre)]/45 text-[var(--dojo-ochre)] font-medium'
                          : 'bg-[var(--dojo-surface-inset)] border-[var(--dojo-border)] text-[var(--dojo-text-muted)] hover:text-[var(--dojo-text)]'
                      }`}
                    >
                      {t('機率演化')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        synth.playClick();
                        if (!keystrokeCloudEnabled) setKeystrokeCloudEnabled(true);
                        setCloudMode('palace');
                      }}
                      className={`py-1 rounded text-[11px] border cursor-pointer ${
                        cloudMode === 'palace'
                          ? 'bg-[var(--dojo-ochre-wash)] border-[var(--dojo-ochre)]/45 text-[var(--dojo-ochre)] font-medium'
                          : 'bg-[var(--dojo-surface-inset)] border-[var(--dojo-border)] text-[var(--dojo-text-muted)] hover:text-[var(--dojo-text)]'
                      }`}
                    >
                      {t('宮殿原圖')}
                    </button>
                  </div>

                  {cloudMode === 'evolving' && (
                    <div className="flex items-center justify-between pt-1 text-[11px]">
                      <span className="text-[var(--dojo-text-sub)]">
                        {t('計入簡碼推演')}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          synth.playClick();
                          if (!keystrokeCloudEnabled) setKeystrokeCloudEnabled(true);
                          setCloudIncludeShortCodes(!cloudIncludeShortCodes);
                        }}
                        className={`px-2 py-0.5 rounded border text-[11px] font-medium cursor-pointer ${
                          cloudIncludeShortCodes
                            ? 'bg-[var(--dojo-pine-wash)] border-[var(--dojo-pine)]/40 text-[var(--dojo-pine-text)]'
                            : 'bg-[var(--dojo-surface-inset)] border-[var(--dojo-border)] text-[var(--dojo-text-muted)]'
                        }`}
                      >
                        {t(cloudIncludeShortCodes ? '計入簡碼' : '純全碼')}
                      </button>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-[var(--dojo-border)] flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-[11px] text-[var(--dojo-text-sub)]">
                    <span>{t('背景干擾度（色調濃淡）')}</span>
                    <span className="font-mono-tabular text-[var(--dojo-ochre)]">
                      {cloudOpacityPct}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={6}
                    max={70}
                    step={2}
                    value={cloudOpacityPct}
                    onChange={(e) => {
                      if (!keystrokeCloudEnabled) setKeystrokeCloudEnabled(true);
                      setCloudOpacity(Number(e.target.value) / 100);
                    }}
                    className="w-full accent-[var(--dojo-ochre)] cursor-pointer"
                  />
                  <div className="grid grid-cols-4 gap-1 pt-0.5">
                    {CLOUD_PRESETS.map((p) => {
                      const active =
                        keystrokeCloudEnabled && Math.abs(cloudOpacity - p.value) < 0.03;
                      return (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => {
                            synth.playClick();
                            setKeystrokeCloudEnabled(true);
                            setCloudOpacity(p.value);
                          }}
                          className={`py-1 rounded text-[11px] border cursor-pointer ${
                            active
                              ? 'bg-[var(--dojo-ochre-wash)] border-[var(--dojo-ochre)]/45 text-[var(--dojo-ochre)] font-medium'
                              : 'bg-[var(--dojo-surface-inset)] border-[var(--dojo-border)] text-[var(--dojo-text-muted)] hover:text-[var(--dojo-text)]'
                          }`}
                        >
                          {t(p.label)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2 border-t border-[var(--dojo-border)] flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-[11px] text-[var(--dojo-text-sub)]">
                    <span>{t('墨跡暈染（背景融合度）')}</span>
                    <span className="font-mono-tabular text-[var(--dojo-ochre)]">
                      {cloudBlendPct}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={100}
                    step={5}
                    value={cloudBlendPct}
                    onChange={(e) => {
                      if (!keystrokeCloudEnabled) setKeystrokeCloudEnabled(true);
                      setCloudBlend(Number(e.target.value) / 100);
                    }}
                    className="w-full accent-[var(--dojo-ochre)] cursor-pointer"
                  />
                  <div className="grid grid-cols-3 gap-1 pt-0.5">
                    {CLOUD_BLEND_PRESETS.map((p) => {
                      const active =
                        keystrokeCloudEnabled && Math.abs(cloudBlend - p.value) < 0.06;
                      return (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => {
                            synth.playClick();
                            setKeystrokeCloudEnabled(true);
                            setCloudBlend(p.value);
                          }}
                          className={`py-1 rounded text-[11px] border cursor-pointer ${
                            active
                              ? 'bg-[var(--dojo-ochre-wash)] border-[var(--dojo-ochre)]/45 text-[var(--dojo-ochre)] font-medium'
                              : 'bg-[var(--dojo-surface-inset)] border-[var(--dojo-border)] text-[var(--dojo-text-muted)] hover:text-[var(--dojo-text)]'
                          }`}
                        >
                          {t(p.label)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              synth.playClick();
              setShowSoftKeyboard((v) => !v);
            }}
            aria-pressed={showSoftKeyboard}
            title={t('26 鍵宮殿鍵盤')}
            className={`inline-flex items-center gap-1 px-2 py-1.5 text-[11px] font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              showSoftKeyboard
                ? 'bg-[var(--dojo-ochre-wash)] border-[var(--dojo-ochre)]/45 text-[var(--dojo-ochre)]'
                : 'bg-[var(--dojo-surface-inset)] hover:bg-[var(--dojo-surface-2)] border-[var(--dojo-border)] text-[var(--dojo-text-muted)] hover:text-[var(--dojo-text)]'
            }`}
          >
            <Keyboard className="w-3.5 h-3.5 shrink-0" />
            <span>{t(showSoftKeyboard ? '鍵盤開' : '鍵盤關')}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              synth.playClick();
              onOpenPalace();
            }}
            title={t('記憶宮殿')}
            className="inline-flex items-center gap-1 px-2 py-1.5 text-[11px] font-medium rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface)]/75 hover:bg-[var(--dojo-surface-2)] text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)] transition-colors whitespace-nowrap cursor-pointer"
          >
            <Compass className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('宮殿')}</span>
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                synth.playClick();
                setExportMenuOpen((v) => !v);
                setDraftDrawerOpen(false);
                setCloudPopoverOpen(false);
              }}
              title={t('匯出')}
              className="inline-flex items-center gap-1 px-2 py-1.5 text-[11px] font-medium rounded-lg border border-[var(--dojo-border)] bg-[var(--dojo-surface)]/75 hover:bg-[var(--dojo-surface-2)] text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)] transition-colors whitespace-nowrap cursor-pointer"
            >
              {copiedNotice ? (
                <Check className="w-3.5 h-3.5 text-[var(--dojo-pine-text)]" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span className="hidden md:inline">{t(copiedNotice ? '已複製' : '匯出')}</span>
            </button>

            {exportMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-40 rounded-xl border border-[var(--dojo-border-strong)] bg-[var(--dojo-surface)] wash:bg-[#F5F3EE] shadow-xl py-1 z-40">
                <button
                  type="button"
                  onClick={handleCopyAll}
                  className="w-full px-3 py-2 text-left text-xs text-[var(--dojo-text)] hover:bg-[var(--dojo-surface-2)] flex items-center gap-2 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5 text-[var(--dojo-text-muted)]" />
                  <span>{t('複製全文')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadFile('md')}
                  className="w-full px-3 py-2 text-left text-xs text-[var(--dojo-text)] hover:bg-[var(--dojo-surface-2)] flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-[var(--dojo-text-muted)]" />
                  <span>{t('匯出 .md')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadFile('txt')}
                  className="w-full px-3 py-2 text-left text-xs text-[var(--dojo-text)] hover:bg-[var(--dojo-surface-2)] flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-[var(--dojo-text-muted)]" />
                  <span>{t('匯出 .txt')}</span>
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              onToggleMute();
              focusSink();
            }}
            aria-label={t(muted ? '開啟微音' : '靜音')}
            className="hidden sm:inline-flex p-1.5 rounded-lg border border-transparent hover:border-[var(--dojo-border)] text-[var(--dojo-text-muted)] hover:text-[var(--dojo-text)] transition-colors cursor-pointer"
          >
            {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </header>

      {/* Local Drafts Popover Drawer */}
      {draftDrawerOpen && (
        <div
          className="absolute top-13 left-3 sm:left-7 z-40 w-72 sm:w-80 max-h-[62vh] flex flex-col rounded-xl border border-[var(--dojo-border-strong)] bg-[var(--dojo-surface)] wash:bg-[#F5F3EE] shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3.5 py-2.5 border-b border-[var(--dojo-border)] flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--dojo-text-bright)]">
              {t('本地手稿')}
            </span>
            <div className="flex items-center gap-1.5">
              <div className="md:hidden inline-flex items-center gap-0.5 p-0.5 rounded bg-[var(--dojo-surface-inset)] border border-[var(--dojo-border)]">
                {SCRIPT_MODE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      synth.playClick();
                      onChangeScriptMode(opt.id);
                    }}
                    className={`px-1.5 py-0.5 text-[10px] rounded cursor-pointer ${
                      scriptMode === opt.id
                        ? 'bg-[var(--dojo-surface-2)] text-[var(--dojo-ochre)]'
                        : 'text-[var(--dojo-text-muted)]'
                    }`}
                  >
                    {t(opt.short)}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={handleCreateDraft}
                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md bg-[var(--dojo-ochre-wash)] text-[var(--dojo-ochre)] hover:opacity-90 cursor-pointer"
              >
                <FilePlus2 className="w-3 h-3" />
                <span>{t('新箋')}</span>
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-[var(--dojo-border)]">
            {store.drafts.map((d) => {
              const isAct = d.id === activeDraft.id;
              const chars = countWriterGlyphs(d.content);
              return (
                <div
                  key={d.id}
                  className={`group px-3.5 py-2.5 flex items-center justify-between gap-2 transition-colors ${
                    isAct
                      ? 'bg-[var(--dojo-surface-2)]'
                      : 'hover:bg-[var(--dojo-surface-2)]/60'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleSelectDraft(d.id)}
                    className="flex-1 min-w-0 text-left cursor-pointer"
                  >
                    <div className="font-display text-sm font-medium text-[var(--dojo-text-bright)] truncate">
                      {d.title.trim() || t('無題手稿')}
                    </div>
                    <div className="text-[11px] text-[var(--dojo-text-muted)] font-mono-tabular mt-0.5">
                      {chars} {t('字')} · {formatDraftTimestamp(d.updatedAt)}
                    </div>
                  </button>
                  {store.drafts.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDeleteDraft(d.id)}
                      title={t('刪除此手稿')}
                      aria-label={t('刪除此手稿')}
                      className="p-1.5 rounded text-[var(--dojo-text-muted)] hover:text-[var(--dojo-crimson-text)] opacity-60 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Whisper-faint Background Keystroke Cloud arranged to the right of the written text */}
      {keystrokeCloudEnabled && cloudAnchor && cloudMode === 'evolving' && (
        <EvolvingProbCloud
          buffer={buffer}
          committedChar={committedCloud?.char ?? null}
          committedTick={committedCloud?.tick ?? 0}
          scriptMode={scriptMode}
          includeShortCodes={cloudIncludeShortCodes}
          boxPx={cloudBoxPx}
          opacityScale={cloudOpacity}
          blendStrength={cloudBlend}
          style={{
            position: 'fixed',
            left: `${clampedCloudX}px`,
            top: `${clampedCloudY}px`,
            transform: 'translate(-14%, -46%)',
            zIndex: 15,
          }}
        />
      )}

      {keystrokeCloudEnabled && cloudAnchor && cloudMode === 'palace' && cloudPulse.pulse && (
        <KeystrokePalaceCloud
          pulse={cloudPulse.pulse}
          visible={cloudPulse.visible}
          scriptMode={scriptMode}
          placement="coincident"
          boxPx={cloudBoxPx}
          opacityScale={cloudOpacity}
          blendStrength={cloudBlend}
          whisperMode
          style={{
            position: 'fixed',
            left: `${clampedCloudX}px`,
            top: `${clampedCloudY}px`,
            transform: 'translate(-20%, -48%)',
            zIndex: 15,
          }}
        />
      )}

      {/* Main Manuscript Scroll Area: progressive depth-of-field fade modeled after 黃庭抄經閣 */}
      <div
        ref={scrollContainerRef}
        onClick={() => {
          if (draftDrawerOpen) setDraftDrawerOpen(false);
          if (exportMenuOpen) setExportMenuOpen(false);
          if (cloudPopoverOpen) setCloudPopoverOpen(false);
          if (!window.getSelection()?.toString()) {
            focusSink();
          }
        }}
        onWheel={() => {
          userScrolledAwayRef.current = true;
          setScrolledAway(true);
        }}
        onTouchMove={() => {
          userScrolledAwayRef.current = true;
          setScrolledAway(true);
        }}
        onScroll={() => {
          if (isAutoScrollingRef.current) return;
          const marker = caretMarkerRef.current;
          const rule = focalRuleRef.current;
          if (!marker || !rule) return;
          const delta = Math.abs(
            marker.getBoundingClientRect().bottom - (rule.getBoundingClientRect().top - 10)
          );
          if (delta > 36) {
            userScrolledAwayRef.current = true;
            setScrolledAway(true);
          }
        }}
        className="relative z-20 flex-1 min-h-0 overflow-y-auto px-5 sm:px-10"
      >
        <div
          className={`max-w-[580px] mx-auto pb-3 ${
            showSoftKeyboard || vvBox.height < 560
              ? 'pt-[44vh]'
              : 'pt-[74vh]'
          }`}
        >
          {paragraphSlices.map((p, idx) => {
            const localCaret = caretPos - p.start;
            const beforeText = p.hasCaret ? p.text.slice(0, localCaret) : p.text;
            const afterText = p.hasCaret ? p.text.slice(localCaret) : '';
            const dist = Math.abs(idx - activeParaIdx);
            const depthStyle = getParagraphDepthStyle(dist, scrolledAway);

            return (
              <p
                key={`p_${idx}`}
                data-para-start={p.start}
                style={depthStyle}
                onMouseUp={(e) => {
                  if (window.getSelection()?.toString()) return;
                  const localOffset = getParagraphOffsetFromPoint(
                    e.currentTarget,
                    e.clientX,
                    e.clientY
                  );
                  if (localOffset !== null) {
                    const nextPos = Math.max(p.start, Math.min(p.end, p.start + localOffset));
                    liveRef.current.caretPos = nextPos;
                    setCaretPos(nextPos);
                  }
                  focusSink();
                }}
                className="font-display text-[19px] sm:text-[22px] leading-[1.92] sm:leading-[2] tracking-[0.02em] text-[var(--dojo-text-bright)] whitespace-pre-wrap break-words min-h-[1.92em] cursor-text transition-[opacity,filter] duration-300"
              >
                {p.hasCaret ? (
                  <>
                    {beforeText}
                    <span
                      ref={caretMarkerRef}
                      data-ignored-caret="true"
                      className="relative inline-flex items-baseline align-baseline"
                    >
                      {buffer && inlineGhostChar && (
                        <span className="inline-flex items-baseline mx-[1px]">
                          <span className="font-display text-[19px] sm:text-[22px] text-[var(--dojo-ochre)]/80 underline decoration-[var(--dojo-ochre)]/45 underline-offset-4">
                            {inlineGhostChar}
                          </span>
                        </span>
                      )}
                      <span
                        aria-hidden="true"
                        className="writer-caret-blink inline-block w-[2px] h-[1.12em] translate-y-[0.18em] rounded-full bg-[var(--dojo-ochre)] mx-[1px]"
                      />
                    </span>
                    {afterText || (beforeText.length === 0 && !buffer ? '\u200B' : null)}
                  </>
                ) : p.text.length > 0 ? (
                  p.text
                ) : (
                  '\u200B'
                )}
              </p>
            );
          })}
        </div>
      </div>

      {/* Lower-Middle Focal Anchor Space (no bottom candidate bar — pure blind typing) */}
      <div className="shrink-0 relative z-30 flex flex-col">
        <div
          className={`max-w-[580px] mx-auto w-full px-5 sm:px-10 ${
            showSoftKeyboard || isCompactViewport ? 'pb-1.5' : 'pb-[22vh]'
          }`}
        >
          {/* Quiet baseline hair-rule sitting under the active writing line */}
          <div
            ref={focalRuleRef}
            className={`w-full h-px transition-opacity duration-300 ${
              chromeVisible || scrolledAway
                ? 'bg-[var(--dojo-border-strong)]/45'
                : 'bg-[var(--dojo-border)]/20'
            }`}
          />

          {/* Only shown when scrolled up rereading earlier text */}
          {scrolledAway && (
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  userScrolledAwayRef.current = false;
                  setScrolledAway(false);
                  snapCaretToFocalBaseline('smooth');
                  focusSink();
                }}
                className="inline-flex items-center gap-1 text-xs font-medium text-[var(--dojo-ochre)] hover:underline cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{t('回到焦點')}</span>
              </button>
            </div>
          )}
        </div>

        {/* Auto-hiding minimal corner toggles when user wakes chrome (never visible while writing) */}
        {!chromeVisible && !showSoftKeyboard && (
          <button
            type="button"
            aria-label={t('顯示底部控制')}
            onClick={() => wakeChrome()}
            className="absolute bottom-0 inset-x-0 h-10 z-25 bg-transparent cursor-default focus:outline-none"
          />
        )}
        <div
          onMouseEnter={() => wakeChrome()}
          className={`max-w-[580px] mx-auto w-full px-5 sm:px-10 flex items-center justify-between gap-2 text-[11px] transition-opacity duration-300 ${
            showSoftKeyboard ? 'pb-1.5' : 'pb-[max(12px,env(safe-area-inset-bottom))]'
          } ${chromeVisible ? 'opacity-85' : 'opacity-0 pointer-events-none'}`}
        >
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                toggleImeMode();
                focusSink();
              }}
              className="inline-flex items-center gap-1.5 text-[var(--dojo-text-sub)] hover:text-[var(--dojo-text-bright)] transition-colors cursor-pointer"
            >
              <span className={imeMode === 'lingming' ? 'text-[var(--dojo-ochre)] font-medium' : ''}>
                {t(imeMode === 'lingming' ? '靈明形碼' : '英文／系統')}
              </span>
              <span aria-hidden="true" className="hidden sm:inline text-[var(--dojo-text-muted)]">·</span>
              <span className="hidden sm:inline text-[var(--dojo-text-muted)] font-mono-tabular">Shift</span>
            </button>

            <span aria-hidden="true" className="text-[var(--dojo-text-muted)]">·</span>

            <button
              type="button"
              onClick={() => {
                synth.playClick();
                setShowSoftKeyboard((v) => !v);
              }}
              className={`transition-colors cursor-pointer ${
                showSoftKeyboard
                  ? 'text-[var(--dojo-ochre)] font-medium'
                  : 'text-[var(--dojo-text-muted)] hover:text-[var(--dojo-text-bright)]'
              }`}
            >
              {t(showSoftKeyboard ? '隱藏26鍵' : '顯示26鍵')}
            </button>
          </div>

          <span className="text-[var(--dojo-text-muted)] font-mono-tabular">
            {wordCount.toLocaleString()} {t('字')}
          </span>
        </div>

        {/* Toggleable Built-in Mobile 26-Key QWERTY Palace Keyboard */}
        {showSoftKeyboard && (
          <TouchPalaceKeyboard
            imeMode={imeMode}
            showCloudHints={keystrokeCloudEnabled}
            cloudOpacity={cloudOpacity}
            cloudBlend={cloudBlend}
            hasBuffer={Boolean(buffer)}
            onPressLetter={(ch) => processInputChar(ch)}
            onBackspace={handleBackspaceAction}
            onSpace={handleSpaceAction}
            onEnter={handleEnterAction}
            onPunctuation={(p) => handlePunctuationAction(p)}
            onToggleImeMode={toggleImeMode}
          />
        )}
      </div>
    </div>
  );
};

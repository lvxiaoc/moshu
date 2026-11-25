import React, { useState } from 'react';
import { CornerDownLeft, Delete, Space } from 'lucide-react';
import { LINGMING_CHAMBER_BY_KEY } from '../data/lingming';
import { KEYBOARD_ROWS, VOWEL_KEYS } from '../data/schemes';
import { useThemeMode } from '../data/theme';
import { useUiText } from '../data/uiScript';

const VOWEL_SHORT: Record<string, string> = {
  a: '了',
  e: '的',
  i: '是',
  o: '我',
  u: '不',
};

interface TouchPalaceKeyboardProps {
  imeMode: 'lingming' | 'passthrough';
  showCloudHints: boolean;
  cloudOpacity?: number;
  cloudBlend?: number;
  hasBuffer: boolean;
  onPressLetter: (letter: string) => void;
  onBackspace: () => void;
  onSpace: () => void;
  onEnter: () => void;
  onPunctuation: (key: ',' | '.') => void;
  onToggleImeMode: () => void;
}

export const TouchPalaceKeyboard: React.FC<TouchPalaceKeyboardProps> = ({
  imeMode,
  showCloudHints,
  cloudOpacity = 0.22,
  cloudBlend = 0.65,
  hasBuffer,
  onPressLetter,
  onBackspace,
  onSpace,
  onEnter,
  onPunctuation,
  onToggleImeMode,
}) => {
  const t = useUiText();
  const isWash = useThemeMode() === 'wash';
  const [shiftUpper, setShiftUpper] = useState(false);

  const hintOpacity = Math.max(
    0.12,
    Math.min(0.85, cloudOpacity * (1.55 - cloudBlend * 0.45))
  );

  const keyBg = isWash
    ? 'bg-[#FAF9F5]/85 active:bg-[#E5E1D8] border-[#141413]/12 text-[#1C1C1A]'
    : 'bg-[#131926]/85 active:bg-[#1E273B] border-[#F2EEE6]/9 text-[#D8D4CC]';

  const utilKeyBg = isWash
    ? 'bg-[#EAE6DC]/80 active:bg-[#DAD5C9] border-[#141413]/12 text-[#444440]'
    : 'bg-[#0F141F]/80 active:bg-[#1A2233] border-[#F2EEE6]/9 text-[#8D95A5]';

  const handleKeyPress = (k: string) => {
    if (imeMode === 'passthrough') {
      const out = shiftUpper ? k.toUpperCase() : k;
      onPressLetter(out);
      if (shiftUpper) setShiftUpper(false);
    } else {
      onPressLetter(k);
    }
  };

  return (
    <div
      aria-label={t('26 鍵觸控宮殿鍵盤')}
      className={`w-full select-none touch-manipulation border-t pt-2 pb-[max(8px,env(safe-area-inset-bottom))] px-1.5 sm:px-3 ${
        isWash
          ? 'bg-[#ECEAE3]/90 border-[#141413]/10'
          : 'bg-[#0B0F17]/92 border-[#F2EEE6]/8'
      }`}
    >
      <div className="max-w-[540px] mx-auto flex flex-col gap-1.5">
        {/* Row 1: Q - P */}
        <div className="grid grid-cols-10 gap-1">
          {KEYBOARD_ROWS[0].map((k) => {
            const isVowel = VOWEL_KEYS.has(k);
            const chamber = LINGMING_CHAMBER_BY_KEY[k];
            const isLeft = chamber?.handGroup.startsWith('left');
            const hint = isVowel ? VOWEL_SHORT[k] : chamber?.primaryAnchor;
            return (
              <button
                key={k}
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  handleKeyPress(k);
                }}
                className={`h-[44px] sm:h-[48px] rounded-lg border flex flex-col items-center justify-center leading-none transition-transform active:scale-95 cursor-pointer ${keyBg}`}
              >
                <span
                  className={`font-mono-tabular font-medium ${
                    showCloudHints ? 'text-[11px] sm:text-xs' : 'text-[15px]'
                  } ${
                    isVowel && imeMode === 'lingming'
                      ? 'text-[var(--dojo-ochre)]/75'
                      : showCloudHints && !isWash
                        ? isLeft
                          ? 'text-[#66C7A6]/65'
                          : 'text-[#7AA8DB]/65'
                        : 'opacity-80'
                  }`}
                >
                  {imeMode === 'passthrough' && shiftUpper ? k.toUpperCase() : k.toUpperCase()}
                </span>
                {showCloudHints && hint && imeMode === 'lingming' && (
                  <span
                    className="font-display text-[12px] sm:text-[13px] font-semibold text-[var(--dojo-text-bright)] mt-0.5 leading-none"
                    style={{ opacity: hintOpacity }}
                  >
                    {hint}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Row 2: A - L */}
        <div className="px-3 sm:px-4 grid grid-cols-9 gap-1">
          {KEYBOARD_ROWS[1].map((k) => {
            const isVowel = VOWEL_KEYS.has(k);
            const chamber = LINGMING_CHAMBER_BY_KEY[k];
            const isLeft = chamber?.handGroup.startsWith('left');
            const hint = isVowel ? VOWEL_SHORT[k] : chamber?.primaryAnchor;
            return (
              <button
                key={k}
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  handleKeyPress(k);
                }}
                className={`h-[44px] sm:h-[48px] rounded-lg border flex flex-col items-center justify-center leading-none transition-transform active:scale-95 cursor-pointer ${keyBg}`}
              >
                <span
                  className={`font-mono-tabular font-medium ${
                    showCloudHints ? 'text-[11px] sm:text-xs' : 'text-[15px]'
                  } ${
                    isVowel && imeMode === 'lingming'
                      ? 'text-[var(--dojo-ochre)]/75'
                      : showCloudHints && !isWash
                        ? isLeft
                          ? 'text-[#66C7A6]/65'
                          : 'text-[#7AA8DB]/65'
                        : 'opacity-80'
                  }`}
                >
                  {imeMode === 'passthrough' && shiftUpper ? k.toUpperCase() : k.toUpperCase()}
                </span>
                {showCloudHints && hint && imeMode === 'lingming' && (
                  <span
                    className="font-display text-[12px] sm:text-[13px] font-semibold text-[var(--dojo-text-bright)] mt-0.5 leading-none"
                    style={{ opacity: hintOpacity }}
                  >
                    {hint}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Row 3: Shift/Placeholder + Z - M + Backspace */}
        <div className="flex items-stretch gap-1">
          {imeMode === 'passthrough' && (
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                setShiftUpper((v) => !v);
              }}
              aria-label={t('大小寫切換')}
              className={`w-[42px] sm:w-[48px] h-[44px] sm:h-[48px] rounded-lg border flex items-center justify-center text-sm font-semibold active:scale-95 cursor-pointer ${
                shiftUpper
                  ? 'bg-[var(--dojo-ochre-wash)] border-[var(--dojo-ochre)] text-[var(--dojo-ochre)]'
                  : utilKeyBg
              }`}
            >
              ⇧
            </button>
          )}

          <div className="flex-1 grid grid-cols-7 gap-1">
            {KEYBOARD_ROWS[2].map((k) => {
              const isZ = k === 'z';
              const chamber = LINGMING_CHAMBER_BY_KEY[k];
              const isLeft = chamber?.handGroup.startsWith('left');
              const hint = chamber?.primaryAnchor;
              const disabledZ = isZ && imeMode === 'lingming';
              return (
                <button
                  key={k}
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    handleKeyPress(k);
                  }}
                  className={`h-[44px] sm:h-[48px] rounded-lg border flex flex-col items-center justify-center leading-none transition-transform active:scale-95 cursor-pointer ${keyBg} ${
                    disabledZ ? 'opacity-45' : ''
                  }`}
                >
                  <span
                    className={`font-mono-tabular font-medium ${
                      showCloudHints ? 'text-[11px] sm:text-xs' : 'text-[15px]'
                    } ${
                      showCloudHints && !isWash && !isZ
                        ? isLeft
                          ? 'text-[#66C7A6]/65'
                          : 'text-[#7AA8DB]/65'
                        : 'opacity-80'
                    }`}
                  >
                    {imeMode === 'passthrough' && shiftUpper ? k.toUpperCase() : k.toUpperCase()}
                  </span>
                  {showCloudHints && hint && imeMode === 'lingming' && (
                    <span
                      className="font-display text-[12px] sm:text-[13px] font-semibold text-[var(--dojo-text-bright)] mt-0.5 leading-none"
                      style={{ opacity: hintOpacity }}
                    >
                      {hint}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              onBackspace();
            }}
            aria-label={t('退格')}
            className={`w-[52px] sm:w-[60px] h-[44px] sm:h-[48px] rounded-lg border flex items-center justify-center active:scale-95 cursor-pointer ${utilKeyBg}`}
          >
            <Delete className="w-4 h-4" />
          </button>
        </div>

        {/* Row 4: Mode Switch · Comma · Space/Commit · Period · Enter */}
        <div className="flex items-stretch gap-1 pt-0.5">
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              setShiftUpper(false);
              onToggleImeMode();
            }}
            className={`w-[62px] sm:w-[70px] h-[40px] rounded-lg border text-xs font-medium active:scale-95 cursor-pointer ${
              imeMode === 'lingming'
                ? 'bg-[var(--dojo-ochre-wash)] border-[var(--dojo-ochre)]/45 text-[var(--dojo-ochre)]'
                : utilKeyBg
            }`}
          >
            {t(imeMode === 'lingming' ? '形 / 英' : '英 / 形')}
          </button>

          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              onPunctuation(',');
            }}
            className={`w-[42px] h-[40px] rounded-lg border font-display text-base active:scale-95 cursor-pointer ${keyBg}`}
          >
            {imeMode === 'lingming' ? '，' : ','}
          </button>

          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              onSpace();
            }}
            className={`flex-1 h-[40px] rounded-lg border flex items-center justify-center gap-1.5 text-xs active:scale-[0.98] cursor-pointer ${keyBg}`}
          >
            <Space className="w-3.5 h-3.5 opacity-60" />
            <span className="text-[var(--dojo-text-sub)]">
              {t(hasBuffer ? '空格上屏' : imeMode === 'lingming' ? '靈明空格' : 'Space')}
            </span>
          </button>

          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              onPunctuation('.');
            }}
            className={`w-[42px] h-[40px] rounded-lg border font-display text-base active:scale-95 cursor-pointer ${keyBg}`}
          >
            {imeMode === 'lingming' ? '。' : '.'}
          </button>

          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              onEnter();
            }}
            aria-label={t('換行')}
            className={`w-[60px] sm:w-[68px] h-[40px] rounded-lg border flex items-center justify-center gap-1 text-xs active:scale-95 cursor-pointer ${utilKeyBg}`}
          >
            <CornerDownLeft className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

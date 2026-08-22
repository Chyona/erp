import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Popover } from 'antd';
import { CalculatorOutlined } from '@ant-design/icons';
import { AMOUNT_UNITS, amountToDigits } from '../utils/amountGrid';
import AmountCalculatorPanel from './AmountCalculatorPanel';

function cellBorderClass(index: number) {
  if (index === 8) return 'amount-grid__cell--yuan';
  if (index === 4) return 'amount-grid__cell--wan';
  if (index === 0) return 'amount-grid__cell--yi';
  return '';
}

export default function AmountGrid({
  value,
  onChange,
  readOnly = false,
  redLetter = false,
  onKeyDown,
  tabIndex = -1
}: {
  value?: number | string;
  onChange?: (value: number | string) => void;
  readOnly?: boolean;
  redLetter?: boolean;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  tabIndex?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const calcOpenRef = useRef(false);
  const [focused, setFocused] = useState(false);
  const [editText, setEditText] = useState('');
  const [calcOpen, setCalcOpen] = useState(false);
  const [calcSeed, setCalcSeed] = useState('');

  const digits = amountToDigits(String(value ?? ''));
  const hasAmount = (parseFloat(String(value)) || 0) > 0;
  const redClass = redLetter && hasAmount ? ' amount-grid--red-letter' : '';

  useEffect(() => {
    if (!focused && !calcOpen) {
      const n = parseFloat(String(value));
      setEditText(Number.isFinite(n) && n > 0 ? String(n) : '');
    }
  }, [value, focused, calcOpen]);

  const commit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      onChange?.('');
      return;
    }
    const n = parseFloat(trimmed);
    if (Number.isFinite(n) && n >= 0) {
      onChange?.(Math.round(n * 100) / 100);
    }
  };

  const focusEditor = () => {
    setFocused(true);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  };

  const handleBlur = () => {
    window.setTimeout(() => {
      if (calcOpenRef.current) return;
      setFocused(false);
      commit(editText);
    }, 0);
  };

  const openCalculator = () => {
    const n = parseFloat(String(value));
    setCalcSeed(Number.isFinite(n) && n > 0 ? String(n) : editText || '');
    calcOpenRef.current = true;
    setCalcOpen(true);
  };

  const applyCalculator = (result: number) => {
    const text = String(result);
    setEditText(text);
    onChange?.(result);
    calcOpenRef.current = false;
    setCalcOpen(false);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  };

  if (readOnly) {
    return (
      <div className={`amount-grid amount-grid--readonly${redClass}`} aria-label="金额">
        {AMOUNT_UNITS.map((unit, i) => (
          <div
            key={unit + i}
            className={`amount-grid__cell ${cellBorderClass(i)}`}
            title={unit}
          >
            <span className="amount-grid__digit">{digits[i]}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className={`amount-grid ${focused ? 'amount-grid--focused' : ''}${redClass}`}
      onMouseDown={(e) => {
        if (focused) return;
        e.preventDefault();
        focusEditor();
      }}
    >
      {AMOUNT_UNITS.map((unit, i) => (
        <div
          key={unit + i}
          className={`amount-grid__cell ${cellBorderClass(i)}`}
          title={unit}
        >
          <span className="amount-grid__digit">{digits[i]}</span>
        </div>
      ))}
      <div className="amount-grid__editor">
        <Popover
          open={calcOpen}
          onOpenChange={(open) => {
            calcOpenRef.current = open;
            setCalcOpen(open);
            if (!open) {
              requestAnimationFrame(() => inputRef.current?.focus());
            }
          }}
          trigger="click"
          placement="bottomLeft"
          overlayClassName="amount-grid__calc-popover"
          content={
            <AmountCalculatorPanel
              key={calcSeed}
              initialValue={calcSeed}
              onApply={applyCalculator}
            />
          }
          destroyOnHidden
        >
          <button
            type="button"
            className="amount-grid__calc-btn"
            tabIndex={-1}
            aria-label="计算器"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation();
              openCalculator();
            }}
          >
            <CalculatorOutlined />
          </button>
        </Popover>
        <input
          ref={inputRef}
          className="amount-grid__input"
          type="text"
          inputMode="decimal"
          value={editText}
          tabIndex={tabIndex}
          onFocus={() => setFocused(true)}
          onBlur={handleBlur}
          onChange={(e) => setEditText(e.target.value.replace(/[^\d.]/g, ''))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              inputRef.current?.blur();
            }
            onKeyDown?.(e);
          }}
        />
      </div>
    </div>
  );
}

export function AmountGridHeader() {
  return (
    <div className="amount-grid amount-grid--header">
      {AMOUNT_UNITS.map((unit, i) => (
        <div
          key={unit + i}
          className={`amount-grid__cell amount-grid__cell--label ${cellBorderClass(i)}`}
        >
          {unit}
        </div>
      ))}
    </div>
  );
}

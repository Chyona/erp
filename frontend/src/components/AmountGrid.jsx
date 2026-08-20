import { useEffect, useRef, useState } from 'react';
import { CalculatorOutlined } from '@ant-design/icons';
import { AMOUNT_UNITS, amountToDigits } from '../utils/amountGrid.js';

function cellBorderClass(index) {
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
}) {
  const inputRef = useRef(null);
  const [focused, setFocused] = useState(false);
  const [editText, setEditText] = useState('');
  const digits = amountToDigits(value);
  const hasAmount = (parseFloat(value) || 0) > 0;
  const redClass = redLetter && hasAmount ? ' amount-grid--red-letter' : '';

  useEffect(() => {
    if (!focused) {
      const n = parseFloat(value);
      setEditText(Number.isFinite(n) && n > 0 ? String(n) : '');
    }
  }, [value, focused]);

  const commit = (text) => {
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
    setFocused(false);
    commit(editText);
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
      <div className="amount-grid__editor" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="amount-grid__calc-btn"
          tabIndex={-1}
          aria-label="计算器"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.focus()}
        >
          <CalculatorOutlined />
        </button>
        <input
          ref={inputRef}
          className="amount-grid__input"
          type="text"
          inputMode="decimal"
          value={editText}
          tabIndex={0}
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

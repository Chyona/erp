import { useState } from 'react';
import { Button } from 'antd';
import EllipsisText from './EllipsisText';
import { evaluateAmountExpression } from '../utils/amountGrid';

const KEY_ROWS = [
  ['7', '8', '9', '+'],
  ['4', '5', '6', '-'],
  ['1', '2', '3', '*'],
  ['0', '.', 'C', '/']
] as const;

export default function AmountCalculatorPanel({
  initialValue = '',
  onApply
}: {
  initialValue?: string;
  onApply: (value: number) => void;
}) {
  const [display, setDisplay] = useState(initialValue);
  const [error, setError] = useState('');

  const appendToken = (token: string) => {
    setError('');
    if (token === 'C') {
      setDisplay('');
      return;
    }
    setDisplay((prev) => prev + token);
  };

  const evaluate = () => {
    const result = evaluateAmountExpression(display);
    if (result == null) {
      setError('算式无效');
      return;
    }
    setDisplay(String(result));
    setError('');
  };

  const confirm = () => {
    const result = evaluateAmountExpression(display);
    if (result == null) {
      setError('请输入有效算式');
      return;
    }
    onApply(result);
  };

  return (
    <div className="amount-calculator" onMouseDown={(e) => e.preventDefault()}>
      <div className="amount-calculator__display">
        <EllipsisText tooltip={display}>{display || '0'}</EllipsisText>
      </div>
      {error ? <div className="amount-calculator__error">{error}</div> : null}
      <div className="amount-calculator__keys">
        {KEY_ROWS.map((row, rowIndex) =>
          row.map((key) => (
            <button
              key={`${rowIndex}-${key}`}
              type="button"
              className={`amount-calculator__key${key === 'C' ? ' amount-calculator__key--muted' : ''}`}
              onClick={() => appendToken(key)}
            >
              {key}
            </button>
          ))
        )}
        <button type="button" className="amount-calculator__key amount-calculator__key--eq" onClick={evaluate}>
          =
        </button>
      </div>
      <Button type="primary" size="small" block onClick={confirm}>
        填入金额
      </Button>
    </div>
  );
}

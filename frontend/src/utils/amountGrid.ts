/** 金额格子单位：亿千百十万千百十元角分 */
export const AMOUNT_UNITS = ['亿', '千', '百', '十', '万', '千', '百', '十', '元', '角', '分'];

export function amountToDigits(amount) {
  const n = Math.abs(parseFloat(amount) || 0);
  const fixed = n.toFixed(2);
  const combined = fixed.replace('.', '');
  const digits = new Array(11).fill('');
  for (let i = 0; i < combined.length && i < 11; i++) {
    digits[11 - 1 - i] = combined[combined.length - 1 - i];
  }
  return digits;
}

export function amountToChineseUppercase(money, negative = false) {
  const cnNums = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
  const cnIntRadice = ['', '拾', '佰', '仟'];
  const cnIntUnits = ['', '万', '亿', '兆'];
  const cnDecUnits = ['角', '分'];

  const n = parseFloat(money);
  if (!Number.isFinite(n) || n === 0) return '零元整';
  if (n >= 1e14) return '';

  let cents = Math.round(Math.abs(n) * 100).toString();
  let integerNum = cents.length > 2 ? cents.slice(0, -2) : '0';
  const decimalNum = cents.length > 2 ? cents.slice(-2) : cents.padStart(2, '0');

  let chineseStr = '';

  if (parseInt(integerNum, 10) > 0) {
    let zeroCount = 0;
    const intLen = integerNum.length;
    for (let i = 0; i < intLen; i++) {
      const digit = integerNum.charAt(i);
      const p = intLen - i - 1;
      const q = Math.floor(p / 4);
      const m = p % 4;
      if (digit === '0') {
        zeroCount++;
      } else {
        if (zeroCount > 0) chineseStr += cnNums[0];
        zeroCount = 0;
        chineseStr += cnNums[parseInt(digit, 10)] + cnIntRadice[m];
      }
      if (m === 0 && zeroCount < 4) chineseStr += cnIntUnits[q];
    }
    chineseStr += '元';
  } else {
    chineseStr = '零元';
  }

  if (decimalNum === '00') {
    chineseStr += '整';
  } else {
    for (let i = 0; i < decimalNum.length; i++) {
      const digit = decimalNum.charAt(i);
      if (digit !== '0') chineseStr += cnNums[parseInt(digit, 10)] + cnDecUnits[i];
    }
  }

  return negative && n !== 0 ? `负${chineseStr}` : chineseStr;
}

export function formatAccountingPeriod(date) {
  if (!date) return '';
  const d = typeof date.format === 'function' ? date : null;
  if (!d) return '';
  return `${d.year()}年第${d.month() + 1}期`;
}

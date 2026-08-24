import type { Account } from '../types';

export function formatLedgerAmount(value: number | null | undefined): string {
  const amount = Number(value) || 0;
  return Math.abs(amount) >= 0.005 ? amount.toFixed(2) : '';
}

export function formatBalanceDirection(account: Account | null | undefined, balance: number): string {
  if (Math.abs(balance) < 0.005) return '平';
  if (account?.direction === 'credit') {
    return balance > 0 ? '贷' : '借';
  }
  return balance > 0 ? '借' : '贷';
}

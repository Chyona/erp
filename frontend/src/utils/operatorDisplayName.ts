export type OperatorAccountRef = {
  id?: number;
  username?: string;
  nickname?: string;
};

export type OperatorDisplayLookup = {
  byId: Map<number, string>;
  byUsername: Map<string, string>;
};

export function formatAccountDisplayName(account: OperatorAccountRef): string {
  const nickname = String(account.nickname || '').trim();
  if (nickname) return nickname;
  return String(account.username || '').trim();
}

export function buildOperatorDisplayLookup(accounts: OperatorAccountRef[]): OperatorDisplayLookup {
  const byId = new Map<number, string>();
  const byUsername = new Map<string, string>();

  for (const account of accounts) {
    const display = formatAccountDisplayName(account);
    const id = Number(account.id) || 0;
    const username = String(account.username || '').trim();
    if (id > 0 && display) byId.set(id, display);
    if (username && display) byUsername.set(username, display);
  }

  return { byId, byUsername };
}

export function resolveOperatorDisplayName(
  stored: string | undefined,
  lookup?: OperatorDisplayLookup,
  accountId?: number
): string {
  const text = String(stored || '').trim();
  const id = Number(accountId) || 0;

  if (lookup) {
    if (id > 0 && lookup.byId.has(id)) {
      return lookup.byId.get(id)!;
    }
    if (text && lookup.byUsername.has(text)) {
      return lookup.byUsername.get(text)!;
    }
  }

  return text;
}

/** 写入制单人：当前登录用户优先用昵称，仅在没有昵称时用用户名。 */
export function normalizePreparedByForSave(
  value: string | undefined,
  operatorDisplay: string,
  operatorUsername: string
): string {
  const trimmed = String(value || '').trim();
  const username = String(operatorUsername || '').trim();
  const display = String(operatorDisplay || '').trim();

  if (!trimmed) return display;
  if (username && trimmed === username) return display;
  return trimmed;
}

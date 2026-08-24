import type React from 'react';

export const TABLE_ROW_GROUP_BASE = 'app-table-group--base';
export const TABLE_ROW_GROUP_ALT = 'app-table-group--alt';
export const TABLE_ROW_GROUP_HOVER = 'app-table-group--hover';

export function tableRowGroupClass(groupIndex: number) {
  return groupIndex % 2 === 0 ? TABLE_ROW_GROUP_BASE : TABLE_ROW_GROUP_ALT;
}

export function resolveTableRowGroupIndex(record: unknown, rowIndex: number) {
  if (record && typeof record === 'object') {
    const row = record as { groupIndex?: number };
    if (typeof row.groupIndex === 'number') return row.groupIndex;
  }
  return rowIndex;
}

export function mergeTableRowClassName(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(' ');
}

export function shouldExcludeTableStripe(record: unknown, className = '') {
  if (className.includes('__row--empty')) return true;
  if (record && typeof record === 'object') {
    const row = record as { rowType?: string };
    if (row.rowType === 'empty') return true;
  }
  return false;
}

export function appTableRowClassName(record: unknown, rowIndex: number, userClass = '') {
  if (shouldExcludeTableStripe(record, userClass)) return userClass;
  return mergeTableRowClassName(userClass, tableRowGroupClass(resolveTableRowGroupIndex(record, rowIndex)));
}

export function setTableGroupHover(tbody: HTMLElement | null, groupIndex: number, active: boolean) {
  if (!tbody) return;
  tbody.querySelectorAll(`tr[data-group-index="${groupIndex}"]`).forEach((row) => {
    row.classList.toggle(TABLE_ROW_GROUP_HOVER, active);
  });
}

type TableRowProps = Record<string, unknown> & {
  onMouseEnter?: (event: React.MouseEvent<HTMLTableRowElement>) => void;
  onMouseLeave?: (event: React.MouseEvent<HTMLTableRowElement>) => void;
};

export function reportViewRowProps(index: number, record?: unknown, className = 'report-view__row') {
  const groupIndex = resolveTableRowGroupIndex(record, index);
  return {
    className: appTableRowClassName(record, index, className),
    'data-group-index': groupIndex,
    onMouseEnter: (event: React.MouseEvent<HTMLTableRowElement>) => {
      setTableGroupHover(event.currentTarget.closest('tbody'), groupIndex, true);
    },
    onMouseLeave: (event: React.MouseEvent<HTMLTableRowElement>) => {
      setTableGroupHover(event.currentTarget.closest('tbody'), groupIndex, false);
    }
  };
}

export function mergeTableOnRow<T extends object>(
  record: T,
  index: number | undefined,
  userOnRow?: (record: T, index?: number) => TableRowProps
) {
  const user = userOnRow?.(record, index) ?? {};
  if (shouldExcludeTableStripe(record, String(user.className ?? ''))) {
    return user;
  }
  const groupIndex = resolveTableRowGroupIndex(record, index ?? 0);
  return {
    ...user,
    'data-group-index': groupIndex,
    onMouseEnter: (event: React.MouseEvent<HTMLTableRowElement>) => {
      user.onMouseEnter?.(event);
      setTableGroupHover(event.currentTarget.closest('tbody'), groupIndex, true);
    },
    onMouseLeave: (event: React.MouseEvent<HTMLTableRowElement>) => {
      user.onMouseLeave?.(event);
      setTableGroupHover(event.currentTarget.closest('tbody'), groupIndex, false);
    }
  };
}

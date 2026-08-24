import { isValidElement, type ReactNode } from 'react';
import type { ColumnGroupType, ColumnType, ColumnsType } from 'antd/es/table';
import EllipsisText from '../components/EllipsisText';

function isColumnGroup<T extends object>(
  column: ColumnType<T> | ColumnGroupType<T>
): column is ColumnGroupType<T> {
  return Array.isArray((column as ColumnGroupType<T>).children);
}

function hasEllipsis<T extends object>(column: ColumnType<T>): boolean {
  return column.ellipsis === true || (typeof column.ellipsis === 'object' && column.ellipsis !== null);
}

function resolveDataIndexValue<T extends object>(
  record: T,
  dataIndex: ColumnType<T>['dataIndex']
): unknown {
  if (dataIndex == null) return undefined;
  if (Array.isArray(dataIndex)) {
    let value: unknown = record;
    for (const key of dataIndex) {
      if (value == null || typeof value !== 'object') return undefined;
      value = (value as Record<PropertyKey, unknown>)[String(key)];
    }
    return value;
  }
  return (record as Record<PropertyKey, unknown>)[String(dataIndex)];
}

function resolveTooltipText<T extends object>(
  value: unknown,
  record: T,
  column: ColumnType<T>
): string | undefined {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  const fromRecord = resolveDataIndexValue(record, column.dataIndex);
  if (typeof fromRecord === 'string' || typeof fromRecord === 'number') return String(fromRecord);
  return undefined;
}

function shouldWrapEllipsis(content: ReactNode): boolean {
  if (content == null || typeof content === 'boolean') return false;
  if (typeof content === 'string' || typeof content === 'number') return true;
  return isValidElement(content) && typeof content.type === 'string';
}

function normalizeEllipsisColumn<T extends object>(column: ColumnType<T>): ColumnType<T> {
  if (!hasEllipsis(column)) return column;

  const ellipsisConfig = typeof column.ellipsis === 'object' ? column.ellipsis : {};
  const normalizedColumn: ColumnType<T> = {
    ...column,
    ellipsis: { ...ellipsisConfig, showTitle: false }
  };

  const originalRender = column.render;
  if (!originalRender) {
    return {
      ...normalizedColumn,
      render: (value, record) => {
        if (value == null || value === '') return value;
        const tooltip = resolveTooltipText(value, record, column);
        return <EllipsisText tooltip={tooltip}>{value as ReactNode}</EllipsisText>;
      }
    };
  }

  return {
    ...normalizedColumn,
    render: (value, record, index) => {
      const rendered = originalRender(value, record, index);
      if (rendered && typeof rendered === 'object' && 'children' in rendered) {
        return rendered;
      }
      const content = rendered as ReactNode;
      if (!shouldWrapEllipsis(content)) return content;
      const tooltip = resolveTooltipText(value, record, column) ?? String(content);
      return <EllipsisText tooltip={tooltip}>{content}</EllipsisText>;
    }
  };
}

export function normalizeTableColumns<T extends object>(
  columns?: ColumnsType<T>
): ColumnsType<T> | undefined {
  if (!columns) return columns;
  return columns.map((column) => {
    if (isColumnGroup(column)) {
      return {
        ...column,
        children: normalizeTableColumns(column.children)
      };
    }
    return normalizeEllipsisColumn(column);
  });
}

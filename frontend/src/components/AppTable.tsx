import { useCallback, useMemo } from 'react';
import { Table, type TableProps } from 'antd';
import { normalizeTableColumns } from '../utils/normalizeTableColumns';
import { appTableRowClassName, mergeTableOnRow, shouldExcludeTableStripe } from '../utils/tableRowGroup';

type AppTableProps<T extends object> = TableProps<T> & {
  striped?: boolean;
};

export default function AppTable<T extends object = Record<string, unknown>>({
  rowClassName,
  striped = true,
  onRow,
  columns,
  ...props
}: AppTableProps<T>) {
  const normalizedColumns = useMemo(() => normalizeTableColumns(columns), [columns]);
  const mergedRowClassName: TableProps<T>['rowClassName'] = (record, index, indent) => {
    const userClass =
      typeof rowClassName === 'function'
        ? rowClassName(record, index, indent)
        : rowClassName ?? '';
    if (!striped || shouldExcludeTableStripe(record, userClass)) {
      return userClass;
    }
    return appTableRowClassName(record, index, userClass);
  };

  const mergedOnRow = useCallback(
    (record: T, index?: number) => mergeTableOnRow(record, index, onRow),
    [onRow]
  );

  return (
    <Table
      {...props}
      columns={normalizedColumns}
      rowClassName={mergedRowClassName}
      onRow={mergedOnRow}
    />
  );
}

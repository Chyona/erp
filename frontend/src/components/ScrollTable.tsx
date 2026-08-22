import { Empty, Table, type TableProps } from 'antd';
import type { ReactNode } from 'react';
import { useTableScrollY } from '../hooks/useTableScrollY';

function renderTableEmpty(description: string) {
  return (
    <div className="app-table-empty">
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={description} />
    </div>
  );
}

function normalizeTableLocale(locale?: TableProps['locale']): TableProps['locale'] {
  const emptyText = locale?.emptyText;
  if (typeof emptyText === 'string') {
    return { ...locale, emptyText: renderTableEmpty(emptyText) };
  }
  return locale;
}

const ROW_SCROLL_THRESHOLD = 12;

type ScrollTableProps<T> = Omit<TableProps<T>, 'footer'> & {
  scroll?: TableProps<T>['scroll'];
  autoHeight?: boolean;
  footer?: ReactNode;
};

export default function ScrollTable<T extends object = Record<string, unknown>>({
  scroll,
  autoHeight = false,
  footer,
  bordered = true,
  size = 'small',
  ...props
}: ScrollTableProps<T>) {
  const rowCount = props.dataSource?.length ?? 0;
  const hasFixedChrome = Boolean(props.pagination) || Boolean(props.summary) || Boolean(footer);
  const needScrollY =
    !autoHeight || rowCount > ROW_SCROLL_THRESHOLD || hasFixedChrome;
  const { wrapRef, scrollY } = useTableScrollY([
    rowCount,
    props.pagination,
    autoHeight,
    needScrollY,
    props.summary,
    footer
  ]);

  const scrollConfig = {
    ...scroll,
    ...(needScrollY && scrollY ? { y: scrollY } : {})
  };

  const bodyClass = [
    'page-table-body',
    autoHeight ? 'page-table-body--auto' : '',
    needScrollY ? 'page-table-body--scroll' : ''
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={bodyClass} ref={needScrollY ? wrapRef : undefined}>
      <Table
        {...props}
        bordered={bordered}
        size={size}
        scroll={scrollConfig}
        locale={normalizeTableLocale(props.locale)}
      />
      {footer}
    </div>
  );
}

import { Empty, Table, type TableProps } from 'antd';
import { useRef, type CSSProperties, type ReactNode } from 'react';
import { useTableHeaderGutter } from '../hooks/useTableHeaderGutter';
import { useTableHorizontalScrollBar } from '../hooks/useTableHorizontalScrollBar';
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
  fillPage?: boolean;
  bodyClassName?: string;
  wrapStyle?: CSSProperties;
  footer?: ReactNode;
  scrollBarBelowSummary?: boolean;
};

export default function ScrollTable<T extends object = Record<string, unknown>>({
  scroll,
  autoHeight = false,
  fillPage = false,
  bodyClassName,
  wrapStyle,
  footer,
  scrollBarBelowSummary = false,
  bordered = true,
  size = 'small',
  ...props
}: ScrollTableProps<T>) {
  const rowCount = props.dataSource?.length ?? 0;
  const hasInternalPagination = Boolean(props.pagination);
  const needScrollY =
    !autoHeight || rowCount > ROW_SCROLL_THRESHOLD || hasInternalPagination;
  const useVerticalScroll = fillPage || needScrollY;
  const xScrollRef = useRef<HTMLDivElement>(null);
  const { wrapRef, scrollY } = useTableScrollY(
    [rowCount, props.pagination, autoHeight, useVerticalScroll, props.summary, footer, scrollBarBelowSummary],
    useVerticalScroll
  );

  useTableHorizontalScrollBar(wrapRef, xScrollRef, scrollBarBelowSummary, [
    rowCount,
    props.summary,
    scroll?.x
  ]);

  useTableHeaderGutter(
    wrapRef,
    useVerticalScroll,
    [rowCount, props.summary, scrollY, scrollBarBelowSummary]
  );

  const scrollConfig = {
    ...scroll,
    ...(useVerticalScroll && scrollY ? { y: scrollY } : {})
  };

  const bodyClass = [
    'page-table-body',
    bodyClassName,
    fillPage ? 'page-table-body--fill' : '',
    autoHeight ? 'page-table-body--auto' : '',
    useVerticalScroll ? 'page-table-body--scroll' : '',
    scrollBarBelowSummary ? 'page-table-body--xbar-below-summary' : ''
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={bodyClass} ref={wrapRef} style={wrapStyle}>
      <Table
        {...props}
        bordered={bordered}
        size={size}
        scroll={scrollConfig}
        locale={normalizeTableLocale(props.locale)}
      />
      {scrollBarBelowSummary ? (
        <div className="voucher-table-x-scroll" ref={xScrollRef} aria-hidden>
          <div className="voucher-table-x-scroll__inner" />
        </div>
      ) : null}
      {footer}
    </div>
  );
}

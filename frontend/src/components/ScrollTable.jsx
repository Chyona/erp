import { Table } from 'antd';
import { useTableScrollY } from '../hooks/useTableScrollY.js';

const ROW_SCROLL_THRESHOLD = 12;

export default function ScrollTable({
  scroll,
  autoHeight = false,
  footer,
  bordered = true,
  size = 'small',
  ...props
}) {
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
      <Table {...props} bordered={bordered} size={size} scroll={scrollConfig} />
      {footer}
    </div>
  );
}

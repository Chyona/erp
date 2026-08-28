import type { ReactNode } from 'react';

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

/** 列表页通用壳：page-table-layout + 可选 toolbar。 */
export default function PageTableLayout({
  className,
  toolbar,
  toolbarClassName,
  children
}: {
  className?: string;
  toolbar?: ReactNode;
  toolbarClassName?: string;
  children: ReactNode;
}) {
  return (
    <div className={cx('page-table-layout', className)}>
      {toolbar != null ? (
        <div className={cx('page-table-toolbar', toolbarClassName)}>{toolbar}</div>
      ) : null}
      {children}
    </div>
  );
}

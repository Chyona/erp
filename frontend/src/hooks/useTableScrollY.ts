import { useEffect, useRef, useState, type DependencyList } from 'react';

export function useTableScrollY(deps: DependencyList = [], enabled = true) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scrollY, setScrollY] = useState<number | undefined>(undefined);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const observed = new Set<Element>();
    let ro: ResizeObserver;

    const update = () => {
      if (!enabled) {
        setScrollY((prev) => (prev === undefined ? prev : undefined));
        return;
      }

      const header = wrap.querySelector('.ant-table-header') as HTMLElement | null;
      const theadRows = wrap.querySelectorAll('.ant-table-thead tr');
      const summary = wrap.querySelector('.ant-table-summary') as HTMLElement | null;
      const xScrollTrack = wrap.querySelector('.voucher-table-x-scroll') as HTMLElement | null;
      const chromeFooter = wrap.querySelector('.voucher-table-chrome') as HTMLElement | null;
      const footer = wrap.querySelector('.table-scroll-footer') as HTMLElement | null;
      const pagination = (
        chromeFooter?.querySelector('.ant-pagination') ||
        footer?.querySelector('.ant-pagination') ||
        wrap.querySelector('.ant-pagination')
      ) as HTMLElement | null;
      const body = wrap.querySelector('.ant-table-body') as HTMLElement | null;

      const theadH =
        header?.offsetHeight ||
        Array.from(theadRows).reduce((sum, row) => sum + (row as HTMLElement).offsetHeight, 0) ||
        47;
      const chromeFooterH = chromeFooter ? chromeFooter.offsetHeight : 0;
      const footerH = chromeFooter ? 0 : footer ? footer.offsetHeight : 0;
      const paginationH = chromeFooter || footer ? 0 : pagination ? pagination.offsetHeight : 0;
      const summaryH = summary ? summary.offsetHeight : 0;
      const xScrollH = xScrollTrack ? xScrollTrack.offsetHeight : 0;
      const y =
        wrap.clientHeight - theadH - paginationH - summaryH - footerH - chromeFooterH - xScrollH - 2;

      setScrollY((prev) => {
        const next = Math.max(120, y);
        return prev === next ? prev : next;
      });

      for (const el of [summary, body, footer, chromeFooter, pagination, xScrollTrack]) {
        if (el && !observed.has(el)) {
          ro.observe(el);
          observed.add(el);
        }
      }
    };

    ro = new ResizeObserver(update);
    ro.observe(wrap);
    update();
    const timer = setTimeout(update, 100);
    const timer2 = setTimeout(update, 300);
    window.addEventListener('resize', update);

    return () => {
      clearTimeout(timer);
      clearTimeout(timer2);
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [enabled, ...deps]);

  return { wrapRef, scrollY };
}

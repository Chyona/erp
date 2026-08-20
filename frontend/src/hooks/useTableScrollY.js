import { useEffect, useRef, useState } from 'react';

export function useTableScrollY(deps = []) {
  const wrapRef = useRef(null);
  const [scrollY, setScrollY] = useState(undefined);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const observed = new Set();
    let ro;

    const update = () => {
      const header = wrap.querySelector('.ant-table-header');
      const theadRows = wrap.querySelectorAll('.ant-table-thead tr');
      const pagination = wrap.querySelector('.ant-pagination');
      const summary = wrap.querySelector('.ant-table-summary');
      const footer = wrap.querySelector('.table-scroll-footer');
      const body = wrap.querySelector('.ant-table-body');

      const theadH =
        header?.offsetHeight ||
        Array.from(theadRows).reduce((sum, row) => sum + row.offsetHeight, 0) ||
        47;
      const paginationH = pagination ? pagination.offsetHeight : 0;
      const summaryH = summary ? summary.offsetHeight : 0;
      const footerH = footer ? footer.offsetHeight : 0;
      const y = wrap.clientHeight - theadH - paginationH - summaryH - footerH - 2;

      setScrollY((prev) => {
        const next = Math.max(120, y);
        return prev === next ? prev : next;
      });

      for (const el of [summary, body, footer]) {
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
  }, deps);

  return { wrapRef, scrollY };
}

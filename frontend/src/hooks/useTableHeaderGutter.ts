import { useEffect, type DependencyList, type RefObject } from 'react';

const HEADER_BG = 'var(--app-table-header-bg)';

function measureVerticalScrollbarWidth(el: HTMLElement): number {
  return Math.max(0, el.offsetWidth - el.clientWidth);
}

function applyScrollbarCellSize(cell: HTMLElement, gutter: number) {
  if (gutter <= 0) {
    cell.style.setProperty('display', 'none', 'important');
    cell.style.setProperty('width', '0', 'important');
    cell.style.setProperty('min-width', '0', 'important');
    cell.style.setProperty('max-width', '0', 'important');
    cell.style.setProperty('padding', '0', 'important');
    cell.style.border = 'none';
    return;
  }

  cell.style.setProperty('display', 'table-cell', 'important');
  cell.style.setProperty('width', `${gutter}px`, 'important');
  cell.style.setProperty('min-width', `${gutter}px`, 'important');
  cell.style.setProperty('max-width', `${gutter}px`, 'important');
  cell.style.setProperty('padding', '0', 'important');
  cell.style.background = HEADER_BG;
  cell.style.borderInlineEnd = 'none';
  cell.style.boxShadow = 'inset 0 -1px 0 var(--app-table-border-strong)';
}

function syncAntTableHeaderGutter(wrap: HTMLElement) {
  const body = wrap.querySelector('.ant-table-body') as HTMLElement | null;
  const header = wrap.querySelector('.ant-table-header') as HTMLElement | null;
  const summary = wrap.querySelector('.ant-table-summary') as HTMLElement | null;
  if (!body || !header) return;

  const gutter = measureVerticalScrollbarWidth(body);
  const scrollbarCell = header.querySelector('.ant-table-cell-scrollbar') as HTMLElement | null;

  header.style.background = HEADER_BG;
  header.style.paddingRight = '';

  if (scrollbarCell) {
    applyScrollbarCellSize(scrollbarCell, gutter);
  } else if (gutter > 0) {
    header.style.paddingRight = `${gutter}px`;
  }

  if (summary) {
    summary.style.paddingRight = gutter > 0 ? `${gutter}px` : '';
  }
}

function syncSplitTableHeaderGutter(scrollRoot: HTMLElement) {
  const body = scrollRoot.querySelector('[class$="__body"]') as HTMLElement | null;
  const head = scrollRoot.querySelector('[class$="__head"]') as HTMLElement | null;
  if (!body || !head) return;

  const gutter = measureVerticalScrollbarWidth(body);
  head.style.background = HEADER_BG;
  head.style.paddingRight = gutter > 0 ? `${gutter}px` : '';
}

/** 按 body 实际滚动条宽度同步表头/合计行右侧占位，消除表头右侧白条。 */
export function useTableHeaderGutter(
  wrapRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  deps: DependencyList = []
) {
  useEffect(() => {
    if (!enabled) return;
    const wrap = wrapRef.current;
    if (!wrap) return;

    const sync = () => {
      if (wrap.querySelector('.ant-table-body')) {
        syncAntTableHeaderGutter(wrap);
        return;
      }
      const scrollRoot = wrap.querySelector('[class$="__scroll"]') as HTMLElement | null;
      if (scrollRoot) {
        syncSplitTableHeaderGutter(scrollRoot);
      }
    };

    const ro = new ResizeObserver(sync);
    ro.observe(wrap);

    const scrollBody = wrap.querySelector('.ant-table-body, [class$="__body"]');
    if (scrollBody) ro.observe(scrollBody);

    sync();
    const timers = [0, 80, 200, 500].map((ms) => window.setTimeout(sync, ms));

    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      ro.disconnect();
    };
  }, [enabled, wrapRef, ...deps]);
}

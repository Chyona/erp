import { useEffect, useRef, type DependencyList, type RefObject } from 'react';

type ScrollTarget = 'body' | 'track';

function syncSummaryScrollbarGutter(wrap: HTMLElement) {
  const summary = wrap.querySelector('.ant-table-summary') as HTMLElement | null;
  const scrollbarCell = wrap.querySelector(
    '.ant-table-header .ant-table-cell-scrollbar, .ant-table-thead .ant-table-cell-scrollbar'
  ) as HTMLElement | null;
  const gutter = scrollbarCell?.offsetWidth ?? 0;

  if (summary) {
    summary.style.paddingRight = gutter > 0 ? `${gutter}px` : '';
  }
}

export function useTableHorizontalScrollBar(
  wrapRef: RefObject<HTMLDivElement | null>,
  trackRef: RefObject<HTMLDivElement | null>,
  enabled: boolean,
  deps: DependencyList = []
) {
  const syncingRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const wrap = wrapRef.current;
    const track = trackRef.current;
    if (!wrap || !track) return;

    const body = wrap.querySelector('.ant-table-body') as HTMLElement | null;
    const header = wrap.querySelector('.ant-table-header') as HTMLElement | null;
    const summary = wrap.querySelector('.ant-table-summary') as HTMLElement | null;
    const inner = track.querySelector('.voucher-table-x-scroll__inner') as HTMLElement | null;
    const table = body?.querySelector('table') ?? null;
    if (!body || !inner) return;

    const applyScrollLeft = (left: number, source: ScrollTarget) => {
      if (syncingRef.current) return;
      syncingRef.current = true;
      if (source !== 'body') body.scrollLeft = left;
      if (header) header.scrollLeft = left;
      if (summary) summary.scrollLeft = left;
      if (source !== 'track' && track.scrollLeft !== left) track.scrollLeft = left;
      syncingRef.current = false;
    };

    const updateTrack = () => {
      const scrollWidth = table?.scrollWidth ?? body.scrollWidth;
      inner.style.width = `${scrollWidth}px`;
      const needsBar = scrollWidth > body.clientWidth + 1;
      track.style.display = needsBar ? '' : 'none';
      syncSummaryScrollbarGutter(wrap);
      applyScrollLeft(body.scrollLeft, 'body');
    };

    const onBodyScroll = () => applyScrollLeft(body.scrollLeft, 'body');
    const onTrackScroll = () => applyScrollLeft(track.scrollLeft, 'track');
    const onWheel = (event: WheelEvent) => {
      if (track.style.display === 'none') return;
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
      track.scrollLeft += event.deltaX;
      event.preventDefault();
    };

    body.addEventListener('scroll', onBodyScroll, { passive: true });
    track.addEventListener('scroll', onTrackScroll, { passive: true });
    body.addEventListener('wheel', onWheel, { passive: false });

    const ro = new ResizeObserver(updateTrack);
    ro.observe(body);
    if (table) ro.observe(table);
    ro.observe(track);
    if (header) ro.observe(header);
    if (summary) ro.observe(summary);
    updateTrack();
    const timer = window.setTimeout(updateTrack, 100);

    return () => {
      window.clearTimeout(timer);
      body.removeEventListener('scroll', onBodyScroll);
      track.removeEventListener('scroll', onTrackScroll);
      body.removeEventListener('wheel', onWheel);
      ro.disconnect();
      if (summary) summary.style.paddingRight = '';
    };
  }, [enabled, wrapRef, trackRef, ...deps]);
}

import { useEffect, useRef, type DependencyList, type RefObject } from 'react';

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

function collectHorizontalScrollTargets(wrap: HTMLElement) {
  const body = wrap.querySelector('.ant-table-body') as HTMLElement | null;
  const header = wrap.querySelector('.ant-table-header') as HTMLElement | null;
  const summary = wrap.querySelector('.ant-table-summary') as HTMLElement | null;
  const bodyContent = body?.querySelector('.ant-table-content') as HTMLElement | null;
  const headerContent = header?.querySelector('.ant-table-content') as HTMLElement | null;

  const targets = [body, header, summary, bodyContent, headerContent].filter(
    (el): el is HTMLElement => el instanceof HTMLElement
  );

  return {
    body,
    header,
    summary,
    headerTable: header?.querySelector('table') as HTMLElement | null,
    bodyTable: body?.querySelector('table') as HTMLElement | null,
    targets
  };
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

    const { body, header, summary, headerTable, bodyTable, targets } =
      collectHorizontalScrollTargets(wrap);
    const inner = track.querySelector('.voucher-table-x-scroll__inner') as HTMLElement | null;
    if (!body || !inner) return;

    const applyScrollLeft = (left: number) => {
      if (syncingRef.current) return;
      syncingRef.current = true;
      for (const el of targets) {
        if (el.scrollLeft !== left) {
          el.scrollLeft = left;
        }
      }
      if (track.scrollLeft !== left) {
        track.scrollLeft = left;
      }
      syncingRef.current = false;
    };

    const updateTrack = () => {
      const scrollWidth = Math.max(
        headerTable?.scrollWidth ?? 0,
        bodyTable?.scrollWidth ?? 0,
        body.scrollWidth
      );
      inner.style.width = `${scrollWidth}px`;
      const needsBar = scrollWidth > body.clientWidth + 1;
      track.style.display = needsBar ? '' : 'none';
      syncSummaryScrollbarGutter(wrap);
      applyScrollLeft(body.scrollLeft);
    };

    const onBodyScroll = () => applyScrollLeft(body.scrollLeft);
    const onTrackScroll = () => applyScrollLeft(track.scrollLeft);
    const onWheel = (event: WheelEvent) => {
      if (track.style.display === 'none') return;
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
      applyScrollLeft(track.scrollLeft + event.deltaX);
      event.preventDefault();
    };

    body.addEventListener('scroll', onBodyScroll, { passive: true });
    track.addEventListener('scroll', onTrackScroll, { passive: true });
    body.addEventListener('wheel', onWheel, { passive: false });

    const ro = new ResizeObserver(updateTrack);
    ro.observe(body);
    if (bodyTable) ro.observe(bodyTable);
    if (headerTable) ro.observe(headerTable);
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

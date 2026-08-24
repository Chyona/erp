import { Tooltip } from 'antd';
import {
  isValidElement,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode
} from 'react';

type EllipsisTextProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Tooltip text; defaults to plain-text children when truncated */
  tooltip?: string;
};

function toPlainText(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(toPlainText).join('');
  if (isValidElement(node)) return toPlainText(node.props.children);
  return '';
}

function resolveOverflowContainer(el: HTMLElement): HTMLElement {
  return (
    (el.closest('.ant-table-cell-content') as HTMLElement | null) ??
    (el.closest('.ant-table-cell') as HTMLElement | null) ??
    (el.closest('.ant-tree-node-content-wrapper') as HTMLElement | null) ??
    (el.closest('td, th') as HTMLElement | null) ??
    el
  );
}

function measureTextOverflow(el: HTMLElement): boolean {
  if (el.scrollWidth > el.clientWidth + 1) return true;

  const container = resolveOverflowContainer(el);
  const range = document.createRange();
  range.selectNodeContents(el);
  const contentWidth = range.getBoundingClientRect().width;
  if (contentWidth <= 0) return false;

  const style = getComputedStyle(container);
  const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
  const available = container.clientWidth - padding;
  if (available <= 0) return false;

  return contentWidth > available + 1;
}

export default function EllipsisText({
  children,
  className,
  style,
  tooltip
}: EllipsisTextProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const checkOverflow = () => {
      setOverflow(measureTextOverflow(el));
    };

    checkOverflow();
    const raf = requestAnimationFrame(checkOverflow);

    const observer = new ResizeObserver(checkOverflow);
    observer.observe(el);
    const container = resolveOverflowContainer(el);
    if (container !== el) observer.observe(container);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [children, tooltip]);

  const tip = tooltip ?? toPlainText(children);
  const classNames = ['ellipsis-text', className].filter(Boolean).join(' ');
  const content = (
    <span ref={ref} className={classNames || undefined} style={style}>
      {children}
    </span>
  );

  if (!overflow || !tip) return content;
  return <Tooltip title={tip}>{content}</Tooltip>;
}

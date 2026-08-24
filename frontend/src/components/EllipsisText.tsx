import { Typography } from 'antd';
import { isValidElement, type CSSProperties, type ReactNode } from 'react';

const { Text } = Typography;

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

export function renderEllipsisCell(
  value: string | number | null | undefined,
  tooltip?: string
): ReactNode {
  if (value == null || value === '') return value ?? '';
  const text = String(value);
  return (
    <EllipsisText tooltip={tooltip ?? text}>{text}</EllipsisText>
  );
}

export default function EllipsisText({
  children,
  className,
  style,
  tooltip
}: EllipsisTextProps) {
  if (children == null || children === '') return null;

  const tip = tooltip ?? toPlainText(children);
  const classNames = ['ellipsis-text', className].filter(Boolean).join(' ');

  return (
    <Text
      className={classNames || undefined}
      style={{ width: '100%', maxWidth: '100%', marginBottom: 0, ...style }}
      ellipsis={tip ? { tooltip: tip } : true}
    >
      {children}
    </Text>
  );
}

export function isEllipsisTextElement(content: ReactNode): boolean {
  return isValidElement(content) && content.type === EllipsisText;
}

import type { CSSProperties, ReactNode } from 'react';
import { Typography } from 'antd';
import {
  CheckCircleFilled,
  CloseCircleFilled,
  ExclamationCircleFilled
} from '@ant-design/icons';

const { Text } = Typography;

export type ClosingPrerequisiteStatus = 'ok' | 'warn' | 'error';

export type ClosingPrerequisiteItem = {
  key: string;
  status: ClosingPrerequisiteStatus;
  content: ReactNode;
};

function PrerequisiteIcon({ status }: { status: ClosingPrerequisiteStatus }) {
  if (status === 'ok') {
    return <CheckCircleFilled className="closing-prerequisites__icon closing-prerequisites__icon--ok" />;
  }
  if (status === 'error') {
    return <CloseCircleFilled className="closing-prerequisites__icon closing-prerequisites__icon--error" />;
  }
  return (
    <ExclamationCircleFilled className="closing-prerequisites__icon closing-prerequisites__icon--warn" />
  );
}

/** 结转页共用的前置检查列表。 */
export default function ClosingPrerequisitesList({
  title = '结转前置检查',
  items,
  style
}: {
  title?: string;
  items: ClosingPrerequisiteItem[];
  style?: CSSProperties;
}) {
  return (
    <div className="closing-prerequisites" style={style ?? { marginBottom: 16 }}>
      <Text strong style={{ display: 'block', marginBottom: 8 }}>
        {title}
      </Text>
      <ul className="closing-prerequisites__list">
        {items.map((item) => (
          <li key={item.key} className="closing-prerequisites__item">
            <PrerequisiteIcon status={item.status} />
            <span>{item.content}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

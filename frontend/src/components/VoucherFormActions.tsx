import { Button, Space } from 'antd';
import { PlusOutlined } from '@ant-design/icons';

export default function VoucherFormActions({
  readOnly,
  canUnapprove = false,
  saving = false,
  unapproving = false,
  onSave,
  onSaveAndNew,
  onCancel,
  onUnapprove,
  onNew,
  variant = 'toolbar'
}: {
  readOnly: boolean;
  canUnapprove?: boolean;
  saving?: boolean;
  unapproving?: boolean;
  onSave: () => void | Promise<void>;
  onSaveAndNew: () => void | Promise<void>;
  onCancel?: () => void;
  onUnapprove?: () => void | Promise<void>;
  onNew?: () => void | Promise<void>;
  variant?: 'toolbar' | 'footer';
}) {
  if (readOnly) {
    if (variant === 'toolbar') {
      return (
        <Space wrap>
          {onNew ? (
            <Button type="primary" disabled={saving || unapproving} onClick={onNew}>
              新增
            </Button>
          ) : null}
          {canUnapprove && (
            <Button danger loading={unapproving} disabled={saving} onClick={onUnapprove}>
              反审核
            </Button>
          )}
          <Button onClick={onCancel} disabled={saving || unapproving}>
            返回
          </Button>
        </Space>
      );
    }
    return null;
  }

  if (variant === 'footer') {
    return (
      <Space wrap>
        <Button type="primary" disabled={saving || unapproving} onClick={() => onSaveAndNew()}>
          保存并新增
        </Button>
        <Button disabled={saving || unapproving} onClick={() => onSave()}>
          保存
        </Button>
      </Space>
    );
  }

  // 工具栏仅放主操作；「模板」放在右侧辅助工具区，避免打断保存流程
  return (
    <Space wrap>
      {onNew ? (
        <Button icon={<PlusOutlined />} disabled={saving || unapproving} onClick={onNew}>
          新增
        </Button>
      ) : null}
      <Button type="primary" disabled={saving || unapproving} onClick={() => onSaveAndNew()}>
        保存并新增
      </Button>
      <Button disabled={saving || unapproving} onClick={() => onSave()}>
        保存
      </Button>
      <Button onClick={onCancel} disabled={saving || unapproving}>
        取消
      </Button>
    </Space>
  );
}

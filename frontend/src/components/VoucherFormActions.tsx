import { Button, Space } from 'antd';

export default function VoucherFormActions({
  readOnly,
  canUnapprove = false,
  onSave,
  onSaveAndNew,
  onCancel,
  onUnapprove,
  variant = 'toolbar'
}: {
  readOnly: boolean;
  canUnapprove?: boolean;
  onSave: () => void;
  onSaveAndNew: () => void;
  onCancel?: () => void;
  onUnapprove?: () => void;
  variant?: 'toolbar' | 'footer';
}) {
  if (readOnly) {
    if (variant === 'toolbar') {
      return (
        <Space wrap>
          {canUnapprove && (
            <Button danger onClick={onUnapprove}>
              反审核
            </Button>
          )}
          <Button onClick={onCancel}>返回</Button>
        </Space>
      );
    }
    return null;
  }

  if (variant === 'footer') {
    return (
      <Space wrap>
        <Button type="primary" onClick={() => onSaveAndNew()}>
          保存并新增
        </Button>
        <Button onClick={() => onSave()}>保存</Button>
      </Space>
    );
  }

  // 工具栏仅放主操作；「模板」放在右侧辅助工具区，避免打断保存流程
  return (
    <Space wrap>
      <Button type="primary" onClick={() => onSaveAndNew()}>
        保存并新增
      </Button>
      <Button onClick={() => onSave()}>保存</Button>
      <Button onClick={onCancel}>取消</Button>
    </Space>
  );
}

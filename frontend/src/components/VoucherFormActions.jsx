import { Button, Space } from 'antd';
import VoucherExamples from './VoucherExamples.jsx';

export default function VoucherFormActions({
  readOnly,
  canUnapprove = false,
  accounts,
  onSave,
  onSaveAndNew,
  onCancel,
  onUnapprove,
  onApplyExample,
  getTemplateSnapshot,
  variant = 'toolbar'
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

  return (
    <Space wrap>
      <VoucherExamples
        accounts={accounts}
        onApply={onApplyExample}
        getSnapshot={getTemplateSnapshot}
      />
      <Button type="primary" onClick={() => onSaveAndNew()}>
        保存并新增
      </Button>
      <Button onClick={() => onSave()}>保存</Button>
      <Button onClick={onCancel}>取消</Button>
    </Space>
  );
}

import { Button, Space, Tooltip } from 'antd';
import { EyeOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';

export default function VoucherSheetTools({
  eyeCare = false,
  onEyeCareToggle,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false
}) {
  return (
    <Space size={4} className="voucher-sheet__tools">
      <Tooltip title={eyeCare ? '关闭护眼' : '护眼'}>
        <Button
          type="text"
          size="small"
          className={`voucher-sheet__tool-btn${eyeCare ? ' voucher-sheet__tool-btn--active' : ''}`}
          icon={<EyeOutlined />}
          onClick={onEyeCareToggle}
        >
          护眼
        </Button>
      </Tooltip>
      <Space size={2} className="voucher-sheet__nav">
        <Tooltip title="上一张（更早）">
          <Button
            type="text"
            size="small"
            className="voucher-sheet__nav-btn"
            icon={<LeftOutlined />}
            disabled={!hasPrev}
            onClick={onPrev}
          />
        </Tooltip>
        <Tooltip title="下一张（更新）">
          <Button
            type="text"
            size="small"
            className="voucher-sheet__nav-btn"
            icon={<RightOutlined />}
            disabled={!hasNext}
            onClick={onNext}
          />
        </Tooltip>
      </Space>
    </Space>
  );
}

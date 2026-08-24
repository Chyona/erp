import { EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons';
import { Tooltip } from 'antd';

type SensitiveColumnHeaderProps = {
  label: string;
  visible: boolean;
  onToggle: () => void;
};

export default function SensitiveColumnHeader({
  label,
  visible,
  onToggle
}: SensitiveColumnHeaderProps) {
  return (
    <span className="sensitive-column-header">
      <span className="sensitive-column-header__label">{label}</span>
      <Tooltip title={visible ? '隐藏明文' : '显示明文'}>
        <button
          type="button"
          className="sensitive-column-header__toggle"
          aria-label={visible ? `隐藏${label}` : `显示${label}`}
          aria-pressed={visible}
          onClick={(event) => {
            event.stopPropagation();
            onToggle();
          }}
        >
          {visible ? <EyeInvisibleOutlined /> : <EyeOutlined />}
        </button>
      </Tooltip>
    </span>
  );
}

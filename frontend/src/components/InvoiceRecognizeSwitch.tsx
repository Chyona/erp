import { Switch, Tooltip } from 'antd';
import { useInvoiceRecognizeOnUpload } from '../hooks/useInvoiceRecognizeOnUpload';

type InvoiceRecognizeSwitchProps = {
  className?: string;
  disabled?: boolean;
  label?: string;
};

export default function InvoiceRecognizeSwitch({
  className = '',
  disabled = false,
  label = '识别发票号'
}: InvoiceRecognizeSwitchProps) {
  const { enabled, setEnabled } = useInvoiceRecognizeOnUpload();

  return (
    <Tooltip title="开启后，上传发票图片或 PDF 时将自动识别发票号码">
      <label
        className={`voucher-sheet__phrase-auto-switch ${className}`.trim()}
        style={disabled ? { opacity: 0.5, pointerEvents: 'none' } : undefined}
      >
        <Switch size="small" checked={enabled} disabled={disabled} onChange={setEnabled} />
        <span>{label}</span>
      </label>
    </Tooltip>
  );
}

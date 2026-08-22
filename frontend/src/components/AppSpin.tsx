import { Spin, type SpinProps } from 'antd';

type AppSpinProps = SpinProps & {
  fullscreen?: boolean;
};

/** 统一加载指示：提示文案不换行 */
export default function AppSpin({
  tip = '加载中…',
  fullscreen = false,
  className = '',
  ...props
}: AppSpinProps) {
  const classes = ['app-spin', fullscreen ? 'app-spin--fullscreen' : '', className]
    .filter(Boolean)
    .join(' ');

  return <Spin {...props} tip={tip} className={classes} />;
}

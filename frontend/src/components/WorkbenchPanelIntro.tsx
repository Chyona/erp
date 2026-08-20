import { Alert } from 'antd';

export default function WorkbenchPanelIntro({ message }: { message: string }) {
  return <Alert type="info" showIcon className="workbench-panel-intro" message={message} />;
}

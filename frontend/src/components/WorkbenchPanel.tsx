import { Card, Tabs } from 'antd';
import MonthEndClosingPanel from './MonthEndClosingPanel';
import MonthEndReimbursementPanel from './MonthEndReimbursementPanel';

export default function WorkbenchPanel() {
  return (
    <Card className="workbench-panel" style={{ marginBottom: 20 }}>
      <Tabs
        className="workbench-panel__tabs"
        items={[
          {
            key: 'month-end-closing',
            label: '月末结转',
            children: <MonthEndClosingPanel />
          },
          {
            key: 'reimbursement',
            label: '月底报销',
            children: <MonthEndReimbursementPanel />
          }
        ]}
      />
    </Card>
  );
}

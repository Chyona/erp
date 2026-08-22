import { Card, Tabs } from 'antd';
import MonthEndClosingPanel from './MonthEndClosingPanel';
import MonthEndReimbursementPanel from './MonthEndReimbursementPanel';

export default function WorkbenchPanel({ readOnly = false }: { readOnly?: boolean }) {
  return (
    <Card className="workbench-panel" style={{ marginBottom: 20 }}>
      <Tabs
        className="workbench-panel__tabs"
        items={[
          {
            key: 'month-end-closing',
            label: '季末结转',
            children: <MonthEndClosingPanel readOnly={readOnly} />
          },
          {
            key: 'reimbursement',
            label: '月底报销',
            children: <MonthEndReimbursementPanel readOnly={readOnly} />
          }
        ]}
      />
    </Card>
  );
}

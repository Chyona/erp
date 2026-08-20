import { Card, Tabs } from 'antd';
import TaxExemptionPanel from './TaxExemptionPanel.jsx';
import MonthEndReimbursementPanel from './MonthEndReimbursementPanel.jsx';

export default function WorkbenchPanel() {
  return (
    <Card className="workbench-panel" style={{ marginBottom: 20 }}>
      <Tabs
        className="workbench-panel__tabs"
        items={[
          {
            key: 'tax-exemption',
            label: '普票结转',
            children: <TaxExemptionPanel />
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

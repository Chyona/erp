import { Card, Tabs, Alert } from 'antd';
import MonthEndClosingPanel from './MonthEndClosingPanel';
import MonthEndReimbursementPanel from './MonthEndReimbursementPanel';

export default function WorkbenchPanel({ readOnly = false }: { readOnly?: boolean }) {
  return (
    <Card className="workbench-panel" style={{ marginBottom: 20 }}>
      {readOnly ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="当前为只读查看，生成凭证、反结转等操作请联系管理员处理。"
        />
      ) : null}
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

import { Button, DatePicker, Input, InputNumber, Tag, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from '../utils/dayjsSetup';
import AppTable from './AppTable';
import {
  Salary,
  type LaborLedgerRow,
  type LaborLedgerRowCalculated,
  type PayrollPeriodView
} from '../services/salary';

type LaborLedgerTableProps = {
  periodKey: string;
  rows: LaborLedgerRowCalculated[];
  totals: PayrollPeriodView['laborTotals'];
  readOnly?: boolean;
  loading?: boolean;
  onChange: (rows: LaborLedgerRow[]) => void;
  onAddRow: () => void;
  onRemoveRow: (id: string) => void;
};

function MoneyCell({
  value,
  readOnly,
  onChange
}: {
  value: number;
  readOnly?: boolean;
  onChange: (value: number) => void;
}) {
  if (readOnly) {
    return <span className="payroll-table__money">{Salary.formatMoneyDisplay(value)}</span>;
  }
  return (
    <InputNumber
      size="small"
      className="payroll-table__input-number"
      value={value || undefined}
      min={0}
      precision={2}
      controls={false}
      onChange={(next) => onChange(Number(next) || 0)}
    />
  );
}

export default function LaborLedgerTable({
  periodKey,
  rows,
  totals,
  readOnly = false,
  loading = false,
  onChange,
  onAddRow,
  onRemoveRow
}: LaborLedgerTableProps) {
  const patchRow = (id: string, patch: Partial<LaborLedgerRow>) => {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const columns: ColumnsType<LaborLedgerRowCalculated> = [
    {
      title: '编号',
      width: 56,
      align: 'center',
      render: (_value, _row, index) => index + 1
    },
    {
      title: '所属月',
      dataIndex: 'salaryMonth',
      width: 108,
      render: (value) => value || periodKey
    },
    {
      title: (
        <span>
          姓名<span className="payroll-table__required">*</span>
        </span>
      ),
      dataIndex: 'name',
      width: 120,
      render: (value, record) =>
        readOnly ? (
          value || '—'
        ) : (
          <Input
            size="small"
            value={value}
            placeholder="必填"
            onChange={(e) => patchRow(record.id, { name: e.target.value })}
          />
        )
    },
    {
      title: '应发劳务费',
      dataIndex: 'grossAmount',
      width: 120,
      align: 'right',
      render: (value, record) => (
        <MoneyCell
          value={value}
          readOnly={readOnly}
          onChange={(next) => patchRow(record.id, { grossAmount: next })}
        />
      )
    },
    {
      title: '代扣个税',
      dataIndex: 'withheldTax',
      width: 120,
      align: 'right',
      render: (value, record) => (
        <MoneyCell
          value={value}
          readOnly={readOnly}
          onChange={(next) => patchRow(record.id, { withheldTax: next })}
        />
      )
    },
    {
      title: '实发劳务费',
      dataIndex: 'netAmount',
      width: 120,
      align: 'right',
      className: 'payroll-table__col-highlight',
      render: (value) => Salary.formatMoneyDisplay(value)
    },
    {
      title: '发放时间',
      dataIndex: 'paymentDate',
      width: 128,
      render: (value, record) =>
        readOnly ? (
          value || '—'
        ) : (
          <DatePicker
            size="small"
            allowClear
            value={value ? dayjs(value) : null}
            format="YYYY-MM-DD"
            onChange={(date) =>
              patchRow(record.id, { paymentDate: date ? date.format('YYYY-MM-DD') : '' })
            }
          />
        )
    },
    {
      title: '备注',
      dataIndex: 'remark',
      ellipsis: true,
      render: (value, record) =>
        readOnly ? (
          value || '—'
        ) : (
          <Input
            size="small"
            value={value}
            placeholder="项目或说明"
            onChange={(e) => patchRow(record.id, { remark: e.target.value })}
          />
        )
    }
  ];

  if (!readOnly) {
    columns.push({
      title: '操作',
      key: 'actions',
      width: 72,
      render: (_, record) => (
        <Button type="link" size="small" danger onClick={() => onRemoveRow(record.id)}>
          删除
        </Button>
      )
    });
  }

  return (
    <div className="payroll-table-wrap">
      {!readOnly ? (
        <div className="payroll-table__toolbar">
          <Button size="small" onClick={onAddRow}>
            新增一行
          </Button>
          <Tag color="blue">单位：元</Tag>
        </div>
      ) : null}
      <AppTable
        size="small"
        bordered
        loading={loading}
        rowKey="id"
        columns={columns}
        dataSource={rows}
        pagination={false}
        scroll={{ x: 980 }}
        className="payroll-table"
        summary={() => (
          <Table.Summary fixed>
            <Table.Summary.Row className="payroll-table__summary-row">
              <Table.Summary.Cell index={0} colSpan={3} align="center">
                合计
              </Table.Summary.Cell>
              <Table.Summary.Cell index={3} align="right">
                {Salary.formatMoneyDisplay(totals.grossAmount)}
              </Table.Summary.Cell>
              <Table.Summary.Cell index={4} align="right">
                {Salary.formatMoneyDisplay(totals.withheldTax)}
              </Table.Summary.Cell>
              <Table.Summary.Cell index={5} align="right" className="payroll-table__col-highlight">
                {Salary.formatMoneyDisplay(totals.netAmount)}
              </Table.Summary.Cell>
              <Table.Summary.Cell index={6} />
              <Table.Summary.Cell index={7} />
              {!readOnly ? <Table.Summary.Cell index={8} /> : null}
            </Table.Summary.Row>
          </Table.Summary>
        )}
      />
    </div>
  );
}

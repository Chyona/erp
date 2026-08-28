import { useMemo, type CSSProperties } from 'react';
import { DatePicker, Input, Select, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from '../utils/dayjsSetup';
import ScrollTable from './ScrollTable';
import { PayrollMoneyCell, PayrollRowActions } from './payrollTableShared';
import {
  Salary,
  type LaborLedgerRow,
  type LaborLedgerRowCalculated,
  type PayrollPeriodView
} from '../services/salary';
import type { PayrollStaffMember } from '../services/payrollStaff';

const LABOR_BASIC_ACTION_WIDTH = 64;
const LABOR_BASIC_NAME_WIDTH = 120;

function tableScrollX(columns: ColumnsType<LaborLedgerRowCalculated>): number {
  return columns.reduce((sum, column) => sum + (typeof column.width === 'number' ? column.width : 120), 0);
}

type LaborLedgerTableProps = {
  periodKey: string;
  rows: LaborLedgerRowCalculated[];
  totals: PayrollPeriodView['laborTotals'];
  staffMembers?: PayrollStaffMember[];
  readOnly?: boolean;
  loading?: boolean;
  fillPage?: boolean;
  onChange: (rows: LaborLedgerRow[]) => void;
  onAddRow: () => void;
  onRemoveRow: (id: string) => void;
};

function moneyColumn(
  title: string,
  dataIndex: keyof LaborLedgerRow,
  patchRow: (id: string, patch: Partial<LaborLedgerRow>) => void,
  readOnly?: boolean,
  width = 120
) {
  return {
    title,
    dataIndex,
    width,
    align: 'right' as const,
    render: (value: number, record: LaborLedgerRowCalculated) => (
      <PayrollMoneyCell
        value={value}
        readOnly={readOnly}
        onChange={(next) => patchRow(record.id, { [dataIndex]: next } as Partial<LaborLedgerRow>)}
      />
    )
  };
}

function calcColumn(title: string, dataIndex: keyof LaborLedgerRowCalculated, width = 120) {
  return {
    title,
    dataIndex,
    width,
    align: 'right' as const,
    className: 'payroll-table__col-total',
    render: (value: number) => Salary.formatMoneyDisplay(value)
  };
}

export default function LaborLedgerTable({
  rows,
  totals,
  staffMembers = [],
  readOnly = false,
  loading = false,
  onChange,
  onAddRow,
  onRemoveRow
}: LaborLedgerTableProps) {
  const staffOptions = useMemo(
    () =>
      staffMembers
        .filter((item) => item.enabled !== false && item.staffType === 'temporary')
        .map((item) => ({
          value: item.id,
          label: item.name
        })),
    [staffMembers]
  );

  const patchRow = (id: string, patch: Partial<LaborLedgerRow>) => {
    onChange(
      rows.map((row) =>
        row.id === id
          ? {
            ...row,
            ...patch
          }
          : row
      )
    );
  };

  const resolveStaffId = (name: string) =>
    staffOptions.find((option) => option.label === name)?.value;

  const columns: ColumnsType<LaborLedgerRowCalculated> = [
    {
      title: '操作',
      key: 'actions',
      width: LABOR_BASIC_ACTION_WIDTH,
      fixed: 'left',
      align: 'center',
      render: (_, record) =>
        readOnly ? null : (
          <PayrollRowActions onAddRow={onAddRow} onRemoveRow={() => onRemoveRow(record.id)} />
        )
    },
    {
      title: '姓名',
      dataIndex: 'name',
      width: LABOR_BASIC_NAME_WIDTH,
      fixed: 'left',
      render: (_value, record) => {
        if (readOnly) {
          return record.name || '—';
        }
        if (staffOptions.length) {
          return (
            <Select
              size="small"
              showSearch
              allowClear
              placeholder="选择人员"
              optionFilterProp="label"
              style={{ width: '100%' }}
              value={resolveStaffId(record.name) || undefined}
              options={staffOptions}
              onChange={(staffId) => {
                if (!staffId) {
                  patchRow(record.id, { name: '' });
                  return;
                }
                const staff = staffMembers.find((item) => item.id === staffId);
                patchRow(record.id, { name: staff?.name || '' });
              }}
            />
          );
        }
        return (
          <Input
            size="small"
            placeholder="姓名"
            value={record.name}
            onChange={(event) => patchRow(record.id, { name: event.target.value })}
          />
        );
      }
    },
    moneyColumn('税前总额', 'grossAmount', patchRow, readOnly),
    moneyColumn('个人缴纳增值税', 'personalVat', patchRow, readOnly, 128),
    calcColumn('个人缴纳增值税后收入', 'incomeAfterVat', 152),
    calcColumn('免税费用', 'taxExemptExpense', 104),
    calcColumn('应纳税所得额', 'taxableIncome', 120),
    calcColumn('代扣个税', 'withheldTax', 104),
    {
      title: '实发劳务费',
      dataIndex: 'netAmount',
      width: 120,
      align: 'right',
      render: (value: number) => Salary.formatMoneyDisplay(value)
    },
    {
      title: '发放时间',
      dataIndex: 'paymentDate',
      width: 128,
      render: (value: string | undefined, record) =>
        readOnly ? (
          value || '—'
        ) : (
          <DatePicker
            size="small"
            allowClear
            style={{ width: '100%' }}
            value={value ? dayjs(value) : null}
            onChange={(next) =>
              patchRow(record.id, { paymentDate: next ? next.format('YYYY-MM-DD') : undefined })
            }
          />
        )
    },
    {
      title: '备注',
      dataIndex: 'remark',
      width: 160,
      ellipsis: true,
      render: (value: string | undefined, record) =>
        readOnly ? (
          value || '—'
        ) : (
          <Input
            size="small"
            placeholder="备注"
            value={value}
            onChange={(event) => patchRow(record.id, { remark: event.target.value })}
          />
        )
    }
  ];

  const scrollX = tableScrollX(columns);

  const summaryCells = [
    totals.grossAmount,
    totals.personalVat,
    totals.incomeAfterVat,
    totals.taxExemptExpense,
    totals.taxableIncome,
    totals.withheldTax,
    totals.netAmount
  ];

  return (
    <div className="payroll-table-wrap payroll-table-wrap--fill">
      <ScrollTable
        fillPage
        size="small"
        bordered
        tableLayout="fixed"
        loading={loading}
        rowKey="id"
        columns={columns}
        dataSource={rows}
        pagination={false}
        scroll={{ x: scrollX }}
        scrollBarBelowSummary
        className="payroll-table payroll-table--labor"
        bodyClassName="payroll-table__scroll-body page-table-body--payroll-labor"
        wrapStyle={
          {
            '--payroll-labor-scroll-x': `${scrollX}px`
          } as CSSProperties
        }
        summary={() => (
          <Table.Summary fixed>
            <Table.Summary.Row className="payroll-table__summary-row">
              <Table.Summary.Cell index={0} colSpan={2} align="center">
                合计
              </Table.Summary.Cell>
              {summaryCells.map((value, index) => (
                <Table.Summary.Cell
                  key={index}
                  index={index + 2}
                  align="right"
                >
                  {Salary.formatMoneyDisplay(value)}
                </Table.Summary.Cell>
              ))}
              <Table.Summary.Cell index={summaryCells.length + 2} />
              <Table.Summary.Cell index={summaryCells.length + 3} />
            </Table.Summary.Row>
          </Table.Summary>
        )}
      />
    </div>
  );
}

import { useMemo, type CSSProperties } from 'react';
import { Button, InputNumber, Select, Space, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined
} from '@ant-design/icons';
import ScrollTable from './ScrollTable';
import {
  Salary,
  type PayrollPeriodView,
  type SalaryPayrollRow,
  type SalaryPayrollRowCalculated
} from '../services/salary';
import {
  PAYROLL_STAFF_TYPE_LABELS,
  type PayrollStaffMember,
  type PayrollStaffType
} from '../services/payrollStaff';

const PAYROLL_BASIC_ACTION_WIDTH = 88;
const PAYROLL_BASIC_STAFF_WIDTH = 120;
const PAYROLL_BASIC_TYPE_WIDTH = 96;
const PAYROLL_FIXED_WIDTH =
  PAYROLL_BASIC_ACTION_WIDTH + PAYROLL_BASIC_STAFF_WIDTH + PAYROLL_BASIC_TYPE_WIDTH;

function leafColumnWidth(column: ColumnsType<SalaryPayrollRowCalculated>[number]): number {
  if ('children' in column && column.children?.length) {
    return column.children.reduce((sum, child) => sum + leafColumnWidth(child), 0);
  }
  return typeof column.width === 'number' ? column.width : 96;
}

function tableScrollX(columns: ColumnsType<SalaryPayrollRowCalculated>): number {
  return columns.reduce((sum, column) => sum + leafColumnWidth(column), 0);
}

type SalaryPayrollTableProps = {
  periodKey: string;
  rows: SalaryPayrollRowCalculated[];
  totals: PayrollPeriodView['salaryTotals'];
  staffMembers: PayrollStaffMember[];
  readOnly?: boolean;
  loading?: boolean;
  onChange: (rows: SalaryPayrollRow[]) => void;
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

function moneyColumn(
  title: string,
  dataIndex: keyof SalaryPayrollRow,
  patchRow: (id: string, patch: Partial<SalaryPayrollRow>) => void,
  readOnly?: boolean,
  width = 96
) {
  return {
    title,
    dataIndex,
    width,
    align: 'right' as const,
    render: (value: number, record: SalaryPayrollRowCalculated) => (
      <MoneyCell
        value={value}
        readOnly={readOnly}
        onChange={(next) => patchRow(record.id, { [dataIndex]: next } as Partial<SalaryPayrollRow>)}
      />
    )
  };
}

function calcColumn(title: string, dataIndex: keyof SalaryPayrollRowCalculated, width = 96) {
  return {
    title,
    dataIndex,
    width,
    align: 'right' as const,
    className: 'payroll-table__col-total',
    render: (value: number) => Salary.formatMoneyDisplay(value)
  };
}

export default function SalaryPayrollTable({
  periodKey,
  rows,
  totals,
  staffMembers,
  readOnly = false,
  loading = false,
  onChange,
  onAddRow,
  onRemoveRow
}: SalaryPayrollTableProps) {
  const staffOptions = useMemo(
    () =>
      staffMembers
        .filter((item) => item.enabled !== false)
        .map((item) => ({
          value: item.id,
          label: item.name,
          staff: item
        })),
    [staffMembers]
  );

  const patchRow = (id: string, patch: Partial<SalaryPayrollRow>) => {
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

  const applyStaff = (record: SalaryPayrollRowCalculated, staffId: string) => {
    const staff = staffMembers.find((item) => item.id === staffId);
    if (!staff) return;
    patchRow(record.id, {
      staffId,
      name: staff.name,
      departmentId: staff.departmentId,
      idNumber: staff.idNumber || '',
      salaryType: staff.staffType
        ? PAYROLL_STAFF_TYPE_LABELS[staff.staffType as PayrollStaffType]
        : PAYROLL_STAFF_TYPE_LABELS.employee
    });
  };

  const columns: ColumnsType<SalaryPayrollRowCalculated> = [
    {
      title: '基本信息',
      fixed: 'left',
      width: PAYROLL_FIXED_WIDTH,
      children: [
        {
          title: '操作',
          key: 'actions',
          width: PAYROLL_BASIC_ACTION_WIDTH,
          align: 'center',
          render: (_, record) =>
            readOnly ? null : (
              <Space size={4}>
                <Button type="text" size="small" icon={<PlusOutlined />} aria-label="新增" onClick={onAddRow} />
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  aria-label="编辑"
                  onClick={() => undefined}
                />
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  aria-label="删除"
                  onClick={() => onRemoveRow(record.id)}
                />
              </Space>
            )
        },
        {
          title: '职员',
          dataIndex: 'name',
          width: PAYROLL_BASIC_STAFF_WIDTH,
          render: (_value, record) =>
            readOnly ? (
              record.name || '—'
            ) : (
              <Select
                size="small"
                showSearch
                allowClear
                placeholder="选择职员"
                optionFilterProp="label"
                style={{ width: '100%' }}
                value={record.staffId || undefined}
                options={staffOptions}
                onChange={(next) => {
                  if (next) applyStaff(record, next);
                  else patchRow(record.id, { staffId: '', name: '' });
                }}
              />
            )
        },
        {
          title: '薪资类型',
          dataIndex: 'salaryType',
          width: PAYROLL_BASIC_TYPE_WIDTH,
          render: (value, record) =>
            readOnly ? (
              value || '—'
            ) : (
              <Select
                size="small"
                style={{ width: '100%' }}
                value={value || PAYROLL_STAFF_TYPE_LABELS.employee}
                options={Object.values(PAYROLL_STAFF_TYPE_LABELS).map((label) => ({
                  value: label,
                  label
                }))}
                onChange={(next) => patchRow(record.id, { salaryType: next })}
              />
            )
        }
      ]
    },
    {
      title: '本期工资',
      children: [
        moneyColumn('基本工资', 'baseSalary', patchRow, readOnly),
        moneyColumn('津贴', 'allowance', patchRow, readOnly),
        moneyColumn('绩效奖金', 'performanceBonus', patchRow, readOnly),
        moneyColumn('补贴', 'subsidy', patchRow, readOnly),
        moneyColumn('缺勤扣款', 'absenceDeduction', patchRow, readOnly),
        calcColumn('应发工资', 'preTaxSalary', 104)
      ]
    },
    {
      title: '社保公积金',
      children: [
        moneyColumn('基本养老保险费', 'pension', patchRow, readOnly, 120),
        moneyColumn('基本医疗保险费', 'medical', patchRow, readOnly, 120),
        moneyColumn('失业保险费', 'unemployment', patchRow, readOnly, 104),
        moneyColumn('大病保险', 'criticalIllness', patchRow, readOnly, 96),
        moneyColumn('住房公积金', 'housingFund', patchRow, readOnly, 104),
        calcColumn('社保公积金合计', 'socialSecurityTotal', 120)
      ]
    },
    moneyColumn('其他扣除', 'otherDeduction', patchRow, readOnly, 96),
    moneyColumn('累计收入', 'cumulativeIncome', patchRow, readOnly, 104),
    moneyColumn('累计专项扣除', 'cumulativeSpecialDeduction', patchRow, readOnly, 120),
    {
      title: '累计专项附加扣除',
      children: [
        moneyColumn('累计子女教育', 'childEducation', patchRow, readOnly, 112),
        moneyColumn('累计住房贷款', 'housingLoan', patchRow, readOnly, 112),
        moneyColumn('累计住房租金', 'housingRent', patchRow, readOnly, 112),
        moneyColumn('累计赡养老人', 'elderlySupport', patchRow, readOnly, 112),
        moneyColumn('累计继续教育', 'continuingEducation', patchRow, readOnly, 112),
        moneyColumn('累计婴幼儿照护', 'infantCare', patchRow, readOnly, 120),
        calcColumn('累计专项附加扣除', 'cumulativeSpecialAdditionalTotal', 130)
      ]
    },
    moneyColumn('累计其他扣除', 'cumulativeOtherDeduction', patchRow, readOnly, 112),
    moneyColumn('累计应缴个税', 'cumulativeTaxPayable', patchRow, readOnly, 112),
    moneyColumn('累计已缴个税', 'cumulativeTaxPaid', patchRow, readOnly, 112),
    moneyColumn('本月应缴个税', 'withheldTax', patchRow, readOnly, 112),
    {
      ...calcColumn('实发工资', 'netSalary', 104),
      className: 'payroll-table__col-highlight'
    }
  ];

  const scrollX = tableScrollX(columns);

  const summaryCells = [
    totals.baseSalary,
    totals.allowance,
    totals.performanceBonus,
    totals.subsidy,
    totals.absenceDeduction,
    totals.preTaxSalary,
    totals.pension,
    totals.medical,
    totals.unemployment,
    totals.criticalIllness,
    totals.housingFund,
    totals.socialSecurityTotal,
    totals.otherDeduction,
    totals.cumulativeIncome,
    totals.cumulativeSpecialDeduction,
    totals.childEducation,
    totals.housingLoan,
    totals.housingRent,
    totals.elderlySupport,
    totals.continuingEducation,
    totals.infantCare,
    totals.cumulativeSpecialAdditionalTotal,
    totals.cumulativeOtherDeduction,
    totals.cumulativeTaxPayable,
    totals.cumulativeTaxPaid,
    totals.withheldTax,
    totals.netSalary
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
        className="payroll-table"
        bodyClassName="payroll-table__scroll-body page-table-body--payroll-detail"
        wrapStyle={
          {
            '--payroll-detail-scroll-x': `${scrollX}px`
          } as CSSProperties
        }
        summary={() => (
          <Table.Summary fixed>
            <Table.Summary.Row className="payroll-table__summary-row">
              <Table.Summary.Cell index={0} colSpan={3} align="center">
                合计
              </Table.Summary.Cell>
              {summaryCells.map((value, index) => (
                <Table.Summary.Cell key={index} index={index + 3} align="right">
                  {Salary.formatMoneyDisplay(value)}
                </Table.Summary.Cell>
              ))}
            </Table.Summary.Row>
          </Table.Summary>
        )}
      />
    </div>
  );
}

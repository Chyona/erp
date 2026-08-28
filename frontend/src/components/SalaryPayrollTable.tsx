import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { Button, DatePicker, InputNumber, Select, Space, Table, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  DeleteOutlined,
  EditOutlined,
  InfoCircleOutlined,
  PlusOutlined
} from '@ant-design/icons';
import dayjs from '../utils/dayjsSetup';
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
const PAYROLL_PAYMENT_DATE_WIDTH = 128;
const PAYROLL_WITHHELD_TAX_WIDTH = 128;
const PAYROLL_NET_SALARY_WIDTH = 112;
const PAYROLL_MONEY_WIDTH = 100;
const PAYROLL_MONEY_WIDTH_MD = 108;
const PAYROLL_MONEY_WIDTH_LG = 120;
const PAYROLL_SOCIAL_PENSION_WIDTH = 136;
const PAYROLL_SOCIAL_MEDICAL_WIDTH = 136;
const PAYROLL_SOCIAL_TOTAL_WIDTH = 152;
const PAYROLL_PRETAX_WIDTH = 112;
const PAYROLL_OTHER_DEDUCTION_WIDTH = 108;
const PAYROLL_CUMULATIVE_INCOME_WIDTH = 120;
const PAYROLL_CUMULATIVE_SPECIAL_DEDUCTION_WIDTH = 136;
const PAYROLL_CUMULATIVE_SPECIAL_ADDITIONAL_WIDTH = 160;
const PAYROLL_CUMULATIVE_OTHER_WIDTH = 128;
const PAYROLL_CUMULATIVE_TAX_WIDTH = 128;
const PAYROLL_SPECIAL_ADDITIONAL_WIDTH = 108;
const PAYROLL_SPECIAL_ADDITIONAL_INFANT_WIDTH = 120;
const PAYROLL_FIXED_RIGHT_WIDTH =
  PAYROLL_WITHHELD_TAX_WIDTH + PAYROLL_NET_SALARY_WIDTH + PAYROLL_PAYMENT_DATE_WIDTH;

const PAYROLL_COLUMN_HINTS = {
  preTaxSalary: '基本工资 + 津贴 + 绩效奖金 + 补贴 − 缺勤扣款',
  socialSecurityTotal: '养老、医疗、失业、工伤、生育、公积金个人部分之和',
  otherDeduction: '本月其他依法可扣除项目，不含社保公积金和个税',
  cumulativeIncome: '当年 1 月至本月应发工资累计；自动汇总本系统同一职员往月工资',
  cumulativeSpecialDeduction:
    '当年 1 月至本月个人三险一金累计；自动汇总本系统同一职员往月工资',
  specialAdditionalGroup: '填写本月专项附加扣除额，系统会自动累计到「累计专项附加扣除」',
  childEducation: '本月子女教育专项附加扣除额',
  housingLoan: '本月住房贷款利息专项附加扣除额',
  housingRent: '本月住房租金专项附加扣除额',
  elderlySupport: '本月赡养老人专项附加扣除额',
  continuingEducation: '本月继续教育专项附加扣除额',
  infantCare: '本月 3 岁以下婴幼儿照护专项附加扣除额',
  cumulativeSpecialAdditionalTotal:
    '当年 1 月至本月专项附加扣除累计；自动汇总本系统同一职员往月 + 本月',
  cumulativeOtherDeduction: '当年 1 月至本月「其他扣除」累计；自动汇总',
  cumulativeTaxPayable:
    '累计预扣法：累计应纳税所得额 × 税率 − 速算扣除数；减除费用按当年在本单位任职月数 × 5,000（年中入职从首月工资起算）',
  cumulativeTaxPaid:
    '当年 1 月至上月已扣个税累计；自动汇总本系统同一职员往月工资表中的「本月应缴个税」',
  withheldTax: '本月应缴个税 = 累计应缴个税 − 累计已缴个税',
  netSalary: '应发工资 − 社保公积金合计 − 其他扣除 − 本月应缴个税'
} as const;

function columnTitle(label: string, hint?: string): ReactNode {
  if (!hint) return label;
  return (
    <span className="payroll-table__col-title">
      <span className="payroll-table__col-title-text">{label}</span>
      <Tooltip title={hint}>
        <InfoCircleOutlined className="field-hint-icon payroll-table__col-hint" aria-label={`${label}说明`} />
      </Tooltip>
    </span>
  );
}

function leafColumnWidth(column: ColumnsType<SalaryPayrollRowCalculated>[number]): number {
  if ('children' in column && column.children?.length) {
    return column.children.reduce((sum, child) => sum + leafColumnWidth(child), 0);
  }
  return typeof column.width === 'number' ? column.width : PAYROLL_MONEY_WIDTH;
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
  width = PAYROLL_MONEY_WIDTH,
  hint?: string
) {
  return {
    title: columnTitle(title, hint),
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

function calcColumn(
  title: string,
  dataIndex: keyof SalaryPayrollRowCalculated,
  width = PAYROLL_MONEY_WIDTH,
  hint?: string
) {
  return {
    title: columnTitle(title, hint),
    dataIndex,
    width,
    align: 'right' as const,
    className: 'payroll-table__col-total',
    render: (value: number) => Salary.formatMoneyDisplay(value)
  };
}

export default function SalaryPayrollTable({
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
      title: '操作',
      key: 'actions',
      width: PAYROLL_BASIC_ACTION_WIDTH,
      fixed: 'left',
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
      fixed: 'left',
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
      title: '本期工资',
      children: [
        moneyColumn('基本工资', 'baseSalary', patchRow, readOnly),
        moneyColumn('津贴', 'allowance', patchRow, readOnly),
        moneyColumn('绩效奖金', 'performanceBonus', patchRow, readOnly, PAYROLL_MONEY_WIDTH_LG),
        moneyColumn('补贴', 'subsidy', patchRow, readOnly),
        moneyColumn('缺勤扣款', 'absenceDeduction', patchRow, readOnly, PAYROLL_MONEY_WIDTH_MD),
        calcColumn('应发工资', 'preTaxSalary', PAYROLL_PRETAX_WIDTH, PAYROLL_COLUMN_HINTS.preTaxSalary)
      ]
    },
    {
      title: '社保公积金',
      children: [
        moneyColumn('基本养老保险费', 'pension', patchRow, readOnly, PAYROLL_SOCIAL_PENSION_WIDTH),
        moneyColumn('基本医疗保险费', 'medical', patchRow, readOnly, PAYROLL_SOCIAL_MEDICAL_WIDTH),
        moneyColumn('失业保险费', 'unemployment', patchRow, readOnly, PAYROLL_MONEY_WIDTH_MD),
        moneyColumn('工伤险', 'workInjury', patchRow, readOnly),
        moneyColumn('生育险', 'maternityInsurance', patchRow, readOnly),
        moneyColumn('住房公积金', 'housingFund', patchRow, readOnly, PAYROLL_MONEY_WIDTH_MD),
        calcColumn(
          '社保公积金合计',
          'socialSecurityTotal',
          PAYROLL_SOCIAL_TOTAL_WIDTH,
          PAYROLL_COLUMN_HINTS.socialSecurityTotal
        )
      ]
    },
    moneyColumn(
      '其他扣除',
      'otherDeduction',
      patchRow,
      readOnly,
      PAYROLL_OTHER_DEDUCTION_WIDTH,
      PAYROLL_COLUMN_HINTS.otherDeduction
    ),
    calcColumn('累计收入', 'cumulativeIncome', PAYROLL_CUMULATIVE_INCOME_WIDTH, PAYROLL_COLUMN_HINTS.cumulativeIncome),
    calcColumn(
      '累计专项扣除',
      'cumulativeSpecialDeduction',
      PAYROLL_CUMULATIVE_SPECIAL_DEDUCTION_WIDTH,
      PAYROLL_COLUMN_HINTS.cumulativeSpecialDeduction
    ),
    {
      title: columnTitle('专项附加扣除（本月）', PAYROLL_COLUMN_HINTS.specialAdditionalGroup),
      children: [
        moneyColumn(
          '子女教育',
          'childEducation',
          patchRow,
          readOnly,
          PAYROLL_SPECIAL_ADDITIONAL_WIDTH,
          PAYROLL_COLUMN_HINTS.childEducation
        ),
        moneyColumn(
          '住房贷款',
          'housingLoan',
          patchRow,
          readOnly,
          PAYROLL_SPECIAL_ADDITIONAL_WIDTH,
          PAYROLL_COLUMN_HINTS.housingLoan
        ),
        moneyColumn(
          '住房租金',
          'housingRent',
          patchRow,
          readOnly,
          PAYROLL_SPECIAL_ADDITIONAL_WIDTH,
          PAYROLL_COLUMN_HINTS.housingRent
        ),
        moneyColumn(
          '赡养老人',
          'elderlySupport',
          patchRow,
          readOnly,
          PAYROLL_SPECIAL_ADDITIONAL_WIDTH,
          PAYROLL_COLUMN_HINTS.elderlySupport
        ),
        moneyColumn(
          '继续教育',
          'continuingEducation',
          patchRow,
          readOnly,
          PAYROLL_SPECIAL_ADDITIONAL_WIDTH,
          PAYROLL_COLUMN_HINTS.continuingEducation
        ),
        moneyColumn(
          '婴幼儿照护',
          'infantCare',
          patchRow,
          readOnly,
          PAYROLL_SPECIAL_ADDITIONAL_INFANT_WIDTH,
          PAYROLL_COLUMN_HINTS.infantCare
        )
      ]
    },
    calcColumn(
      '累计专项附加扣除',
      'cumulativeSpecialAdditionalTotal',
      PAYROLL_CUMULATIVE_SPECIAL_ADDITIONAL_WIDTH,
      PAYROLL_COLUMN_HINTS.cumulativeSpecialAdditionalTotal
    ),
    calcColumn(
      '累计其他扣除',
      'cumulativeOtherDeduction',
      PAYROLL_CUMULATIVE_OTHER_WIDTH,
      PAYROLL_COLUMN_HINTS.cumulativeOtherDeduction
    ),
    calcColumn(
      '累计应缴个税',
      'cumulativeTaxPayable',
      PAYROLL_CUMULATIVE_TAX_WIDTH,
      PAYROLL_COLUMN_HINTS.cumulativeTaxPayable
    ),
    calcColumn(
      '累计已缴个税',
      'cumulativeTaxPaid',
      PAYROLL_CUMULATIVE_TAX_WIDTH,
      PAYROLL_COLUMN_HINTS.cumulativeTaxPaid
    ),
    {
      ...calcColumn('本月应缴个税', 'withheldTax', PAYROLL_WITHHELD_TAX_WIDTH, PAYROLL_COLUMN_HINTS.withheldTax),
      className: 'payroll-table__col-total',
      fixed: 'right'
    },
    {
      ...calcColumn('实发工资', 'netSalary', PAYROLL_NET_SALARY_WIDTH, PAYROLL_COLUMN_HINTS.netSalary),
      className: 'payroll-table__col-highlight',
      fixed: 'right'
    },
    {
      title: '发放日期',
      dataIndex: 'paymentDate',
      width: PAYROLL_PAYMENT_DATE_WIDTH,
      fixed: 'right',
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
    totals.workInjury,
    totals.maternityInsurance,
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
    totals.cumulativeTaxPaid
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
            '--payroll-detail-scroll-x': `${scrollX}px`,
            '--payroll-fixed-right-width': `${PAYROLL_FIXED_RIGHT_WIDTH}px`
          } as CSSProperties
        }
        summary={() => (
          <Table.Summary fixed>
            <Table.Summary.Row className="payroll-table__summary-row">
              <Table.Summary.Cell index={0} colSpan={2} align="center">
                合计
              </Table.Summary.Cell>
              {summaryCells.map((value, index) => (
                <Table.Summary.Cell key={index} index={index + 2} align="right">
                  {Salary.formatMoneyDisplay(value)}
                </Table.Summary.Cell>
              ))}
              <Table.Summary.Cell
                index={summaryCells.length + 2}
                align="right"
                className="payroll-table__col-highlight"
              >
                {Salary.formatMoneyDisplay(totals.withheldTax)}
              </Table.Summary.Cell>
              <Table.Summary.Cell
                index={summaryCells.length + 3}
                align="right"
                className="payroll-table__col-highlight"
              >
                {Salary.formatMoneyDisplay(totals.netSalary)}
              </Table.Summary.Cell>
              <Table.Summary.Cell index={summaryCells.length + 4} />
            </Table.Summary.Row>
          </Table.Summary>
        )}
      />
    </div>
  );
}

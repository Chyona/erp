import { Alert, Button, InputNumber, Space, Typography } from 'antd';
import CopyableReportAmount from './CopyableReportAmount';
import type {
  CitPayrollAdjustmentValues,
  SurchargeRatePercents,
  SurchargeReliefOptions,
  TaxEstimateResult
} from '../services/taxEstimate';

const { Text, Title } = Typography;

type TaxEstimateViewProps = {
  data: TaxEstimateResult | null;
  loading?: boolean;
  /** 已结项：只读展示账面实际数，隐藏未入账成本 */
  settled?: boolean;
  citRatePercent: number;
  onCitRateChange: (value: number) => void;
  surchargeRates: SurchargeRatePercents;
  onSurchargeRatesChange: (next: SurchargeRatePercents) => void;
  surchargeRelief: SurchargeReliefOptions;
  onSurchargeReliefChange: (next: SurchargeReliefOptions) => void;
  payrollAdjustment: CitPayrollAdjustmentValues;
  onPayrollAdjustmentChange: (next: CitPayrollAdjustmentValues) => void;
  onResetPayrollAdjustment?: () => void;
};

function Money({ value, strong = false }: { value: number; strong?: boolean }) {
  return <CopyableReportAmount value={value} format="plain" strong={strong} showZero />;
}

function MetricRow({
  label,
  value,
  hint,
  emphasize = false
}: {
  label: string;
  value: number;
  hint?: string;
  emphasize?: boolean;
}) {
  return (
    <div className={`tax-estimate-view__row${emphasize ? ' tax-estimate-view__row--emphasize' : ''}`}>
      <div className="tax-estimate-view__label">
        <span>{label}</span>
        {hint ? (
          <Text type="secondary" className="tax-estimate-view__hint">
            {hint}
          </Text>
        ) : null}
      </div>
      <div className="tax-estimate-view__value">
        <Money value={value} strong={emphasize} />
      </div>
    </div>
  );
}

function EditableDeductionRow({
  label,
  hint,
  value,
  onChange,
  disabled = false
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="tax-estimate-view__row tax-estimate-view__row--editable">
      <div className="tax-estimate-view__label">
        <span>{label}</span>
        {hint ? (
          <Text type="secondary" className="tax-estimate-view__hint">
            {hint}
          </Text>
        ) : null}
      </div>
      <div className="tax-estimate-view__value">
        {disabled ? (
          <Money value={value} />
        ) : (
          <InputNumber
            min={0}
            step={100}
            precision={2}
            value={value}
            onChange={(next) => onChange(Number(next) || 0)}
            className="tax-estimate-view__amount-input"
          />
        )}
      </div>
    </div>
  );
}

export default function TaxEstimateView({
  data,
  loading = false,
  settled = false,
  citRatePercent,
  onCitRateChange,
  surchargeRates,
  onSurchargeRatesChange,
  surchargeRelief,
  onSurchargeReliefChange,
  payrollAdjustment,
  onPayrollAdjustmentChange,
  onResetPayrollAdjustment
}: TaxEstimateViewProps) {
  if (!data && !loading) {
    return <Text type="secondary">请选择期间查询税费预估</Text>;
  }

  const readOnly = settled || Boolean(data?.settled);
  const vat = data?.vat;
  const cit = data?.cit;
  const surcharge = vat?.surcharge;
  const previousLabel = cit?.payrollAdjustment?.previousPeriodKey
    ? cit.payrollAdjustment.previousPeriodKey.replace('-', '年') + '月'
    : '';
  const alreadyBooked = cit?.payrollAdjustment?.alreadyBooked;
  const payrollHintFor = (
    field:
      | 'unbookedSalaryGross'
      | 'unbookedLaborGross'
      | 'unbookedCompanySocialSecurity'
      | 'unbookedCompanyHousingFund'
  ) => {
    if (alreadyBooked?.[field]) return '本月已入账，不再扣减';
    if (previousLabel) return `默认取自${previousLabel}`;
    return '非当前月份或季度，不计未入账';
  };
  const surchargeTotalPercent = roundDisplayPercent(
    surchargeRates.cityPercent +
    surchargeRates.educationPercent +
    surchargeRates.localEducationPercent
  );

  const patchPayroll = (patch: Partial<CitPayrollAdjustmentValues>) => {
    onPayrollAdjustmentChange({ ...payrollAdjustment, ...patch });
  };
  const payrollTotal =
    Math.round(
      ((Number(payrollAdjustment.unbookedSalaryGross) || 0) +
        (Number(payrollAdjustment.unbookedLaborGross) || 0) +
        (Number(payrollAdjustment.unbookedCompanySocialSecurity) || 0) +
        (Number(payrollAdjustment.unbookedCompanyHousingFund) || 0)) *
      100
    ) / 100;

  return (
    <div className={`tax-estimate-view${loading ? ' tax-estimate-view--loading' : ''}`}>
      <Alert
        type={readOnly ? 'success' : 'info'}
        showIcon
        className="tax-estimate-view__alert"
        message={readOnly ? '已结项（账面实际）' : '预估说明'}
        description={
          readOnly
            ? '该期间所属季度已申报结项，以下为凭证与报表账面实际数据，税率与金额不可调整。'
            : '增值税按本期销售收入凭证销项拆分；附加税按《附列资料（二）》口径：应纳税额 − 本期减免税额（教育费附加+地方教育附加）− 六税两费减征额 − 已缴税额。企业所得税按「账面利润 − 未入账成本」×税率匡算。'
        }
      />

      <div className="tax-estimate-view__grid">
        <section className="tax-estimate-view__card">
          <div className="tax-estimate-view__title-row">
            <Title level={5} className="tax-estimate-view__title">
              {readOnly ? '应交增值税及附加' : '应交增值税及附加（预估）'}
            </Title>
          </div>
          <MetricRow label="销项税额合计" value={vat?.outputTaxTotal || 0} />
          <MetricRow
            label="其中：普票销项"
            value={
              Math.round(((vat?.ordinaryPendingTax || 0) + (vat?.ordinaryDoneTax || 0)) * 100) / 100
            }
          />
          <MetricRow label="其中：专票销项" value={vat?.specialTax || 0} />
          <MetricRow
            label={readOnly ? '应交增值税' : '预估应交增值税（假设普票按期减免）'}
            value={vat?.estimatedPayableAfterExemption || 0}
            hint="≈ 专票销项，作为附加税税基"
            emphasize
          />

          <div className="tax-estimate-view__subtitle-row">
            <Text strong className="tax-estimate-view__subtitle">
              附加税（合计 {surchargeTotalPercent}%）
            </Text>
            <Space size={8} wrap className="tax-estimate-view__rate-group">
              <Space size={4} className="tax-estimate-view__rate">
                <span>城建</span>
                <InputNumber
                  min={0}
                  max={100}
                  step={1}
                  precision={2}
                  value={surchargeRates.cityPercent}
                  disabled={readOnly}
                  onChange={(value) =>
                    onSurchargeRatesChange({
                      ...surchargeRates,
                      cityPercent: Number(value) || 0
                    })
                  }
                  addonAfter="%"
                  className="tax-estimate-view__rate-input tax-estimate-view__rate-input--sm"
                />
              </Space>
              <Space size={4} className="tax-estimate-view__rate">
                <span>教育</span>
                <InputNumber
                  min={0}
                  max={100}
                  step={0.5}
                  precision={2}
                  value={surchargeRates.educationPercent}
                  disabled={readOnly}
                  onChange={(value) =>
                    onSurchargeRatesChange({
                      ...surchargeRates,
                      educationPercent: Number(value) || 0
                    })
                  }
                  addonAfter="%"
                  className="tax-estimate-view__rate-input tax-estimate-view__rate-input--sm"
                />
              </Space>
              <Space size={4} className="tax-estimate-view__rate">
                <span>地方教育</span>
                <InputNumber
                  min={0}
                  max={100}
                  step={0.5}
                  precision={2}
                  value={surchargeRates.localEducationPercent}
                  disabled={readOnly}
                  onChange={(value) =>
                    onSurchargeRatesChange({
                      ...surchargeRates,
                      localEducationPercent: Number(value) || 0
                    })
                  }
                  addonAfter="%"
                  className="tax-estimate-view__rate-input tax-estimate-view__rate-input--sm"
                />
              </Space>
            </Space>
          </div>

          <MetricRow
            label={`城建税（${surchargeRates.cityPercent}%）`}
            value={surcharge?.cityTax || 0}
          />
          <MetricRow
            label={`教育费附加（${surchargeRates.educationPercent}%）`}
            value={surcharge?.educationTax || 0}
          />
          <MetricRow
            label={`地方教育附加（${surchargeRates.localEducationPercent}%）`}
            value={surcharge?.localEducationTax || 0}
          />
          <MetricRow
            label="本期应纳税（费）额"
            value={surcharge?.taxableAmount || 0}
            hint="合计 = 城建 + 教育 + 地方教育"
          />
          <MetricRow
            label="本期减免税（费）额"
            value={surcharge?.periodExemptionAmount || 0}
            hint="教育费附加 + 地方教育附加"
          />
          <div className="tax-estimate-view__row tax-estimate-view__row--editable">
            <div className="tax-estimate-view__label">
              <span>增值税小规模纳税人「六税两费」减征政策</span>
              <Text type="secondary" className="tax-estimate-view__hint">
                减征额 =（本期应纳税额 − 本期减免税额）× 减征比例
              </Text>
            </div>
            <div className="tax-estimate-view__value tax-estimate-view__value--stacked">
              <Space size={6} className="tax-estimate-view__rate">
                <span>减征比例</span>
                <InputNumber
                  min={0}
                  max={100}
                  step={5}
                  precision={2}
                  value={surchargeRelief.sixTaxTwoFeePercent}
                  disabled={readOnly}
                  onChange={(value) =>
                    onSurchargeReliefChange({
                      ...surchargeRelief,
                      sixTaxTwoFeePercent: Number(value) || 0
                    })
                  }
                  addonAfter="%"
                  className="tax-estimate-view__rate-input tax-estimate-view__rate-input--sm"
                />
              </Space>
              <div className="tax-estimate-view__relief-amount">
                <Text type="secondary">减征额</Text>
                <Money value={surcharge?.sixTaxTwoFeeAmount || 0} />
              </div>
            </div>
          </div>
          <EditableDeductionRow
            label="本期已缴税（费）额"
            hint={readOnly ? '账面已缴' : '预估通常为 0'}
            value={surchargeRelief.periodPaidAmount}
            disabled={readOnly}
            onChange={(periodPaidAmount) =>
              onSurchargeReliefChange({ ...surchargeRelief, periodPaidAmount })
            }
          />
          <MetricRow
            label="本期应补（退）税（费）额"
            value={surcharge?.total || 0}
            hint="应纳税额 − 减免税额 − 六税两费减征额 − 已缴税额"
            emphasize
          />
          <MetricRow
            label={readOnly ? '增值税+附加合计' : '预估增值税+附加合计（减免后）'}
            value={vat?.estimatedPayableWithSurcharge || 0}
            emphasize
          />
          {(vat?.ordinaryWithoutTaxCount || 0) > 0 ? (
            <Text type="warning" className="tax-estimate-view__note">
              有 {vat?.ordinaryWithoutTaxCount} 张普票销售凭证未识别到销项税额，请核对分录。
            </Text>
          ) : null}
        </section>

        <section className="tax-estimate-view__card">
          <div className="tax-estimate-view__title-row">
            <Title level={5} className="tax-estimate-view__title">
              {readOnly ? '企业所得税' : '企业所得税（预估）'}
            </Title>
            <Space size={6} className="tax-estimate-view__rate">
              <span>税率</span>
              <InputNumber
                min={0}
                max={100}
                step={0.5}
                precision={2}
                value={citRatePercent}
                disabled={readOnly}
                onChange={(value) => onCitRateChange(Number(value) || 0)}
                addonAfter="%"
                className="tax-estimate-view__rate-input"
              />
            </Space>
          </div>
          <MetricRow label="本期营业收入" value={cit?.revenue || 0} />
          <MetricRow
            label={readOnly ? '利润总额' : '账面利润总额'}
            value={cit?.bookedTotalProfit || 0}
            hint={readOnly ? '利润表本期' : '利润表本期数，未扣未入账成本'}
          />

          {!readOnly ? (
            <div className="tax-estimate-payroll">
              <div className="tax-estimate-payroll__head">
                <Text strong className="tax-estimate-view__subtitle">
                  未入账成本（可改）
                </Text>
                <span className="tax-estimate-payroll__total">
                  <CopyableReportAmount value={payrollTotal} format="plain" showZero strong />
                </span>
                {onResetPayrollAdjustment ? (
                  <Button
                    type="link"
                    size="small"
                    className="tax-estimate-payroll__reset"
                    onClick={onResetPayrollAdjustment}
                  >
                    恢复默认
                  </Button>
                ) : null}
              </div>
              <div className="tax-estimate-payroll__list">
                <EditableDeductionRow
                  label="减：未入账应发工资"
                  hint={payrollHintFor('unbookedSalaryGross')}
                  value={payrollAdjustment.unbookedSalaryGross}
                  onChange={(unbookedSalaryGross) => patchPayroll({ unbookedSalaryGross })}
                />
                <EditableDeductionRow
                  label="减：未入账劳务应发"
                  hint={payrollHintFor('unbookedLaborGross')}
                  value={payrollAdjustment.unbookedLaborGross}
                  onChange={(unbookedLaborGross) => patchPayroll({ unbookedLaborGross })}
                />
                <EditableDeductionRow
                  label="减：未入账公司社保"
                  hint={payrollHintFor('unbookedCompanySocialSecurity')}
                  value={payrollAdjustment.unbookedCompanySocialSecurity}
                  onChange={(unbookedCompanySocialSecurity) =>
                    patchPayroll({ unbookedCompanySocialSecurity })
                  }
                />
                <EditableDeductionRow
                  label="减：未入账公司公积金"
                  hint={payrollHintFor('unbookedCompanyHousingFund')}
                  value={payrollAdjustment.unbookedCompanyHousingFund}
                  onChange={(unbookedCompanyHousingFund) =>
                    patchPayroll({ unbookedCompanyHousingFund })
                  }
                />
              </div>
            </div>
          ) : null}

          <MetricRow
            label={readOnly ? '利润总额（本期税基）' : '调整后利润总额（本期税基）'}
            value={cit?.totalProfit || 0}
            hint={
              readOnly
                ? '已结项，按账面利润总额'
                : (cit?.payrollAdjustment?.total || 0) > 0.005
                  ? '账面利润总额 − 未入账成本'
                  : '本期工资、社保、公积金均已入账或暂无数据'
            }
            emphasize
          />
          <MetricRow
            label="本期所得税费用（计提）"
            value={cit?.priorPeriodCitPaid || 0}
            hint="仅统计借 5801 / 贷 2221 的计提凭证；缴纳上期不计入"
          />
          <MetricRow
            label="本期缴纳上期所得税"
            value={cit?.periodCitPaid || 0}
            hint="仅累加摘要含企业所得税的 2221 借方；不含个税/增值税/附加"
          />
          <MetricRow
            label="本期净利润"
            value={
              Math.round(
                ((cit?.totalProfit || 0) -
                  (cit?.periodCitPaid || 0) -
                  (cit?.priorPeriodCitPaid || 0)) *
                100
              ) / 100
            }
            hint={
              readOnly
                ? '利润总额 − 本期缴纳上期所得税 − 本期所得税费用（计提）'
                : '调整后利润总额 − 本期缴纳上期所得税 − 本期所得税费用（计提）'
            }
            emphasize
          />

          <div className="tax-estimate-view__subtitle-row">
            <Text strong className="tax-estimate-view__subtitle">
              本年累计（预缴）
            </Text>
          </div>
          <MetricRow label="本年累计账面利润总额" value={cit?.bookedYtdTotalProfit || 0} />
          <MetricRow
            label={readOnly ? '本年累计利润总额' : '本年累计调整后利润总额'}
            value={cit?.ytdTotalProfit || 0}
            hint={readOnly ? '已结项，按账面累计' : '本年累计账面利润 − 未入账成本'}
          />
          <MetricRow
            label={readOnly ? '本年累计所得税' : '本年累计预估所得税'}
            value={cit?.ytdEstimatedTax || 0}
            hint={`max(本年累计利润总额, 0) × ${citRatePercent}%`}
          />
          <MetricRow
            label="本年度已缴纳所得税"
            value={cit?.ytdIncomeTaxExpense || 0}
            hint="本年累计实缴企业所得税（不含个税/增值税/附加）"
          />
          <MetricRow
            label={readOnly ? '本期应补所得税' : '本期应补提所得税'}
            value={cit?.remainingToAccrue || 0}
            hint={citAccrualHint(cit)}
            emphasize
          />
        </section>
      </div>
    </div>
  );
}

function citAccrualHint(cit: TaxEstimateResult['cit'] | undefined) {
  const estimated = Number(cit?.ytdEstimatedTax || 0);
  const paid = Number(cit?.ytdIncomeTaxExpense || 0);
  const accrue = Number(cit?.remainingToAccrue || 0);
  const gap = Math.round((estimated - paid) * 100) / 100;
  const formula = `max(${estimated.toFixed(2)} − ${paid.toFixed(2)}, 0) = ${accrue.toFixed(2)}`;
  if (gap < -0.005) {
    return `${formula}，已多缴 ${Math.abs(gap).toFixed(2)}`;
  }
  return formula;
}

function roundDisplayPercent(value: number) {
  return Math.round(value * 100) / 100;
}

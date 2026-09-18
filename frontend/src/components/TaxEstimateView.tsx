import { Alert, Button, InputNumber, Space, Typography } from 'antd';
import CopyableReportAmount from './CopyableReportAmount';
import type {
  CitPayrollAdjustmentValues,
  SurchargeRatePercents,
  TaxEstimateResult
} from '../services/taxEstimate';

const { Text, Title } = Typography;

type TaxEstimateViewProps = {
  data: TaxEstimateResult | null;
  loading?: boolean;
  citRatePercent: number;
  onCitRateChange: (value: number) => void;
  surchargeRates: SurchargeRatePercents;
  onSurchargeRatesChange: (next: SurchargeRatePercents) => void;
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
  onChange
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (value: number) => void;
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
        <InputNumber
          min={0}
          step={100}
          precision={2}
          value={value}
          onChange={(next) => onChange(Number(next) || 0)}
          className="tax-estimate-view__amount-input"
        />
      </div>
    </div>
  );
}

export default function TaxEstimateView({
  data,
  loading = false,
  citRatePercent,
  onCitRateChange,
  surchargeRates,
  onSurchargeRatesChange,
  payrollAdjustment,
  onPayrollAdjustmentChange,
  onResetPayrollAdjustment
}: TaxEstimateViewProps) {
  if (!data && !loading) {
    return <Text type="secondary">请选择期间查询税费预估</Text>;
  }

  const vat = data?.vat;
  const cit = data?.cit;
  const surcharge = vat?.surcharge;
  const previousLabel = cit?.payrollAdjustment?.previousPeriodKey
    ? cit.payrollAdjustment.previousPeriodKey.replace('-', '年') + '月'
    : '';
  const surchargeTotalPercent = roundDisplayPercent(
    surchargeRates.cityPercent +
    surchargeRates.educationPercent +
    surchargeRates.localEducationPercent
  );

  const patchPayroll = (patch: Partial<CitPayrollAdjustmentValues>) => {
    onPayrollAdjustmentChange({ ...payrollAdjustment, ...patch });
  };

  return (
    <div className={`tax-estimate-view${loading ? ' tax-estimate-view--loading' : ''}`}>
      <Alert
        type="info"
        showIcon
        className="tax-estimate-view__alert"
        message="预估说明"
        description="增值税按本期销售收入凭证销项拆分；附加税按预估应交增值税匡算；企业所得税按「账面利润 − 未入账人力成本」×税率匡算。未入账人力成本可按上月默认，也可手工调整。"
      />

      <div className="tax-estimate-view__grid">
        <section className="tax-estimate-view__card">
          <div className="tax-estimate-view__title-row">
            <Title level={5} className="tax-estimate-view__title">
              应交增值税及附加（预估）
            </Title>
          </div>
          <MetricRow label="销项税额合计" value={vat?.outputTaxTotal || 0} />
          <MetricRow
            label="其中：普票销项（待减免）"
            value={vat?.ordinaryPendingTax || 0}
            hint="尚未做普票免税结转"
          />
          <MetricRow label="其中：普票销项（已减免）" value={vat?.ordinaryDoneTax || 0} />
          <MetricRow label="其中：专票销项" value={vat?.specialTax || 0} />
          <MetricRow
            label="预估应交增值税（假设普票按期减免）"
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
            hint="市区常见 7%，县城/镇 5%，其他 1%"
          />
          <MetricRow
            label={`教育费附加（${surchargeRates.educationPercent}%）`}
            value={surcharge?.educationTax || 0}
          />
          <MetricRow
            label={`地方教育附加（${surchargeRates.localEducationPercent}%）`}
            value={surcharge?.localEducationTax || 0}
          />
          <MetricRow label="预估附加税合计" value={surcharge?.total || 0} emphasize />
          <MetricRow
            label="本期已计提税金及附加（5403）"
            value={surcharge?.bookedTaxSurcharge || 0}
          />
          <MetricRow
            label="建议补提附加税"
            value={surcharge?.remainingToAccrue || 0}
            hint="预估附加税 − 已计提（不小于 0）"
          />
          <MetricRow
            label="预估增值税+附加合计（减免后）"
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
              企业所得税（预估）
            </Title>
            <Space size={6} className="tax-estimate-view__rate">
              <span>税率</span>
              <InputNumber
                min={0}
                max={100}
                step={0.5}
                precision={2}
                value={citRatePercent}
                onChange={(value) => onCitRateChange(Number(value) || 0)}
                addonAfter="%"
                className="tax-estimate-view__rate-input"
              />
            </Space>
          </div>
          <MetricRow label="本期营业收入" value={cit?.revenue || 0} />
          <MetricRow
            label="账面利润总额"
            value={cit?.bookedTotalProfit || 0}
            hint="利润表本期数，未扣未入账人力成本"
          />

          <div className="tax-estimate-view__subtitle-row tax-estimate-view__subtitle-row--inline">
            <Text strong className="tax-estimate-view__subtitle">
              未入账人力成本（可改）
            </Text>
            {onResetPayrollAdjustment ? (
              <Button type="link" size="small" onClick={onResetPayrollAdjustment}>
                恢复默认
              </Button>
            ) : null}
          </div>

          <EditableDeductionRow
            label="减：未入账应发工资"
            hint={previousLabel ? `默认取自${previousLabel}` : '暂无上月工资表'}
            value={payrollAdjustment.unbookedSalaryGross}
            onChange={(unbookedSalaryGross) => patchPayroll({ unbookedSalaryGross })}
          />
          <EditableDeductionRow
            label="减：未入账劳务应发"
            hint={previousLabel ? `默认取自${previousLabel}` : '暂无上月工资表'}
            value={payrollAdjustment.unbookedLaborGross}
            onChange={(unbookedLaborGross) => patchPayroll({ unbookedLaborGross })}
          />
          <EditableDeductionRow
            label="减：未入账公司社保"
            hint={previousLabel ? `默认取自${previousLabel}` : '暂无上月工资表'}
            value={payrollAdjustment.unbookedCompanySocialSecurity}
            onChange={(unbookedCompanySocialSecurity) =>
              patchPayroll({ unbookedCompanySocialSecurity })
            }
          />
          <EditableDeductionRow
            label="减：未入账公司公积金"
            hint={previousLabel ? `默认取自${previousLabel}` : '暂无上月工资表'}
            value={payrollAdjustment.unbookedCompanyHousingFund}
            onChange={(unbookedCompanyHousingFund) =>
              patchPayroll({ unbookedCompanyHousingFund })
            }
          />

          <MetricRow
            label="调整后利润总额（预估税基）"
            value={cit?.totalProfit || 0}
            hint={
              (cit?.payrollAdjustment?.total || 0) > 0.005
                ? `账面利润 − 未入账人力成本 ${Number(cit?.payrollAdjustment?.total || 0).toFixed(2)}`
                : '本期工资/社保公积金均已关联凭证或暂无数据'
            }
            emphasize
          />
          <MetricRow label="本年累计账面利润总额" value={cit?.bookedYtdTotalProfit || 0} />
          <MetricRow
            label="本年累计调整后利润总额"
            value={cit?.ytdTotalProfit || 0}
            hint={
              (cit?.payrollAdjustment?.ytdTotal || 0) > 0.005
                ? `已扣减本年未入账人力 ${Number(cit?.payrollAdjustment?.ytdTotal || 0).toFixed(2)}`
                : undefined
            }
          />
          <MetricRow
            label="本年累计预估所得税"
            value={cit?.ytdEstimatedTax || 0}
            hint={`max(本年累计调整后利润总额, 0) × ${citRatePercent}%`} />
          <MetricRow
            label="预估本期所得税"
            value={cit?.estimatedTax || 0}
            hint={`max(调整后利润总额, 0) × ${citRatePercent}%`}
            emphasize
          />
          <MetricRow
            label="本年度已缴纳企业所得税（5801）"
            value={cit?.ytdIncomeTaxExpense || 0}
            hint="利润表本年累计 5801"
          />
          <MetricRow
            label="建议补提金额"
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

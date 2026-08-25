import { VOUCHER_EXAMPLES } from './voucherExamples';

function dedupeOrdered(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const text = String(raw || '').trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
  }
  return out;
}

function collectSummariesFromExamples(): string[] {
  const items: string[] = [];
  for (const example of VOUCHER_EXAMPLES) {
    for (const entry of example.entries || []) {
      const text = String(entry.summary || '').trim();
      if (text) items.push(text);
    }
  }
  return items;
}

function collectRemarksFromExamples(): string[] {
  return VOUCHER_EXAMPLES.map((example) => String(example.remark || '').trim()).filter(Boolean);
}

/** 系统模板未单独列出、但保留为内置的摘要 */
const EXTRA_SUMMARY_EXAMPLES = ['期初余额', '代码助手充值'];

/** 系统内置摘要（系统记账模板 + 少量补充） */
export const STATIC_SUMMARY_EXAMPLES = dedupeOrdered([
  ...EXTRA_SUMMARY_EXAMPLES,
  ...collectSummariesFromExamples()
]);

/** 系统内置备注（来自系统记账模板） */
export const STATIC_REMARK_EXAMPLES = dedupeOrdered(collectRemarksFromExamples());

export const SUMMARY_GUIDE_RULES = [
  '第一行摘要建议写业务实质，便于查账与报表识别。',
  '同一凭证多行分录可写相同摘要，或末行写合计说明。',
  '垫付报销：摘要末尾写（姓名垫付），如（thm垫付），便于月底按人汇总。',
  '普票销项税分录摘要写「销项税额（普票）」；专票写「销项税额（专票）」。',
  '费用类可加【类别】前缀，如【办公费】、【福利费】。'
];

export const REMARK_GUIDE_RULES = [
  '备注写在凭证级，补充业务背景、审批依据或税务说明，分录摘要保持简洁。',
  '个人垫付可在备注说明垫付人及后续报销计划。',
  '工资、社保、公积金类可注明计提/发放周期。',
  '季度税费可注明所属期间与申报口径。',
  '销售收入可说明开票类型、价税分离或减免结转相关事项。'
];

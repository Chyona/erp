import type { BalanceSheetMergedRow, BalanceSheetSideRow } from '../types';

type Side = 'asset' | 'liability';

function sideFields(side: Side, row: BalanceSheetSideRow | null) {
  if (!row) {
    return {
      [`${side}Label`]: '',
      [`${side}Type`]: null,
      [`${side}Row`]: '',
      [`${side}Ending`]: null,
      [`${side}Opening`]: null,
      [`${side}EndingDraft`]: false,
      [`${side}OpeningDraft`]: false
    };
  }
  return {
    [`${side}Label`]: row.label ?? '',
    [`${side}Type`]: row.type,
    [`${side}Row`]: row.row ?? '',
    [`${side}Ending`]: row.ending ?? null,
    [`${side}Opening`]: row.opening ?? null,
    [`${side}EndingDraft`]: row.endingDraft ?? false,
    [`${side}OpeningDraft`]: row.openingDraft ?? false
  };
}

/** 在「负债合计」行后插入空白行，使负债侧与资产侧顶部对齐 */
function layoutLiabilityRows(
  assetRows: BalanceSheetSideRow[],
  liabilityRows: BalanceSheetSideRow[]
): (BalanceSheetSideRow | null)[] {
  const padCount = Math.max(0, assetRows.length - liabilityRows.length);
  if (padCount === 0) return liabilityRows;

  const splitIndex = liabilityRows.findIndex((row) => row?.key === 'liabilitiesTotal');
  if (splitIndex < 0) {
    return [...liabilityRows, ...Array(padCount).fill(null)];
  }

  return [
    ...liabilityRows.slice(0, splitIndex + 1),
    ...Array(padCount).fill(null),
    ...liabilityRows.slice(splitIndex + 1)
  ];
}

export function mergeBalanceSheetRows(
  assetRows: BalanceSheetSideRow[] = [],
  liabilityRows: BalanceSheetSideRow[] = []
): BalanceSheetMergedRow[] {
  const liabilities = layoutLiabilityRows(assetRows, liabilityRows);
  const length = Math.max(assetRows.length, liabilities.length);

  return Array.from({ length }, (_, index) => ({
    key: `balance-sheet-${index}`,
    ...sideFields('asset', assetRows[index] ?? null),
    ...sideFields('liability', liabilities[index] ?? null)
  }));
}

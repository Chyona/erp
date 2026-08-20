export const INVOICE_TYPE = {
  NONE: '',
  ORDINARY: 'ordinary',
  SPECIAL: 'special'
};

export const INVOICE_TYPE_OPTIONS = [
  { value: INVOICE_TYPE.NONE, label: '不开票' },
  { value: INVOICE_TYPE.ORDINARY, label: '普票（月底可减免结转）' },
  { value: INVOICE_TYPE.SPECIAL, label: '专票（不参与减免结转）' }
];

export const INVOICE_TYPE_LABEL = {
  [INVOICE_TYPE.NONE]: '不开票',
  [INVOICE_TYPE.ORDINARY]: '普票',
  [INVOICE_TYPE.SPECIAL]: '专票'
};

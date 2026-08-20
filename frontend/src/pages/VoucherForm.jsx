import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Alert,
  App
} from 'antd';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { Voucher } from '../services/voucher.js';
import { DB } from '../services/db.js';
import { useApp } from '../context/AppContext.jsx';
import { confirmDanger, confirmWarning } from '../utils/confirmAction.js';
import BusinessTypeHint from '../components/BusinessTypeHint.jsx';
import VoucherEntrySheet from '../components/VoucherEntrySheet.jsx';
import VoucherSheetTools from '../components/VoucherSheetTools.jsx';
import VoucherFormActions from '../components/VoucherFormActions.jsx';
import { buildAttachmentFileName } from '../utils/attachmentName.js';
import { INVOICE_TYPE, INVOICE_TYPE_OPTIONS } from '../constants/invoice.js';
import {
  expectedCarryForwardDate,
  formatStoredTaxExemptionPeriod
} from '../utils/reportPeriod.js';

const { TextArea } = Input;

const VOUCHER_TYPE = '记';
const EYE_CARE_KEY = 'voucherEyeCare';

const BUSINESS_TYPES = [
  '日常费用',
  '销售收入',
  '采购支出',
  '工资薪酬',
  '固定资产',
  '税费缴纳',
  '银行往来',
  '其他'
];

function roundMoney(n) {
  return Math.round((parseFloat(n) || 0) * 100) / 100;
}

const emptyEntry = () => ({
  key: Date.now() + Math.random(),
  summary: '',
  accountId: '',
  accountCode: '',
  accountName: '',
  debit: '',
  credit: ''
});

export default function VoucherForm() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const insertDate = searchParams.get('date');
  const insertNumber = searchParams.get('number');
  const isInsert = Boolean(!id && insertNumber);
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { message, modal } = App.useApp();
  const { accounts, refresh } = useApp();
  const [form] = Form.useForm();
  const [entries, setEntries] = useState([emptyEntry(), emptyEntry()]);
  const [attachments, setAttachments] = useState([]);
  const [attachmentPanelOpen, setAttachmentPanelOpen] = useState(false);
  const [voucherNumber, setVoucherNumber] = useState('');
  const [voucherStatus, setVoucherStatus] = useState(Voucher.STATUS.DRAFT);
  const [reviewedBy, setReviewedBy] = useState('');
  const [isRedLetter, setIsRedLetter] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [adjacent, setAdjacent] = useState({ older: null, newer: null });
  const [eyeCare, setEyeCare] = useState(() => localStorage.getItem(EYE_CARE_KEY) === '1');
  const [carryForwardPeriodLabel, setCarryForwardPeriodLabel] = useState('');

  const readOnly = isEdit && !Voucher.canEditVoucher(voucherStatus);

  const voucherDate = Form.useWatch('voucherDate', form);
  const businessType = Form.useWatch('businessType', form);
  const invoiceType = Form.useWatch('invoiceType', form);
  const signatory = Form.useWatch('signatory', form);

  const totals = useMemo(() => Voucher.calcTotals(entries), [entries]);

  useEffect(() => {
    if (!voucherDate || isEdit || isInsert) return;
    const dateStr = voucherDate.format('YYYY-MM-DD');
    Voucher.getNextNumber(VOUCHER_TYPE, dateStr).then(setVoucherNumber);
  }, [voucherDate, isEdit, isInsert]);

  useEffect(() => {
    if (!isInsert) return;
    setVoucherNumber(insertNumber);
  }, [isInsert, insertNumber]);

  useEffect(() => {
    if (!isEdit) {
      (async () => {
        const signatory = await loadDefaultSignatory();
        const presetDate =
          searchParams.get('date') && !isInsert ? dayjs(searchParams.get('date')) : null;
        form.setFieldsValue({
          voucherDate: isInsert && insertDate ? dayjs(insertDate) : presetDate || dayjs(),
          attachmentCount: 0,
          businessType: '日常费用',
          invoiceType: INVOICE_TYPE.NONE,
          taxAmount: undefined,
          signatory
        });
      })();
      return;
    }

    (async () => {
      const v = await Voucher.getById(id);
      if (!v || v.status === 'locked') {
        message.error('该凭证不可编辑');
        navigate('/vouchers');
        return;
      }
      form.setFieldsValue({
        voucherDate: dayjs(
          v.isTaxExemptionCarryForward ? expectedCarryForwardDate(v) || v.date : v.date
        ),
        attachmentCount: v.attachmentCount || 0,
        businessType: v.businessType || '其他',
        invoiceType: v.invoiceType || INVOICE_TYPE.NONE,
        taxAmount: v.taxAmount || undefined,
        invoiceNumbers: v.invoiceNumbers || '',
        remark: v.remark || '',
        signatory: v.preparedBy || v.reviewedBy || v.postedBy || v.cashierBy || ''
      });
      setVoucherNumber(v.voucherNumber);
      setVoucherStatus(v.status || Voucher.STATUS.DRAFT);
      setCarryForwardPeriodLabel(
        v.isTaxExemptionCarryForward ? formatStoredTaxExemptionPeriod(v) : ''
      );
      setReviewedBy(v.reviewedBy || v.postedBy || '');
      setIsRedLetter(Voucher.isRedLetterVoucher(v));
      setEntries(
        v.entries.map((e) => ({
          key: e.accountId + e.summary + Math.random(),
          ...e,
          debit: e.debit || '',
          credit: e.credit || ''
        }))
      );
      const atts = [];
      if (v.attachmentIds) {
        for (const attId of v.attachmentIds) {
          const att = await Voucher.getAttachment(attId);
          if (att) atts.push(att);
        }
      }
      setAttachments(atts);
      setLoading(false);
    })();
  }, [id, isEdit, form, navigate, message]);

  useEffect(() => {
    if (!isEdit || !id) {
      setAdjacent({ older: null, newer: null });
      return;
    }
    (async () => {
      const [older, newer] = await Promise.all([
        Voucher.getAdjacentVoucher(id, 'older'),
        Voucher.getAdjacentVoucher(id, 'newer')
      ]);
      setAdjacent({ older, newer });
    })();
  }, [id, isEdit]);

  const toggleEyeCare = () => {
    setEyeCare((prev) => {
      const next = !prev;
      localStorage.setItem(EYE_CARE_KEY, next ? '1' : '0');
      return next;
    });
  };

  const openVoucher = (voucher) => {
    if (!voucher) return;
    if (voucher.status === Voucher.STATUS.LOCKED) {
      message.info('已锁定凭证请在凭证列表中查看');
      return;
    }
    navigate(`/vouchers/${voucher.id}/edit`);
  };

  const updateEntry = (index, field, value) => {
    setEntries((prev) =>
      prev.map((e, i) => {
        if (i !== index) return e;
        const updated = { ...e, [field]: value };
        if (field === 'accountId') {
          const acc = accounts.find((a) => a.id === value);
          updated.accountCode = acc?.code || '';
          updated.accountName = acc?.name || '';
        }
        if (field === 'debit' && value) updated.credit = '';
        if (field === 'credit' && value) updated.debit = '';
        return updated;
      })
    );
  };

  const addEntry = () => setEntries((prev) => [...prev, emptyEntry()]);

  const insertEntryAfter = (index) => {
    setEntries((prev) => {
      const next = [...prev];
      next.splice(index + 1, 0, emptyEntry());
      return next;
    });
  };

  const copyEntry = (index) => {
    const source = entries[index];
    if (!source) return;
    setEntries((prev) => {
      const next = [...prev];
      next.splice(index + 1, 0, {
        ...source,
        key: Date.now() + Math.random()
      });
      return next;
    });
  };

  const loadDefaultSignatory = async () =>
    (await DB.getSetting('defaultSignatory')) ||
    (await DB.getSetting('defaultPreparedBy')) ||
    (await DB.getSetting('defaultReviewedBy')) ||
    '';

  const clearForm = async () => {
    const values = form.getFieldsValue();
    const hasEntries = entries.some(
      (e) => e.summary || e.accountId || e.debit || e.credit
    );
    const hasForm =
      hasEntries ||
      attachments.length > 0 ||
      values.invoiceNumbers ||
      values.remark ||
      values.taxAmount ||
      (values.businessType && values.businessType !== '日常费用') ||
      (values.invoiceType && values.invoiceType !== INVOICE_TYPE.NONE);

    if (hasForm) {
      const ok = await confirmDanger(modal, {
        title: '确定清除全部内容？',
        content: '将清除分录明细、备注、发票号码、附件及业务类型等已填内容，此操作不可撤销。',
        okText: '确定清除'
      });
      if (!ok) return;
    }

    for (const att of attachments) {
      await DB.remove('attachments', att.id);
    }

    const signatory = await loadDefaultSignatory();
    form.setFieldsValue({
      businessType: '日常费用',
      invoiceType: INVOICE_TYPE.NONE,
      taxAmount: undefined,
      invoiceNumbers: '',
      remark: '',
      attachmentCount: 0,
      signatory
    });
    setEntries([emptyEntry(), emptyEntry()]);
    setAttachments([]);
    setAttachmentPanelOpen(false);
    message.success('已清除全部内容');
  };

  const addBalancingDebitEntry = () => {
    const diff = roundMoney(totals.credit - totals.debit);
    if (diff <= 0) {
      message.info('当前无需补借方');
      return;
    }
    const acc = accounts.find((a) => a.code === '1002');
    setEntries((prev) => [
      ...prev,
      {
        key: Date.now() + Math.random(),
        summary: businessType === '销售收入' ? '收到项目款（含税）' : '银行收款',
        accountId: acc?.id || '',
        accountCode: acc?.code || '1002',
        accountName: acc?.name || '银行存款',
        debit: diff,
        credit: ''
      }
    ]);
    message.success('已添加借方分录，请核对摘要和科目');
  };

  const addBalancingCreditEntry = () => {
    const diff = roundMoney(totals.debit - totals.credit);
    if (diff <= 0) {
      message.info('当前无需补贷方');
      return;
    }
    const acc = accounts.find((a) => a.code === '1002');
    setEntries((prev) => [
      ...prev,
      {
        key: Date.now() + Math.random(),
        summary: '银行付款',
        accountId: acc?.id || '',
        accountCode: acc?.code || '1002',
        accountName: acc?.name || '银行存款',
        debit: '',
        credit: diff
      }
    ]);
    message.success('已添加贷方分录，请核对摘要和科目');
  };

  const removeEntry = async (index) => {
    if (entries.length <= 1) {
      message.error('至少保留一条分录');
      return;
    }
    const entry = entries[index];
    const hasData = entry.summary || entry.accountId || entry.debit || entry.credit;
    if (hasData) {
      const ok = await confirmDanger(modal, {
        title: '确定删除该分录？',
        content: '删除后该分录内容将无法恢复。',
        okText: '确定删除'
      });
      if (!ok) return;
    }
    setEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const removeAttachmentFromPanel = (index) => {
    if (!Voucher.canModifyAttachments(voucherStatus)) {
      message.warning(Voucher.ATTACHMENT_READONLY_TIP);
      return;
    }
    setAttachments((prev) => {
      const next = prev.filter((_, idx) => idx !== index);
      if (next.length === 0) setAttachmentPanelOpen(false);
      form.setFieldValue('attachmentCount', next.length);
      return next;
    });
  };

  const toggleAttachmentPanel = () => {
    if (attachments.length === 0) return;
    setAttachmentPanelOpen((open) => !open);
  };

  const getAttachmentNameContext = () => ({
    voucherNo: voucherNumber ? `${VOUCHER_TYPE}-${voucherNumber}` : `${VOUCHER_TYPE}-草稿`,
    entries,
    totals
  });

  const handleUpload = async ({ file, onSuccess, onError }) => {
    if (!Voucher.canModifyAttachments(voucherStatus)) {
      message.warning(Voucher.ATTACHMENT_READONLY_TIP);
      onError(new Error(Voucher.ATTACHMENT_READONLY_TIP));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      message.error(`${file.name} 超过 5MB 限制`);
      onError(new Error('文件过大'));
      return;
    }
    try {
      const fileName = buildAttachmentFileName({
        ...getAttachmentNameContext(),
        originalName: file.name,
        index: attachments.length
      });
      const att = await Voucher.saveAttachment(file, fileName);
      setAttachments((prev) => [...prev, att]);
      form.setFieldValue('attachmentCount', attachments.length + 1);
      setAttachmentPanelOpen(true);
      onSuccess();
    } catch (err) {
      message.error(err.message || '附件上传失败');
      onError(err);
    }
  };

  const resetForNewVoucher = async () => {
    const signatoryValue =
      form.getFieldValue('signatory')?.trim() || (await loadDefaultSignatory());
    const currentDate = form.getFieldValue('voucherDate') || dayjs();

    form.setFieldsValue({
      voucherDate: currentDate,
      businessType: '日常费用',
      invoiceType: INVOICE_TYPE.NONE,
      taxAmount: undefined,
      invoiceNumbers: '',
      remark: '',
      attachmentCount: 0,
      signatory: signatoryValue
    });
    setEntries([emptyEntry(), emptyEntry()]);
    setAttachments([]);
    setAttachmentPanelOpen(false);

    const dateStr = currentDate.format('YYYY-MM-DD');
    setVoucherNumber(await Voucher.getNextNumber(VOUCHER_TYPE, dateStr));
  };

  const save = async ({ continueNew = false } = {}) => {
    try {
      const values = await form.validateFields();
      let taxExemptionDone = false;
      let taxExemptionVoucherId = '';
      let isTaxExemptionCarryForward = false;
      let taxExemptionPeriod = '';
      let taxExemptionPeriodType = 'month';

      if (isEdit) {
        const existing = await Voucher.getById(id);
        taxExemptionDone = existing?.taxExemptionDone || false;
        taxExemptionVoucherId = existing?.taxExemptionVoucherId || '';
        isTaxExemptionCarryForward = existing?.isTaxExemptionCarryForward || false;
        taxExemptionPeriod = existing?.taxExemptionPeriod || '';
        taxExemptionPeriodType = existing?.taxExemptionPeriodType || 'month';
      }

      const voucherData = {
        id: isEdit ? id : null,
        voucherType: VOUCHER_TYPE,
        voucherNumber: isEdit ? voucherNumber : voucherNumber,
        date:
          isTaxExemptionCarryForward && taxExemptionPeriod
            ? expectedCarryForwardDate({
                taxExemptionPeriod,
                taxExemptionPeriodType
              })
            : values.voucherDate.format('YYYY-MM-DD'),
        attachmentCount: attachments.length,
        businessType: values.businessType,
        invoiceType:
          values.businessType === '销售收入'
            ? values.invoiceType || INVOICE_TYPE.NONE
            : INVOICE_TYPE.NONE,
        taxAmount:
          values.businessType === '销售收入' &&
            (values.invoiceType === INVOICE_TYPE.ORDINARY ||
              values.invoiceType === INVOICE_TYPE.SPECIAL)
            ? roundMoney(values.taxAmount)
            : 0,
        taxExemptionDone,
        taxExemptionVoucherId,
        isTaxExemptionCarryForward,
        taxExemptionPeriod,
        taxExemptionPeriodType,
        entries,
        invoiceNumbers: values.invoiceNumbers?.trim() || '',
        remark: values.remark?.trim() || '',
        attachmentIds: attachments.map((a) => a.id),
        preparedBy: values.signatory?.trim() || '',
        reviewedBy: values.signatory?.trim() || '',
        postedBy: values.signatory?.trim() || '',
        cashierBy: values.signatory?.trim() || ''
      };

      const finalVoucherNo = `${VOUCHER_TYPE}-${voucherNumber}`;
      const renamedAttachments = await Promise.all(
        attachments.map((att, index) => {
          const name = buildAttachmentFileName({
            voucherNo: finalVoucherNo,
            entries,
            totals,
            originalName: att.name,
            index
          });
          if (att.name === name) return att;
          return Voucher.updateAttachment({ ...att, name });
        })
      );
      voucherData.attachmentIds = renamedAttachments.map((a) => a.id);
      setAttachments(renamedAttachments);

      const saved = await Voucher.save(voucherData, false);
      message.success(`${saved.voucherNo} 保存成功`);
      refresh();

      if (continueNew) {
        const dateStr = values.voucherDate.format('YYYY-MM-DD');
        if (isEdit) {
          navigate(`/vouchers/new?date=${dateStr}`);
        } else {
          await resetForNewVoucher();
        }
        return;
      }

      navigate('/vouchers');
    } catch (err) {
      message.error(err.message || '保存失败');
    }
  };

  const applyExample = (example) => {
    form.setFieldsValue({
      businessType: example.businessType,
      invoiceType: example.invoiceType || INVOICE_TYPE.NONE,
      taxAmount: example.taxAmount,
      remark: example.remark || '',
      invoiceNumbers: example.invoiceNumbers || ''
    });
    setEntries(
      example.entries.map((e, i) => {
        const acc = accounts.find((a) => a.code === e.accountCode);
        return {
          key: `${example.key || example.id}-${i}-${Date.now()}`,
          summary: e.summary,
          accountId: acc?.id || '',
          accountCode: acc?.code || e.accountCode,
          accountName: acc?.name || '',
          debit: e.debit || '',
          credit: e.credit || ''
        };
      })
    );
  };

  const getTemplateSnapshot = () => {
    const values = form.getFieldsValue();
    return {
      businessType: values.businessType,
      invoiceType: values.invoiceType,
      taxAmount: values.taxAmount,
      remark: values.remark || '',
      invoiceNumbers: values.invoiceNumbers || '',
      entries: entries.map((e) => ({
        summary: e.summary || '',
        accountCode: e.accountCode || '',
        debit: e.debit || '',
        credit: e.credit || ''
      }))
    };
  };

  const handleUnapprove = async () => {
    if (!isEdit || voucherStatus !== Voucher.STATUS.APPROVED) return;
    const ok = await confirmWarning(modal, {
      title: '反审核',
      content: `确定将凭证 ${VOUCHER_TYPE}-${voucherNumber} 改回草稿？反审核后可继续编辑。`,
      okText: '反审核'
    });
    if (!ok) return;
    try {
      const updated = await Voucher.unapprove(id);
      setVoucherStatus(updated.status);
      setReviewedBy('');
      message.success('已反审核，凭证已改回草稿');
      refresh();
    } catch (err) {
      message.error(err.message || '反审核失败');
    }
  };

  const formActions = (
    <VoucherFormActions
      readOnly={readOnly}
      canUnapprove={isEdit && voucherStatus === Voucher.STATUS.APPROVED}
      accounts={accounts}
      onSave={() => save()}
      onSaveAndNew={() => save({ continueNew: true })}
      onCancel={() => navigate('/vouchers')}
      onUnapprove={handleUnapprove}
      onApplyExample={applyExample}
      getTemplateSnapshot={getTemplateSnapshot}
    />
  );

  const sheetTools = (
    <VoucherSheetTools
      eyeCare={eyeCare}
      onEyeCareToggle={toggleEyeCare}
      onPrev={() => openVoucher(adjacent.older)}
      onNext={() => openVoucher(adjacent.newer)}
      hasPrev={Boolean(adjacent.older)}
      hasNext={Boolean(adjacent.newer)}
    />
  );

  const footerActions = !readOnly ? (
    <VoucherFormActions
      readOnly={readOnly}
      variant="footer"
      onSave={() => save()}
      onSaveAndNew={() => save({ continueNew: true })}
    />
  ) : null;

  return (
    <div
      className={`page-form-layout voucher-form-page${eyeCare ? ' voucher-form-page--eye-care' : ''}`}
    >
      <div className="page-header voucher-form-page__toolbar">
        <div className="voucher-form-page__toolbar-start">{formActions}</div>
        <div className="voucher-form-page__toolbar-end">
          {sheetTools}
        </div>
      </div>

      <div className="page-form-body">
        <Card loading={loading} className={`voucher-form-card${readOnly ? ' voucher-form-card--readonly' : ''}`}>
          <Form form={form} layout="vertical" className="voucher-form">
            <Form.Item name="voucherDate" hidden rules={[{ required: true, message: '请选择日期' }]}>
              <DatePicker />
            </Form.Item>
            <Form.Item name="signatory" hidden>
              <Input />
            </Form.Item>
            <Form.Item name="attachmentCount" hidden>
              <InputNumber />
            </Form.Item>

            <VoucherEntrySheet
              voucherType={VOUCHER_TYPE}
              voucherNumber={voucherNumber}
              voucherDate={voucherDate}
              onDateChange={(d) => form.setFieldValue('voucherDate', d)}
              accountingPeriodLabel={carryForwardPeriodLabel}
              dateReadOnly={Boolean(carryForwardPeriodLabel)}
              entries={entries}
              accounts={accounts}
              totals={totals}
              attachments={attachments}
              attachmentsCount={attachments.length}
              signatory={signatory || ''}
              onSignatoryChange={(v) => form.setFieldValue('signatory', v)}
              onUpdateEntry={updateEntry}
              onInsertEntryAfter={insertEntryAfter}
              onCopyEntry={copyEntry}
              onRemoveEntry={removeEntry}
              onUpload={handleUpload}
              onRemoveAttachment={removeAttachmentFromPanel}
              canModifyAttachments={Voucher.canModifyAttachments(voucherStatus)}
              readOnly={readOnly}
              redLetter={isRedLetter}
              reviewedBy={reviewedBy}
              attachmentPanelOpen={attachmentPanelOpen}
              onAttachmentPanelClose={() => setAttachmentPanelOpen(false)}
              onAttachmentPanelToggle={toggleAttachmentPanel}
              footerActions={footerActions}
              businessTypeField={
                <Space size={4} className="voucher-sheet__meta-field">
                  <span className="voucher-sheet__meta-label">
                    业务类型
                    <BusinessTypeHint />
                  </span>
                  <Form.Item name="businessType" noStyle>
                    <Select
                      style={{ width: 132 }}
                      disabled={readOnly}
                      options={BUSINESS_TYPES.map((t) => ({ value: t, label: t }))}
                    />
                  </Form.Item>
                </Space>
              }
            />

            {!readOnly && !totals.balanced && (totals.debit > 0 || totals.credit > 0) && (
              <Alert
                type="error"
                showIcon
                style={{ margin: '12px 0' }}
                message={`借贷不平衡，差额：${Math.abs(totals.debit - totals.credit).toFixed(2)}`}
                action={
                  totals.credit > totals.debit ? (
                    <Button size="small" type="primary" ghost onClick={addBalancingDebitEntry}>
                      补借方（银行存款）
                    </Button>
                  ) : totals.debit > totals.credit ? (
                    <Button size="small" type="primary" ghost onClick={addBalancingCreditEntry}>
                      补贷方（银行存款）
                    </Button>
                  ) : null
                }
              />
            )}

            <div className="voucher-form__extra">
              {businessType === '销售收入' && (
                <>
                  <Form.Item
                    name="invoiceType"
                    label="开票类型"
                    initialValue={INVOICE_TYPE.NONE}
                  >
                    <Select options={INVOICE_TYPE_OPTIONS} disabled={readOnly} />
                  </Form.Item>
                  {(invoiceType === INVOICE_TYPE.ORDINARY ||
                    invoiceType === INVOICE_TYPE.SPECIAL) && (
                    <Form.Item
                      name="taxAmount"
                      label="增值税额"
                      rules={[{ required: true, message: '请填写增值税额' }]}
                    >
                      <InputNumber
                        min={0}
                        precision={2}
                        style={{ width: '100%' }}
                        placeholder="0.00"
                        disabled={readOnly}
                      />
                    </Form.Item>
                  )}
                </>
              )}
              <Form.Item name="invoiceNumbers" label="发票/单据号码">
                <Input placeholder="多个号码用逗号分隔" readOnly={readOnly} />
              </Form.Item>
              <Form.Item name="remark" label="备注">
                <TextArea
                  rows={2}
                  placeholder="补充说明业务背景，便于税务核查"
                  readOnly={readOnly}
                />
              </Form.Item>
            </div>
          </Form>
        </Card>
      </div>
    </div>
  );
}

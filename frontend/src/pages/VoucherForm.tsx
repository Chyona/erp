import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  App,
  Tooltip
} from 'antd';
import { useAsyncLoading } from '../hooks/useAsyncLoading';
import { disableFutureDate } from '../utils/dateConstraints';
import { useNavigate, useParams, useSearchParams, useLocation, Navigate } from 'react-router-dom';
import dayjs from '../utils/dayjsSetup';
import { Voucher, isNewVoucherNav } from '../services/voucher';
import type { VoucherFormNavTarget } from '../services/voucher';
import type { Attachment, VoucherStatus } from '../types';
import { ErpApi } from '../services/erpApi';
import { useApp } from '../context/AppContext';
import { getCurrentOperatorName, useAuth } from '../context/AuthContext';
import { confirmDanger, confirmWarning } from '../utils/confirmAction';
import BusinessTypeHint from '../components/BusinessTypeHint';
import VoucherEntrySheet from '../components/VoucherEntrySheet';
import VoucherSheetTools from '../components/VoucherSheetTools';
import VoucherFormActions from '../components/VoucherFormActions';
import VoucherExamples from '../components/VoucherExamples';
import {
  buildAttachmentDisplayName,
  enrichAttachmentDisplayNames
} from '../utils/attachmentName';
import { isInvoiceRecognizableFile, mergeInvoiceNumbers } from '../utils/invoiceNumberExtract';
import { recognizeInvoiceNumbersFromFile } from '../services/invoiceNumberRecognition';
import { syncSalesVoucherMeta } from '../utils/salesInvoiceTax';
import { INVOICE_TYPE, INVOICE_TYPE_OPTIONS } from '../constants/invoice';
import { isCarryForwardVoucher, CARRY_FORWARD_VOUCHER_READONLY_TIP } from '../utils/carryForwardVoucher';
import {
  expectedCarryForwardDate,
  expectedProfitLossClosingDate,
  formatStoredProfitLossClosingPeriod,
  formatStoredTaxExemptionPeriod
} from '../utils/reportPeriod';

const { TextArea } = Input;

const VOUCHER_TYPE = '记';
const EYE_CARE_KEY = 'voucherEyeCare';
const FULLSCREEN_KEY = 'voucherFullscreen';
const SAVE_MSG_KEY = 'voucher-save';

type VoucherNavState = {
  skipInit?: boolean;
  voucher?: Awaited<ReturnType<typeof Voucher.getById>>;
  mode?: 'new';
  presetDate?: string;
};

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

type FormEntry = {
  key: number;
  summary: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  debit: string | number;
  credit: string | number;
};

const emptyEntry = (): FormEntry => ({
  key: Date.now() + Math.random(),
  summary: '',
  accountId: '',
  accountCode: '',
  accountName: '',
  debit: '',
  credit: ''
});

export default function VoucherForm() {
  const { id: routeId } = useParams();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const insertDate = searchParams.get('date');
  const insertNumber = searchParams.get('number');
  const isInsert = Boolean(!routeId && insertNumber);
  const urlPresetDate = searchParams.get('date');
  const initKey = routeId
    ? `edit:${routeId}`
    : isInsert
      ? `insert:${insertDate ?? ''}:${insertNumber ?? ''}`
      : `new:${urlPresetDate ?? ''}`;
  const initializedKeyRef = useRef<string | null>(null);
  const skipPageInitRef = useRef(false);
  const savedSnapshotRef = useRef<string | null>(null);
  const [snapshotVersion, setSnapshotVersion] = useState(0);
  const bumpSnapshotBaseline = useCallback(() => {
    setSnapshotVersion((v) => v + 1);
  }, []);
  const navigate = useNavigate();
  const { message, modal } = App.useApp();
  const { accounts, refresh } = useApp();
  const { user, canAccessOwnVoucher, canMutateVoucher } = useAuth();
  const [form] = Form.useForm();
  const [editingId, setEditingId] = useState<string | null>(routeId ?? null);
  const isEdit = editingId !== null;
  const [entries, setEntries] = useState<FormEntry[]>([emptyEntry(), emptyEntry()]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachmentPanelOpen, setAttachmentPanelOpen] = useState(false);
  const attachmentsRef = useRef<Attachment[]>([]);
  const uploadQueueRef = useRef(Promise.resolve());
  const uploadToastRef = useRef({ count: 0, timer: 0 as ReturnType<typeof setTimeout> | 0 });
  const uploadBusyCountRef = useRef(0);
  const [attachmentUploadStatus, setAttachmentUploadStatus] = useState<string | null>(null);
  attachmentsRef.current = attachments;
  const [voucherNumber, setVoucherNumber] = useState('');
  const [voucherStatus, setVoucherStatus] = useState<VoucherStatus>(Voucher.STATUS.DRAFT);
  const [reviewedBy, setReviewedBy] = useState('');
  const [isRedLetter, setIsRedLetter] = useState(false);
  const [loading, setLoading] = useState(Boolean(routeId));
  const [adjacent, setAdjacent] = useState<{
    older: Awaited<ReturnType<typeof Voucher.getById>> | null;
    newer: VoucherFormNavTarget | null;
  }>({ older: null, newer: null });
  const [eyeCare, setEyeCare] = useState(() => localStorage.getItem(EYE_CARE_KEY) === '1');
  const [fullscreen, setFullscreen] = useState(() => localStorage.getItem(FULLSCREEN_KEY) === '1');
  const [carryForwardPeriodLabel, setCarryForwardPeriodLabel] = useState('');
  const [carryForwardReadOnly, setCarryForwardReadOnly] = useState(false);
  const [saving, setSaving] = useState(false);
  const { loading: unapproving, run: runUnapprove } = useAsyncLoading();

  const readOnly =
    user?.role === 'readonly' ||
    (isEdit && (carryForwardReadOnly || !Voucher.canEditVoucher(voucherStatus)));

  if (!isEdit && user?.role === 'readonly') {
    return <Navigate to="/" replace />;
  }

  const voucherDate = Form.useWatch('voucherDate', form);
  const businessType = Form.useWatch('businessType', form);
  const invoiceType = Form.useWatch('invoiceType', form);
  const signatory = Form.useWatch('signatory', form);

  const totals = useMemo(() => Voucher.calcTotals(entries), [entries]);

  const buildFormSnapshot = useCallback(() => {
    const values = form.getFieldsValue();
    const normAmount = (v: unknown) => {
      const n = parseFloat(String(v));
      return Number.isFinite(n) && n > 0 ? String(Math.round(n * 100) / 100) : '';
    };
    return JSON.stringify({
      voucherDate: values.voucherDate?.format?.('YYYY-MM-DD') ?? '',
      businessType: values.businessType ?? '',
      invoiceType: values.invoiceType ?? '',
      taxAmount: normAmount(values.taxAmount),
      invoiceNumbers: String(values.invoiceNumbers ?? '').trim(),
      remark: String(values.remark ?? '').trim(),
      signatory: String(values.signatory ?? '').trim(),
      voucherNumber,
      entries: entries.map((e) => ({
        summary: e.summary || '',
        accountId: e.accountId || '',
        debit: normAmount(e.debit),
        credit: normAmount(e.credit)
      })),
      attachmentIds: attachments.map((a) => a.id).sort()
    });
  }, [form, voucherNumber, entries, attachments]);

  const hasUnsavedChanges = useCallback(() => {
    if (savedSnapshotRef.current === null) return false;
    return buildFormSnapshot() !== savedSnapshotRef.current;
  }, [buildFormSnapshot]);

  const markFormSaved = useCallback(() => {
    savedSnapshotRef.current = buildFormSnapshot();
  }, [buildFormSnapshot]);

  useEffect(() => {
    markFormSaved();
    // 仅在翻页/加载后 bumpSnapshotBaseline 时重设基线，避免编辑过程中误重置
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshotVersion]);

  const refreshFormAdjacent = useCallback(async (currentId: string | null) => {
    const next = await Voucher.getFormAdjacent(currentId);
    setAdjacent(next);
  }, []);

  const loadDefaultSignatory = async () => getCurrentOperatorName();

  const applyVoucherToForm = useCallback(
    async (v: NonNullable<Awaited<ReturnType<typeof Voucher.getById>>>) => {
      if (!v || v.status === 'locked') {
        message.error('该凭证不可编辑');
        return false;
      }
      if (!canAccessOwnVoucher(v)) {
        message.error('无权查看该凭证');
        return false;
      }
      if (!canMutateVoucher(v) && v.status === Voucher.STATUS.DRAFT) {
        message.error(
          v.createdByAccountId
            ? '无权修改他人的凭证'
            : '该凭证为历史数据、无归属人，仅管理员可修改'
        );
        return false;
      }

      setCarryForwardReadOnly(false);
      setCarryForwardPeriodLabel('');
      if (isCarryForwardVoucher(v)) {
        setCarryForwardReadOnly(true);
        message.warning(CARRY_FORWARD_VOUCHER_READONLY_TIP);
      }

      form.setFieldsValue({
        voucherDate: dayjs(
          v.isTaxExemptionCarryForward
            ? expectedCarryForwardDate(v) || v.date
            : v.isProfitLossClosing
              ? expectedProfitLossClosingDate(v) || v.date
              : v.date
        ),
        attachmentCount: v.attachmentCount || 0,
        businessType: v.businessType || '其他',
        invoiceType: v.invoiceType || INVOICE_TYPE.NONE,
        taxAmount: v.taxAmount || undefined,
        invoiceNumbers: v.invoiceNumbers || '',
        remark: v.remark || '',
        signatory: v.preparedBy || v.reviewedBy || v.postedBy || v.cashierBy || ''
      });
      setEditingId(v.id);
      setVoucherNumber(v.voucherNumber);
      setVoucherStatus(v.status || Voucher.STATUS.DRAFT);
      setCarryForwardPeriodLabel(
        v.isTaxExemptionCarryForward
          ? formatStoredTaxExemptionPeriod(v)
          : v.isProfitLossClosing
            ? formatStoredProfitLossClosingPeriod(v)
            : ''
      );
      setReviewedBy(v.reviewedBy || v.postedBy || '');
      setIsRedLetter(Voucher.isRedLetterVoucher(v));
      setEntries(
        v.entries.map((e) => ({
          key: Date.now() + Math.random(),
          summary: e.summary || '',
          accountId: e.accountId || '',
          accountCode: e.accountCode || '',
          accountName: e.accountName || '',
          debit: e.debit || '',
          credit: e.credit || ''
        }))
      );
      const atts: Attachment[] = [];
      if (v.attachmentIds) {
        for (const attId of v.attachmentIds) {
          const att = await Voucher.getAttachment(attId);
          if (att) atts.push(att);
        }
      }
      setAttachments(atts);
      attachmentsRef.current = atts;
      setAttachmentPanelOpen(false);
      await refreshFormAdjacent(v.id);
      bumpSnapshotBaseline();
      return true;
    },
    [
      bumpSnapshotBaseline,
      canAccessOwnVoucher,
      canMutateVoucher,
      form,
      message,
      refreshFormAdjacent
    ]
  );

  const applyNewVoucherForm = useCallback(
    async (options: { presetDate?: string; keepDate?: ReturnType<typeof dayjs> } = {}) => {
      const signatory = await loadDefaultSignatory();
      const presetDate =
        options.presetDate && !isInsert ? dayjs(options.presetDate) : null;
      const nextDate =
        options.keepDate ||
        (isInsert && insertDate ? dayjs(insertDate) : null) ||
        presetDate ||
        dayjs();

      form.setFieldsValue({
        voucherDate: nextDate,
        attachmentCount: 0,
        businessType: '日常费用',
        invoiceType: INVOICE_TYPE.NONE,
        taxAmount: undefined,
        invoiceNumbers: '',
        remark: '',
        signatory
      });
      setEditingId(null);
      setEntries([emptyEntry(), emptyEntry()]);
      setAttachments([]);
      attachmentsRef.current = [];
      setAttachmentPanelOpen(false);
      setVoucherStatus(Voucher.STATUS.DRAFT);
      setReviewedBy('');
      setIsRedLetter(false);
      setCarryForwardPeriodLabel('');
      setCarryForwardReadOnly(false);
      if (!isInsert) {
        const dateStr = nextDate.format('YYYY-MM-DD');
        setVoucherNumber(await Voucher.getNextNumber(VOUCHER_TYPE, dateStr));
      }
      await refreshFormAdjacent(null);
      bumpSnapshotBaseline();
    },
    [bumpSnapshotBaseline, form, insertDate, isInsert, refreshFormAdjacent]
  );

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
    const navState = location.state as VoucherNavState | null;
    if (navState?.skipInit) {
      skipPageInitRef.current = true;
      initializedKeyRef.current = initKey;
      (async () => {
        try {
          if (navState.mode === 'new') {
            await applyNewVoucherForm({ presetDate: navState.presetDate });
          } else if (navState.voucher) {
            await applyVoucherToForm(navState.voucher);
          }
        } finally {
          navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
          skipPageInitRef.current = false;
        }
      })();
      return;
    }

    if (skipPageInitRef.current) {
      initializedKeyRef.current = initKey;
      return;
    }
    if (initializedKeyRef.current === initKey) return;
    initializedKeyRef.current = initKey;
    setLoading(true);

    if (!routeId) {
      (async () => {
        try {
          await applyNewVoucherForm({ presetDate: urlPresetDate || undefined });
        } finally {
          setLoading(false);
        }
      })();
      return;
    }

    (async () => {
      try {
        const v = await Voucher.getById(routeId);
        if (!v) {
          message.error('凭证不存在');
          navigate('/vouchers');
          return;
        }
        const ok = await applyVoucherToForm(v);
        if (!ok) {
          navigate('/vouchers');
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [initKey]);

  const toggleEyeCare = () => {
    setEyeCare((prev) => {
      const next = !prev;
      localStorage.setItem(EYE_CARE_KEY, next ? '1' : '0');
      return next;
    });
  };

  const toggleFullscreen = () => {
    setFullscreen((prev) => {
      const next = !prev;
      localStorage.setItem(FULLSCREEN_KEY, next ? '1' : '0');
      return next;
    });
  };

  const confirmDiscardIfDirty = useCallback(async () => {
    if (!hasUnsavedChanges()) return true;
    return confirmWarning(modal, {
      title: '系统提示',
      content: '您有未保存的凭证修改，离开后内容将丢失。确认要离开吗？',
      okText: '确认离开'
    });
  }, [hasUnsavedChanges, modal]);

  const openNewVoucher = useCallback(
    async (presetDate?: string) => {
      if (!(await confirmDiscardIfDirty())) return;
      skipPageInitRef.current = true;
      const path = presetDate ? `/vouchers/new?date=${presetDate}` : '/vouchers/new';
      const willRemount = Boolean(routeId);
      navigate(path, {
        replace: true,
        state: willRemount ? { skipInit: true, mode: 'new', presetDate } : null
      });
      if (!willRemount) {
        await applyNewVoucherForm({ presetDate });
        initializedKeyRef.current = presetDate ? `new:${presetDate}` : 'new:';
      }
      skipPageInitRef.current = false;
    },
    [applyNewVoucherForm, confirmDiscardIfDirty, navigate, routeId]
  );

  const openVoucher = useCallback(
    async (target: VoucherFormNavTarget | null) => {
      if (!target) return;
      if (isNewVoucherNav(target)) {
        await openNewVoucher();
        return;
      }
      if (target.status === Voucher.STATUS.LOCKED) {
        message.info('已结项凭证请在凭证列表中查看');
        return;
      }
      if (!(await confirmDiscardIfDirty())) return;

      skipPageInitRef.current = true;
      if (target.id !== editingId) {
        const willRemount = !routeId;
        navigate(`/vouchers/${target.id}/edit`, {
          replace: true,
          state: willRemount ? { skipInit: true, voucher: target } : null
        });
        if (willRemount) {
          skipPageInitRef.current = false;
          return;
        }
      }
      const ok = await applyVoucherToForm(target);
      if (!ok) {
        skipPageInitRef.current = false;
        return;
      }
      initializedKeyRef.current = `edit:${target.id}`;
      skipPageInitRef.current = false;
    },
    [
      applyVoucherToForm,
      confirmDiscardIfDirty,
      editingId,
      message,
      navigate,
      openNewVoucher,
      routeId
    ]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (loading || saving) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === 'ArrowLeft' && adjacent.older) {
        e.preventDefault();
        openVoucher(adjacent.older);
      } else if (e.key === 'ArrowRight' && adjacent.newer) {
        e.preventDefault();
        openVoucher(adjacent.newer);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [adjacent, loading, openVoucher, saving]);

  const updateEntry = (index, field, value) => {
    setEntries((prev) => {
      const next = [...prev];
      while (next.length <= index) {
        next.push(emptyEntry());
      }
      return next.map((e, i) => {
        if (i !== index) return e;
        let fieldValue = value;
        if (field === 'debit' || field === 'credit') {
          const n = parseFloat(String(value));
          fieldValue =
            value === '' || value === undefined || value === null
              ? ''
              : Number.isFinite(n) && n > 0
                ? Math.round(n * 100) / 100
                : '';
        }
        const updated = { ...e, [field]: fieldValue };
        if (field === 'accountId') {
          const acc = accounts.find((a) => a.id === value);
          updated.accountCode = acc?.code || '';
          updated.accountName = acc?.name || '';
        }
        if (field === 'debit' && fieldValue) updated.credit = '';
        if (field === 'credit' && fieldValue) updated.debit = '';
        return updated;
      });
    });
  };

  const addEntry = () => setEntries((prev) => [...prev, emptyEntry()]);

  const insertEntryAfter = (index) => {
    setEntries((prev) => {
      const next = [...prev];
      next.splice(index + 1, 0, emptyEntry());
      return next;
    });
  };

  const copyEntry = (index: number) => {
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

  const ensureEntryAt = (index: number) => {
    setEntries((prev) => {
      if (prev[index]) return prev;
      const next = [...prev];
      while (next.length <= index) {
        next.push(emptyEntry());
      }
      return next;
    });
  };

  const copyRowAt = (index: number) => {
    if (entries[index]) {
      copyEntry(index);
      return;
    }
    const source = index > 0 ? entries[index - 1] : null;
    if (!source) {
      ensureEntryAt(index);
      return;
    }
    setEntries((prev) => {
      const next = [...prev];
      while (next.length < index) {
        next.push(emptyEntry());
      }
      next.splice(index, 0, {
        ...source,
        key: Date.now() + Math.random()
      });
      return next;
    });
  };

  const loadDefaultSignatoryForClear = async () => getCurrentOperatorName();

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

    if (attachments.length) {
      await ErpApi.removeMany(
        'attachments',
        attachments.map((att) => att.id)
      );
    }

    const signatory = await loadDefaultSignatoryForClear();
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
    markFormSaved();
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

  const removeEntry = (index: number) => {
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

  const removeAttachmentsFromPanel = (indices: number[]) => {
    if (!Voucher.canModifyAttachments(voucherStatus)) {
      message.warning(Voucher.ATTACHMENT_READONLY_TIP);
      return;
    }
    const removeSet = new Set(indices || []);
    setAttachments((prev) => {
      const next = prev.filter((_, idx) => !removeSet.has(idx));
      if (next.length === 0) setAttachmentPanelOpen(false);
      form.setFieldValue('attachmentCount', next.length);
      return next;
    });
  };

  const toggleAttachmentPanel = () => {
    if (attachments.length === 0) return;
    setAttachmentPanelOpen((open) => !open);
  };

  const attachmentNameContext = useMemo(
    () => ({
      voucherNo: voucherNumber ? `${VOUCHER_TYPE}-${voucherNumber}` : `${VOUCHER_TYPE}-草稿`,
      entries,
      totals
    }),
    [voucherNumber, entries, totals]
  );

  const displayAttachments = useMemo(
    () => enrichAttachmentDisplayNames(attachmentNameContext, attachments),
    [attachmentNameContext, attachments]
  );

  const getAttachmentNameContext = () => attachmentNameContext;

  const tryAutoRecognizeInvoiceNumber = async (
    file: File
  ): Promise<{ numbers: string[]; hint?: string }> => {
    if (readOnly || !isInvoiceRecognizableFile(file)) {
      return { numbers: [] };
    }
    try {
      const numbers = await recognizeInvoiceNumbersFromFile(file);
      if (!numbers.length) {
        return { numbers: [], hint: '未识别到发票号码，请手动填写' };
      }
      return { numbers };
    } catch (err) {
      return {
        numbers: [],
        hint: (err as Error)?.message || '发票号识别失败，请手动填写'
      };
    }
  };

  const beginAttachmentUploadStatus = (text: string) => {
    uploadBusyCountRef.current += 1;
    setAttachmentUploadStatus(text);
  };

  const updateAttachmentUploadStatus = (text: string) => {
    if (uploadBusyCountRef.current > 0) setAttachmentUploadStatus(text);
  };

  const endAttachmentUploadStatus = () => {
    uploadBusyCountRef.current = Math.max(0, uploadBusyCountRef.current - 1);
    if (uploadBusyCountRef.current === 0) setAttachmentUploadStatus(null);
  };

  const handleUpload = ({ file, onSuccess, onError }) => {
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

    const noteSuccess = (recognized: string[] = [], hint?: string, invoiceLike = false) => {
      uploadToastRef.current.count += 1;
      if (uploadToastRef.current.timer) clearTimeout(uploadToastRef.current.timer);
      uploadToastRef.current.timer = setTimeout(() => {
        const n = uploadToastRef.current.count;
        uploadToastRef.current.count = 0;
        uploadToastRef.current.timer = 0;
        if (n <= 0) return;
        if (recognized.length > 0) {
          message.success(
            n > 1
              ? `已上传 ${n} 个附件，已识别发票号 ${recognized.join(', ')}`
              : `附件上传成功，已识别发票号 ${recognized.join(', ')}`
          );
          return;
        }
        if (hint && invoiceLike) {
          message.warning(n > 1 ? `已上传 ${n} 个附件，${hint}` : `附件上传成功，${hint}`);
          return;
        }
        message.success(n > 1 ? `已上传 ${n} 个附件` : '附件上传成功');
      }, 280);
    };

    uploadQueueRef.current = uploadQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        const fileObj = file as File;
        const invoiceLike = isInvoiceRecognizableFile(fileObj);
        beginAttachmentUploadStatus(`正在上传 ${fileObj.name}…`);
        try {
          const fileName = buildAttachmentDisplayName({
            ...getAttachmentNameContext(),
            originalName: fileObj.name,
            index: attachmentsRef.current.length
          });
          const att = await Voucher.saveAttachment(
            fileObj,
            fileName,
            voucherDate ? voucherDate.format('YYYY-MM-DD') : undefined
          );
          if (invoiceLike) {
            updateAttachmentUploadStatus('正在识别发票号…');
          }
          const { numbers: recognized, hint } = await tryAutoRecognizeInvoiceNumber(fileObj);
          if (recognized.length) {
            const current = String(form.getFieldValue('invoiceNumbers') || '');
            form.setFieldValue('invoiceNumbers', mergeInvoiceNumbers(current, recognized));
          }
          const next = [...attachmentsRef.current, att];
          attachmentsRef.current = next;
          setAttachments(next);
          form.setFieldValue('attachmentCount', next.length);
          setAttachmentPanelOpen(true);
          noteSuccess(recognized, hint, invoiceLike);
          onSuccess();
        } finally {
          endAttachmentUploadStatus();
        }
      })
      .catch((err) => {
        endAttachmentUploadStatus();
        message.error(err?.message || '附件上传失败');
        onError(err);
      });
  };

  const resetForNewVoucher = async (keepDate = form.getFieldValue('voucherDate') || dayjs()) => {
    const signatoryValue =
      form.getFieldValue('signatory')?.trim() || (await loadDefaultSignatory());
    const currentDate = keepDate || dayjs();

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
    setEditingId(null);
    setEntries([emptyEntry(), emptyEntry()]);
    setAttachments([]);
    attachmentsRef.current = [];
    setAttachmentPanelOpen(false);
    setVoucherStatus(Voucher.STATUS.DRAFT);
    setReviewedBy('');
    setIsRedLetter(false);
    setCarryForwardPeriodLabel('');
    setCarryForwardReadOnly(false);

    const dateStr = currentDate.format('YYYY-MM-DD');
    setVoucherNumber(await Voucher.getNextNumber(VOUCHER_TYPE, dateStr));
    markFormSaved();
    await refreshFormAdjacent(null);
  };

  const save = async ({ continueNew = false } = {}) => {
    if (saving) return;
    setSaving(true);
    message.loading({ content: '正在保存…', key: SAVE_MSG_KEY, duration: 0 });
    try {
      const values = await form.validateFields();
      let taxExemptionDone = false;
      let taxExemptionVoucherId = '';
      let isTaxExemptionCarryForward = false;
      let taxExemptionPeriod = '';
      let taxExemptionPeriodType = 'month';
      let isProfitLossClosing = false;
      let profitLossClosingPeriod = '';
      let profitLossClosingPeriodType = 'month';
      let existingPreparedBy = '';

      if (isEdit) {
        const existing = await Voucher.getById(editingId);
        taxExemptionDone = existing?.taxExemptionDone || false;
        taxExemptionVoucherId = existing?.taxExemptionVoucherId || '';
        isTaxExemptionCarryForward = existing?.isTaxExemptionCarryForward || false;
        taxExemptionPeriod = existing?.taxExemptionPeriod || '';
        taxExemptionPeriodType = existing?.taxExemptionPeriodType || 'month';
        isProfitLossClosing = existing?.isProfitLossClosing || false;
        profitLossClosingPeriod = existing?.profitLossClosingPeriod || '';
        profitLossClosingPeriodType = existing?.profitLossClosingPeriodType || 'month';
        existingPreparedBy = existing?.preparedBy || '';
      }

      const inferredTax = syncSalesVoucherMeta({
        businessType: values.businessType,
        entries,
        invoiceType: values.invoiceType
      });
      const resolvedInvoiceType =
        values.businessType === '销售收入'
          ? values.invoiceType || inferredTax.invoiceType || INVOICE_TYPE.NONE
          : INVOICE_TYPE.NONE;
      const resolvedTaxAmount =
        values.businessType === '销售收入' &&
          (resolvedInvoiceType === INVOICE_TYPE.ORDINARY ||
            resolvedInvoiceType === INVOICE_TYPE.SPECIAL)
          ? roundMoney(
            values.taxAmount != null && values.taxAmount !== ''
              ? values.taxAmount
              : inferredTax.taxAmount
          )
          : 0;

      const voucherData = {
        id: isEdit ? editingId : null,
        voucherType: VOUCHER_TYPE,
        voucherNumber: isEdit ? voucherNumber : voucherNumber,
        date:
          isTaxExemptionCarryForward && taxExemptionPeriod
            ? expectedCarryForwardDate({
              taxExemptionPeriod,
              taxExemptionPeriodType
            })
            : isProfitLossClosing && profitLossClosingPeriod
              ? expectedProfitLossClosingDate({
                profitLossClosingPeriod,
                profitLossClosingPeriodType
              })
              : values.voucherDate.format('YYYY-MM-DD'),
        attachmentCount: attachments.length,
        businessType: values.businessType,
        invoiceType: resolvedInvoiceType,
        taxAmount: resolvedTaxAmount,
        taxExemptionDone,
        taxExemptionVoucherId,
        isTaxExemptionCarryForward,
        taxExemptionPeriod,
        taxExemptionPeriodType,
        isProfitLossClosing,
        profitLossClosingPeriod,
        profitLossClosingPeriodType,
        entries,
        invoiceNumbers: values.invoiceNumbers?.trim() || '',
        remark: values.remark?.trim() || '',
        attachmentIds: attachments.map((a) => a.id),
        preparedBy:
          existingPreparedBy.trim() ||
          values.signatory?.trim() ||
          getCurrentOperatorName()
      };

      const saved = await Voucher.save(voucherData, false);
      message.success({ content: `${saved.voucherNo} 保存成功`, key: SAVE_MSG_KEY });

      if (continueNew) {
        const keepDate = values.voucherDate;
        if (isEdit) {
          initializedKeyRef.current = null;
          skipPageInitRef.current = true;
          navigate(`/vouchers/new?date=${keepDate.format('YYYY-MM-DD')}`, {
            replace: true,
            state: { skipInit: true, mode: 'new', presetDate: keepDate.format('YYYY-MM-DD') }
          });
        }
        await resetForNewVoucher(keepDate);
        refresh();
        return;
      }

      navigate('/vouchers', { replace: true });
      refresh();
    } catch (err) {
      if ((err as { errorFields?: unknown[] })?.errorFields) {
        message.destroy(SAVE_MSG_KEY);
        return;
      }
      message.error({ content: (err as Error).message || '保存失败', key: SAVE_MSG_KEY });
    } finally {
      setSaving(false);
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
    if (!isEdit || !editingId || voucherStatus !== Voucher.STATUS.APPROVED) return;
    const ok = await confirmWarning(modal, {
      title: '反审核',
      content: `确定将凭证 ${VOUCHER_TYPE}-${voucherNumber} 改回草稿？反审核后可继续编辑。`,
      okText: '反审核'
    });
    if (!ok) return;
    await runUnapprove(async () => {
      try {
        const updated = await Voucher.unapprove(editingId);
        setVoucherStatus(updated.status);
        setReviewedBy('');
        message.success('已反审核，凭证已改回草稿');
        refresh();
      } catch (err) {
        message.error((err as Error).message || '反审核失败');
      }
    });
  };

  const formActions = (
    <VoucherFormActions
      readOnly={readOnly}
      canUnapprove={isEdit && voucherStatus === Voucher.STATUS.APPROVED}
      saving={saving}
      unapproving={unapproving}
      onSave={() => save()}
      onSaveAndNew={() => save({ continueNew: true })}
      onCancel={() => navigate('/vouchers')}
      onUnapprove={handleUnapprove}
    />
  );

  const sheetTools = (
    <VoucherSheetTools
      eyeCare={eyeCare}
      onEyeCareToggle={toggleEyeCare}
      fullscreen={fullscreen}
      onFullscreenToggle={toggleFullscreen}
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
      saving={saving}
      unapproving={unapproving}
      onSave={() => save()}
      onSaveAndNew={() => save({ continueNew: true })}
    />
  ) : null;

  return (
    <div
      className={`page-form-layout voucher-form-page${eyeCare ? ' voucher-form-page--eye-care' : ''}${fullscreen ? ' voucher-form-page--fullscreen' : ''}`}
    >
      {/* <div className="page-header voucher-form-page__toolbar">
        <div className="voucher-form-page__toolbar-start">{formActions}</div>
      </div> */}

      <div className="page-form-body">
        <Card loading={loading} className={`voucher-form-card ${readOnly ? ' voucher-form-card--readonly' : ''}`}>
          {carryForwardReadOnly ? (
            <Alert
              type="info"
              showIcon
              message={CARRY_FORWARD_VOUCHER_READONLY_TIP}
              style={{ marginBottom: 16 }}
            />
          ) : null}
          <div className="voucher-form__toolbar">
            <div className="voucher-form__toolbar-right-side">
              {formActions}
            </div>
            <div className="voucher-form__toolbar-left-side">
              {!readOnly ? (
                <>
                  <Tooltip title="辅助填单">
                    <VoucherExamples
                      accounts={accounts}
                      onApply={applyExample}
                      getSnapshot={getTemplateSnapshot}
                    />
                  </Tooltip>
                  <span className="voucher-form__toolbar-divider" aria-hidden="true" />
                </>
              ) : null}
              {sheetTools}
            </div>
          </div>
          <Form form={form} layout="vertical" className="voucher-form">
            <Form.Item name="voucherDate" hidden rules={[{ required: true, message: '请选择日期' }]}>
              <DatePicker disabledDate={disableFutureDate} />
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
              attachments={displayAttachments}
              attachmentsCount={attachments.length}
              signatory={signatory || ''}
              onUpdateEntry={updateEntry}
              onInsertEntryAfter={insertEntryAfter}
              onCopyEntry={copyRowAt}
              onEnsureEntry={ensureEntryAt}
              onRemoveEntry={removeEntry}
              onUpload={handleUpload}
              uploadStatus={attachmentUploadStatus}
              onRemoveAttachment={removeAttachmentFromPanel}
              onRemoveAttachments={removeAttachmentsFromPanel}
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

            <div className="voucher-form__extra">
              <div className="voucher-form__extra-col">
                <Form.Item name="invoiceNumbers" label="发票号">
                  <Input
                    placeholder="上传发票附件后自动识别，多个号码用逗号分隔"
                    readOnly={readOnly}
                  />
                </Form.Item>
                <Form.Item name="remark" label="备注">
                  <TextArea
                    rows={3}
                    placeholder="补充说明业务背景，便于税务核查"
                    readOnly={readOnly}
                  />
                </Form.Item>
              </div>
              <div className="voucher-form__extra-col">
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
              </div>
            </div>
          </Form>
        </Card>
      </div>
    </div>
  );
}

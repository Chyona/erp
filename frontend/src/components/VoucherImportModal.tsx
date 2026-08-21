import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ColumnsType } from 'antd/es/table';
import {
  Alert,
  App,
  Button,
  Checkbox,
  DatePicker,
  Input,
  InputNumber,
  Modal,
  Popover,
  Select,
  Space,
  Table,
  Typography,
  Upload
} from 'antd';
import {
  CloseOutlined,
  FileExcelOutlined,
  InboxOutlined,
  InfoCircleOutlined,
  PaperClipOutlined,
  PictureOutlined,
  SnippetsOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { Accounts } from '../services/accounts';
import { VoucherImport } from '../services/voucherImport';
import { isImportImageFile } from '../services/voucherImportImage';

const { Dragger } = Upload;
const { Text, Paragraph, Title } = Typography;

const BUSINESS_TYPE_EDIT_OPTIONS = [
  { value: '日常费用', label: '日常费用' },
  { value: '销售收入', label: '销售收入' },
  { value: '采购支出', label: '采购支出' },
  { value: '工资薪酬', label: '工资薪酬' },
  { value: '固定资产', label: '固定资产' },
  { value: '税费缴纳', label: '税费缴纳' },
  { value: '银行往来', label: '银行往来' },
  { value: '其他', label: '其他' }
];

function toUploadItem(selectedFile: File & { uid?: string }) {
  return {
    uid: selectedFile.uid || selectedFile.name,
    name: selectedFile.name,
    status: 'done' as const,
    originFileObj: selectedFile
  };
}

function mergeCell(rowSpan: number) {
  return rowSpan > 0 ? { rowSpan } : { rowSpan: 0 };
}

function parseEditedVoucherNo(raw: string) {
  const text = String(raw || '').trim();
  if (!text) return { voucherNo: '', voucherType: '记', voucherNumber: '' };
  const match = text.match(/^([^\d-]+)-(.+)$/);
  if (match) {
    return {
      voucherNo: `${match[1]}-${match[2]}`,
      voucherType: match[1] || '记',
      voucherNumber: match[2]
    };
  }
  return {
    voucherNo: `记-${text}`,
    voucherType: '记',
    voucherNumber: text
  };
}

function amountInputValue(value: number | string) {
  if (value === '' || value == null) return null;
  const num = parseFloat(String(value));
  return Number.isFinite(num) ? num : null;
}

function SelectedFileBar({
  name,
  onRemove
}: {
  name: string;
  onRemove: () => void;
}) {
  return (
    <div className="voucher-import-modal__source-file">
      <PaperClipOutlined className="voucher-import-modal__source-file-icon" />
      <span className="voucher-import-modal__source-file-name" title={name}>
        {name}
      </span>
      <button
        type="button"
        className="voucher-import-modal__source-file-remove"
        aria-label="移除文件"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
      >
        <CloseOutlined />
      </button>
    </div>
  );
}

export default function VoucherImportModal({ open, accounts, onClose, onSuccess }) {
  const { message } = App.useApp();
  const [tableFile, setTableFile] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [pasteActive, setPasteActive] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState('');
  const [importing, setImporting] = useState(false);
  const [skipDuplicates, setSkipDuplicates] = useState(false);
  const [preview, setPreview] = useState(null);
  const pasteZoneRef = useRef(null);

  const accountOptions = useMemo(
    () =>
      (accounts || []).map((a) => ({
        value: a.id,
        label: Accounts.formatAccountOption(a)
      })),
    [accounts]
  );

  const updateVoucherField = useCallback((voucherIndex: number, field: string, value: unknown) => {
    setPreview((prev) => {
      if (!prev?.vouchers) return prev;
      const vouchers = prev.vouchers.map((voucher, index) => {
        if (index !== voucherIndex) return voucher;
        if (field === 'voucherNo') {
          return { ...voucher, ...parseEditedVoucherNo(String(value ?? '')) };
        }
        if (field === 'summary') {
          const summary = String(value ?? '');
          return {
            ...voucher,
            entries: (voucher.entries || []).map((entry) => ({ ...entry, summary }))
          };
        }
        return { ...voucher, [field]: value };
      });
      return { ...prev, vouchers };
    });
  }, []);

  const updateEntryField = useCallback(
    (voucherIndex: number, entryIndex: number, field: string, value: unknown) => {
      setPreview((prev) => {
        if (!prev?.vouchers) return prev;
        const vouchers = prev.vouchers.map((voucher, index) => {
          if (index !== voucherIndex) return voucher;
          const entries = (voucher.entries || []).map((entry, ei) => {
            if (ei !== entryIndex) return entry;
            const updated = { ...entry, [field]: value };
            if (field === 'accountId') {
              const acc = (accounts || []).find((a) => a.id === value);
              updated.accountId = acc?.id || '';
              updated.accountCode = acc?.code || '';
              updated.accountName = acc?.name || '';
            }
            if (field === 'debit' && value !== '' && value != null) updated.credit = '';
            if (field === 'credit' && value !== '' && value != null) updated.debit = '';
            return updated;
          });
          return { ...voucher, entries };
        });
        return { ...prev, vouchers };
      });
    },
    [accounts]
  );

  const previewColumns = useMemo(
    (): ColumnsType<any> => [
      {
        title: '序号',
        key: 'seqNo',
        width: 46,
        align: 'center',
        onCell: (row) => mergeCell(row.groupRowSpan),
        render: (_value, row) => row.seqNo
      },
      {
        title: '凭证号',
        key: 'voucherNo',
        width: 80,
        onCell: (row) => mergeCell(row.groupRowSpan),
        render: (_value, row) => (
          <Input
            size="small"
            variant="borderless"
            className="voucher-import-modal__edit-input"
            value={row.voucherNo}
            onChange={(e) => updateVoucherField(row.voucherIndex, 'voucherNo', e.target.value)}
          />
        )
      },
      {
        title: '日期',
        key: 'date',
        width: 130,
        onCell: (row) => mergeCell(row.groupRowSpan),
        render: (_value, row) => (
          <DatePicker
            size="small"
            variant="borderless"
            allowClear={false}
            className="voucher-import-modal__edit-input voucher-import-modal__edit-date"
            value={row.date ? dayjs(row.date) : null}
            onChange={(d) =>
              updateVoucherField(row.voucherIndex, 'date', d ? d.format('YYYY-MM-DD') : '')
            }
          />
        )
      },
      {
        title: '业务类型',
        key: 'businessType',
        width: 110,
        onCell: (row) => mergeCell(row.groupRowSpan),
        render: (_value, row) => (
          <Select
            size="small"
            variant="borderless"
            className="voucher-import-modal__edit-input"
            style={{ width: '100%' }}
            options={BUSINESS_TYPE_EDIT_OPTIONS}
            value={row.businessType || '其他'}
            onChange={(v) => updateVoucherField(row.voucherIndex, 'businessType', v)}
          />
        )
      },
      {
        title: '摘要',
        key: 'summary',
        ellipsis: true,
        onCell: (row) => mergeCell(row.groupRowSpan),
        render: (_value, row) => (
          <Input
            size="small"
            variant="borderless"
            className="voucher-import-modal__edit-input"
            value={row.summary}
            title={row.summary}
            onChange={(e) => updateVoucherField(row.voucherIndex, 'summary', e.target.value)}
          />
        )
      },
      {
        title: '科目',
        key: 'account',
        width: 170,
        render: (_value, row) => (
          <Select
            size="small"
            variant="borderless"
            showSearch
            optionFilterProp="label"
            popupMatchSelectWidth={280}
            className="voucher-import-modal__edit-input"
            style={{ width: '100%' }}
            placeholder="选择科目"
            options={accountOptions}
            value={row.accountId || undefined}
            onChange={(v) => updateEntryField(row.voucherIndex, row.entryIndex, 'accountId', v)}
          />
        )
      },
      {
        title: '借方金额',
        key: 'debit',
        width: 85,
        align: 'right',
        render: (_value, row) => (
          <InputNumber
            size="small"
            variant="borderless"
            controls={false}
            precision={2}
            className={`voucher-import-modal__edit-input voucher-import-modal__edit-amount${row.balanced ? '' : ' voucher-import-modal__amount--unbalanced'
              }`}
            value={amountInputValue(row.debit)}
            onChange={(v) =>
              updateEntryField(
                row.voucherIndex,
                row.entryIndex,
                'debit',
                v == null ? '' : Math.round(Number(v) * 100) / 100
              )
            }
          />
        )
      },
      {
        title: '贷方金额',
        key: 'credit',
        width: 85,
        align: 'right',
        render: (_value, row) => (
          <InputNumber
            size="small"
            variant="borderless"
            controls={false}
            precision={2}
            className={`voucher-import-modal__edit-input voucher-import-modal__edit-amount${row.balanced ? '' : ' voucher-import-modal__amount--unbalanced'
              }`}
            value={amountInputValue(row.credit)}
            onChange={(v) =>
              updateEntryField(
                row.voucherIndex,
                row.entryIndex,
                'credit',
                v == null ? '' : Math.round(Number(v) * 100) / 100
              )
            }
          />
        )
      },
      {
        title: '备注',
        key: 'remark',
        ellipsis: true,
        onCell: (row) => mergeCell(row.groupRowSpan),
        render: (_value, row) => (
          <Input
            size="small"
            variant="borderless"
            className="voucher-import-modal__edit-input"
            value={row.remark || ''}
            title={row.remark || ''}
            onChange={(e) => updateVoucherField(row.voucherIndex, 'remark', e.target.value)}
          />
        )
      }
    ],
    [accountOptions, updateEntryField, updateVoucherField]
  );

  const previewData = useMemo(() => {
    if (!preview?.vouchers) return [];
    const rows = [];
    preview.vouchers.forEach((voucher, voucherIndex) => {
      const entries = voucher.entries || [];
      if (!entries.length) return;

      let totalDebit = 0;
      let totalCredit = 0;
      for (const entry of entries) {
        totalDebit += parseFloat(String(entry.debit)) || 0;
        totalCredit += parseFloat(String(entry.credit)) || 0;
      }
      totalDebit = Math.round(totalDebit * 100) / 100;
      totalCredit = Math.round(totalCredit * 100) / 100;
      const balanced = Math.abs(totalDebit - totalCredit) < 0.005;
      const firstSummary = String(entries[0]?.summary || '').trim();
      const groupSpan = entries.length;

      entries.forEach((entry, entryIndex) => {
        rows.push({
          key: `import-row-${voucherIndex}-${entryIndex}`,
          voucherIndex,
          entryIndex,
          seqNo: voucherIndex + 1,
          voucherNo: voucher.voucherNo,
          date: voucher.date,
          businessType: voucher.businessType,
          summary: firstSummary,
          accountId: entry.accountId,
          accountCode: entry.accountCode,
          accountName: entry.accountName,
          debit: entry.debit,
          credit: entry.credit,
          balanced,
          remark: voucher.remark,
          groupRowSpan: entryIndex === 0 ? groupSpan : 0
        });
      });
    });
    return rows;
  }, [preview]);

  const reset = () => {
    setTableFile(null);
    setImageFile(null);
    setPreview(null);
    setParseProgress('');
    setSkipDuplicates(false);
    setPasteActive(false);
  };

  const handleClose = () => {
    reset();
    onClose?.();
  };

  const parseSelectedFile = async (selectedFile: File, source: 'table' | 'image') => {
    setParsing(true);
    setParseProgress('');
    if (source === 'table') {
      setTableFile(toUploadItem(selectedFile as File & { uid?: string }));
      setImageFile(null);
    } else {
      setImageFile(toUploadItem(selectedFile as File & { uid?: string }));
      setTableFile(null);
    }
    try {
      const result = await VoucherImport.parseFile(selectedFile, accounts, (status) => {
        setParseProgress(status);
      });
      setPreview(result);
      message.success(`已解析 ${result.vouchers.length} 张凭证`);
    } catch (err) {
      setPreview(null);
      message.error(err.message || '文件解析失败');
    } finally {
      setParsing(false);
      setParseProgress('');
    }
  };

  const takeImageFromClipboard = async (clipboardData: DataTransfer | null) => {
    if (!clipboardData) return false;
    const items = Array.from(clipboardData.items || []);
    for (const item of items) {
      if (!item.type?.startsWith('image/')) continue;
      const blob = item.getAsFile();
      if (!blob) continue;
      const ext = (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
      const file = new File([blob], `clipboard-${Date.now()}.${ext}`, {
        type: blob.type || 'image/png'
      });
      await parseSelectedFile(file, 'image');
      return true;
    }
    return false;
  };

  useEffect(() => {
    if (!open) return undefined;

    const onPaste = (event: ClipboardEvent) => {
      if (parsing || importing) return;
      const items = Array.from(event.clipboardData?.items || []);
      const hasImage = items.some((item) => item.type?.startsWith('image/'));
      if (!hasImage) return;
      event.preventDefault();
      void takeImageFromClipboard(event.clipboardData);
    };

    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
    // parseSelectedFile closes over latest accounts via takeImageFromClipboard in render scope
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, parsing, importing, accounts]);

  const handleImport = async () => {
    if (!preview?.vouchers?.length) {
      message.warning('请先选择表格文件或粘贴截图');
      return;
    }

    setImporting(true);
    try {
      const result = await VoucherImport.importVouchers(preview.vouchers, {
        skipDuplicates
      });

      const cfSkipped = preview.filteredCarryForwardCount || 0;
      const invalidCount = preview.invalidVoucherCount || 0;
      const dupSkipped = result.skipped || 0;
      const skippedTotal = cfSkipped + invalidCount + dupSkipped;
      const skipParts = [];
      if (dupSkipped) skipParts.push(`已存在 ${dupSkipped}`);
      if (cfSkipped) skipParts.push(`结转 ${cfSkipped}`);
      if (invalidCount) skipParts.push(`无效 ${invalidCount}`);
      const summary =
        `成功导入 ${result.imported} 个凭证，跳过 ${skippedTotal} 个` +
        (skipParts.length ? `（${skipParts.join('，')}）` : '') +
        (result.failed ? `，失败 ${result.failed} 个` : '');

      if (result.failed) {
        message.warning(summary);
      } else {
        message.success(summary);
      }

      if (dupSkipped && result.imported === 0) {
        message.info(
          '跳过的凭证在同月份下已有相同凭证号；若需重导，请先删除旧凭证或取消勾选「跳过已存在的凭证号」。'
        );
      } else if (dupSkipped > 0) {
        message.info(
          `有 ${dupSkipped} 个因「同月同凭证号已存在」被跳过（已勾选跳过已存在）。`
        );
      }

      onSuccess?.(result);
      handleClose();
    } catch (err) {
      message.error(err.message || '导入失败');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal
      title="导入历史凭证"
      open={open}
      onCancel={handleClose}
      width="min(1360px, calc(100vw - 48px))"
      centered
      destroyOnHidden
      className="voucher-import-modal"
      wrapClassName="voucher-import-modal-wrap"
      footer={
        <Space>
          <Button onClick={handleClose}>取消</Button>
          <Button
            type="primary"
            loading={importing}
            disabled={!preview?.vouchers?.length}
            onClick={handleImport}
          >
            开始导入
          </Button>
        </Space>
      }
    >
      <Paragraph type="secondary" style={{ marginBottom: 6 }}>
        表头需含：凭证号、凭证日期、摘要、一级科目、借方金额、贷方金额。导入后默认为
        <strong>草稿</strong>
        （便于补传附件后再审核）。多工作表 Excel 仅导入第 1 个工作表。
      </Paragraph>
      <Paragraph className="voucher-import-modal__skip-tip" style={{ marginBottom: 12 }}>
        <Text strong className="voucher-import-modal__skip-tip-label">
          结转跳过：
        </Text>
        <Text type="secondary">
          摘要或备注命中
          <Text code>普票减免结转</Text>、
          <Text code>结转损益</Text>、
          <Text code>损益结转</Text>
          的凭证自动跳过，不入库；普通业务如「结转成本」不受影响。请在工作台「季末结转」重新生成。
        </Text>
      </Paragraph>

      <div
        className={`voucher-import-modal__sources${preview ? ' voucher-import-modal__sources--compact' : ''}`}
      >
        <div className="voucher-import-modal__source-card">
          <div className="voucher-import-modal__source-head">
            <FileExcelOutlined />
            <div>
              <Title level={5} style={{ margin: 0 }}>
                表格文件
              </Title>
              <Text type="secondary">上传 Excel / CSV，按列精确解析</Text>
            </div>
          </div>
          <div className="voucher-import-modal__source-drop">
            <Dragger
              accept=".xlsx,.xls,.csv"
              maxCount={1}
              disabled={parsing}
              fileList={[]}
              showUploadList={false}
              beforeUpload={(selectedFile) => {
                if (isImportImageFile(selectedFile)) {
                  message.warning('图片请使用右侧「截图识别」');
                  return false;
                }
                void parseSelectedFile(selectedFile, 'table');
                return false;
              }}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">点击或拖拽表格文件到此处</p>
              <p className="ant-upload-hint">.xlsx / .xls / .csv</p>
            </Dragger>
            {tableFile?.name ? (
              <SelectedFileBar
                name={tableFile.name}
                onRemove={() => {
                  setTableFile(null);
                  if (!imageFile) setPreview(null);
                }}
              />
            ) : null}
          </div>
        </div>

        <div
          ref={pasteZoneRef}
          className={`voucher-import-modal__source-card voucher-import-modal__source-card--paste${pasteActive ? ' is-active' : ''
            }`}
          tabIndex={0}
          onFocus={() => setPasteActive(true)}
          onBlur={() => setPasteActive(false)}
          onClick={() => pasteZoneRef.current?.focus()}
          onPaste={(event) => {
            void takeImageFromClipboard(event.clipboardData).then((ok) => {
              if (ok) event.preventDefault();
              else message.info('剪贴板中没有图片，请先截图再 Ctrl+V');
            });
          }}
        >
          <div className="voucher-import-modal__source-head">
            <PictureOutlined />
            <div>
              <Title level={5} style={{ margin: 0 }}>
                截图识别
              </Title>
              <Text type="secondary">粘贴或上传分录表截图，由视觉大模型识别</Text>
            </div>
          </div>
          <div className="voucher-import-modal__source-drop">
            <Dragger
              accept=".png,.jpg,.jpeg,.webp,.bmp,.gif,image/*"
              maxCount={1}
              disabled={parsing}
              fileList={[]}
              showUploadList={false}
              openFileDialogOnClick
              beforeUpload={(selectedFile) => {
                if (!isImportImageFile(selectedFile)) {
                  message.warning('请上传图片，或使用左侧「表格文件」');
                  return false;
                }
                void parseSelectedFile(selectedFile, 'image');
                return false;
              }}
            >
              <p className="ant-upload-drag-icon">
                <SnippetsOutlined />
              </p>
              <p className="ant-upload-text">点击上传，或在此区域 Ctrl+V 粘贴截图</p>
              <p className="ant-upload-hint">通义视觉大模型识别分录表</p>
            </Dragger>
            {imageFile?.name ? (
              <SelectedFileBar
                name={imageFile.name}
                onRemove={() => {
                  setImageFile(null);
                  if (!tableFile) setPreview(null);
                }}
              />
            ) : null}
          </div>
        </div>
      </div>

      {parsing && (
        <Alert
          className="voucher-import-modal__progress"
          style={{ marginTop: 16 }}
          type="info"
          showIcon
          message={parseProgress || '正在解析文件的分录表，请稍候…'}
        />
      )}

      {preview && (
        <div className="voucher-import-modal__preview">
          <div className="voucher-import-modal__summary">
            <Space wrap align="center">
              <Text strong>
                已解析 {preview.vouchers.length} 个凭证，解析阶段跳过{' '}
                {(preview.filteredCarryForwardCount || 0) + (preview.invalidVoucherCount || 0)}{' '}
                个
              </Text>
              <Text type="secondary">可直接修改下表后再导入</Text>
              <Popover
                title="导入说明"
                trigger="hover"
                placement="bottomLeft"
                content={
                  <div className="voucher-import-warnings-popover">
                    <Text type="secondary" style={{ display: 'block', marginBottom: 6 }}>
                      本次跳过结转 {preview.filteredCarryForwardCount || 0} 个、无效{' '}
                      {preview.invalidVoucherCount || 0} 个
                      {preview.warnings?.length
                        ? `；另有 ${preview.warnings.length} 条行级提示`
                        : ''}
                      。
                    </Text>
                    {preview.warnings?.length > 0 && (
                      <ul className="voucher-import-warnings">
                        {preview.warnings.slice(0, 10).map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                        {preview.warnings.length > 10 && (
                          <li>…另有 {preview.warnings.length - 10} 条</li>
                        )}
                      </ul>
                    )}
                  </div>
                }
              >
                <InfoCircleOutlined
                  className="voucher-import-modal__tip-icon"
                  aria-label="导入说明"
                />
              </Popover>
              <Checkbox checked={skipDuplicates} onChange={(e) => setSkipDuplicates(e.target.checked)}>
                跳过已存在的凭证号
              </Checkbox>
            </Space>
          </div>

          <div className="voucher-import-modal__table app-table">
            <Table
              size="small"
              bordered
              tableLayout="fixed"
              columns={previewColumns}
              dataSource={previewData}
              scroll={{ x: 1140, y: preview ? 360 : 280 }}
              pagination={false}
            />
          </div>
        </div>
      )}
    </Modal>
  );
}

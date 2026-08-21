import { useMemo, useState } from 'react';
import type { ColumnsType } from 'antd/es/table';
import {
  Alert,
  App,
  Button,
  Checkbox,
  Modal,
  Popover,
  Space,
  Table,
  Tooltip,
  Typography,
  Upload
} from 'antd';
import { InboxOutlined, InfoCircleOutlined, UploadOutlined } from '@ant-design/icons';
import { VoucherImport } from '../services/voucherImport';

const { Dragger } = Upload;
const { Text, Paragraph } = Typography;

export default function VoucherImportModal({ open, accounts, onClose, onSuccess }) {
  const { message } = App.useApp();
  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [skipDuplicates, setSkipDuplicates] = useState(false);
  const [preview, setPreview] = useState(null);

  const previewColumns = useMemo(
    (): ColumnsType<any> => [
      {
        title: '序号',
        key: 'seqNo',
        width: 52,
        align: 'center',
        render: (_value, _row, rowIndex) => rowIndex + 1
      },
      { title: '凭证号', dataIndex: 'voucherNo', key: 'voucherNo', width: 70, ellipsis: true },
      { title: '日期', dataIndex: 'date', key: 'date', width: 100 },
      {
        title: '业务类型',
        dataIndex: 'businessType',
        key: 'businessType',
        width: 80,
        ellipsis: true
      },
      {
        title: '摘要',
        dataIndex: 'summary',
        key: 'summary',
        ellipsis: { showTitle: false },
        render: (text: string) =>
          text ? (
            <Tooltip placement="topLeft" title={text}>
              <span className="voucher-import-modal__cell-ellipsis">{text}</span>
            </Tooltip>
          ) : (
            ''
          )
      },
      {
        title: '分录',
        dataIndex: 'entryCount',
        key: 'entryCount',
        width: 52,
        align: 'center'
      },
      {
        title: '借方合计',
        dataIndex: 'totalDebit',
        key: 'totalDebit',
        width: 100,
        align: 'right',
        render: (v, row) => (
          <span className={row.balanced ? undefined : 'voucher-import-modal__amount--unbalanced'}>
            {Number(v).toFixed(2)}
          </span>
        )
      },
      {
        title: '贷方合计',
        dataIndex: 'totalCredit',
        key: 'totalCredit',
        width: 100,
        align: 'right',
        render: (v, row) => (
          <span className={row.balanced ? undefined : 'voucher-import-modal__amount--unbalanced'}>
            {Number(v).toFixed(2)}
          </span>
        )
      },
      {
        title: '备注',
        dataIndex: 'remark',
        key: 'remark',
        ellipsis: { showTitle: false },
        render: (text: string) =>
          text ? (
            <Tooltip placement="topLeft" title={text}>
              <span className="voucher-import-modal__cell-ellipsis">{text}</span>
            </Tooltip>
          ) : (
            ''
          )
      }
    ],
    []
  );
  const previewData = useMemo(() => {
    if (!preview?.vouchers) return [];
    return preview.vouchers.map((voucher, rowIndex) => {
      let debit = 0;
      let credit = 0;
      for (const entry of voucher.entries) {
        debit += parseFloat(entry.debit) || 0;
        credit += parseFloat(entry.credit) || 0;
      }
      debit = Math.round(debit * 100) / 100;
      credit = Math.round(credit * 100) / 100;
      const firstSummary = String(voucher.entries?.[0]?.summary || '').trim();
      return {
        key: `import-row-${rowIndex}-${voucher.voucherNo}`,
        voucherNo: voucher.voucherNo,
        date: voucher.date,
        businessType: voucher.businessType,
        summary: firstSummary,
        entryCount: voucher.entries.length,
        totalDebit: debit,
        totalCredit: credit,
        balanced: Math.abs(debit - credit) < 0.005,
        remark: voucher.remark
      };
    });
  }, [preview]);

  const reset = () => {
    setFile(null);
    setPreview(null);
    setSkipDuplicates(true);
  };

  const handleClose = () => {
    reset();
    onClose?.();
  };

  const parseSelectedFile = async (selectedFile) => {
    setParsing(true);
    try {
      const result = await VoucherImport.parseFile(selectedFile, accounts);
      setPreview(result);
      message.success(`已解析 ${result.vouchers.length} 张凭证`);
    } catch (err) {
      setPreview(null);
      message.error(err.message || '文件解析失败');
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    if (!preview?.vouchers?.length) {
      message.warning('请先选择并解析文件');
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
      width="min(1360px, calc(100vw - 32px))"
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
      <Paragraph type="secondary" style={{ marginBottom: 8 }}>
        <strong>多工作表文件仅导入第 1 个工作表（分录表）</strong>。
        表头需含：凭证号、凭证日期、摘要、一级科目、借方金额、贷方金额；导入后凭证默认为<strong>草稿</strong>，可在凭证管理中批量审核。
      </Paragraph>
      <Paragraph className="voucher-import-modal__skip-tip" style={{ marginBottom: 16 }}>
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

      <Dragger
        accept=".xlsx,.xls,.csv"
        maxCount={1}
        fileList={file ? [file] : []}
        beforeUpload={(selectedFile) => {
          const item = {
            uid: selectedFile.uid || selectedFile.name,
            name: selectedFile.name,
            status: 'done',
            originFileObj: selectedFile
          };
          setFile(item);
          parseSelectedFile(selectedFile);
          return false;
        }}
        onRemove={() => {
          reset();
          return true;
        }}
        showUploadList={{ showRemoveIcon: true }}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">点击或拖拽历史凭证文件到此处</p>
      </Dragger>

      {parsing && (
        <Alert style={{ marginTop: 16 }} type="info" showIcon message="正在解析文件…" />
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
              scroll={{ y: 360 }}
              pagination={false}
            />
          </div>
        </div>
      )}

      {!preview && !parsing && (
        <div style={{ marginTop: 16 }}>
          <Button icon={<UploadOutlined />} disabled>
            选择文件后将自动预览
          </Button>
        </div>
      )}
    </Modal>
  );
}

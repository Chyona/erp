import { useMemo, useState } from 'react';
import type { ColumnsType } from 'antd/es/table';
import {
  Alert,
  App,
  Button,
  Checkbox,
  Modal,
  Space,
  Table,
  Typography,
  Upload
} from 'antd';
import { InboxOutlined, UploadOutlined } from '@ant-design/icons';
import { VoucherImport } from '../services/voucherImport';

const { Dragger } = Upload;
const { Text, Paragraph } = Typography;

export default function VoucherImportModal({ open, accounts, onClose, onSuccess }) {
  const { message } = App.useApp();
  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [preview, setPreview] = useState(null);

  const previewColumns = useMemo(
    (): ColumnsType<any> => [
      { title: '凭证号', dataIndex: 'voucherNo', width: 130 },
      { title: '日期', dataIndex: 'date', width: 100 },
      { title: '业务类型', dataIndex: 'businessType', width: 88 },
      {
        title: '分录数',
        dataIndex: 'entryCount',
        width: 72,
        align: 'center'
      },
      {
        title: '借方合计',
        dataIndex: 'totalDebit',
        width: 110,
        align: 'right',
        render: (v) => v.toFixed(2)
      },
      {
        title: '贷方合计',
        dataIndex: 'totalCredit',
        width: 110,
        align: 'right',
        render: (v) => v.toFixed(2)
      },
      {
        title: '平衡',
        dataIndex: 'balanced',
        width: 72,
        align: 'center',
        render: (v) => (v ? '是' : '否')
      },
      { title: '备注', dataIndex: 'remark', ellipsis: true }
    ],
    []
  );
  const previewData = useMemo(() => {
    if (!preview?.vouchers) return [];
    return preview.vouchers.map((voucher) => {
      let debit = 0;
      let credit = 0;
      for (const entry of voucher.entries) {
        debit += parseFloat(entry.debit) || 0;
        credit += parseFloat(entry.credit) || 0;
      }
      debit = Math.round(debit * 100) / 100;
      credit = Math.round(credit * 100) / 100;
      return {
        key: voucher.voucherNo,
        voucherNo: voucher.voucherNo,
        date: voucher.date,
        businessType: voucher.businessType,
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
      if (result.warnings.length) {
        message.warning(`解析完成，有 ${result.warnings.length} 条提示`);
      } else {
        message.success(`已解析 ${result.vouchers.length} 张凭证`);
      }
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

      const parts = [`成功 ${result.imported} 张`];
      if (result.skipped) parts.push(`跳过重复 ${result.skipped} 张`);
      if (result.failed) parts.push(`失败 ${result.failed} 张`);

      if (result.failed) {
        message.warning(`导入完成：${parts.join('，')}。请展开查看失败原因。`);
      } else {
        message.success(`导入完成：${parts.join('，')}`);
      }

      if (result.skipped && result.imported === 0) {
        message.info('跳过的凭证在同月份下已有相同凭证号；若需重导，请先删除旧凭证或取消勾选「跳过已存在的凭证号」。');
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
      width={860}
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
      <Paragraph type="secondary" style={{ marginBottom: 16 }}>
        支持完整历史「分录表」Excel。<strong>多工作表文件仅导入第 1 个工作表（分录表）</strong>，其余工作表自动忽略。
        表头需含：凭证号、凭证日期、摘要、一级科目、借方金额、贷方金额；导入后凭证默认为<strong>草稿</strong>，可在凭证管理中批量审核。
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
            <Space wrap>
              <Text strong>解析结果：{preview.vouchers.length} 张凭证</Text>
              <Checkbox checked={skipDuplicates} onChange={(e) => setSkipDuplicates(e.target.checked)}>
                跳过已存在的凭证号
              </Checkbox>
            </Space>
          </div>

          <div className="voucher-import-modal__table app-table">
            <Table
              size="small"
              bordered
              columns={previewColumns}
              dataSource={previewData}
              scroll={{ x: 720, y: 360 }}
              pagination={false}
            />
          </div>

          {preview.warnings.length > 0 && (
            <Alert
              style={{ marginTop: 12 }}
              type="warning"
              showIcon
              message={`解析提示（${preview.warnings.length} 条，未匹配的科目/日期/分录行不会导入）`}
              description={
                <ul className="voucher-import-warnings">
                  {preview.warnings.slice(0, 8).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                  {preview.warnings.length > 8 && (
                    <li>…另有 {preview.warnings.length - 8} 条</li>
                  )}
                </ul>
              }
            />
          )}
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

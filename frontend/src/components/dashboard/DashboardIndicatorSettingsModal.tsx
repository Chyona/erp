import { useEffect, useMemo, useState } from 'react';
import { App, Button, Checkbox, Form, Input, Modal, Space } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import {
  createDashboardIndicator,
  saveDashboardIndicatorConfigs,
  type DashboardIndicatorDefinition
} from '../../services/dashboardIndicators';

type DraftIndicator = DashboardIndicatorDefinition;

export default function DashboardIndicatorSettingsModal({
  open,
  indicators,
  onCancel,
  onSaved
}: {
  open: boolean;
  indicators: DashboardIndicatorDefinition[];
  onCancel: () => void;
  onSaved: (items: DashboardIndicatorDefinition[]) => void;
}) {
  const { message } = App.useApp();
  const [draft, setDraft] = useState<DraftIndicator[]>([]);
  const [saving, setSaving] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm<{ label: string; codePrefix: string }>();

  useEffect(() => {
    if (open) {
      setDraft(indicators.map((item) => ({ ...item })));
    }
  }, [open, indicators]);

  const visibleCount = draft.filter((item) => item.visible).length;
  const allVisible = draft.length > 0 && visibleCount === draft.length;
  const indeterminate = visibleCount > 0 && visibleCount < draft.length;

  const openCreate = () => {
    setEditingId(null);
    form.setFieldsValue({ label: '', codePrefix: '' });
    setEditorOpen(true);
  };

  const openEdit = (item: DraftIndicator) => {
    setEditingId(item.id);
    form.setFieldsValue({ label: item.label, codePrefix: item.codePrefix });
    setEditorOpen(true);
  };

  const handleEditorOk = async () => {
    const values = await form.validateFields();
    if (editingId) {
      setDraft((prev) =>
        prev.map((item) =>
          item.id === editingId
            ? { ...item, label: values.label.trim(), codePrefix: values.codePrefix.trim() }
            : item
        )
      );
    } else {
      setDraft((prev) => [
        ...prev,
        createDashboardIndicator({
          label: values.label,
          codePrefix: values.codePrefix
        })
      ]);
    }
    setEditorOpen(false);
    form.resetFields();
  };

  const handleDelete = (item: DraftIndicator) => {
    if (item.builtin) {
      message.warning('内置指标不可删除，可取消勾选隐藏');
      return;
    }
    setDraft((prev) => prev.filter((row) => row.id !== item.id));
  };

  const handleConfirm = async () => {
    setSaving(true);
    try {
      const next = await saveDashboardIndicatorConfigs(draft);
      message.success('财务指标已保存');
      onSaved(next);
    } catch (err) {
      message.error((err as Error).message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const editorTitle = useMemo(
    () => (editingId ? '编辑报表项' : '新增报表项'),
    [editingId]
  );

  return (
    <>
      <Modal
        title="财务指标管理"
        open={open}
        width={720}
        destroyOnClose
        className="dashboard-indicator-settings-modal"
        onCancel={onCancel}
        footer={
          <Space>
            <Button onClick={onCancel}>取消</Button>
            <Button type="primary" loading={saving} onClick={() => void handleConfirm()}>
              确定
            </Button>
          </Space>
        }
      >
        <div className="dashboard-indicator-settings-table">
          <div className="dashboard-indicator-settings-table__head">
            <Checkbox
              checked={allVisible}
              indeterminate={indeterminate}
              onChange={(event) => {
                const checked = event.target.checked;
                setDraft((prev) => prev.map((item) => ({ ...item, visible: checked })));
              }}
            />
            <span>操作</span>
            <span>名称</span>
          </div>
          <div className="dashboard-indicator-settings-table__body">
            {draft.map((item) => (
              <div key={item.id} className="dashboard-indicator-settings-table__row">
                <Checkbox
                  checked={item.visible}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setDraft((prev) =>
                      prev.map((row) => (row.id === item.id ? { ...row, visible: checked } : row))
                    );
                  }}
                />
                <Space size={4}>
                  <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(item)} />
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleDelete(item)}
                  />
                </Space>
                <span className="dashboard-indicator-settings-table__name">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
        <Button block icon={<PlusOutlined />} className="dashboard-indicator-settings-add" onClick={openCreate}>
          新增报表项
        </Button>
      </Modal>

      <Modal
        title={editorTitle}
        open={editorOpen}
        destroyOnClose
        onCancel={() => {
          setEditorOpen(false);
          form.resetFields();
        }}
        onOk={() => void handleEditorOk()}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="名称"
            name="label"
            rules={[{ required: true, message: '请输入名称' }]}
          >
            <Input placeholder="如：银行存款" maxLength={30} />
          </Form.Item>
          <Form.Item
            label="科目编码前缀"
            name="codePrefix"
            rules={[{ required: true, message: '请输入科目编码前缀' }]}
            extra="按科目余额汇总该前缀及下级科目；利润表项请使用内置指标。"
          >
            <Input placeholder="如：1002" maxLength={20} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

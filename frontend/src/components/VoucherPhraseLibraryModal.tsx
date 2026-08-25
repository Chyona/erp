import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Button, Input, Modal, Radio, Space, Table } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  listVoucherPhraseLibrary,
  type PhraseLibraryItem,
  invalidateVoucherPhraseCatalog
} from '../services/voucherPhraseCatalog';
import { VoucherPhrases, type VoucherPhraseKind } from '../services/voucherPhrases';
import EllipsisText from './EllipsisText';

type VoucherPhraseLibraryModalProps = {
  open: boolean;
  kind: VoucherPhraseKind;
  initialKeyword?: string;
  initialSelectedText?: string;
  onConfirm: (text: string) => void;
  onCancel: () => void;
};

export default function VoucherPhraseLibraryModal({
  open,
  kind,
  initialKeyword = '',
  initialSelectedText = '',
  onConfirm,
  onCancel
}: VoucherPhraseLibraryModalProps) {
  const { message, modal } = App.useApp();
  const title = kind === 'summary' ? '摘要库' : '备注库';
  const [keyword, setKeyword] = useState('');
  const [items, setItems] = useState<PhraseLibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addDraft, setAddDraft] = useState('');
  const [addSaving, setAddSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await listVoucherPhraseLibrary(kind, keyword));
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载短语库失败');
    } finally {
      setLoading(false);
    }
  }, [kind, keyword, message]);

  useEffect(() => {
    if (!open) return;
    setKeyword(initialKeyword);
    setEditingKey(null);
    setEditingText('');
    setAddOpen(false);
    setAddDraft('');
  }, [open, initialKeyword]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const match = items.find((item) => item.text === initialSelectedText.trim());
    setSelectedKey(match?.key ?? null);
  }, [open, items, initialSelectedText]);

  const selectedText = useMemo(
    () => items.find((item) => item.key === selectedKey)?.text ?? '',
    [items, selectedKey]
  );

  const handleAdd = () => {
    setAddDraft('');
    setAddOpen(true);
  };

  const saveNewPhrase = async (keepOpen: boolean) => {
    const normalized = addDraft.trim();
    if (!normalized) {
      message.warning('内容不能为空');
      return;
    }
    setAddSaving(true);
    try {
      const created = await VoucherPhrases.addPhrase(kind, normalized);
      invalidateVoucherPhraseCatalog();
      message.success('已新增');
      await load();
      setSelectedKey(created.id);
      if (keepOpen) {
        setAddDraft('');
      } else {
        setAddOpen(false);
        setAddDraft('');
      }
    } catch (err) {
      message.error(err instanceof Error ? err.message : '新增失败');
    } finally {
      setAddSaving(false);
    }
  };

  const startEdit = (item: PhraseLibraryItem) => {
    setEditingKey(item.key);
    setEditingText(item.text);
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setEditingText('');
  };

  const handleUpdate = async (item: PhraseLibraryItem) => {
    if (editingKey !== item.key) return;
    const normalized = editingText.trim();
    if (!normalized) {
      message.warning('内容不能为空');
      return;
    }
    setSaving(true);
    try {
      if (item.source === 'custom' && item.id) {
        await VoucherPhrases.updatePhrase(kind, item.id, normalized);
        setSelectedKey(item.id);
      } else if (item.source === 'builtin' && item.builtinOriginal) {
        await VoucherPhrases.updateBuiltinPhrase(kind, item.builtinOriginal, normalized);
        setSelectedKey(item.key);
      } else {
        throw new Error('短语不存在');
      }
      invalidateVoucherPhraseCatalog();
      cancelEdit();
      message.success('已更新');
      await load();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '更新失败');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = (item: PhraseLibraryItem) => {
    modal.confirm({
      title: '确认删除这条短语？',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          if (item.source === 'custom' && item.id) {
            await VoucherPhrases.removePhrase(kind, item.id);
          } else if (item.source === 'builtin' && item.builtinOriginal) {
            await VoucherPhrases.removeBuiltinPhrase(kind, item.builtinOriginal);
          } else {
            throw new Error('短语不存在');
          }
          invalidateVoucherPhraseCatalog();
          if (selectedKey === item.key) setSelectedKey(null);
          if (editingKey === item.key) cancelEdit();
          message.success('已删除');
          await load();
        } catch (err) {
          message.error(err instanceof Error ? err.message : '删除失败');
        }
      }
    });
  };

  const columns: ColumnsType<PhraseLibraryItem> = [
    {
      title: '',
      width: 44,
      render: (_, record) => (
        <Radio
          checked={selectedKey === record.key}
          onChange={() => setSelectedKey(record.key)}
        />
      )
    },
    {
      title: title,
      dataIndex: 'text',
      ellipsis: true,
      render: (text, record) => {
        if (editingKey === record.key) {
          return (
            <Input.TextArea
              value={editingText}
              autoSize={{ minRows: 1, maxRows: 3 }}
              maxLength={200}
              onClick={(event) => event.stopPropagation()}
              onChange={(e) => setEditingText(e.target.value)}
            />
          );
        }
        return (
          <div className="voucher-phrase-library__text-cell">
            {record.source === 'builtin' ? (
              <span className="voucher-phrase-library__tag">内置</span>
            ) : null}
            <EllipsisText className="voucher-phrase-library__text" tooltip={text}>
              {text}
            </EllipsisText>
          </div>
        );
      }
    },
    {
      title: '操作',
      width: 100,
      align: 'center',
      render: (_, record) => {
        if (editingKey === record.key) {
          return (
            <Space size={0}>
              <Button
                type="link"
                size="small"
                loading={saving}
                onClick={(event) => {
                  event.stopPropagation();
                  void handleUpdate(record);
                }}
              >
                保存
              </Button>
              <Button
                type="link"
                size="small"
                onClick={(event) => {
                  event.stopPropagation();
                  cancelEdit();
                }}
              >
                取消
              </Button>
            </Space>
          );
        }
        return (
          <Space size={0}>
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              aria-label="编辑"
              onClick={(event) => {
                event.stopPropagation();
                startEdit(record);
              }}
            />
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              aria-label="删除"
              onClick={(event) => {
                event.stopPropagation();
                handleRemove(record);
              }}
            />
          </Space>
        );
      }
    }
  ];

  return (
    <>
      <Modal
        title={title}
        open={open}
        width={680}
        centered
        className="voucher-phrase-library-modal"
        onCancel={onCancel}
        footer={
          <div className="voucher-phrase-library__footer">
            <Button icon={<PlusOutlined />} onClick={handleAdd}>
              新增
            </Button>
            <Space>
              <Button onClick={onCancel}>取消</Button>
              <Button
                type="primary"
                disabled={!selectedText}
                onClick={() => onConfirm(selectedText)}
              >
                确定
              </Button>
            </Space>
          </div>
        }
      >
        <Input
          allowClear
          value={keyword}
          prefix={<SearchOutlined />}
          placeholder="请输入搜索内容"
          className="voucher-phrase-library__search"
          onChange={(e) => setKeyword(e.target.value)}
        />
        <Table
          size="small"
          bordered
          rowKey="key"
          loading={loading}
          columns={columns}
          dataSource={items}
          pagination={false}
          scroll={{ y: 420 }}
          className="voucher-phrase-library__table"
          rowClassName={(record) =>
            record.key === selectedKey ? 'voucher-phrase-library__row--selected' : ''
          }
          onRow={(record) => ({
            onClick: () => setSelectedKey(record.key)
          })}
        />
      </Modal>

      <Modal
        title={kind === 'summary' ? '新增摘要' : '新增备注'}
        open={addOpen}
        centered
        zIndex={1400}
        maskClosable={false}
        className="voucher-phrase-library-add-modal"
        onCancel={() => {
          if (addSaving) return;
          setAddOpen(false);
          setAddDraft('');
        }}
        footer={
          <Space>
            <Button
              disabled={addSaving}
              onClick={() => {
                setAddOpen(false);
                setAddDraft('');
              }}
            >
              取消
            </Button>
            <Button loading={addSaving} onClick={() => void saveNewPhrase(false)}>
              保存
            </Button>
            <Button type="primary" loading={addSaving} onClick={() => void saveNewPhrase(true)}>
              保存并新增
            </Button>
          </Space>
        }
      >
        <Input.TextArea
          value={addDraft}
          autoSize={{ minRows: 3, maxRows: 6 }}
          maxLength={200}
          placeholder={kind === 'summary' ? '输入摘要内容' : '输入备注内容'}
          onChange={(e) => setAddDraft(e.target.value)}
        />
      </Modal>
    </>
  );
}

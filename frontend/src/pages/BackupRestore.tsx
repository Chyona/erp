import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ColumnsType } from 'antd/es/table';
import { Alert, App, Button, Input, Modal, Space, Typography } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { Backup, formatBackupSize, formatBackupSource } from '../services/backup';
import { useApp } from '../context/AppContext';
import { useTabDataRefresh } from '../context/PageTabsContext';
import { useAsyncLoading } from '../hooks/useAsyncLoading';
import ScrollTable from '../components/ScrollTable';
import { confirmWarning } from '../utils/confirmAction';
import { toUserMessage } from '../utils/userMessage';
import type { BackupRecord } from '../types';

const { Text, Link } = Typography;
const MAX_BACKUPS = 5;

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', { hour12: false });
}

export default function BackupRestore() {
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const { reinitApp } = useApp();
  const tabDataRefresh = useTabDataRefresh();
  const { can } = useAuth();
  const canBackup = can('backup');
  const canRestore = can('restore');
  const allowed = canBackup || canRestore;

  const [records, setRecords] = useState<BackupRecord[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<BackupRecord | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const { loading, run } = useAsyncLoading(true);

  const loadRecords = useCallback(async () => {
    const list = await Backup.list();
    setRecords(list);
    setSelectedRowKeys((prev) => prev.filter((key) => list.some((item) => item.id === key)));
  }, []);

  useEffect(() => {
    if (!allowed) return;
    void run(loadRecords);
  }, [allowed, loadRecords, run, tabDataRefresh]);

  const selectedRows = useMemo(
    () => records.filter((item) => selectedRowKeys.includes(item.id)),
    [records, selectedRowKeys]
  );

  const handleCreateBackup = async () => {
    if (!canBackup) {
      message.warning('当前账号无权备份');
      return;
    }
    try {
      await Backup.create();
      message.success('备份成功');
      await loadRecords();
    } catch (err) {
      message.error(toUserMessage(err, '备份失败'));
    }
  };

  const handleBatchDelete = async () => {
    if (!canRestore) {
      message.warning('当前账号无权删除备份');
      return;
    }
    if (!selectedRowKeys.length) {
      message.warning('请选择要删除的备份');
      return;
    }
    const ok = await confirmWarning(modal, {
      title: '确定删除所选备份？',
      content: `将删除 ${selectedRowKeys.length} 个备份文件，此操作不可恢复。`
    });
    if (!ok) return;
    try {
      await Backup.batchRemove(selectedRowKeys);
      message.success('删除成功');
      setSelectedRowKeys([]);
      await loadRecords();
    } catch (err) {
      message.error(toUserMessage(err, '删除失败'));
    }
  };

  const handleRestore = async (record: BackupRecord) => {
    if (!canRestore) {
      message.warning('当前账号无权恢复数据');
      return;
    }
    const ok = await confirmWarning(modal, {
      title: '确定恢复数据？',
      content: `恢复备份「${record.name}」将覆盖现有全部数据（凭证、科目、设置等），此操作不可撤销。`
    });
    if (!ok) return;
    try {
      await Backup.restore(record.id);
      message.success('数据恢复成功');
      await reinitApp();
      navigate('/');
    } catch (err) {
      message.error(toUserMessage(err, '恢复失败'));
    }
  };

  const openRename = (record: BackupRecord) => {
    setRenameTarget(record);
    setRenameValue(record.name);
    setRenameOpen(true);
  };

  const handleRename = async () => {
    if (!renameTarget) return;
    const name = renameValue.trim();
    if (!name) {
      message.warning('请输入备份名称');
      return;
    }
    try {
      await Backup.rename(renameTarget.id, name);
      message.success('重命名成功');
      setRenameOpen(false);
      await loadRecords();
    } catch (err) {
      message.error(toUserMessage(err, '重命名失败'));
    }
  };

  const handleDelete = async (record: BackupRecord) => {
    if (!canRestore) {
      message.warning('当前账号无权删除备份');
      return;
    }
    const ok = await confirmWarning(modal, {
      title: '确定删除该备份？',
      content: `备份「${record.name}」删除后不可恢复。`
    });
    if (!ok) return;
    try {
      await Backup.remove(record.id);
      message.success('删除成功');
      await loadRecords();
    } catch (err) {
      message.error(toUserMessage(err, '删除失败'));
    }
  };

  const handleDownload = async (record: BackupRecord) => {
    if (!canBackup) {
      message.warning('当前账号无权下载备份');
      return;
    }
    try {
      await Backup.download(record);
      message.success('下载成功');
    } catch (err) {
      message.error(toUserMessage(err, '下载失败'));
    }
  };

  const handleUploadClick = () => {
    if (!canRestore) {
      message.warning('当前账号无权上传备份');
      return;
    }
    uploadInputRef.current?.click();
  };

  const handleUploadChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      await Backup.upload(file);
      message.success('上传成功');
      await loadRecords();
    } catch (err) {
      message.error(toUserMessage(err, '上传失败'));
    }
  };

  const columns: ColumnsType<BackupRecord> = [
    {
      title: '备份名称',
      dataIndex: 'name',
      width: 180,
      ellipsis: true
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      width: 180,
      render: (value: string) => formatTime(value)
    },
    {
      title: '文件大小',
      dataIndex: 'size',
      width: 110,
      align: 'right',
      render: (value: number) => formatBackupSize(value)
    },
    {
      title: '备份来源',
      dataIndex: 'source',
      width: 120,
      align: 'center',
      render: (value: string) => formatBackupSource(value)
    },
    {
      title: '操作',
      key: 'actions',
      width: 220,
      render: (_, record) => (
        <Space size={12} wrap className="backup-restore-page__actions">
          {canRestore ? (
            <Link onClick={() => void handleRestore(record)}>恢复</Link>
          ) : null}
          {canRestore ? <Link onClick={() => openRename(record)}>重命名</Link> : null}
          {canBackup ? <Link onClick={() => void handleDownload(record)}>下载</Link> : null}
          {canRestore ? (
            <Link type="danger" onClick={() => void handleDelete(record)}>
              删除
            </Link>
          ) : null}
        </Space>
      )
    },
    {
      title: '',
      key: '__fill',
      className: 'backup-restore-page__fill-col',
      onHeaderCell: () => ({ className: 'backup-restore-page__fill-col' }),
      onCell: () => ({ className: 'backup-restore-page__fill-col' }),
      render: () => null
    }
  ];

  if (!allowed) {
    return (
      <Alert
        type="warning"
        showIcon
        message="当前账号无权访问备份与恢复"
        className="backup-restore-page__denied"
      />
    );
  }

  return (
    <div className="page-table-layout backup-restore-page">
      <div className="backup-restore-page__toolbar">
        <Space wrap>
          {canBackup ? (
            <Button type="primary" onClick={() => void handleCreateBackup()}>
              开始备份
            </Button>
          ) : null}
          {canRestore ? (
            <Button disabled={!selectedRowKeys.length} onClick={() => void handleBatchDelete()}>
              批量删除
            </Button>
          ) : null}
        </Space>
      </div>

      <Alert
        type="warning"
        showIcon
        icon={<ExclamationCircleOutlined />}
        className="backup-restore-page__notice"
        message={
          <div className="backup-restore-page__notice-text">
            <div>系统仅支持最多同时保留 {MAX_BACKUPS} 个备份文件</div>
            <div>备份文件已加密，下载后不能直接打开，可上传并恢复到本系统查看</div>
          </div>
        }
      />

      <div className="backup-restore-page__section-title">数据备份记录：</div>

      <ScrollTable
        fillPage
        autoHeight
        rowKey="id"
        columns={columns}
        dataSource={records}
        loading={loading}
        pagination={false}
        bordered
        size="small"
        tableLayout="fixed"
        locale={{ emptyText: '暂无备份记录' }}
        rowSelection={
          canRestore
            ? {
                selectedRowKeys,
                onChange: (keys) => setSelectedRowKeys(keys as string[])
              }
            : undefined
        }
      />

      {canRestore ? (
        <div className="backup-restore-page__upload">
          <Link onClick={handleUploadClick}>上传本地备份</Link>
          <input
            ref={uploadInputRef}
            type="file"
            accept=".bak,.json,application/json"
            hidden
            onChange={(event) => void handleUploadChange(event)}
          />
        </div>
      ) : null}

      {selectedRows.length ? (
        <Text type="secondary" className="backup-restore-page__selection">
          已选 {selectedRows.length} 项
        </Text>
      ) : null}

      <Modal
        title="重命名备份"
        open={renameOpen}
        onCancel={() => setRenameOpen(false)}
        onOk={() => void handleRename()}
        destroyOnHidden
      >
        <Input
          value={renameValue}
          maxLength={64}
          placeholder="请输入备份名称"
          onChange={(event) => setRenameValue(event.target.value)}
        />
      </Modal>
    </div>
  );
}

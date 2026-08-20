import { useState } from 'react';
import { Button, Dropdown, Modal, InputNumber, Space, Typography, App, Tooltip } from 'antd';
import { MoreOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { Voucher } from '../services/voucher.js';
import { confirmWarning } from '../utils/confirmAction.js';
import { useApp } from '../context/AppContext.jsx';

const { Text } = Typography;

export default function VoucherMoreActions({ voucher, onRefresh }) {
  const navigate = useNavigate();
  const { message, modal } = App.useApp();
  const { refresh } = useApp();
  const [reorderOpen, setReorderOpen] = useState(false);
  const [insertOpen, setInsertOpen] = useState(false);
  const [targetNumber, setTargetNumber] = useState(null);
  const [loading, setLoading] = useState(false);

  const voucherType = voucher.voucherType || '记';
  const locked = voucher.status === Voucher.STATUS.LOCKED;

  const notifyDataChanged = () => {
    refresh();
    onRefresh?.();
  };

  const handleReverse = () => {
    modal.confirm({
      title: '冲销凭证',
      content: `将为 ${voucher.voucherNo} 生成一张借贷相反的冲销凭证（草稿），是否继续？`,
      okText: '冲销',
      cancelText: '取消',
      onOk: async () => {
        try {
          const saved = await Voucher.reverse(voucher.id);
          message.success(`已生成冲销凭证 ${saved.voucherNo}`);
          notifyDataChanged();
          navigate(`/vouchers/${saved.id}/edit`);
        } catch (err) {
          message.error(err.message || '冲销失败');
        }
      }
    });
  };

  const handleUnapprove = async () => {
    if (voucher.status !== Voucher.STATUS.APPROVED) return;
    const ok = await confirmWarning(modal, {
      title: '反审核',
      content: `确定将凭证 ${voucher.voucherNo} 改回草稿？反审核后可继续编辑。`,
      okText: '反审核'
    });
    if (!ok) return;
    try {
      await Voucher.unapprove(voucher.id);
      message.success('已反审核，凭证已改回草稿');
      notifyDataChanged();
    } catch (err) {
      message.error(err.message || '反审核失败');
    }
  };

  const handleReorder = async () => {
    if (!targetNumber || targetNumber < 1) {
      message.warning('请输入有效的凭证号');
      return;
    }
    setLoading(true);
    try {
      const result = await Voucher.reorder(voucher.id, targetNumber);
      if (result.changed) {
        message.success(`已调整顺序，当前字号 ${result.voucher.voucherNo}`);
      } else {
        message.info('凭证已在目标位置');
      }
      setReorderOpen(false);
      setTargetNumber(null);
      notifyDataChanged();
    } catch (err) {
      message.error(err.message || '调整顺序失败');
    } finally {
      setLoading(false);
    }
  };

  const handleInsert = async () => {
    if (!targetNumber || targetNumber < 1) {
      message.warning('请输入有效的凭证号');
      return;
    }
    setLoading(true);
    try {
      const reservedNumber = await Voucher.prepareInsertSlot(
        voucherType,
        voucher.date,
        targetNumber
      );
      setInsertOpen(false);
      setTargetNumber(null);
      notifyDataChanged();
      navigate(`/vouchers/new?date=${voucher.date}&number=${reservedNumber}`);
    } catch (err) {
      message.error(err.message || '插入凭证失败');
    } finally {
      setLoading(false);
    }
  };

  const openReorder = () => {
    setTargetNumber(parseInt(voucher.voucherNumber, 10) || null);
    setReorderOpen(true);
  };

  const openInsert = () => {
    setTargetNumber(parseInt(voucher.voucherNumber, 10) || null);
    setInsertOpen(true);
  };

  const menuItems = [
    {
      key: 'unapprove',
      label: '反审核',
      disabled: voucher.status !== Voucher.STATUS.APPROVED
    },
    {
      key: 'reverse',
      label: '冲销',
      disabled: locked
    },
    {
      key: 'reorder',
      label: '调整顺序',
      disabled: locked
    },
    {
      key: 'insert',
      label: (
        <Space size={4}>
          插入凭证
          <Tooltip title="在指定凭证号之前插入一张新凭证，其后凭证字号依次后移">
            <QuestionCircleOutlined className="voucher-more-actions__help" />
          </Tooltip>
        </Space>
      )
    }
  ];

  const onMenuClick = ({ key }) => {
    if (key === 'unapprove') handleUnapprove();
    if (key === 'reverse') handleReverse();
    if (key === 'reorder') openReorder();
    if (key === 'insert') openInsert();
  };

  return (
    <>
      <Dropdown
        menu={{ items: menuItems, onClick: onMenuClick }}
        trigger={['click']}
        placement="bottomLeft"
      >
        <Button type="text" size="small" icon={<MoreOutlined />} title="更多" />
      </Dropdown>

      <Modal
        title="调整顺序"
        open={reorderOpen}
        okText="调整"
        cancelText="取消"
        confirmLoading={loading}
        onOk={handleReorder}
        onCancel={() => {
          setReorderOpen(false);
          setTargetNumber(null);
        }}
        destroyOnHidden
      >
        <Text>
          将已选中的 <Text strong>{voucher.voucherNo}</Text> 凭证移动到{voucherType}字凭证
        </Text>
        <InputNumber
          min={1}
          precision={0}
          value={targetNumber}
          onChange={setTargetNumber}
          className="voucher-more-actions__input"
        />
        <Text> 号之前，同期凭证将按新顺序重新编号</Text>
      </Modal>

      <Modal
        title="插入凭证"
        open={insertOpen}
        okText="插入"
        cancelText="取消"
        confirmLoading={loading}
        onOk={handleInsert}
        onCancel={() => {
          setInsertOpen(false);
          setTargetNumber(null);
        }}
        destroyOnHidden
      >
        <Text>
          在{voucherType}字凭证
        </Text>
        <InputNumber
          min={1}
          precision={0}
          value={targetNumber}
          onChange={setTargetNumber}
          className="voucher-more-actions__input"
        />
        <Text>
          {' '}
          号之前插入一张新凭证，原凭证及其之后的凭证将被顺次后移一个凭证号
        </Text>
      </Modal>
    </>
  );
}

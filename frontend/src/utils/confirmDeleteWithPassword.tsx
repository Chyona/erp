import { Modal } from 'antd';
import type { HookAPI } from 'antd/es/modal/useModal';
import type { ReactNode } from 'react';

/** 删除前二次确认（已登录身份由 JWT 校验，不再要求管理员重复输入密码）。 */
export function confirmDeleteWithPassword(options: {
  modal?: HookAPI;
  isAdmin?: boolean;
  title: string;
  content: ReactNode;
  okText?: string;
  onConfirm: (confirmPassword?: string) => Promise<void>;
}): void {
  const modalApi = options.modal ?? Modal;

  modalApi.confirm({
    title: options.title,
    content: options.content,
    okText: options.okText || '删除',
    okButtonProps: { danger: true },
    cancelText: '取消',
    onOk: () => options.onConfirm()
  });
}

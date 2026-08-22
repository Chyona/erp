import { Modal, Input } from 'antd';
import type { ModalFuncProps } from 'antd';
import type { ReactNode } from 'react';

/** 管理员删除：弹窗输入登录密码；其他角色仅确认。 */
export function confirmDeleteWithPassword(options: {
  isAdmin: boolean;
  title: string;
  content: ReactNode;
  okText?: string;
  onConfirm: (confirmPassword?: string) => Promise<void>;
}): void {
  if (!options.isAdmin) {
    Modal.confirm({
      title: options.title,
      content: options.content,
      okText: options.okText || '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => options.onConfirm()
    });
    return;
  }

  let password = '';
  Modal.confirm({
    title: options.title,
    content: (
      <div>
        <div style={{ marginBottom: 12 }}>{options.content}</div>
        <p style={{ marginBottom: 8, color: 'rgba(0,0,0,0.65)' }}>请输入登录密码以确认删除：</p>
        <Input.Password
          placeholder="登录密码"
          autoComplete="current-password"
          onChange={(e) => {
            password = e.target.value;
          }}
        />
      </div>
    ),
    okText: options.okText || '确认删除',
    okButtonProps: { danger: true },
    cancelText: '取消',
    onOk: async () => {
      if (!password.trim()) {
        throw new Error('请输入登录密码');
      }
      await options.onConfirm(password);
    }
  } as ModalFuncProps);
}

import { Form, Input, Modal } from 'antd';
import type { HookAPI } from 'antd/es/modal/useModal';
import type { ReactNode } from 'react';

/** 危险删除前二次确认，管理员须输入当前登录密码。 */
export function confirmDeleteWithPassword(options: {
  modal?: HookAPI;
  isAdmin?: boolean;
  title: string;
  content: ReactNode;
  okText?: string;
  onConfirm: (confirmPassword?: string) => Promise<void>;
}): void {
  const modalApi = options.modal ?? Modal;

  if (!options.isAdmin) {
    modalApi.confirm({
      title: options.title,
      content: options.content,
      okText: options.okText || '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => options.onConfirm()
    });
    return;
  }

  let passwordValue = '';

  modalApi.confirm({
    title: options.title,
    content: (
      <div>
        <div style={{ marginBottom: 12 }}>{options.content}</div>
        <Form layout="vertical">
          <Form.Item label="当前登录密码" required style={{ marginBottom: 0 }}>
            <Input.Password
              autoComplete="current-password"
              placeholder="请输入当前登录密码"
              onChange={(e) => {
                passwordValue = e.target.value;
              }}
            />
          </Form.Item>
        </Form>
      </div>
    ),
    okText: options.okText || '删除',
    okButtonProps: { danger: true },
    cancelText: '取消',
    onOk: async () => {
      const confirmPassword = passwordValue.trim();
      if (!confirmPassword) {
        return Promise.reject(new Error('请输入当前登录密码'));
      }
      await options.onConfirm(confirmPassword);
    }
  });
}

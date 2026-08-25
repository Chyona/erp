import { useState } from 'react';
import { Alert, Button, Card, Form, Input, Typography } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { APP_CONFIG } from '../config/app';
import { useAuth } from '../context/AuthContext';
import { loginRequest } from '../services/auth';
import { normalizeRole } from '../utils/permissions';
import { toUserMessage } from '../utils/userMessage';

type LoginForm = {
  username: string;
  password: string;
};

function safeRedirectPath(raw: string): string {
  const path = String(raw || '').trim();
  if (!path.startsWith('/') || path.startsWith('//')) return '/';
  return path;
}

export default function Login() {
  const { isAuthenticated, mustChangePassword, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (isAuthenticated && mustChangePassword) {
    return <Navigate to="/setup-password" replace />;
  }
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const searchFrom = new URLSearchParams(location.search).get('from') || '';
  const from = safeRedirectPath(
    (location.state as { from?: string } | null)?.from || searchFrom || '/'
  );

  const onFinish = async (values: LoginForm) => {
    setSubmitting(true);
    setError('');
    try {
      const data = await loginRequest(values.username.trim(), values.password);
      login(data.token, {
        accountId: data.account_id,
        username: data.username,
        nickname: data.nickname || data.username,
        role: normalizeRole(data.role),
        mustChangePassword: Boolean(data.must_change_password)
      });
      if (data.must_change_password) {
        navigate('/setup-password', { replace: true });
      } else {
        navigate(from, { replace: true });
      }
    } catch (err) {
      setError(toUserMessage(err, '登录失败'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <Card className="login-card" bordered={false}>
        <div className="login-brand">
          <span className="login-brand-icon">📒</span>
          <Typography.Title level={3} style={{ margin: 0 }}>
            {APP_CONFIG.shortName}
          </Typography.Title>
          <Typography.Text type="secondary">{APP_CONFIG.description}</Typography.Text>
        </div>

        {error ? (
          <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />
        ) : null}

        <Form<LoginForm>
          layout="vertical"
          size="large"
          onFinish={onFinish}
          initialValues={{ username: '', password: '' }}
          requiredMark={false}
        >
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="用户名" autoComplete="username" />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码"
              autoComplete="current-password"
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" block loading={submitting}>
              登录
            </Button>
          </Form.Item>
        </Form>
        {import.meta.env.VITE_USE_MOCK === 'true' ? (
          <Typography.Paragraph type="secondary" style={{ marginTop: 16, marginBottom: 0, fontSize: 12 }}>
            Mock 模式：请使用 mock 账号登录（首次登录可能需设密）
          </Typography.Paragraph>
        ) : (
          <Typography.Paragraph type="secondary" style={{ marginTop: 16, marginBottom: 0, fontSize: 12 }}>
            首次登录请使用管理员提供的初始密码并设置新密码；之后可在右上角「修改密码」。
          </Typography.Paragraph>
        )}
      </Card>
    </div>
  );
}

import { useState } from 'react';
import { Alert, Button, Card, Form, Input, Typography } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { Navigate, useNavigate } from 'react-router-dom';
import { APP_CONFIG } from '../config/app';
import { useAuth } from '../context/AuthContext';
import { setupPasswordRequest } from '../services/auth';
import { normalizeRole } from '../utils/permissions';

type FormValues = {
  password: string;
  confirm: string;
};

/** 首次登录强制设置密码；之后改密请联系管理员。 */
export default function SetupPassword() {
  const { isAuthenticated, mustChangePassword, login, logout, user } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (!mustChangePassword) {
    return <Navigate to="/" replace />;
  }

  const onFinish = async (values: FormValues) => {
    setSubmitting(true);
    setError('');
    try {
      const data = await setupPasswordRequest(values.password);
      login(data.token, {
        accountId: data.account_id,
        username: data.username,
        nickname: data.nickname || data.username,
        role: normalizeRole(data.role),
        mustChangePassword: data.must_change_password
      });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : '设置失败');
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
            设置登录密码
          </Typography.Title>
          <Typography.Text type="secondary">
            {user?.nickname || user?.username}，首次登录请设置您的专用密码
          </Typography.Text>
        </div>

        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="设置完成后，如需再次修改密码，请联系管理员重置。"
        />

        {error ? (
          <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />
        ) : null}

        <Form<FormValues> layout="vertical" size="large" onFinish={onFinish} requiredMark={false}>
          <Form.Item
            name="password"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码至少 6 位' }
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="至少 6 位"
              autoComplete="new-password"
            />
          </Form.Item>
          <Form.Item
            name="confirm"
            label="确认密码"
            dependencies={['password']}
            rules={[
              { required: true, message: '请再次输入密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                }
              })
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="再次输入新密码"
              autoComplete="new-password"
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 8 }}>
            <Button type="primary" htmlType="submit" block loading={submitting}>
              确认并进入系统
            </Button>
          </Form.Item>
          <Button
            type="link"
            block
            onClick={() => {
              logout();
              navigate('/login', { replace: true });
            }}
          >
            退出登录
          </Button>
        </Form>
        <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0, fontSize: 12 }}>
          {APP_CONFIG.shortName}
        </Typography.Paragraph>
      </Card>
    </div>
  );
}

import { useEffect, useState, type ReactNode } from 'react';
import { Alert, Button } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { isAuthError } from '../utils/apiError';
import AppSpin from './AppSpin';

export default function AppInit({ children }: { children: ReactNode }) {
  const { reinitApp, initWarning, clearInitWarning } = useApp();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [ready, setReady] = useState(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await reinitApp();
        if (!cancelled) setReady(true);
      } catch (err) {
        if (cancelled) return;
        if (isAuthError(err)) {
          logout();
          navigate('/login', {
            replace: true,
            state: { from: location.pathname + location.search }
          });
          return;
        }
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reinitApp, logout, navigate, location.pathname, location.search]);

  const handleRetrySync = async () => {
    setRetrying(true);
    try {
      await reinitApp();
    } catch (err) {
      if (isAuthError(err)) {
        logout();
        navigate('/login', {
          replace: true,
          state: { from: location.pathname + location.search }
        });
      }
    } finally {
      setRetrying(false);
    }
  };

  if (!ready) {
    return (
      <AppSpin fullscreen size="large" tip="加载中…">
        <div style={{ minHeight: 48, minWidth: 96 }} />
      </AppSpin>
    );
  }

  return (
    <>
      {initWarning ? (
        <Alert
          banner
          type="warning"
          showIcon
          message={initWarning}
          action={
            <Button size="small" loading={retrying} onClick={handleRetrySync}>
              重试同步
            </Button>
          }
          closable
          onClose={clearInitWarning}
        />
      ) : null}
      {children}
    </>
  );
}

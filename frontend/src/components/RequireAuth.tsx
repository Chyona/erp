import { Navigate, Outlet, useLocation } from 'react-router-dom';
import AppInit from './AppInit';
import { useAuth } from '../context/AuthContext';

/** 未登录跳转登录页；需设密则跳转设密页；已登录才加载系统初始化。 */
export default function RequireAuth() {
  const { isAuthenticated, mustChangePassword } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  if (mustChangePassword) {
    return <Navigate to="/setup-password" replace />;
  }

  return (
    <AppInit>
      <Outlet />
    </AppInit>
  );
}

import { Navigate } from 'react-router-dom';
import PayrollStatsPanel from '../components/PayrollStatsPanel';
import { useAuth } from '../context/AuthContext';

export default function PayrollStats() {
  const { can } = useAuth();
  if (!can('closing.view')) {
    return <Navigate to="/" replace />;
  }
  return <PayrollStatsPanel />;
}

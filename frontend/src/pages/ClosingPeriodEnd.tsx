import { Navigate } from 'react-router-dom';
import MonthEndClosingPanel from '../components/MonthEndClosingPanel';
import { useAuth } from '../context/AuthContext';

export default function ClosingPeriodEnd() {
  const { can } = useAuth();
  if (!can('closing.view')) {
    return <Navigate to="/" replace />;
  }
  return <MonthEndClosingPanel readOnly={!can('closing')} />;
}

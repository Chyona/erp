import { Navigate } from 'react-router-dom';
import MonthEndReimbursementPanel from '../components/MonthEndReimbursementPanel';
import { useAuth } from '../context/AuthContext';

export default function ClosingReimbursement() {
  const { can } = useAuth();
  if (!can('closing.view')) {
    return <Navigate to="/" replace />;
  }
  return <MonthEndReimbursementPanel readOnly={!can('closing')} />;
}

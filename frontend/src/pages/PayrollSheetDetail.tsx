import { Navigate } from 'react-router-dom';
import PayrollSheetDetailPanel from '../components/PayrollSheetDetailPanel';
import { useAuth } from '../context/AuthContext';

export default function PayrollSheetDetail() {
  const { can } = useAuth();
  if (!can('closing.view')) {
    return <Navigate to="/" replace />;
  }
  return <PayrollSheetDetailPanel readOnly={!can('closing')} />;
}

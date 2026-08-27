import { Navigate } from 'react-router-dom';
import PayrollSheetListPanel from '../components/PayrollSheetListPanel';
import { useAuth } from '../context/AuthContext';

export default function PayrollSheet() {
  const { can } = useAuth();
  if (!can('closing.view')) {
    return <Navigate to="/" replace />;
  }
  return <PayrollSheetListPanel readOnly={!can('closing')} />;
}

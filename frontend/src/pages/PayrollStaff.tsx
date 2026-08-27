import { Navigate } from 'react-router-dom';
import PayrollStaffPanel from '../components/PayrollStaffPanel';
import { useAuth } from '../context/AuthContext';

export default function PayrollStaff() {
  const { can } = useAuth();
  if (!can('closing.view')) {
    return <Navigate to="/" replace />;
  }
  return <PayrollStaffPanel readOnly={!can('closing')} />;
}

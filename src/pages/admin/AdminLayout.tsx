import { Navigate, Outlet } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { Navbar } from '@/components/Navbar';
import { LoadingState } from '@/components/LoadingState';

export default function AdminLayout() {
  const { isAdmin, isLoading } = useUserRole();

  if (isLoading) {
    return (
      <div className="min-h-screen somma-shell flex items-center justify-center px-6">
        <LoadingState label="Carregando área administrativa..." />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen somma-shell">
      <Navbar />
      <main className="somma-admin container mx-auto px-4 pt-28 pb-14">
        <Outlet />
      </main>
    </div>
  );
}

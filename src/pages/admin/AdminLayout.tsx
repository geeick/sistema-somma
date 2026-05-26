import { Navigate, Outlet } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { Navbar } from '@/components/Navbar';
import { Loader2 } from 'lucide-react';

export default function AdminLayout() {
  const { isAdmin, isLoading } = useUserRole();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 pt-24 pb-8">
        <Outlet />
      </main>
    </div>
  );
}

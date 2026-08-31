import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getNeonSession, type NeonUser } from "@/lib/auth";
import { Navbar } from "@/components/Navbar";
import { UploadVideo } from "@/components/UploadVideo";
import { VideoList } from "@/components/VideoList";
import { StatsCards } from "@/components/StatsCards";
import { WalletDisplay } from "@/components/WalletDisplay";

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<NeonUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    getNeonSession()
      .then(({ user }) => {
        if (!user) {
          navigate("/auth");
        } else {
          setUser(user);
        }
      })
      .catch(() => navigate("/auth"))
      .finally(() => setIsLoading(false));
  }, [navigate]);

  const refreshDashboard = () => {
    setRefreshKey((current) => current + 1);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen somma-shell flex items-center justify-center">
        <div className="text-base font-semibold text-muted-foreground">Carregando painel...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen somma-shell">
      <Navbar />
      <div className="container mx-auto px-4 pt-28 pb-16">
        <div className="max-w-7xl mx-auto">
          <div className="app-page-header">
            <p className="app-eyebrow">Painel Somma</p>
            <h1 className="app-title">Painel do criador</h1>
            <p className="app-subtitle">
              Envie conteúdos, acompanhe aprovações e ganhos, e gerencie seus saques em um só lugar.
            </p>
          </div>

          <div className="mt-6 page-enter stagger-1">
            <StatsCards userId={user?.id} refreshKey={refreshKey} />
          </div>

          <div className="mt-5 page-enter stagger-2">
            <WalletDisplay userId={user?.id} refreshKey={refreshKey} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.55fr] gap-6 mt-6 items-start">
            <div className="page-enter stagger-3">
              <UploadVideo userId={user?.id} onSubmissionCreated={refreshDashboard} />
            </div>
            <div className="page-enter stagger-4">
              <VideoList userId={user?.id} refreshKey={refreshKey} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

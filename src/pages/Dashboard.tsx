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
        <div className="text-xl">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen somma-shell">
      <Navbar />
      <div className="container mx-auto px-4 pt-28 pb-16">
        <div className="mb-8 somma-dark-panel somma-grain rounded-[2rem] p-8">
          <p className="text-primary font-semibold mb-2">Painel Somma</p>
          <h1 className="font-display text-5xl font-black mb-3 text-[#f7ead1]">Painel do Criador</h1>
          <p className="text-[#f7ead1]/75 max-w-2xl">
            Envie conteúdos, acompanhe ganhos aprovados e solicite saques quando sua carteira estiver disponível.
          </p>
        </div>

        <StatsCards userId={user?.id} refreshKey={refreshKey} />

        <div className="mt-4">
          <WalletDisplay userId={user?.id} refreshKey={refreshKey} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
          <div className="lg:col-span-1">
            <UploadVideo userId={user?.id} onSubmissionCreated={refreshDashboard} />
          </div>
          <div className="lg:col-span-2">
            <VideoList userId={user?.id} refreshKey={refreshKey} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;


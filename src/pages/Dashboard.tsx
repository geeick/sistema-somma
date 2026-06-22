import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getNeonSession, type NeonUser } from "@/lib/auth";
import { Navbar } from "@/components/Navbar";
import { UploadVideo } from "@/components/UploadVideo";
import { VideoList } from "@/components/VideoList";
import { StatsCards } from "@/components/StatsCards";
import { WalletDisplay } from "@/components/WalletDisplay";
import { useSheetMetrics } from "@/hooks/useSheetMetrics";

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<NeonUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { sheetMetrics, refetch: refetchMetrics } = useSheetMetrics();

  useEffect(() => {
    getNeonSession().then(({ user }) => {
      if (!user) {
        navigate("/auth");
      } else {
        setUser(user);
      }
      setIsLoading(false);
    }).catch(() => {
      setIsLoading(false);
      navigate("/auth");
    });
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-16">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Creator Dashboard</h1>
          <p className="text-muted-foreground">
            Upload your videos and track your earnings
          </p>
        </div>

        <StatsCards userId={user?.id} sheetMetrics={sheetMetrics} />
        
        <WalletDisplay userId={user?.id} />
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
          <div className="lg:col-span-1">
            <UploadVideo userId={user?.id} />
          </div>
          <div className="lg:col-span-2">
            <VideoList userId={user?.id} sheetMetrics={sheetMetrics} onMetricsRefresh={refetchMetrics} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

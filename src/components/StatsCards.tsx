import { useEffect, useState } from "react";
import apiClient from "@/integrations/apiClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Video, Wallet, Clock } from "lucide-react";

interface StatsCardsProps {
  userId?: string;
  refreshKey?: number;
}

interface ProfileSummary {
  total_earnings?: number | string | null;
  balance_total?: number | string | null;
  balance_available?: number | string | null;
  pending_withdrawals?: number | string | null;
}

interface Submission {
  id: string;
  status: string | null;
}

function toNumber(value: number | string | null | undefined) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
}

function formatMoney(value: number | string | null | undefined) {
  return toNumber(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export const StatsCards = ({ userId, refreshKey = 0 }: StatsCardsProps) => {
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  useEffect(() => {
    if (!userId) return;

    const fetchStats = async () => {
      try {
        const [profileData, submissionsData] = await Promise.all([
          apiClient.wallet.profile(),
          apiClient.tables.list("submissions", { user_id: userId }),
        ]);

        setProfile(profileData || null);
        setSubmissions(submissionsData || []);
      } catch (err) {
        console.error("Falha ao carregar estatísticas do painel:", err);
      }
    };

    fetchStats();
  }, [userId, refreshKey]);

  const activeSubmissions = submissions.filter(
    (submission) => String(submission.status || "").toLowerCase() !== "deleted"
  );

  const totalEarnings = profile?.balance_total ?? profile?.total_earnings ?? 0;
  const available = profile?.balance_available ?? 0;
  const pendingWithdrawals = profile?.pending_withdrawals ?? 0;

  const statCards = [
    {
      title: "Ganhos totais",
      value: `R$ ${formatMoney(totalEarnings)}`,
      icon: DollarSign,
      color: "text-green-700",
    },
    {
      title: "Disponível agora",
      value: `R$ ${formatMoney(available)}`,
      icon: Wallet,
      color: "text-green-700",
    },
    {
      title: "Vídeos enviados",
      value: activeSubmissions.length.toString(),
      icon: Video,
      color: "text-primary",
    },
    {
      title: "Saques pendentes",
      value: `R$ ${formatMoney(pendingWithdrawals)}`,
      icon: Clock,
      color: "text-yellow-700",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {statCards.map((stat) => (
        <Card key={stat.title} className="somma-panel rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {stat.title}
            </CardTitle>
            <stat.icon className={`h-4 w-4 ${stat.color}`} />
          </CardHeader>
          <CardContent>
            <div className="font-display text-3xl font-black">{stat.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

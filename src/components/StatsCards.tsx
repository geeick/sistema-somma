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
    { title: "Ganhos totais", value: `R$ ${formatMoney(totalEarnings)}`, icon: DollarSign, iconClass: "text-emerald-700 bg-emerald-50" },
    { title: "Disponível agora", value: `R$ ${formatMoney(available)}`, icon: Wallet, iconClass: "text-emerald-700 bg-emerald-50" },
    { title: "Vídeos enviados", value: activeSubmissions.length.toString(), icon: Video, iconClass: "text-primary bg-primary/10" },
    { title: "Saques pendentes", value: `R$ ${formatMoney(pendingWithdrawals)}`, icon: Clock, iconClass: "text-amber-700 bg-amber-50" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {statCards.map((stat) => (
        <Card key={stat.title} className="somma-panel rounded-2xl min-h-[138px]">
          <CardHeader className="flex flex-row items-start justify-between pb-3">
            <CardTitle className="text-[0.92rem] font-bold text-muted-foreground tracking-[-0.015em]">
              {stat.title}
            </CardTitle>
            <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${stat.iconClass}`}>
              <stat.icon className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="metric-value text-[2rem] md:text-[2.15rem]">{stat.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

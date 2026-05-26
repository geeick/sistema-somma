import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Video } from "lucide-react";
import { SheetMetric, findMetricForUrl, computePayoutFromPlays } from "@/hooks/useSheetMetrics";

interface StatsCardsProps {
  userId?: string;
  sheetMetrics?: SheetMetric[];
}

interface Submission {
  payment_amount: number | null;
  status: string;
  post_url: string | null;
}

export const StatsCards = ({ userId, sheetMetrics = [] }: StatsCardsProps) => {
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  useEffect(() => {
    if (!userId) return;

    const fetchSubmissions = async () => {
      const { data } = await supabase
        .from("submissions")
        .select("payment_amount, status, post_url")
        .eq("user_id", userId);

      if (data) setSubmissions(data);
    };

    fetchSubmissions();

    const channel = supabase
      .channel("stats-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "submissions",
          filter: `user_id=eq.${userId}`,
        },
        () => fetchSubmissions()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const activeSubmissions = submissions.filter((v) => v.status !== "deleted");
  const totalVideos = activeSubmissions.length;

  // Calculate earnings from sheet metrics plays using tier table
  const totalEarnings = activeSubmissions.reduce((sum, sub) => {
    const metric = findMetricForUrl(sub.post_url, sheetMetrics);
    const plays = metric?.plays || 0;
    return sum + computePayoutFromPlays(plays);
  }, 0);

  const statCards = [
    {
      title: "Total Earnings",
      value: `R$ ${totalEarnings.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: "text-green-500",
    },
    {
      title: "Total Videos",
      value: totalVideos.toString(),
      icon: Video,
      color: "text-primary",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {statCards.map((stat) => (
        <Card key={stat.title} className="bg-gradient-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {stat.title}
            </CardTitle>
            <stat.icon className={`h-4 w-4 ${stat.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

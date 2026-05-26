import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Video, DollarSign, TrendingUp } from 'lucide-react';

export function CreatorStats() {
  const [stats, setStats] = useState({
    creators: 0,
    submissions: 0,
    totalPaid: 0,
    pendingPayouts: 0,
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // Get creator count from view
      const { data: creatorData } = await supabase
        .from('creator_count_v')
        .select('creator_count')
        .single();

      // Get submission count (excluding deleted)
      const { count: submissionCount } = await supabase
        .from('submissions')
        .select('*', { count: 'exact', head: true })
        .neq('status', 'deleted');

      // Get total paid
      const { data: paidData } = await supabase
        .from('submissions')
        .select('payment_amount')
        .eq('status', 'paid')
        .neq('status', 'deleted');

      const totalPaid = paidData?.reduce((sum, s) => sum + (s.payment_amount || 0), 0) || 0;

      // Get pending payouts
      const { data: pendingData } = await supabase
        .from('submissions')
        .select('payment_amount')
        .eq('status', 'approved')
        .neq('status', 'deleted')
        .not('payment_amount', 'is', null);

      const pendingPayouts = pendingData?.reduce((sum, s) => sum + (s.payment_amount || 0), 0) || 0;

      setStats({
        creators: creatorData?.creator_count || 0,
        submissions: submissionCount || 0,
        totalPaid,
        pendingPayouts,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const statCards = [
    {
      title: 'Total Creators',
      value: stats.creators,
      icon: Users,
      color: 'text-blue-500',
    },
    {
      title: 'Submissions',
      value: stats.submissions,
      icon: Video,
      color: 'text-green-500',
    },
    {
      title: 'Total Paid',
      value: `R$ ${stats.totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: 'text-yellow-500',
    },
    {
      title: 'Pending Payouts',
      value: `R$ ${stats.pendingPayouts.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      icon: TrendingUp,
      color: 'text-purple-500',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.creators === 0 && (
        <Card className="col-span-full">
          <CardContent className="pt-6 text-center text-muted-foreground">
            No creators found. Creators will appear here once they register or add pages.
          </CardContent>
        </Card>
      )}
      {statCards.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <Icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

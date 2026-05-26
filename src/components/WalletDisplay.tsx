import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet, TrendingUp } from 'lucide-react';

interface WalletDisplayProps {
  userId?: string;
}

export function WalletDisplay({ userId }: WalletDisplayProps) {
  const [balance, setBalance] = useState({
    total: 0,
    available: 0,
  });

  useEffect(() => {
    if (!userId) return;
    fetchBalance();
  }, [userId]);

  const fetchBalance = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('balance_total, balance_available')
        .eq('id', userId)
        .single();

      if (error) throw error;

      setBalance({
        total: data?.balance_total || 0,
        available: data?.balance_available || 0,
      });
    } catch (error) {
      console.error('Error fetching balance:', error);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Gains</CardTitle>
          <TrendingUp className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            R$ {balance.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-muted-foreground mt-1">All-time earnings</p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Available Now</CardTitle>
          <Wallet className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            R$ {balance.available.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Ready to withdraw</p>
        </CardContent>
      </Card>
    </div>
  );
}

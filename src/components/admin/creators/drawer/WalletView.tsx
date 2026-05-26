import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';

interface Ledger {
  id: string;
  amount: number;
  type: string;
  description: string | null;
  created_at: string;
}

export function WalletView({ userId }: { userId: string }) {
  const [ledger, setLedger] = useState<Ledger[]>([]);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchWallet();
  }, [userId]);

  const fetchWallet = async () => {
    try {
      // Get profile total earnings
      const { data: profile } = await supabase
        .from('profiles')
        .select('total_earnings')
        .eq('id', userId)
        .single();

      setTotalEarnings(profile?.total_earnings || 0);

      // Get ledger entries
      const { data, error } = await supabase
        .from('ledger')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setLedger(data || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center py-4">Loading...</div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Wallet Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Earnings</span>
              <span className="font-semibold">R$ {totalEarnings.toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ledger.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                  No transactions
                </TableCell>
              </TableRow>
            ) : (
              ledger.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="capitalize">{entry.type}</TableCell>
                  <TableCell className={entry.amount > 0 ? 'text-green-600' : 'text-red-600'}>
                    {entry.amount > 0 ? '+' : ''}R$ {entry.amount.toFixed(2)}
                  </TableCell>
                  <TableCell>{entry.description || 'N/A'}</TableCell>
                  <TableCell>{new Date(entry.created_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

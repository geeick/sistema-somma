import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { DollarSign, Clock, CheckCircle, XCircle, TrendingUp, Users } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface Withdrawal {
  id: string;
  user_id: string;
  amount: number;
  pix_key: string;
  status: string;
  requested_at: string;
  profiles: {
    full_name: string | null;
    email: string | null;
  } | null;
}

interface Stats {
  pendingWithdrawals: number;
  totalPendingAmount: number;
  totalPaidOut: number;
  activeCreators: number;
}

export default function WalletAdmin() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [stats, setStats] = useState<Stats>({
    pendingWithdrawals: 0,
    totalPendingAmount: 0,
    totalPaidOut: 0,
    activeCreators: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch pending withdrawals
      const { data: withdrawalsData, error: withdrawalsError } = await supabase
        .from('withdrawals')
        .select('*, profiles(full_name, email)')
        .eq('status', 'requested')
        .order('requested_at', { ascending: true });

      if (withdrawalsError) throw withdrawalsError;
      setWithdrawals(withdrawalsData || []);

      // Calculate stats
      const pendingAmount = withdrawalsData?.reduce((sum, w) => sum + Number(w.amount), 0) || 0;

      const { data: paidWithdrawals } = await supabase
        .from('withdrawals')
        .select('amount')
        .eq('status', 'paid');
      
      const totalPaid = paidWithdrawals?.reduce((sum, w) => sum + Number(w.amount), 0) || 0;

      const { data: creators } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true });

      setStats({
        pendingWithdrawals: withdrawalsData?.length || 0,
        totalPendingAmount: pendingAmount,
        totalPaidOut: totalPaid,
        activeCreators: creators?.length || 0,
      });
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load wallet data');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (withdrawalId: string) => {
    try {
      const { error } = await supabase
        .from('withdrawals')
        .update({ status: 'approved', approved_at: new Date().toISOString() })
        .eq('id', withdrawalId);

      if (error) throw error;
      
      toast.success('Withdrawal approved');
      fetchData();
    } catch (error) {
      console.error('Error approving withdrawal:', error);
      toast.error('Failed to approve withdrawal');
    }
  };

  const handleReject = async (withdrawalId: string) => {
    try {
      // Get withdrawal details to refund the user
      const { data: withdrawal } = await supabase
        .from('withdrawals')
        .select('user_id, amount')
        .eq('id', withdrawalId)
        .single();

      if (!withdrawal) throw new Error('Withdrawal not found');

      // Get current balance
      const { data: profile } = await supabase
        .from('profiles')
        .select('balance_available')
        .eq('id', withdrawal.user_id)
        .single();

      if (!profile) throw new Error('Profile not found');

      // Refund to user's available balance
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ 
          balance_available: Number(profile.balance_available) + Number(withdrawal.amount)
        })
        .eq('id', withdrawal.user_id);

      if (profileError) throw profileError;

      // Add reversal entry to ledger
      const { error: ledgerError } = await supabase
        .from('ledger')
        .insert({
          user_id: withdrawal.user_id,
          amount: withdrawal.amount,
          type: 'reversal',
          ref_id: withdrawalId,
          description: 'Withdrawal request rejected - refunded to balance',
        });

      if (ledgerError) throw ledgerError;

      // Update withdrawal status
      const { error } = await supabase
        .from('withdrawals')
        .update({ status: 'rejected' })
        .eq('id', withdrawalId);

      if (error) throw error;
      
      toast.success('Withdrawal rejected and amount refunded');
      fetchData();
    } catch (error) {
      console.error('Error rejecting withdrawal:', error);
      toast.error('Failed to reject withdrawal');
    }
  };

  const handleMarkAsPaid = async (withdrawalId: string) => {
    try {
      const { error } = await supabase
        .from('withdrawals')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', withdrawalId);

      if (error) throw error;
      
      toast.success('Withdrawal marked as paid');
      fetchData();
    } catch (error) {
      console.error('Error marking as paid:', error);
      toast.error('Failed to mark as paid');
    }
  };

  if (loading) {
    return <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold mb-2">Wallet & Payouts</h1>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    </div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold mb-2">Carteira & Pagamentos</h1>
          <p className="text-muted-foreground">Processar saques e gerenciar finanças</p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            const csv = [
              ['Criador', 'Email', 'Chave PIX', 'Valor', 'Status', 'Solicitado em'],
              ...withdrawals.map(w => [
                w.profiles?.full_name || 'Desconhecido',
                w.profiles?.email || '',
                w.pix_key,
                Number(w.amount).toFixed(2),
                w.status,
                new Date(w.requested_at).toLocaleDateString('pt-BR'),
              ]),
            ].map(row => row.join(',')).join('\n');
            
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `saques-${new Date().toISOString()}.csv`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          disabled={withdrawals.length === 0}
        >
          Exportar CSV
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <p className="text-2xl font-bold">{stats.pendingWithdrawals}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              <p className="text-2xl font-bold">R$ {stats.totalPendingAmount.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Paid Out</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <p className="text-2xl font-bold">R$ {stats.totalPaidOut.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Creators</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <p className="text-2xl font-bold">{stats.activeCreators}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Withdrawals Table */}
      <Card className="bg-gradient-card border-border">
        <CardHeader>
          <CardTitle>Pending Withdrawal Requests</CardTitle>
          <CardDescription>Review and process creator withdrawal requests</CardDescription>
        </CardHeader>
        <CardContent>
          {withdrawals.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No pending withdrawals</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Creator</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>PIX Key</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {withdrawals.map((withdrawal) => (
                    <TableRow key={withdrawal.id}>
                      <TableCell className="font-medium">
                        {withdrawal.profiles?.full_name || 'Unknown'}
                      </TableCell>
                      <TableCell>{withdrawal.profiles?.email || 'N/A'}</TableCell>
                      <TableCell className="font-mono text-sm">{withdrawal.pix_key}</TableCell>
                      <TableCell className="text-right font-semibold text-primary">
                        R$ {Number(withdrawal.amount).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {new Date(withdrawal.requested_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {withdrawal.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="default">
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Approve Withdrawal</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to approve this withdrawal of R$ {Number(withdrawal.amount).toLocaleString()} to {withdrawal.profiles?.full_name}?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleApprove(withdrawal.id)}>
                                  Approve
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="destructive">
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Reject Withdrawal</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to reject this withdrawal? The amount will be refunded to the creator's balance.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleReject(withdrawal.id)}>
                                  Reject
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

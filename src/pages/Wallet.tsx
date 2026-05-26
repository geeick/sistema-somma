import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { DollarSign, Wallet as WalletIcon, TrendingUp } from "lucide-react";
import { User } from "@supabase/supabase-js";

interface Profile {
  total_earnings: number | null;
  pix_key: string | null;
}

interface Withdrawal {
  id: string;
  amount: number;
  pix_key: string;
  status: string;
  requested_at: string;
}

const Wallet = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [pixKey, setPixKey] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/auth");
      }
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      const [profileResult, withdrawalsResult] = await Promise.all([
        supabase.from("profiles").select("total_earnings, pix_key").eq("id", user.id).single(),
        supabase.from("withdrawals").select("*").eq("user_id", user.id).order("requested_at", { ascending: false })
      ]);

      if (profileResult.data) {
        setProfile(profileResult.data);
        setPixKey(profileResult.data.pix_key || "");
      }
      if (withdrawalsResult.data) setWithdrawals(withdrawalsResult.data);
      setIsLoading(false);
    };

    fetchData();
  }, [user]);

  const handleRequestWithdrawal = async () => {
    if (!user || !amount || !pixKey) {
      toast({ title: "Erro", description: "Por favor, preencha todos os campos", variant: "destructive" });
      return;
    }

    const amountNum = parseFloat(amount);
    if (amountNum <= 0) {
      toast({ title: "Erro", description: "O valor deve ser maior que 0", variant: "destructive" });
      return;
    }

    if (amountNum < 25) {
      toast({ title: "Erro", description: "O valor mínimo para saque é R$ 25,00", variant: "destructive" });
      return;
    }

    const available = profile?.total_earnings || 0;
    if (amountNum > available) {
      toast({ title: "Erro", description: "Saldo insuficiente", variant: "destructive" });
      return;
    }

    const { error } = await supabase.from("withdrawals").insert({
      user_id: user.id,
      amount: amountNum,
      pix_key: pixKey,
      status: "requested"
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Withdrawal requested successfully! We'll process it soon." });
      setIsDialogOpen(false);
      setAmount("");
      
      const { data } = await supabase.from("withdrawals").select("*").eq("user_id", user.id).order("requested_at", { ascending: false });
      if (data) setWithdrawals(data);
    }
  };

  const statusColors: Record<string, string> = {
    requested: "bg-yellow-500",
    approved: "bg-blue-500",
    paid: "bg-green-500",
    rejected: "bg-red-500"
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <Navbar />
        <div className="container mx-auto px-4 pt-24 pb-12">
          <p className="text-center text-muted-foreground">Loading wallet...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-4xl mx-auto space-y-6">
          <h1 className="text-4xl font-bold mb-2">Wallet</h1>

          <div className="grid md:grid-cols-2 gap-4">
            <Card className="bg-gradient-card border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">
                  R$ {(profile?.total_earnings || 0).toFixed(2)}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-card border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Available Balance</CardTitle>
                <WalletIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  R$ {(profile?.total_earnings || 0).toFixed(2)}
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="mt-4 w-full">Request Withdrawal</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Request Withdrawal via PIX</DialogTitle>
                      <DialogDescription>Enter the amount and your PIX key to request a withdrawal</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Valor (R$)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="25"
                          placeholder="Mínimo: R$ 25,00"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Valor mínimo para saque: R$ 25,00
                        </p>
                      </div>
                      <div>
                        <Label>PIX Key</Label>
                        <Input
                          placeholder="CPF, email, or phone"
                          value={pixKey}
                          onChange={(e) => setPixKey(e.target.value)}
                        />
                      </div>
                      <Button onClick={handleRequestWithdrawal} className="w-full">
                        Submit Request
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-gradient-card border-border">
            <CardHeader>
              <CardTitle>Withdrawal History</CardTitle>
              <CardDescription>Track your withdrawal requests</CardDescription>
            </CardHeader>
            <CardContent>
              {withdrawals.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No withdrawal requests yet</p>
              ) : (
                <div className="space-y-4">
                  {withdrawals.map((withdrawal) => (
                    <div key={withdrawal.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                      <div className="flex-1">
                        <p className="font-semibold text-lg">R$ {withdrawal.amount.toFixed(2)}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(withdrawal.requested_at).toLocaleDateString()}
                        </p>
                        <p className="text-sm text-muted-foreground">PIX: {withdrawal.pix_key}</p>
                      </div>
                      <Badge className={`${statusColors[withdrawal.status]} text-white`}>
                        {withdrawal.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Wallet;

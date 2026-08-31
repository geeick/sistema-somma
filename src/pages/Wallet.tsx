import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "@/integrations/apiClient";
import { getNeonUser, type NeonUser } from "@/lib/auth";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Wallet as WalletIcon, TrendingUp, Clock } from "lucide-react";

interface Profile {
  total_earnings?: number | string | null;
  balance_total?: number | string | null;
  balance_available?: number | string | null;
  pending_withdrawals?: number | string | null;
  paid_out?: number | string | null;
  pix_key?: string | null;
}

interface Withdrawal {
  id: string;
  amount: number | string;
  pix_key?: string | null;
  status: string;
  requested_at: string;
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

const statusLabels: Record<string, string> = {
  requested: "Solicitado",
  pending: "Pendente",
  approved: "Aprovado",
  paid: "Pago",
  rejected: "Rejeitado",
};

const Wallet = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<NeonUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [pixKey, setPixKey] = useState("");

  const totalEarnings = toNumber(profile?.balance_total ?? profile?.total_earnings);
  const available = toNumber(profile?.balance_available);
  const pendingWithdrawals = toNumber(profile?.pending_withdrawals);
  const paidOut = toNumber(profile?.paid_out);

  const loadWallet = async () => {
    try {
      const [profileData, withdrawalsData] = await Promise.all([
        apiClient.wallet.profile(),
        apiClient.wallet.withdrawals(),
      ]);

      setProfile(profileData || null);
      setWithdrawals(withdrawalsData || []);

      if (profileData?.pix_key) {
        setPixKey(profileData.pix_key);
      }
    } catch (err) {
      console.error("Erro ao carregar carteira:", err);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados da carteira.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    getNeonUser()
      .then((currentUser) => {
        if (!currentUser) {
          navigate("/auth");
          return;
        }
        setUser(currentUser);
      })
      .catch(() => navigate("/auth"));
  }, [navigate]);

  useEffect(() => {
    if (!user) return;
    loadWallet();
  }, [user]);

  const handleRequestWithdrawal = async () => {
    if (!user || !amount || !pixKey) {
      toast({ title: "Erro", description: "Por favor, preencha todos os campos.", variant: "destructive" });
      return;
    }

    const amountNum = Number(amount);

    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      toast({ title: "Erro", description: "O valor deve ser maior que zero.", variant: "destructive" });
      return;
    }

    if (amountNum < 25) {
      toast({ title: "Erro", description: "O valor mínimo para saque é R$ 25,00.", variant: "destructive" });
      return;
    }

    if (amountNum > available) {
      toast({ title: "Erro", description: "Saldo insuficiente.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);

    try {
      await apiClient.wallet.requestWithdrawal({ amount: amountNum, pix_key: pixKey });
      toast({ title: "Sucesso", description: "Saque solicitado com sucesso. Um administrador processará em breve." });
      setIsDialogOpen(false);
      setAmount("");
      await loadWallet();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message || String(err), variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusColors: Record<string, string> = {
    requested: "bg-yellow-500",
    pending: "bg-yellow-500",
    approved: "bg-blue-500",
    paid: "bg-green-500",
    rejected: "bg-red-500",
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <Navbar />
        <div className="container mx-auto px-4 pt-24 pb-12">
          <p className="text-center text-muted-foreground">Carregando carteira...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-5xl mx-auto space-y-6">
          <div>
            <h1 className="text-4xl font-bold mb-2">Carteira</h1>
            <p className="text-muted-foreground">
              Acompanhe seus ganhos e solicite saques via PIX.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Card className="bg-gradient-card border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ganhos aprovados totais</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">
                  R$ {formatMoney(totalEarnings)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Apenas envios aprovados e pagos entram neste total.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-card border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Saldo disponível</CardTitle>
                <WalletIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  R$ {formatMoney(available)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Saques pendentes e pagos já foram descontados.
                </p>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="mt-4 w-full" disabled={available < 25}>
                      Solicitar saque
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Solicitar saque via PIX</DialogTitle>
                      <DialogDescription>
                        Digite o valor e sua chave PIX. A chave completa não será exibida novamente depois de salva.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Valor (R$)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="25"
                          max={available}
                          placeholder="Mínimo: R$ 25,00"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Disponível: R$ {formatMoney(available)}. Valor mínimo: R$ 25,00.
                        </p>
                      </div>
                      <div>
                        <Label>Chave PIX</Label>
                        <Input
                          placeholder="CPF, e-mail, telefone ou chave aleatória PIX"
                          value={pixKey}
                          onChange={(e) => setPixKey(e.target.value)}
                        />
                        {profile?.pix_key && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Chave salva: {profile.pix_key}. Digite uma chave completa para atualizá-la.
                          </p>
                        )}
                      </div>
                      <Button onClick={handleRequestWithdrawal} className="w-full" disabled={isSubmitting}>
                        {isSubmitting ? "Enviando..." : "Enviar solicitação"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>

            <Card className="bg-gradient-card border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Saques pendentes</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  R$ {formatMoney(pendingWithdrawals)}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-card border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total pago</CardTitle>
                <WalletIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  R$ {formatMoney(paidOut)}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-gradient-card border-border">
            <CardHeader>
              <CardTitle>Histórico de saques</CardTitle>
              <CardDescription>Acompanhe suas solicitações de saque</CardDescription>
            </CardHeader>
            <CardContent>
              {withdrawals.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhuma solicitação de saque ainda</p>
              ) : (
                <div className="space-y-4">
                  {withdrawals.map((withdrawal) => (
                    <div key={withdrawal.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                      <div className="flex-1">
                        <p className="font-semibold text-lg">R$ {formatMoney(withdrawal.amount)}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(withdrawal.requested_at).toLocaleDateString("pt-BR")}
                        </p>
                        {withdrawal.pix_key && (
                          <p className="text-sm text-muted-foreground">PIX: {withdrawal.pix_key}</p>
                        )}
                      </div>
                      <Badge className={`${statusColors[withdrawal.status] || "bg-muted"} text-white`}>
                        {statusLabels[withdrawal.status] || withdrawal.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gradient-card border-border">
            <CardHeader>
              <CardTitle>Regras de saque</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>Saque mínimo: R$ 25,00</p>
              <p>As solicitações começam como pendentes e são processadas por um administrador.</p>
              <p>O saldo disponível desconta saques solicitados, pendentes, aprovados e pagos para evitar saques duplicados.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Wallet;

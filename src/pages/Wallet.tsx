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
import { Wallet as WalletIcon, TrendingUp, Clock, Sparkles } from "lucide-react";

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

      if (profileData?.pix_key) setPixKey(profileData.pix_key);
    } catch (err) {
      console.error("Erro ao carregar carteira:", err);
      toast({ title: "Erro", description: "Não foi possível carregar os dados da carteira.", variant: "destructive" });
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
    requested: "border-amber-300 bg-amber-100 text-amber-900",
    pending: "border-amber-300 bg-amber-100 text-amber-900",
    approved: "border-blue-300 bg-blue-100 text-blue-900",
    paid: "border-emerald-300 bg-emerald-100 text-emerald-900",
    rejected: "border-red-300 bg-red-100 text-red-900",
  };

  if (isLoading) {
    return (
      <div className="min-h-screen somma-shell">
        <Navbar />
        <div className="container mx-auto px-4 pt-28 pb-12">
          <p className="text-center text-muted-foreground font-semibold">Carregando carteira...</p>
        </div>
      </div>
    );
  }

  const summaryCards = [
    { title: "Ganhos aprovados", value: totalEarnings, note: "Somente envios aprovados e pagos.", icon: TrendingUp, accent: true },
    { title: "Saldo disponível", value: available, note: "Saques pendentes e pagos já foram descontados.", icon: WalletIcon },
    { title: "Saques pendentes", value: pendingWithdrawals, note: "Solicitações aguardando processamento.", icon: Clock },
    { title: "Total pago", value: paidOut, note: "Valor já enviado para você.", icon: WalletIcon },
  ];

  return (
    <div className="min-h-screen somma-shell">
      <Navbar />
      <div className="container mx-auto px-4 pt-28 pb-16">
        <div className="max-w-6xl mx-auto space-y-6">
          <section className="app-page-header">
            <div className="app-eyebrow"><Sparkles className="h-4 w-4" /> Financeiro</div>
            <h1 className="app-title">Carteira</h1>
            <p className="app-subtitle">Acompanhe ganhos aprovados, saldo disponível e suas solicitações de saque via PIX.</p>
          </section>

          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 page-enter stagger-1">
            {summaryCards.map(({ title, value, note, icon: Icon, accent }) => (
              <Card key={title} className="somma-panel rounded-2xl min-h-[170px]">
                <CardHeader className="flex flex-row items-start justify-between pb-3">
                  <div>
                    <CardTitle className="text-[0.95rem] font-bold">{title}</CardTitle>
                    <CardDescription className="ui-caption mt-1">{note}</CardDescription>
                  </div>
                  <div className="somma-icon-tile h-9 w-9 rounded-xl">
                    <Icon className="h-4 w-4" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className={`metric-value text-[2rem] ${accent ? "text-primary" : ""}`}>R$ {formatMoney(value)}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-5 page-enter stagger-2">
            <Card className="somma-panel rounded-2xl">
              <CardHeader>
                <CardTitle className="text-xl font-extrabold">Histórico de saques</CardTitle>
                <CardDescription className="ui-caption">Acompanhe o status de cada solicitação.</CardDescription>
              </CardHeader>
              <CardContent>
                {withdrawals.length === 0 ? (
                  <div className="empty-state min-h-[220px]">
                    <Clock className="h-7 w-7 text-primary" />
                    <p className="font-bold">Nenhuma solicitação de saque ainda</p>
                    <p className="ui-caption max-w-md">Quando você solicitar um saque, o andamento aparecerá aqui.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {withdrawals.map((withdrawal) => (
                      <div key={withdrawal.id} className="flex flex-col items-start gap-3 border border-border rounded-xl bg-background/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-extrabold text-lg">R$ {formatMoney(withdrawal.amount)}</p>
                          <p className="ui-caption">{new Date(withdrawal.requested_at).toLocaleDateString("pt-BR")}</p>
                          {withdrawal.pix_key && <p className="ui-caption">PIX: {withdrawal.pix_key}</p>}
                        </div>
                        <Badge variant="outline" className={statusColors[withdrawal.status] || "border-border bg-muted text-foreground"}>{statusLabels[withdrawal.status] || withdrawal.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="space-y-5">
              <Card className="somma-dark-panel rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-xl font-extrabold text-[#f7ead1]">Solicitar saque</CardTitle>
                  <CardDescription className="text-[0.92rem] leading-relaxed !text-[#e8d9c0]">Saldo disponível para saque</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="metric-value text-[2rem] text-[#ff9418]">R$ {formatMoney(available)}</p>
                  <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                      <Button
                        className="w-full rounded-xl font-bold disabled:bg-[#6b513b] disabled:text-[#f2e6d2] disabled:opacity-100"
                        disabled={available < 25}
                      >
                        {available < 25 ? "Saldo insuficiente para saque" : "Solicitar saque via PIX"}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Solicitar saque via PIX</DialogTitle>
                        <DialogDescription>Digite o valor e sua chave PIX. A chave completa não será exibida novamente depois de salva.</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="withdrawal-amount">Valor (R$)</Label>
                          <Input id="withdrawal-amount" type="number" step="0.01" min="25" max={available} placeholder="Mínimo: R$ 25,00" value={amount} onChange={(e) => setAmount(e.target.value)} />
                          <p className="ui-caption mt-1">Disponível: R$ {formatMoney(available)}. Valor mínimo: R$ 25,00.</p>
                        </div>
                        <div>
                          <Label htmlFor="withdrawal-pix-key">Chave PIX</Label>
                          <Input id="withdrawal-pix-key" placeholder="CPF, e-mail, telefone ou chave aleatória PIX" value={pixKey} onChange={(e) => setPixKey(e.target.value)} />
                          {profile?.pix_key && <p className="ui-caption mt-1">Chave salva: {profile.pix_key}. Digite uma chave completa para atualizá-la.</p>}
                        </div>
                        <Button onClick={handleRequestWithdrawal} className="w-full" disabled={isSubmitting}>{isSubmitting ? "Enviando..." : "Enviar solicitação"}</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                  {available < 25 && <p className="text-[0.88rem] leading-relaxed text-[#e8d9c0]">Você poderá solicitar um saque quando o saldo atingir R$ 25,00.</p>}
                </CardContent>
              </Card>

              <Card className="somma-panel rounded-2xl">
                <CardHeader><CardTitle className="text-lg font-extrabold">Regras de saque</CardTitle></CardHeader>
                <CardContent className="space-y-2 ui-caption">
                  <p>• Saque mínimo de R$ 25,00.</p>
                  <p>• Solicitações são processadas por um administrador.</p>
                  <p>• Valores solicitados, pendentes, aprovados e pagos são descontados do saldo disponível.</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Wallet;

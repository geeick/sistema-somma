import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "@/integrations/apiClient";
import { getNeonUser, type NeonUser } from "@/lib/auth";
import { Navbar } from "@/components/Navbar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  AlertTriangle,
  Clock,
  DollarSign,
  RefreshCw,
  TrendingUp,
  Wallet as WalletIcon,
} from "lucide-react";

interface Profile {
  total_earnings: number | string | null;
  pix_key: string | null;
}

interface Withdrawal {
  id: string;
  amount: number | string | null;
  pix_key?: string | null;
  status: string | null;
  requested_at: string | null;
}

const MIN_WITHDRAWAL = 25;

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

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not set";

  return date.toLocaleDateString("pt-BR");
}

function getStatusClass(status: string | null | undefined) {
  switch (status) {
    case "requested":
    case "pending":
      return "bg-yellow-500 text-white";
    case "approved":
      return "bg-blue-500 text-white";
    case "paid":
      return "bg-green-500 text-white";
    case "rejected":
      return "bg-red-500 text-white";
    default:
      return "bg-muted text-muted-foreground";
  }
}

const Wallet = () => {
  const navigate = useNavigate();

  const [user, setUser] = useState<NeonUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [error, setError] = useState("");

  const balance = useMemo(() => toNumber(profile?.total_earnings), [profile]);

  const pendingAmount = useMemo(() => {
    return withdrawals
      .filter((withdrawal) =>
        ["requested", "pending", "approved"].includes(withdrawal.status || "")
      )
      .reduce((sum, withdrawal) => sum + toNumber(withdrawal.amount), 0);
  }, [withdrawals]);

  const availableBalance = Math.max(balance - pendingAmount, 0);

  const loadWalletData = async () => {
    setIsLoadingData(true);
    setError("");

    try {
      const [profileData, withdrawalsData] = await Promise.all([
        apiClient.wallet.profile(),
        apiClient.wallet.withdrawals(),
      ]);

      setProfile(
        profileData || {
          total_earnings: 0,
          pix_key: null,
        }
      );

      setWithdrawals(Array.isArray(withdrawalsData) ? withdrawalsData : []);
    } catch (err: any) {
      console.error("Failed to load wallet:", err);
      setError(err.message || "Failed to load wallet data");
      toast({
        title: "Error",
        description: err.message || "Failed to load wallet data",
        variant: "destructive",
      });
    } finally {
      setIsLoadingData(false);
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
      .catch(() => navigate("/auth"))
      .finally(() => setIsLoadingUser(false));
  }, [navigate]);

  useEffect(() => {
    if (!user) return;
    loadWalletData();
  }, [user]);

  const handleRequestWithdrawal = async () => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to request a withdrawal",
        variant: "destructive",
      });
      return;
    }

    const amountNum = Number(amount);

    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      toast({
        title: "Erro",
        description: "O valor deve ser maior que 0",
        variant: "destructive",
      });
      return;
    }

    if (amountNum < MIN_WITHDRAWAL) {
      toast({
        title: "Erro",
        description: "O valor mínimo para saque é R$ 25,00",
        variant: "destructive",
      });
      return;
    }

    if (amountNum > availableBalance) {
      toast({
        title: "Erro",
        description: "Saldo insuficiente",
        variant: "destructive",
      });
      return;
    }

    if (!pixKey.trim()) {
      toast({
        title: "Erro",
        description: "Por favor, informe sua chave PIX",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await apiClient.wallet.requestWithdrawal({
        amount: amountNum,
        pix_key: pixKey.trim(),
      });

      toast({
        title: "Success",
        description: "Withdrawal requested successfully. We will process it soon.",
      });

      setIsDialogOpen(false);
      setAmount("");
      setPixKey("");

      await loadWalletData();
    } catch (err: any) {
      console.error("Withdrawal request failed:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to request withdrawal",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLoading = isLoadingUser || isLoadingData;

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
          <div>
            <h1 className="text-4xl font-bold mb-2">Wallet</h1>
            <p className="text-muted-foreground">
              Track earnings and request PIX withdrawals.
            </p>
          </div>

          {error && (
            <Card className="bg-gradient-card border-border">
              <CardContent className="pt-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  <div>
                    <p className="font-semibold">Could not load all wallet data</p>
                    <p className="text-sm text-muted-foreground">{error}</p>
                  </div>
                </div>

                <Button variant="outline" onClick={loadWalletData}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try again
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <Card className="bg-gradient-card border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Earnings
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>

              <CardContent>
                <div className="text-3xl font-bold text-primary">
                  R$ {formatMoney(balance)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  All-time earnings.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-card border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Available Balance
                </CardTitle>
                <WalletIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>

              <CardContent>
                <div className="text-3xl font-bold">
                  R$ {formatMoney(availableBalance)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Pending withdrawals are excluded.
                </p>

                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="mt-4 w-full" disabled={availableBalance < MIN_WITHDRAWAL}>
                      Request Withdrawal
                    </Button>
                  </DialogTrigger>

                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Request Withdrawal via PIX</DialogTitle>
                      <DialogDescription>
                        Enter the amount and your PIX key. The backend should store
                        only a masked version, not the raw key.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                      <div>
                        <Label>Valor (R$)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min={MIN_WITHDRAWAL}
                          placeholder="Mínimo: R$ 25,00"
                          value={amount}
                          onChange={(event) => setAmount(event.target.value)}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Available: R$ {formatMoney(availableBalance)}
                        </p>
                      </div>

                      <div>
                        <Label>PIX Key</Label>
                        <Input
                          placeholder="CPF, email, phone, or random PIX key"
                          value={pixKey}
                          onChange={(event) => setPixKey(event.target.value)}
                        />
                        {profile?.pix_key && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Saved PIX hint: {profile.pix_key}
                          </p>
                        )}
                      </div>

                      <Button
                        onClick={handleRequestWithdrawal}
                        className="w-full"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? "Submitting..." : "Submit Request"}
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
              <CardDescription>Track your withdrawal requests.</CardDescription>
            </CardHeader>

            <CardContent>
              {withdrawals.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  No withdrawal requests yet
                </p>
              ) : (
                <div className="space-y-4">
                  {withdrawals.map((withdrawal) => (
                    <div
                      key={withdrawal.id}
                      className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between p-4 border border-border rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="font-semibold text-lg">
                          R$ {formatMoney(withdrawal.amount)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Requested: {formatDate(withdrawal.requested_at)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          PIX: {withdrawal.pix_key || "Stored securely"}
                        </p>
                      </div>

                      <Badge className={`${getStatusClass(withdrawal.status)} w-fit`}>
                        {withdrawal.status || "unknown"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gradient-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                Withdrawal Rules
              </CardTitle>
            </CardHeader>

            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>Minimum withdrawal: R$ {formatMoney(MIN_WITHDRAWAL)}</p>
              <p>Requests start as pending and are processed by an admin.</p>
              <p>PIX keys should be masked or encrypted on the backend.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Wallet;

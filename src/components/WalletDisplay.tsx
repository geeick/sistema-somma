import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import apiClient from "@/integrations/apiClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, TrendingUp } from "lucide-react";

interface WalletDisplayProps {
  userId?: string;
  refreshKey?: number;
}

interface BalanceSummary {
  total_earnings?: number | string | null;
  balance_total?: number | string | null;
  balance_available?: number | string | null;
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

export function WalletDisplay({ userId, refreshKey = 0 }: WalletDisplayProps) {
  const [balance, setBalance] = useState({
    total: 0,
    available: 0,
  });

  useEffect(() => {
    if (!userId) return;
    fetchBalance();
  }, [userId, refreshKey]);

  const fetchBalance = async () => {
    try {
      const profile: BalanceSummary = await apiClient.wallet.profile();
      setBalance({
        total: toNumber(profile?.balance_total ?? profile?.total_earnings),
        available: toNumber(profile?.balance_available),
      });
    } catch (error) {
      console.error("Error fetching balance:", error);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card className="bg-gradient-card border-border">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Approved Earnings</CardTitle>
          <TrendingUp className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">R$ {formatMoney(balance.total)}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Sum of approved or paid submissions.
          </p>
        </CardContent>
      </Card>

      <Card className="bg-gradient-card border-border">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Available to Withdraw</CardTitle>
          <Wallet className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            R$ {formatMoney(balance.available)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Pending and paid withdrawals are already subtracted.
          </p>
          <Button asChild className="mt-4 w-full" disabled={balance.available < 25}>
            <Link to="/wallet">Withdraw / View Wallet</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}



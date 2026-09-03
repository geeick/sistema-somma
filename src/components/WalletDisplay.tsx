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
  const [balance, setBalance] = useState({ total: 0, available: 0 });

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
      console.error("Erro ao carregar saldo:", error);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card className="somma-panel rounded-2xl min-h-[188px]">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-[0.95rem] font-bold">Ganhos aprovados</CardTitle>
            <p className="ui-caption mt-1">Total acumulado de envios aprovados ou pagos.</p>
          </div>
          <div className="somma-icon-tile h-9 w-9 rounded-xl">
            <TrendingUp className="h-4 w-4" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="metric-value text-[2.2rem]">R$ {formatMoney(balance.total)}</div>
        </CardContent>
      </Card>

      <Card className="somma-dark-panel rounded-2xl min-h-[188px]">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-[0.95rem] font-bold text-[#f7ead1]">Disponível para saque</CardTitle>
            <p className="text-[0.88rem] leading-relaxed text-[#f7ead1]/65 mt-1">Saques pendentes e pagos já foram descontados.</p>
          </div>
          <div className="somma-icon-tile h-9 w-9 rounded-xl">
            <Wallet className="h-4 w-4" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="metric-value text-[2.2rem] text-primary">R$ {formatMoney(balance.available)}</div>
          <Button asChild className="mt-5 w-full rounded-xl font-bold" disabled={balance.available < 25}>
            <Link to="/wallet">Ver carteira e sacar</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

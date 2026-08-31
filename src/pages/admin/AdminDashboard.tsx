import { useEffect, useState } from "react";
import { getNeonAccessToken } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, FileVideo, Megaphone, RefreshCw, ShieldAlert, Users, Wallet, Sparkles } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "";

type AdminSummary = {
  totalCampaigns?: number;
  activeCampaigns?: number;
  totalSubmissions?: number;
  approvedSubmissions?: number;
  totalCreators?: number;
  totalPages?: number;
  verifiedPages?: number;
  pendingWithdrawals?: number;
  pendingWithdrawalAmount?: number;
  totalViews?: number;
  totalPayout?: number;
};

function formatNumber(value: number | undefined) {
  return Number(value || 0).toLocaleString("pt-BR");
}

function formatMoney(value: number | undefined) {
  return `R$ ${Number(value || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function StatCard({ title, value, description, icon: Icon }: { title: string; value: string; description: string; icon: any }) {
  return (
    <Card className="somma-panel rounded-2xl min-h-[156px]">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-[0.94rem] font-extrabold">{title}</CardTitle>
          <CardDescription className="ui-caption mt-1">{description}</CardDescription>
        </div>
        <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="metric-value text-[2rem]">{value}</div>
      </CardContent>
    </Card>
  );
}

const AdminDashboard = () => {
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [rawResponse, setRawResponse] = useState<any>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const loadDashboard = async () => {
    setIsLoading(true);
    setError("");
    setRawResponse(null);

    try {
      const token = await getNeonAccessToken();
      if (!token) throw new Error("Token de autenticação não encontrado. Entre novamente.");

      const res = await fetch(`${API_BASE}/api/admin/summary`, {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });

      const json = await res.json().catch(() => null);
      setRawResponse(json);

      if (!res.ok) {
        throw new Error(`O backend retornou ${res.status}: ${json?.error || json?.message || "erro desconhecido"}`);
      }

      setSummary(json.data);
    } catch (err: any) {
      console.error("Falha no painel administrativo:", err);
      setError(err.message || "Não foi possível carregar o painel administrativo.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen somma-shell flex items-center justify-center">
        <p className="font-semibold text-muted-foreground">Carregando painel administrativo...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen somma-shell p-8 md:p-12">
        <Card className="somma-panel rounded-2xl max-w-3xl mx-auto">
          <CardHeader>
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-8 w-8 text-destructive" />
              <div>
                <CardTitle className="text-xl font-extrabold">Erro no painel administrativo</CardTitle>
                <CardDescription className="ui-caption">{error}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={loadDashboard} className="font-bold"><RefreshCw className="h-4 w-4 mr-2" />Tentar novamente</Button>
            <details className="rounded-xl bg-muted/50 p-4">
              <summary className="font-bold cursor-pointer">Informações técnicas</summary>
              <pre className="text-xs whitespace-pre-wrap overflow-x-auto mt-3">{JSON.stringify(rawResponse, null, 2)}</pre>
            </details>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen somma-shell p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-6">
        <section className="app-page-header">
          <div className="app-eyebrow"><Sparkles className="h-4 w-4" /> Administração</div>
          <h1 className="app-title">Visão geral</h1>
          <p className="app-subtitle">Acompanhe campanhas, criadores, envios, alcance e pagamentos em uma visão consolidada.</p>
        </section>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 page-enter stagger-1">
          <StatCard title="Campanhas" value={formatNumber(summary?.totalCampaigns)} description={`${formatNumber(summary?.activeCampaigns)} ativas`} icon={Megaphone} />
          <StatCard title="Envios" value={formatNumber(summary?.totalSubmissions)} description={`${formatNumber(summary?.approvedSubmissions)} aprovados`} icon={FileVideo} />
          <StatCard title="Criadores" value={formatNumber(summary?.totalCreators)} description={`${formatNumber(summary?.totalPages)} páginas conectadas`} icon={Users} />
          <StatCard title="Saques pendentes" value={formatNumber(summary?.pendingWithdrawals)} description={formatMoney(summary?.pendingWithdrawalAmount)} icon={Wallet} />
          <StatCard title="Visualizações" value={formatNumber(summary?.totalViews)} description="Somadas entre os conteúdos enviados" icon={BarChart3} />
          <StatCard title="Pagamento estimado" value={formatMoney(summary?.totalPayout)} description="Com base nos envios registrados" icon={Wallet} />
          <StatCard title="Páginas verificadas" value={formatNumber(summary?.verifiedPages)} description="Páginas de criadores confirmadas" icon={Users} />
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;

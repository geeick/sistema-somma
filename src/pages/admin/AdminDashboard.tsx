import { useEffect, useState } from "react";
import { getNeonAccessToken } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  FileVideo,
  Megaphone,
  RefreshCw,
  ShieldAlert,
  Users,
  Wallet,
} from "lucide-react";

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

function StatCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: string;
  description: string;
  icon: any;
}) {
  return (
    <Card className="bg-gradient-card border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-primary" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
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

      if (!token) {
        throw new Error("No Neon Auth token found. Sign in again.");
      }

      const res = await fetch(`${API_BASE}/api/admin/summary`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json().catch(() => null);
      setRawResponse(json);

      if (!res.ok) {
        throw new Error(
          `Backend returned ${res.status}: ${
            json?.error || json?.message || "Unknown error"
          }`
        );
      }

      setSummary(json.data);
    } catch (err: any) {
      console.error("Admin dashboard failed:", err);
      setError(err.message || "Failed to load admin dashboard");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground p-10">
        <h1 className="text-4xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-2">Loading admin data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background text-foreground p-10">
        <Card className="bg-gradient-card border-border max-w-3xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-8 w-8 text-destructive" />
              <div>
                <CardTitle>Admin dashboard error</CardTitle>
                <CardDescription>{error}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={loadDashboard}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try again
            </Button>

            <div className="rounded-lg bg-muted p-4">
              <p className="font-semibold mb-2">Debug info</p>
              <pre className="text-xs whitespace-pre-wrap overflow-x-auto">
                {JSON.stringify(rawResponse, null, 2)}
              </pre>
            </div>

            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                If this says <b>404</b> or <b>Cannot GET /api/admin/summary</b>,
                your backend does not have the admin summary route yet.
              </p>
              <p>
                If this says <b>403 Admin only</b>, your Neon Auth user is not
                marked as admin.
              </p>
              <p>
                If this says <b>Failed to fetch</b>, your backend is not running
                or <code>VITE_API_BASE</code> is wrong.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-10 space-y-8">
      <div>
        <h1 className="text-4xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Overview of campaigns, creators, submissions, and payouts.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Campaigns"
          value={formatNumber(summary?.totalCampaigns)}
          description={`${formatNumber(summary?.activeCampaigns)} active`}
          icon={Megaphone}
        />

        <StatCard
          title="Submissions"
          value={formatNumber(summary?.totalSubmissions)}
          description={`${formatNumber(summary?.approvedSubmissions)} approved`}
          icon={FileVideo}
        />

        <StatCard
          title="Creators"
          value={formatNumber(summary?.totalCreators)}
          description={`${formatNumber(summary?.totalPages)} connected pages`}
          icon={Users}
        />

        <StatCard
          title="Pending Withdrawals"
          value={formatNumber(summary?.pendingWithdrawals)}
          description={formatMoney(summary?.pendingWithdrawalAmount)}
          icon={Wallet}
        />

        <StatCard
          title="Total Views"
          value={formatNumber(summary?.totalViews)}
          description="Across submitted posts"
          icon={BarChart3}
        />

        <StatCard
          title="Estimated Payout"
          value={formatMoney(summary?.totalPayout)}
          description="Based on submissions"
          icon={Wallet}
        />

        <StatCard
          title="Verified Pages"
          value={formatNumber(summary?.verifiedPages)}
          description="Verified creator pages"
          icon={Users}
        />
      </div>
    </div>
  );
};

export default AdminDashboard;

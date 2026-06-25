import { useEffect, useMemo, useState } from "react";
import { getNeonAccessToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  Download,
  RefreshCw,
  TrendingUp,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "";

type Withdrawal = {
  id: string;
  user_id: string;
  amount: number | string | null;
  pix_key?: string | null;
  pix_key_last4?: string | null;
  status: string | null;
  requested_at: string | null;
  creator_email?: string | null;
  creator_name?: string | null;
};

async function adminRequest(path: string, options: RequestInit = {}) {
  const token = await getNeonAccessToken();

  if (!token) {
    throw new Error("No Neon Auth token found. Sign in again.");
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(
      `Backend returned ${res.status}: ${
        json?.details || json?.error || json?.message || "Unknown error"
      }`
    );
  }

  return json?.data;
}

function toNumber(value?: number | string | null) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
}

function formatMoney(value?: number | string | null) {
  return `R$ ${toNumber(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value?: string | null) {
  if (!value) return "Not set";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not set";

  return date.toLocaleDateString("pt-BR");
}

function getPixKeyDisplay(withdrawal: Withdrawal) {
  if (withdrawal.pix_key) return withdrawal.pix_key;
  if (withdrawal.pix_key_last4) return `**** ${withdrawal.pix_key_last4}`;
  return "No PIX key";
}

async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}

function getStatusBadgeVariant(status?: string | null) {
  if (status === "paid") return "default";
  if (status === "approved") return "default";
  if (status === "rejected") return "destructive";
  return "secondary";
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
      <CardHeader className="flex flex-row items-center justify-between pb-2">
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

export default function WalletAdmin() {
  const { toast } = useToast();

  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingId, setIsUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [rawResponse, setRawResponse] = useState<any>(null);

  const loadWalletData = async () => {
    setIsLoading(true);
    setError("");
    setRawResponse(null);

    try {
      const data = await adminRequest("/api/admin/withdrawals");

      setRawResponse(data);
      setWithdrawals(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error("Failed to load wallet data:", err);
      setError(err.message || "Failed to load wallet data");
      setWithdrawals([]);

      toast({
        title: "Failed to load wallet data",
        description: err.message || "Could not load wallet data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadWalletData();
  }, []);

  const stats = useMemo(() => {
    const pending = withdrawals.filter((item) =>
      ["requested", "pending", "approved"].includes(item.status || "")
    );

    const paid = withdrawals.filter((item) => item.status === "paid");

    const activeCreatorIds = new Set(
      withdrawals.map((item) => item.user_id).filter(Boolean)
    );

    const pendingAmount = pending.reduce(
      (sum, item) => sum + toNumber(item.amount),
      0
    );

    const totalPaid = paid.reduce(
      (sum, item) => sum + toNumber(item.amount),
      0
    );

    return {
      pendingCount: pending.length,
      pendingAmount,
      totalPaid,
      activeCreators: activeCreatorIds.size,
    };
  }, [withdrawals]);

  const pendingWithdrawals = useMemo(() => {
    return withdrawals
      .filter((item) => ["requested", "pending", "approved"].includes(item.status || ""))
      .sort(
        (a, b) =>
          new Date(b.requested_at || 0).getTime() -
          new Date(a.requested_at || 0).getTime()
      );
  }, [withdrawals]);

  const completedWithdrawals = useMemo(() => {
    return withdrawals
      .filter((item) => ["paid", "rejected"].includes(item.status || ""))
      .sort(
        (a, b) =>
          new Date(b.requested_at || 0).getTime() -
          new Date(a.requested_at || 0).getTime()
      );
  }, [withdrawals]);

  const updateWithdrawalStatus = async (withdrawal: Withdrawal, status: string) => {
    setIsUpdatingId(withdrawal.id);

    try {
      const updated = await adminRequest(
        `/api/admin/withdrawals/${withdrawal.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ status }),
        }
      );

      setWithdrawals((current) =>
        current.map((item) =>
          item.id === withdrawal.id ? { ...item, ...updated } : item
        )
      );

      toast({
        title: "Success",
        description: `Withdrawal marked as ${status}`,
      });
    } catch (err: any) {
      console.error("Failed to update withdrawal:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to update withdrawal",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingId(null);
    }
  };

  const exportCsv = () => {
    const rows = [
      ["ID", "Creator", "User ID", "Amount", "PIX Key", "Status", "Requested At"],
      ...withdrawals.map((withdrawal) => [
        withdrawal.id,
        withdrawal.creator_email || withdrawal.creator_name || withdrawal.user_id || "",
        withdrawal.user_id || "",
        String(withdrawal.amount || 0),
        getPixKeyDisplay(withdrawal),
        withdrawal.status || "",
        formatDate(withdrawal.requested_at),
      ]),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = `withdrawals-${new Date().toISOString()}.csv`;
    a.click();

    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Carteira & Pagamentos</h1>
          <p className="text-muted-foreground">Loading wallet data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Card className="bg-gradient-card border-border max-w-3xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-destructive" />
              <div>
                <CardTitle>Could not load wallet data</CardTitle>
                <CardDescription>{error}</CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <Button onClick={loadWalletData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try again
            </Button>

            <div className="rounded-lg bg-muted p-4">
              <p className="font-semibold mb-2">Debug info</p>
              <pre className="text-xs whitespace-pre-wrap overflow-x-auto">
                {JSON.stringify(rawResponse, null, 2)}
              </pre>
            </div>

            <p className="text-sm text-muted-foreground">
              If this says Backend returned 500, update the backend
              /api/admin/withdrawals route so it returns the full PIX key for admins.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Carteira & Pagamentos</h1>
          <p className="text-muted-foreground">
            Processar saques e gerenciar finanças.
          </p>
        </div>

        <Button
          variant="outline"
          onClick={exportCsv}
          disabled={withdrawals.length === 0}
        >
          <Download className="h-4 w-4 mr-2" />
          Exportar CSV
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <StatCard
          title="Pending Requests"
          value={String(stats.pendingCount)}
          description="Withdrawal requests waiting for review"
          icon={Clock}
        />

        <StatCard
          title="Pending Amount"
          value={formatMoney(stats.pendingAmount)}
          description="Total amount requested"
          icon={DollarSign}
        />

        <StatCard
          title="Total Paid Out"
          value={formatMoney(stats.totalPaid)}
          description="Withdrawals marked as paid"
          icon={TrendingUp}
        />

        <StatCard
          title="Active Creators"
          value={String(stats.activeCreators)}
          description="Creators with withdrawal records"
          icon={Users}
        />
      </div>

      <Card className="bg-gradient-card border-border">
        <CardHeader>
          <CardTitle>Pending Withdrawal Requests</CardTitle>
          <CardDescription>
            Review and process creator withdrawal requests.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {pendingWithdrawals.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">
              No pending withdrawals
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Creator</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>PIX Key</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {pendingWithdrawals.map((withdrawal) => (
                    <TableRow key={withdrawal.id}>
                      <TableCell>
                        <div className="font-medium">
                          {withdrawal.creator_email ||
                            withdrawal.creator_name ||
                            "Unknown creator"}
                        </div>
                        <div className="text-xs text-muted-foreground max-w-[260px] truncate">
                          {withdrawal.user_id}
                        </div>
                      </TableCell>

                      <TableCell className="text-right font-semibold">
                        {formatMoney(withdrawal.amount)}
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-2 max-w-[320px]">
                          <code className="rounded bg-muted px-2 py-1 text-xs break-all">
                            {getPixKeyDisplay(withdrawal)}
                          </code>

                          {withdrawal.pix_key && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                copyText(withdrawal.pix_key || "");
                                toast({
                                  title: "Copied",
                                  description: "PIX key copied to clipboard",
                                });
                              }}
                            >
                              Copy
                            </Button>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(withdrawal.status)}>
                          {withdrawal.status || "unknown"}
                        </Badge>
                      </TableCell>

                      <TableCell>{formatDate(withdrawal.requested_at)}</TableCell>

                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {withdrawal.status !== "approved" && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isUpdatingId === withdrawal.id}
                              onClick={() =>
                                updateWithdrawalStatus(withdrawal, "approved")
                              }
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                          )}

                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isUpdatingId === withdrawal.id}
                            onClick={() =>
                              updateWithdrawalStatus(withdrawal, "paid")
                            }
                          >
                            <Wallet className="h-4 w-4 mr-1" />
                            Mark Paid
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isUpdatingId === withdrawal.id}
                            onClick={() =>
                              updateWithdrawalStatus(withdrawal, "rejected")
                            }
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
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

      <Card className="bg-gradient-card border-border">
        <CardHeader>
          <CardTitle>Completed Withdrawal Requests</CardTitle>
          <CardDescription>
            Paid and rejected withdrawal history across creators.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {completedWithdrawals.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">
              No completed withdrawals yet
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Creator</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>PIX Key</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Requested</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {completedWithdrawals.map((withdrawal) => (
                    <TableRow key={withdrawal.id}>
                      <TableCell>
                        <div className="font-medium">
                          {withdrawal.creator_email ||
                            withdrawal.creator_name ||
                            "Unknown creator"}
                        </div>
                        <div className="text-xs text-muted-foreground max-w-[260px] truncate">
                          {withdrawal.user_id}
                        </div>
                      </TableCell>

                      <TableCell className="text-right font-semibold">
                        {formatMoney(withdrawal.amount)}
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-2 max-w-[320px]">
                          <code className="rounded bg-muted px-2 py-1 text-xs break-all">
                            {getPixKeyDisplay(withdrawal)}
                          </code>

                          {withdrawal.pix_key && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                copyText(withdrawal.pix_key || "");
                                toast({
                                  title: "Copied",
                                  description: "PIX key copied to clipboard",
                                });
                              }}
                            >
                              Copy
                            </Button>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(withdrawal.status)}>
                          {withdrawal.status || "unknown"}
                        </Badge>
                      </TableCell>

                      <TableCell>{formatDate(withdrawal.requested_at)}</TableCell>
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




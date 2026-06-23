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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  ExternalLink,
  RefreshCw,
  XCircle,
  DollarSign,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "";

type Submission = {
  id: string;
  user_id: string;
  campaign_id: string | null;
  page_id?: string | null;
  title: string | null;
  platform: string | null;
  post_url: string | null;
  status: string | null;
  audio_verified?: boolean | null;
  views_count?: number | string | null;
  payment_amount?: number | string | null;
  created_at?: string | null;
  uploaded_at?: string | null;

  campaign_title?: string | null;
  page_handle?: string | null;
  page_platform?: string | null;
  page_follower_count?: number | string | null;
  page_verified?: boolean | null;
  creator_email?: string | null;
  creator_name?: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleDateString("pt-BR");
}

function formatNumber(value?: number | string | null) {
  return Number(value || 0).toLocaleString("pt-BR");
}

function formatMoney(value?: number | string | null) {
  return `R$ ${Number(value || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function normalizePlatform(platform?: string | null) {
  if (!platform) return "unknown";
  return platform.replace("_", " ");
}

function getStatusBadgeVariant(status?: string | null) {
  if (status === "approved") return "default";
  if (status === "paid") return "default";
  if (status === "rejected") return "destructive";
  return "secondary";
}

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
        json?.error || json?.message || "Unknown error"
      }`
    );
  }

  return json?.data;
}

export default function SubmissionsAdmin() {
  const { toast } = useToast();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingId, setIsUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [rawResponse, setRawResponse] = useState<any>(null);

  const loadSubmissions = async () => {
    setIsLoading(true);
    setError("");
    setRawResponse(null);

    try {
      const data = await adminRequest("/api/admin/submissions");
      setRawResponse(data);
      setSubmissions(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error("Failed to load submissions:", err);
      setError(err.message || "Failed to load submissions");
      setSubmissions([]);
      toast({
        title: "Error",
        description: "Failed to load submissions",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSubmissions();
  }, []);

  const filteredSubmissions = useMemo(() => {
    return submissions.filter((submission) => {
      const statusMatches =
        statusFilter === "all" || submission.status === statusFilter;
      const platformMatches =
        platformFilter === "all" || submission.platform === platformFilter;

      return statusMatches && platformMatches;
    });
  }, [submissions, statusFilter, platformFilter]);

  const platforms = useMemo(() => {
    return Array.from(
      new Set(
        submissions
          .map((submission) => submission.platform)
          .filter((platform): platform is string => Boolean(platform))
      )
    ).sort();
  }, [submissions]);

  const updateSubmission = async (
    id: string,
    updates: Partial<Pick<Submission, "status" | "views_count" | "payment_amount" | "audio_verified">>
  ) => {
    setIsUpdatingId(id);

    try {
      const updated = await adminRequest(`/api/admin/submissions/${id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });

      setSubmissions((current) =>
        current.map((submission) =>
          submission.id === id ? { ...submission, ...updated } : submission
        )
      );

      toast({
        title: "Success",
        description: "Submission updated",
      });
    } catch (err: any) {
      console.error("Failed to update submission:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to update submission",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingId(null);
    }
  };

  const exportCsv = () => {
    const rows = [
      [
        "Creator",
        "Title",
        "Campaign",
        "Platform",
        "Views",
        "Status",
        "Payout",
        "Uploaded",
        "Post URL",
      ],
      ...filteredSubmissions.map((submission) => [
        submission.creator_name ||
          submission.creator_email ||
          submission.page_handle ||
          submission.user_id ||
          "",
        submission.title || "",
        submission.campaign_title || "",
        submission.platform || "",
        String(submission.views_count || 0),
        submission.status || "",
        String(submission.payment_amount || 0),
        formatDate(submission.uploaded_at || submission.created_at),
        submission.post_url || "",
      ]),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `submissions-${new Date().toISOString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Submissões de Conteúdo</h1>
          <p className="text-muted-foreground">
            Loading submissions...
          </p>
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
                <CardTitle>Could not load submissions</CardTitle>
                <CardDescription>{error}</CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <Button onClick={loadSubmissions}>
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
              If this says Backend returned 500, replace the backend
              /api/admin/submissions route with the safer route I sent.
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
          <h1 className="text-3xl font-bold">Submissões de Conteúdo</h1>
          <p className="text-muted-foreground">
            Ver todas as submissões com métricas de conteúdo.
          </p>
        </div>

        <Button
          variant="outline"
          onClick={exportCsv}
          disabled={filteredSubmissions.length === 0}
        >
          Exportar CSV
        </Button>
      </div>

      <Card className="bg-gradient-card border-border">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="flex flex-col gap-4 md:flex-row">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>

            <Select value={platformFilter} onValueChange={setPlatformFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="All Platforms" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Platforms</SelectItem>
                {platforms.map((platform) => (
                  <SelectItem key={platform} value={platform}>
                    {normalizePlatform(platform)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Creator</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="text-right">Payout</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filteredSubmissions.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="text-center text-muted-foreground py-8"
                    >
                      No submissions found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSubmissions.map((submission) => (
                    <TableRow key={submission.id}>
                      <TableCell>
                        <div className="font-medium">
                          {submission.creator_name ||
                            submission.creator_email ||
                            submission.page_handle ||
                            "Unknown creator"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {submission.page_handle || submission.user_id}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="font-medium">
                          {submission.title || "Untitled submission"}
                        </div>
                        {submission.post_url && (
                          <a
                            href={submission.post_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-primary inline-flex items-center gap-1"
                          >
                            Open post
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </TableCell>

                      <TableCell>
                        {submission.campaign_title || "No campaign"}
                      </TableCell>

                      <TableCell className="capitalize">
                        {normalizePlatform(submission.platform)}
                      </TableCell>

                      <TableCell className="text-right">
                        {formatNumber(submission.views_count)}
                      </TableCell>

                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(submission.status)}>
                          {submission.status || "unknown"}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        {formatDate(submission.uploaded_at || submission.created_at)}
                      </TableCell>

                      <TableCell className="text-right">
                        {formatMoney(submission.payment_amount)}
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isUpdatingId === submission.id}
                            onClick={() =>
                              updateSubmission(submission.id, {
                                status: "approved",
                                audio_verified: true,
                              })
                            }
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approve
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isUpdatingId === submission.id}
                            onClick={() =>
                              updateSubmission(submission.id, {
                                status: "rejected",
                              })
                            }
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Reject
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isUpdatingId === submission.id}
                            onClick={() =>
                              updateSubmission(submission.id, {
                                status: "paid",
                              })
                            }
                          >
                            <DollarSign className="h-4 w-4 mr-1" />
                            Paid
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { getNeonAccessToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
  Download,
  RefreshCw,
  Search,
  Shield,
  XCircle,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "";

type Creator = {
  id: string;
  email?: string | null;
  name?: string | null;
  role?: string | null;
  total_earnings?: number | string | null;
  pix_key?: string | null;
  created_at?: string | null;
  page_count?: number | string | null;
  submission_count?: number | string | null;
  total_views?: number | string | null;
  total_payout?: number | string | null;
  strikes?: number | string | null;
};

type Page = {
  id: string;
  user_id: string;
  platform?: string | null;
  handle?: string | null;
  url?: string | null;
  follower_count?: number | string | null;
  tags?: string[] | string | null;
  verified?: boolean | null;
  verified_at?: string | null;
  created_at?: string | null;
  owner_role?: string | null;
};

type CreatorRow = Creator & {
  fallback_page_count?: number;
  fallback_pages?: Page[];
};

async function adminRequest(path: string, options: RequestInit = {}) {
  const token = await getNeonAccessToken();

  if (!token) {
    throw new Error("Token de autenticação não encontrado. Entre novamente.");
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
      `O servidor retornou ${res.status}: ${
        json?.error || json?.message || "erro desconhecido"
      }`
    );
  }

  return json?.data;
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

function formatDate(value?: string | null) {
  if (!value) return "Não informado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Não informado";
  return date.toLocaleDateString("pt-BR");
}

function normalizeTags(tags: Page["tags"]) {
  if (Array.isArray(tags)) return tags;

  if (typeof tags === "string") {
    try {
      const parsed = JSON.parse(tags);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
    }
  }

  return [];
}

function normalizePlatform(platform?: string | null) {
  if (!platform) return "desconhecida";
  return platform.replace("_", " ");
}

function exportCsv(filename: string, rows: Array<Array<string | number>>) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`)
        .join(",")
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function CreatorsAdmin() {
  const { toast } = useToast();

  const [creators, setCreators] = useState<Creator[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingPageId, setIsUpdatingPageId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [rawResponse, setRawResponse] = useState<any>(null);

  const loadData = async () => {
    setIsLoading(true);
    setError("");
    setRawResponse(null);

    try {
      const [creatorData, pageData] = await Promise.all([
        adminRequest("/api/admin/creators"),
        adminRequest("/api/admin/pages"),
      ]);

      setRawResponse({ creators: creatorData, pages: pageData });
      setCreators(Array.isArray(creatorData) ? creatorData : []);
      setPages(Array.isArray(pageData) ? pageData : []);
    } catch (err: any) {
      console.error("Failed to load creators/pages:", err);
      setError(err.message || "Não foi possível carregar os criadores e as páginas");
      setCreators([]);
      setPages([]);

      toast({
        title: "Erro",
        description: "Não foi possível carregar os criadores e as páginas",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const pagesByUser = useMemo(() => {
    const grouped: Record<string, Page[]> = {};

    pages.forEach((page) => {
      if (!page.user_id) return;
      grouped[page.user_id] ||= [];
      grouped[page.user_id].push(page);
    });

    return grouped;
  }, [pages]);

  const creatorRows = useMemo<CreatorRow[]>(() => {
    const creatorMap = new Map<string, CreatorRow>();

    creators.forEach((creator) => {
      creatorMap.set(creator.id, {
        ...creator,
        fallback_pages: pagesByUser[creator.id] || [],
        fallback_page_count: pagesByUser[creator.id]?.length || 0,
      });
    });

    Object.entries(pagesByUser).forEach(([userId, userPages]) => {
      if (!creatorMap.has(userId)) {
        creatorMap.set(userId, {
          id: userId,
          role: userPages[0]?.owner_role || "creator",
          fallback_pages: userPages,
          fallback_page_count: userPages.length,
          page_count: userPages.length,
          created_at: userPages[0]?.created_at || null,
        });
      }
    });

    return Array.from(creatorMap.values());
  }, [creators, pagesByUser]);

  const filteredCreators = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return creatorRows;

    return creatorRows.filter((creator) => {
      const pageHandles =
        creator.fallback_pages?.map((page) => page.handle || "").join(" ") || "";

      return [
        creator.id,
        creator.name || "",
        creator.email || "",
        creator.role || "",
        pageHandles,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [creatorRows, search]);

  const filteredPages = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return pages;

    return pages.filter((page) =>
      [
        page.user_id,
        page.handle || "",
        page.platform || "",
        page.url || "",
        normalizeTags(page.tags).join(" "),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [pages, search]);

  const updatePageVerification = async (page: Page, verified: boolean) => {
    setIsUpdatingPageId(page.id);

    try {
      const updatedPage = await adminRequest(`/api/admin/pages/${page.id}`, {
        method: "PATCH",
        body: JSON.stringify({ verified }),
      });

      setPages((current) =>
        current.map((item) =>
          item.id === page.id ? { ...item, ...updatedPage } : item
        )
      );

      toast({
        title: "Sucesso",
        description: verified ? "Página verificada" : "Verificação da página removida",
      });
    } catch (err: any) {
      console.error("Failed to update page:", err);
      toast({
        title: "Erro",
        description: err.message || "Não foi possível atualizar a página",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingPageId(null);
    }
  };

  const exportCreators = () => {
    exportCsv(`creators-${new Date().toISOString()}.csv`, [
      [
        "ID",
        "Nome",
        "E-mail",
        "Função",
        "Páginas",
        "Envios",
        "Visualizações",
        "Ganhos",
        "Criado em",
      ],
      ...filteredCreators.map((creator) => [
        creator.id,
        creator.name || "",
        creator.email || "",
        creator.role || "",
        creator.page_count || creator.fallback_page_count || 0,
        creator.submission_count || 0,
        creator.total_views || 0,
        creator.total_earnings || creator.total_payout || 0,
        formatDate(creator.created_at),
      ]),
    ]);
  };

  const exportPages = () => {
    exportCsv(`pages-${new Date().toISOString()}.csv`, [
      [
        "ID",
        "ID do usuário",
        "Plataforma",
        "Perfil",
        "URL",
        "Seguidores",
        "Verificada",
        "Tags",
        "Criado em",
      ],
      ...filteredPages.map((page) => [
        page.id,
        page.user_id,
        page.platform || "",
        page.handle || "",
        page.url || "",
        page.follower_count || 0,
        page.verified ? "sim" : "não",
        normalizeTags(page.tags).join("; "),
        formatDate(page.created_at),
      ]),
    ]);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Criadores e páginas</h1>
          <p className="text-muted-foreground">
            Carregando criadores e páginas...
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
                <CardTitle>Não foi possível carregar os criadores e as páginas</CardTitle>
                <p className="text-muted-foreground">{error}</p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <Button onClick={loadData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Tentar novamente
            </Button>

            <div className="rounded-lg bg-muted p-4">
              <p className="font-semibold mb-2">Informações técnicas</p>
              <pre className="text-xs whitespace-pre-wrap overflow-x-auto">
                {JSON.stringify(rawResponse, null, 2)}
              </pre>
            </div>

            <p className="text-sm text-muted-foreground">
              Se a mensagem indicar erro 500, as rotas /api/admin/creators ou
              /api/admin/pages do servidor precisam ser atualizadas.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Criadores e páginas</h1>
        <p className="text-muted-foreground">
          Gerencie criadores, páginas e verificações.
        </p>
      </div>

      <Tabs defaultValue="creators" className="space-y-6">
        <TabsList>
          <TabsTrigger value="creators">Criadores</TabsTrigger>
          <TabsTrigger value="pages">Páginas</TabsTrigger>
        </TabsList>

        <Card className="bg-gradient-card border-border">
          <CardContent className="pt-6 space-y-4">
            <div className="flex flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por nome, e-mail, perfil ou ID do usuário..."
                />
              </div>

              <TabsContent value="creators" className="m-0">
                <Button
                  variant="outline"
                  onClick={exportCreators}
                  disabled={filteredCreators.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exportar CSV
                </Button>
              </TabsContent>

              <TabsContent value="pages" className="m-0">
                <Button
                  variant="outline"
                  onClick={exportPages}
                  disabled={filteredPages.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exportar CSV
                </Button>
              </TabsContent>
            </div>

            <TabsContent value="creators" className="m-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>E-mail / ID</TableHead>
                    <TableHead>Função</TableHead>
                    <TableHead className="text-right">Páginas</TableHead>
                    <TableHead className="text-right">Envios</TableHead>
                    <TableHead className="text-right">Visualizações</TableHead>
                    <TableHead className="text-right">Ganhos</TableHead>
                    <TableHead>Criado em</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filteredCreators.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-center text-muted-foreground py-8"
                      >
                        Nenhum criador encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCreators.map((creator) => (
                      <TableRow key={creator.id}>
                        <TableCell>
                          <div className="font-medium">
                            {creator.name || "Criador desconhecido"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {creator.fallback_pages?.[0]?.handle || ""}
                          </div>
                        </TableCell>

                        <TableCell>
                          <div>{creator.email || "Sem e-mail"}</div>
                          <div className="text-xs text-muted-foreground max-w-[260px] truncate">
                            {creator.id}
                          </div>
                        </TableCell>

                        <TableCell>
                          <Badge variant={creator.role === "admin" ? "default" : "secondary"}>
                            {creator.role === "admin" ? "Administrador" : "Criador"}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-right">
                          {formatNumber(
                            creator.page_count || creator.fallback_page_count || 0
                          )}
                        </TableCell>

                        <TableCell className="text-right">
                          {formatNumber(creator.submission_count)}
                        </TableCell>

                        <TableCell className="text-right">
                          {formatNumber(creator.total_views)}
                        </TableCell>

                        <TableCell className="text-right">
                          {formatMoney(creator.total_earnings || creator.total_payout)}
                        </TableCell>

                        <TableCell>{formatDate(creator.created_at)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="pages" className="m-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Página</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Plataforma</TableHead>
                    <TableHead className="text-right">Seguidores</TableHead>
                    <TableHead>Tags</TableHead>
                    <TableHead>Verificação</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filteredPages.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-center text-muted-foreground py-8"
                      >
                        Nenhuma página encontrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPages.map((page) => {
                      const tags = normalizeTags(page.tags);

                      return (
                        <TableRow key={page.id}>
                          <TableCell>
                            <div className="font-medium">
                              {page.handle || "Sem perfil"}
                            </div>
                            {page.url && (
                              <a
                                href={page.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-primary"
                              >
                                Abrir página
                              </a>
                            )}
                          </TableCell>

                          <TableCell>
                            <div className="max-w-[260px] truncate">
                              {page.user_id}
                            </div>
                          </TableCell>

                          <TableCell className="capitalize">
                            {normalizePlatform(page.platform)}
                          </TableCell>

                          <TableCell className="text-right">
                            {formatNumber(page.follower_count)}
                          </TableCell>

                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {tags.length > 0 ? (
                                tags.slice(0, 3).map((tag) => (
                                  <Badge key={tag} variant="outline">
                                    {tag}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  Nenhuma
                                </span>
                              )}
                              {tags.length > 3 && (
                                <Badge variant="outline">+{tags.length - 3}</Badge>
                              )}
                            </div>
                          </TableCell>

                          <TableCell>
                            {page.verified ? (
                              <Badge>
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Verificada
                              </Badge>
                            ) : (
                              <Badge variant="secondary">Não verificada</Badge>
                            )}
                          </TableCell>

                          <TableCell>{formatDate(page.created_at)}</TableCell>

                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isUpdatingPageId === page.id}
                              onClick={() =>
                                updatePageVerification(page, !page.verified)
                              }
                            >
                              <Shield className="h-4 w-4 mr-2" />
                              {page.verified ? "Remover verificação" : "Verificar"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TabsContent>
          </CardContent>
        </Card>
      </Tabs>
    </div>
  );
}

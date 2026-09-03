import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { getNeonAccessToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { LoadingState } from "@/components/LoadingState";
import { ArrowLeft, AlertTriangle, Loader2, Save } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "";

type CampaignFromApi = {
  id: string;
  title?: string | null;
  code?: string | null;
  client?: string | null;
  artist?: string | null;
  brief?: string | null;
  budget?: number | string | null;
  start_date?: string | null;
  end_date?: string | null;
  status?: string | null;
  platforms?: string[] | string | null;
  required_tags?: string[] | string | null;
  audio_url?: string | null;
  audio_urls?: Record<string, string> | string | null;
  example_urls?: Record<string, string> | string | null;
  rules?: Record<string, any> | string | null;
  min_posts_per_creator?: number | string | null;
  max_posts_per_creator?: number | string | null;
};

type CampaignForm = {
  title: string;
  code: string;
  client: string;
  artist: string;
  status: string;
  budget: string;
  start_date: string;
  end_date: string;
  min_posts_per_creator: string;
  max_posts_per_creator: string;
  brief: string;
  required_tags: string;
  platforms: string[];
  audio_url: string;
  audio_tiktok: string;
  audio_instagram: string;
  audio_youtube_shorts: string;
  example_1: string;
  example_2: string;
  example_3: string;
  example_4: string;
};

const emptyForm: CampaignForm = {
  title: "",
  code: "",
  client: "",
  artist: "",
  status: "draft",
  budget: "",
  start_date: "",
  end_date: "",
  min_posts_per_creator: "1",
  max_posts_per_creator: "3",
  brief: "",
  required_tags: "",
  platforms: [],
  audio_url: "",
  audio_tiktok: "",
  audio_instagram: "",
  audio_youtube_shorts: "",
  example_1: "",
  example_2: "",
  example_3: "",
  example_4: "",
};

const platformOptions = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube_shorts", label: "YouTube Shorts" },
];

function normalizeList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === "string");
      }
    } catch {
      const normalizedValue = value.trim().replace(/^\{(.*)\}$/, "$1");
      return normalizedValue
        .split(",")
        .map((item) => item.trim().replace(/^"|"$/g, ""))
        .filter(Boolean);
    }
  }

  return [];
}

function normalizeObject(value: unknown): Record<string, any> {
  if (!value) return {};

  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, any>;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      return {};
    }
  }

  return {};
}

function toDateInput(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString().slice(0, 10);
}

function splitTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

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

export default function CampaignEditor() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { toast } = useToast();

  const [form, setForm] = useState<CampaignForm>(emptyForm);
  const [isLoading, setIsLoading] = useState(Boolean(id));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [rawResponse, setRawResponse] = useState<any>(null);

  const titleText = useMemo(() => (isEdit ? "Editar campanha" : "Nova campanha"), [isEdit]);

  useEffect(() => {
    if (!id) {
      setIsLoading(false);
      setForm(emptyForm);
      return;
    }

    let cancelled = false;

    const loadCampaign = async () => {
      setIsLoading(true);
      setError("");
      setRawResponse(null);

      try {
        const campaign: CampaignFromApi | null = await adminRequest(
          `/api/admin/campaigns/${id}`
        );

        setRawResponse(campaign);

        if (!campaign) {
          throw new Error("Campanha não encontrada.");
        }

        const audioUrls = normalizeObject(campaign.audio_urls);
        const exampleUrls = normalizeObject(campaign.example_urls);
        const rules = normalizeObject(campaign.rules);

        if (!cancelled) {
          setForm({
            title: campaign.title || "",
            code: campaign.code || "",
            client: campaign.client || "",
            artist: campaign.artist || rules.artist || "",
            status: campaign.status || "draft",
            budget:
              campaign.budget === null || campaign.budget === undefined
                ? ""
                : String(campaign.budget),
            start_date: toDateInput(campaign.start_date),
            end_date: toDateInput(campaign.end_date),
            min_posts_per_creator:
              campaign.min_posts_per_creator === null ||
              campaign.min_posts_per_creator === undefined
                ? "1"
                : String(campaign.min_posts_per_creator),
            max_posts_per_creator:
              campaign.max_posts_per_creator === null ||
              campaign.max_posts_per_creator === undefined
                ? "3"
                : String(campaign.max_posts_per_creator),
            brief: campaign.brief || "",
            required_tags: normalizeList(campaign.required_tags).join(", "),
            platforms: normalizeList(campaign.platforms),
            audio_url: campaign.audio_url || "",
            audio_tiktok: audioUrls.tiktok || "",
            audio_instagram: audioUrls.instagram || "",
            audio_youtube_shorts: audioUrls.youtube_shorts || "",
            example_1: exampleUrls.example_1 || "",
            example_2: exampleUrls.example_2 || "",
            example_3: exampleUrls.example_3 || "",
            example_4: exampleUrls.example_4 || "",
          });
        }
      } catch (err: any) {
        console.error("Failed to load campaign:", err);
        if (!cancelled) {
          setError(err.message || "Não foi possível carregar a campanha.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadCampaign();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const updateField = <K extends keyof CampaignForm>(
    key: K,
    value: CampaignForm[K]
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const togglePlatform = (platform: string) => {
    setForm((current) => {
      const hasPlatform = current.platforms.includes(platform);

      return {
        ...current,
        platforms: hasPlatform
          ? current.platforms.filter((item) => item !== platform)
          : [...current.platforms, platform],
      };
    });
  };

  const validateForm = () => {
    if (!form.title.trim()) return "O título da campanha é obrigatório.";
    if (!form.client.trim()) return "O cliente é obrigatório.";
    if (!form.artist.trim()) return "O artista é obrigatório.";
    if (!form.budget.trim()) return "O orçamento é obrigatório.";
    if (!form.start_date) return "A data de início é obrigatória.";
    if (!form.end_date) return "A data de término é obrigatória.";
    if (!form.brief.trim()) return "O briefing criativo é obrigatório.";

    const hasAudio =
      form.audio_url.trim() ||
      form.audio_tiktok.trim() ||
      form.audio_instagram.trim() ||
      form.audio_youtube_shorts.trim();

    if (!hasAudio) {
      return "É necessário informar pelo menos um link de áudio da campanha.";
    }

    return "";
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const validationError = validateForm();

    if (validationError) {
      toast({
        title: "Informações obrigatórias",
        description: validationError,
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    const payload = {
      title: form.title.trim(),
      code: form.code.trim() || null,
      client: form.client.trim(),
      artist: form.artist.trim(),
      brief: form.brief.trim(),
      budget: Number(form.budget || 0),
      start_date: form.start_date,
      end_date: form.end_date,
      status: form.status,
      required_tags: splitTags(form.required_tags),
      platforms: form.platforms,
      audio_url: form.audio_url.trim() || null,
      audio_urls: {
        tiktok: form.audio_tiktok.trim(),
        instagram: form.audio_instagram.trim(),
        youtube_shorts: form.audio_youtube_shorts.trim(),
      },
      example_urls: {
        example_1: form.example_1.trim(),
        example_2: form.example_2.trim(),
        example_3: form.example_3.trim(),
        example_4: form.example_4.trim(),
      },
      rules: {
        artist: form.artist.trim(),
      },
      min_posts_per_creator: Number(form.min_posts_per_creator || 1),
      max_posts_per_creator: Number(form.max_posts_per_creator || 1),
    };

    try {
      if (isEdit && id) {
        await adminRequest(`/api/admin/campaigns/${id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await adminRequest("/api/admin/campaigns", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      toast({
        title: "Sucesso",
        description: isEdit ? "Campanha atualizada." : "Campanha criada.",
      });

      navigate("/admin/campaigns");
    } catch (err: any) {
      console.error("Failed to save campaign:", err);
      toast({
        title: "Erro",
        description: err.message || "Não foi possível salvar a campanha.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" asChild>
          <Link to="/admin/campaigns">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para campanhas
          </Link>
        </Button>

        <Card className="bg-gradient-card border-border">
          <CardHeader>
            <CardTitle>{titleText}</CardTitle>
            <CardDescription>Aguarde enquanto preparamos o editor.</CardDescription>
          </CardHeader>
          <CardContent>
            <LoadingState label="Carregando informações da campanha..." compact />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" asChild>
          <Link to="/admin/campaigns">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para campanhas
          </Link>
        </Button>

        <Card className="bg-gradient-card border-border max-w-3xl">
          <CardHeader>
            <div className="flex gap-3">
              <AlertTriangle className="h-8 w-8 text-destructive" />
              <div>
                <CardTitle>Não foi possível carregar a campanha</CardTitle>
                <CardDescription>{error}</CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <pre className="rounded-lg bg-muted p-4 text-xs whitespace-pre-wrap overflow-x-auto">
              {JSON.stringify(rawResponse, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" asChild>
        <Link to="/admin/campaigns">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para campanhas
        </Link>
      </Button>

      <section className="admin-page-intro">
        <h1>{titleText}</h1>
        <p>
          {isEdit
            ? "Atualize regras, plataformas, orçamento e materiais da campanha."
            : "Configure uma nova oportunidade para os criadores da Somma."}
        </p>
      </section>

      <Card className="bg-gradient-card border-border">
        <CardHeader>
          <CardTitle>Detalhes da campanha</CardTitle>
          <CardDescription>
            {isEdit
              ? "Atualize as informações da campanha abaixo."
              : "Preencha as informações para criar uma campanha."}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="title">Título da campanha *</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(event) => updateField("title", event.target.value)}
                  placeholder="Campanha de Verão"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="code">Código da Campanha</Label>
                <Input
                  id="code"
                  value={form.code}
                  onChange={(event) => updateField("code", event.target.value)}
                  placeholder="SMM83"
                />
                <p className="text-xs text-muted-foreground">
                  Código único para identificar a campanha.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="client">Cliente *</Label>
                <Input
                  id="client"
                  value={form.client}
                  onChange={(event) => updateField("client", event.target.value)}
                  placeholder="Nome da marca ou do cliente"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="artist">Artista *</Label>
                <Input
                  id="artist"
                  value={form.artist}
                  onChange={(event) => updateField("artist", event.target.value)}
                  placeholder="Nome do artista"
                />
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(value) => updateField("status", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Rascunho</SelectItem>
                    <SelectItem value="active">Ativa</SelectItem>
                    <SelectItem value="closed">Encerrada</SelectItem>
                    <SelectItem value="archived">Arquivada</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="budget">Orçamento (R$) *</Label>
                <Input
                  id="budget"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.budget}
                  onChange={(event) => updateField("budget", event.target.value)}
                  placeholder="1000"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="start_date">Data de início *</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={form.start_date}
                  onChange={(event) =>
                    updateField("start_date", event.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="end_date">Data de término *</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={form.end_date}
                  onChange={(event) => updateField("end_date", event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="min_posts_per_creator">
                  Mínimo de publicações por criador
                </Label>
                <Input
                  id="min_posts_per_creator"
                  type="number"
                  min="1"
                  value={form.min_posts_per_creator}
                  onChange={(event) =>
                    updateField("min_posts_per_creator", event.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="max_posts_per_creator">
                  Máximo de publicações por criador
                </Label>
                <Input
                  id="max_posts_per_creator"
                  type="number"
                  min="1"
                  value={form.max_posts_per_creator}
                  onChange={(event) =>
                    updateField("max_posts_per_creator", event.target.value)
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="brief">Briefing criativo *</Label>
              <Textarea
                id="brief"
                rows={6}
                value={form.brief}
                onChange={(event) => updateField("brief", event.target.value)}
                placeholder="Explique o que os criadores devem produzir."
              />
            </div>

            <div className="space-y-3">
              <Label>Plataformas</Label>
              <div className="grid gap-3 md:grid-cols-3">
                {platformOptions.map((platform) => (
                  <Label
                    key={platform.value}
                    className="flex items-center gap-3 rounded-lg border border-border p-3 cursor-pointer"
                  >
                    <Checkbox
                      checked={form.platforms.includes(platform.value)}
                      onCheckedChange={() => togglePlatform(platform.value)}
                    />
                    {platform.label}
                  </Label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="required_tags">Tags obrigatórias</Label>
              <Input
                id="required_tags"
                value={form.required_tags}
                onChange={(event) =>
                  updateField("required_tags", event.target.value)
                }
                placeholder="moda, música, dança"
              />
              <p className="text-xs text-muted-foreground">
                Separe as tags por vírgulas. Deixe em branco para campanhas livres.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label>Áudio da Campanha *</Label>
                <p className="text-sm text-muted-foreground">
                  Pelo menos um link de áudio deve ser fornecido.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="audio_url">Link geral do áudio</Label>
                  <Input
                    id="audio_url"
                    type="url"
                    value={form.audio_url}
                    onChange={(event) =>
                      updateField("audio_url", event.target.value)
                    }
                    placeholder="https://..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="audio_tiktok">Link do áudio no TikTok</Label>
                  <Input
                    id="audio_tiktok"
                    type="url"
                    value={form.audio_tiktok}
                    onChange={(event) =>
                      updateField("audio_tiktok", event.target.value)
                    }
                    placeholder="https://..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="audio_instagram">Link do áudio no Instagram</Label>
                  <Input
                    id="audio_instagram"
                    type="url"
                    value={form.audio_instagram}
                    onChange={(event) =>
                      updateField("audio_instagram", event.target.value)
                    }
                    placeholder="https://..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="audio_youtube_shorts">
                    Link do áudio no YouTube Shorts
                  </Label>
                  <Input
                    id="audio_youtube_shorts"
                    type="url"
                    value={form.audio_youtube_shorts}
                    onChange={(event) =>
                      updateField("audio_youtube_shorts", event.target.value)
                    }
                    placeholder="https://..."
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label>Links de exemplo</Label>
                <p className="text-sm text-muted-foreground">
                  Publicações de referência opcionais para os criadores.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {[1, 2, 3, 4].map((num) => {
                  const key = `example_${num}` as keyof CampaignForm;

                  return (
                    <div key={key} className="space-y-2">
                      <Label htmlFor={key}>Exemplo {num}</Label>
                      <Input
                        id={key}
                        type="url"
                        value={form[key]}
                        onChange={(event) =>
                          updateField(key, event.target.value)
                        }
                        placeholder="https://..."
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" asChild>
                <Link to="/admin/campaigns">Cancelar</Link>
              </Button>

              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {isEdit ? "Atualizar campanha" : "Criar campanha"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

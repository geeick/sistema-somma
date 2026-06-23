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
      return value
        .split(",")
        .map((item) => item.trim())
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

  const titleText = useMemo(() => (isEdit ? "Edit Campaign" : "New Campaign"), [isEdit]);

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
          throw new Error("Campaign not found.");
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
          setError(err.message || "Failed to load campaign.");
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
    if (!form.title.trim()) return "Campaign title is required.";
    if (!form.client.trim()) return "Client is required.";
    if (!form.artist.trim()) return "Artist is required.";
    if (!form.budget.trim()) return "Budget is required.";
    if (!form.start_date) return "Start date is required.";
    if (!form.end_date) return "End date is required.";
    if (!form.brief.trim()) return "Creative brief is required.";

    const hasAudio =
      form.audio_url.trim() ||
      form.audio_tiktok.trim() ||
      form.audio_instagram.trim() ||
      form.audio_youtube_shorts.trim();

    if (!hasAudio) {
      return "At least one campaign audio link is required.";
    }

    return "";
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const validationError = validateForm();

    if (validationError) {
      toast({
        title: "Missing information",
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
        title: "Success",
        description: isEdit ? "Campaign updated." : "Campaign created.",
      });

      navigate("/admin/campaigns");
    } catch (err: any) {
      console.error("Failed to save campaign:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to save campaign.",
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
            Back to Campaigns
          </Link>
        </Button>

        <Card className="bg-gradient-card border-border">
          <CardHeader>
            <CardTitle>{titleText}</CardTitle>
            <CardDescription>Loading campaign information...</CardDescription>
          </CardHeader>
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
            Back to Campaigns
          </Link>
        </Button>

        <Card className="bg-gradient-card border-border max-w-3xl">
          <CardHeader>
            <div className="flex gap-3">
              <AlertTriangle className="h-8 w-8 text-destructive" />
              <div>
                <CardTitle>Could not load campaign</CardTitle>
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
          Back to Campaigns
        </Link>
      </Button>

      <Card className="bg-gradient-card border-border">
        <CardHeader>
          <CardTitle>{titleText}</CardTitle>
          <CardDescription>
            {isEdit
              ? "Update campaign information below."
              : "Create a new campaign below."}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="title">Campaign Title *</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(event) => updateField("title", event.target.value)}
                  placeholder="Summer Push"
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
                <Label htmlFor="client">Client *</Label>
                <Input
                  id="client"
                  value={form.client}
                  onChange={(event) => updateField("client", event.target.value)}
                  placeholder="Brand or client name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="artist">Artist *</Label>
                <Input
                  id="artist"
                  value={form.artist}
                  onChange={(event) => updateField("artist", event.target.value)}
                  placeholder="Artist name"
                />
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(value) => updateField("status", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="budget">Budget (R$) *</Label>
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
                <Label htmlFor="start_date">Start Date *</Label>
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
                <Label htmlFor="end_date">End Date *</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={form.end_date}
                  onChange={(event) => updateField("end_date", event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="min_posts_per_creator">
                  Min Posts per Creator
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
                  Max Posts per Creator
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
              <Label htmlFor="brief">Creative Brief *</Label>
              <Textarea
                id="brief"
                rows={6}
                value={form.brief}
                onChange={(event) => updateField("brief", event.target.value)}
                placeholder="Explain what creators should make."
              />
            </div>

            <div className="space-y-3">
              <Label>Platforms</Label>
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
              <Label htmlFor="required_tags">Required Tags</Label>
              <Input
                id="required_tags"
                value={form.required_tags}
                onChange={(event) =>
                  updateField("required_tags", event.target.value)
                }
                placeholder="fashion, music, dance"
              />
              <p className="text-xs text-muted-foreground">
                Separate tags with commas. Leave blank for open campaigns.
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
                  <Label htmlFor="audio_url">General Audio URL</Label>
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
                  <Label htmlFor="audio_tiktok">TikTok Audio URL</Label>
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
                  <Label htmlFor="audio_instagram">Instagram Audio URL</Label>
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
                    YouTube Shorts Audio URL
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
                <Label>Example URLs</Label>
                <p className="text-sm text-muted-foreground">
                  Optional reference posts for creators.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {[1, 2, 3, 4].map((num) => {
                  const key = `example_${num}` as keyof CampaignForm;

                  return (
                    <div key={key} className="space-y-2">
                      <Label htmlFor={key}>Example {num}</Label>
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
                <Link to="/admin/campaigns">Cancel</Link>
              </Button>

              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {isEdit ? "Update Campaign" : "Create Campaign"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

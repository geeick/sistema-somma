import { useState, useEffect, useMemo } from "react";
import apiClient from "@/integrations/apiClient";
import { getNeonAccessToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

interface UploadVideoProps {
  userId?: string;
}

interface Campaign {
  id: string;
  title: string;
  status: string;
  end_date: string;
  platforms?: string[] | string | null;
  audio_url?: string | any;
}

interface Page {
  id: string;
  platform: "instagram" | "tiktok" | "youtube_shorts";
  handle: string | null;
  url: string | null;
  verified?: boolean | null;
}

const API_BASE = import.meta.env.VITE_API_BASE || "";

const submissionSchema = z.object({
  campaignId: z.string().uuid("Please select a campaign"),
  pageId: z.string().min(1, "Please select one of your approved pages"),
  postUrl: z.string().trim().url("Invalid post URL").max(500, "URL must be less than 500 characters"),
  audioUrl: z.string().trim().url("Invalid audio URL").optional().or(z.literal("")),
});

function normalizeList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === "string");
    } catch {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  return [];
}

function normalizePlatform(platform?: string | null) {
  if (!platform) return "unknown";
  return platform.replace("_", " ");
}

function urlLooksLikePlatform(postUrl: string, platform: string) {
  try {
    const url = new URL(postUrl);
    const host = url.hostname.toLowerCase();

    if (platform === "instagram") {
      return host.includes("instagram.com");
    }

    if (platform === "tiktok") {
      return host.includes("tiktok.com");
    }

    if (platform === "youtube_shorts") {
      return host.includes("youtube.com") || host.includes("youtu.be");
    }

    return true;
  } catch {
    return false;
  }
}

export const UploadVideo = ({ userId }: UploadVideoProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>("");
  const [selectedPageId, setSelectedPageId] = useState<string>("");
  const [postUrl, setPostUrl] = useState("");
  const [audioUrl, setAudioUrl] = useState("");

  const approvedPages = useMemo(() => {
    return pages.filter((page) => page.verified === true);
  }, [pages]);

  const selectedPage = useMemo(() => {
    return approvedPages.find((page) => page.id === selectedPageId) || null;
  }, [approvedPages, selectedPageId]);

  const selectedCampaignData = useMemo(() => {
    return campaigns.find((campaign) => campaign.id === selectedCampaign) || null;
  }, [campaigns, selectedCampaign]);

  const campaignPlatforms = useMemo(() => {
    return normalizeList(selectedCampaignData?.platforms);
  }, [selectedCampaignData]);

  const eligiblePages = useMemo(() => {
    if (campaignPlatforms.length === 0) return approvedPages;

    return approvedPages.filter((page) => campaignPlatforms.includes(page.platform));
  }, [approvedPages, campaignPlatforms]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [campaignData, pageData] = await Promise.all([
          apiClient.campaigns.active(),
          apiClient.pages.list(),
        ]);

        setCampaigns(campaignData || []);
        setPages(pageData || []);
      } catch (err) {
        console.error("Error fetching upload data:", err);
        toast.error("Failed to load campaigns or approved pages");
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (!selectedPageId) return;

    const stillEligible = eligiblePages.some((page) => page.id === selectedPageId);

    if (!stillEligible) {
      setSelectedPageId("");
    }
  }, [eligiblePages, selectedPageId]);

  const submitToBackend = async (payload: {
    campaign_id: string;
    page_id: string;
    post_url: string;
    audio_url?: string;
  }) => {
    const token = await getNeonAccessToken();

    if (!token) {
      throw new Error("You must be logged in to submit");
    }

    const res = await fetch(`${API_BASE}/api/submissions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(json?.error || json?.message || "Failed to submit");
    }

    return json?.data;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userId) {
      toast.error("You must be logged in to submit");
      return;
    }

    try {
      const validated = submissionSchema.parse({
        campaignId: selectedCampaign,
        pageId: selectedPageId,
        postUrl,
        audioUrl: audioUrl || undefined,
      });

      const campaign = campaigns.find((c) => c.id === validated.campaignId);
      const page = approvedPages.find((p) => p.id === validated.pageId);

      if (!page) {
        toast.error("You must choose one of your approved pages before submitting");
        return;
      }

      if (campaign && new Date(campaign.end_date) < new Date()) {
        toast.error("This campaign has ended and is no longer accepting submissions");
        return;
      }

      const allowedPlatforms = normalizeList(campaign?.platforms);

      if (allowedPlatforms.length > 0 && !allowedPlatforms.includes(page.platform)) {
        toast.error(`This campaign does not accept ${normalizePlatform(page.platform)} submissions`);
        return;
      }

      if (!urlLooksLikePlatform(validated.postUrl, page.platform)) {
        toast.error(`The post URL must match the selected page platform: ${normalizePlatform(page.platform)}`);
        return;
      }

      setIsUploading(true);

      const inserted = await submitToBackend({
        campaign_id: validated.campaignId,
        page_id: validated.pageId,
        post_url: validated.postUrl,
        audio_url: validated.audioUrl || undefined,
      });

      if (!inserted) throw new Error("Insert failed");

      toast.success("Submission uploaded and pending approval!");

      setSelectedCampaign("");
      setSelectedPageId("");
      setPostUrl("");
      setAudioUrl("");
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        console.error("Submission error:", error);
        toast.error(error instanceof Error ? error.message : "Failed to submit");
      }
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className="bg-gradient-card border-border">
      <CardHeader>
        <CardTitle>Submit Content</CardTitle>
        <CardDescription>
          Submit content from one of your approved pages.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {approvedPages.length === 0 ? (
          <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
            You do not have any approved pages yet. Add a page first, then wait
            for it to be verified before submitting campaign content.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="campaign">Campaign *</Label>
              <Select value={selectedCampaign} onValueChange={setSelectedCampaign} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select a campaign" />
                </SelectTrigger>
                <SelectContent>
                  {campaigns.length === 0 ? (
                    <SelectItem value="_no_campaigns" disabled>
                      No active campaigns available
                    </SelectItem>
                  ) : (
                    campaigns.map((campaign) => (
                      <SelectItem key={campaign.id} value={campaign.id}>
                        {campaign.title}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="page">Approved Page *</Label>
              <Select value={selectedPageId} onValueChange={setSelectedPageId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select one of your approved pages" />
                </SelectTrigger>
                <SelectContent>
                  {eligiblePages.length === 0 ? (
                    <SelectItem value="_no_pages" disabled>
                      No approved pages match this campaign
                    </SelectItem>
                  ) : (
                    eligiblePages.map((page) => (
                      <SelectItem key={page.id} value={page.id}>
                        {page.handle || page.url || "Unnamed page"} · {normalizePlatform(page.platform)}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {selectedCampaign && campaignPlatforms.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  This campaign accepts: {campaignPlatforms.map(normalizePlatform).join(", ")}
                </p>
              )}
            </div>

            {selectedPage && (
              <div className="rounded-lg border border-border p-3 text-sm">
                <p className="font-medium">Selected page</p>
                <p className="text-muted-foreground">
                  {selectedPage.handle || selectedPage.url || "Unnamed page"} · {normalizePlatform(selectedPage.platform)}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="postUrl">Post URL *</Label>
              <Input
                id="postUrl"
                type="url"
                placeholder="https://instagram.com/p/..."
                value={postUrl}
                onChange={(e) => setPostUrl(e.target.value)}
                required
                maxLength={500}
              />
            </div>

            {selectedCampaignData?.audio_url && (
              <div className="space-y-2">
                <Label htmlFor="audioUrl">Audio URL (Optional)</Label>
                <Input
                  id="audioUrl"
                  type="url"
                  placeholder="Link to the audio used in your video..."
                  value={audioUrl}
                  onChange={(e) => setAudioUrl(e.target.value)}
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground">
                  Provide the audio link if you used the campaign&apos;s required audio.
                </p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={isUploading || !selectedCampaign || !selectedPageId}
            >
              <Upload className="h-4 w-4 mr-2" />
              {isUploading ? "Submitting..." : "Submit Content"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
};

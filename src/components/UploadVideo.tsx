import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
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

const submissionSchema = z.object({
  campaignId: z.string().uuid("Please select a campaign"),
  postUrl: z.string().trim().url("Invalid post URL").max(500, "URL must be less than 500 characters"),
  platform: z.enum(["instagram", "tiktok", "youtube_shorts"]),
  audioUrl: z.string().trim().url("Invalid audio URL").optional().or(z.literal("")),
});

interface Campaign {
  id: string;
  title: string;
  status: string;
  end_date: string;
  audio_url?: string | any;
}

export const UploadVideo = ({ userId }: UploadVideoProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>("");
  const [platform, setPlatform] = useState<string>("");
  const [postUrl, setPostUrl] = useState("");
  const [audioUrl, setAudioUrl] = useState("");

  useEffect(() => {
    const fetchCampaigns = async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("id, title, status, audio_url, end_date")
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching campaigns:", error);
        toast.error("Failed to load campaigns");
      } else {
        // Filter out campaigns past their end date (client-side check)
        const activeCampaigns = (data || []).filter(campaign => 
          new Date(campaign.end_date) >= new Date()
        );
        setCampaigns(activeCampaigns);
      }
    };

    fetchCampaigns();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userId) {
      toast.error("You must be logged in to submit");
      return;
    }

    try {
      const validated = submissionSchema.parse({
        campaignId: selectedCampaign,
        postUrl,
        platform,
        audioUrl: audioUrl || undefined,
      });

      setIsUploading(true);

      // Get campaign and check audio requirement
      const campaign = campaigns.find(c => c.id === validated.campaignId);
      
      // Check if campaign is expired
      if (campaign && new Date(campaign.end_date) < new Date()) {
        toast.error("This campaign has ended and is no longer accepting submissions");
        setIsUploading(false);
        return;
      }
      
      // Verify audio if campaign requires it
      let audioVerified = false;
      if (campaign?.audio_url && validated.audioUrl) {
        // Simple check: if user provided audio URL and campaign has audio, mark as to be verified
        audioVerified = false; // Will be verified by admin or automated process
      } else if (!campaign?.audio_url) {
        // No audio requirement
        audioVerified = true;
      }
      
      const { error: insertError } = await supabase.from("submissions").insert({
        user_id: userId,
        campaign_id: validated.campaignId,
        title: `${campaign?.title || 'Campaign'} - Submission`,
        platform: validated.platform,
        post_url: validated.postUrl,
        status: "approved",
        audio_verified: audioVerified,
      });

      if (insertError) throw insertError;

      // Send data to Google Sheets via edge function
      try {
        const { data: sheetsResult, error: sheetsError } = await supabase.functions.invoke("send-to-sheets", {
          body: {
            postLink: validated.postUrl,
            campaignName: campaign?.title || "",
            platform: validated.platform,
          },
        });

        if (sheetsError) {
          throw sheetsError;
        }

        if (sheetsResult?.status === "error") {
          console.error("Google Sheets API returned error:", sheetsResult);
          toast.warning("Conteúdo enviado, mas não foi possível registrar na planilha.");
        }
      } catch (sheetError) {
        console.error("Failed to send data to Google Sheets:", sheetError);
        toast.warning("Conteúdo enviado, mas houve erro ao enviar para a planilha.");
      }

      toast.success("Submission uploaded successfully!");
      
      setSelectedCampaign("");
      setPlatform("");
      setPostUrl("");
      setAudioUrl("");
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        console.error("Submission error:", error);
        toast.error("Failed to submit");
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
          Submit your campaign content
        </CardDescription>
      </CardHeader>
      <CardContent>
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

          {campaigns.find(c => c.id === selectedCampaign)?.audio_url && (
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
                Provide the audio link if you used the campaign's required audio
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="platform">Platform *</Label>
            <Select value={platform} onValueChange={setPlatform} required>
              <SelectTrigger>
                <SelectValue placeholder="Select platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="tiktok">TikTok</SelectItem>
                <SelectItem value="youtube_shorts">YouTube Shorts</SelectItem>
                <SelectItem value="twitter">Twitter/X</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" className="w-full" disabled={isUploading}>
            <Upload className="h-4 w-4 mr-2" />
            {isUploading ? "Submitting..." : "Submit Content"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import apiClient from "@/integrations/apiClient";
import { getNeonAccessToken, getNeonUser, type NeonUser } from "@/lib/auth";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Instagram, Play, Youtube, Plus, Trash2, Pencil, ShieldCheck, ShieldAlert, ExternalLink } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Page {
  id: string;
  platform: string;
  handle: string;
  url: string;
  follower_count: number | null;
  tags: string[];
  verified?: boolean | null;
  verified_at?: string | null;
  external_account_id?: string | null;
  page_key?: string | null;
}

const platformIcons: Record<string, LucideIcon> = {
  instagram: Instagram,
  tiktok: Play,
  youtube_shorts: Youtube,
};

const platformLabels: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube_shorts: "YouTube Shorts",
};

const availableTags = [
  "Funk",
  "Rap/Trap",
  "Pop",
  "Sertanejo",
  "Forró",
  "Piseiro",
  "Arrocha",
  "Gospel",
  "Internacional",
  "Fofoca",
  "Influencer",
  "Edição",
  "Letras",
];

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

function normalizeTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((tag): tag is string => typeof tag === "string");
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter((tag): tag is string => typeof tag === "string");
      }
    } catch {
      return value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
    }
  }

  return [];
}
function normalizePageHandle(value: string) {
  const raw = String(value || "").trim().toLowerCase();
  const withoutAt = raw.replace(/^@+/, "").replace(/\s+/g, "");
  return withoutAt ? `@${withoutAt}` : "";
}

function normalizePageUrl(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(www\.)?/, "")
    .replace(/\?.*$/, "")
    .replace(/#.*$/, "")
    .replace(/\/+$/, "");
}

function getPageDedupeKey(platform: string, handleValue: string, urlValue: string) {
  const cleanPlatform = String(platform || "").trim().toLowerCase();
  const cleanHandle = normalizePageHandle(handleValue);

  if (cleanPlatform && cleanHandle) {
    return `${cleanPlatform}:handle:${cleanHandle}`;
  }

  const cleanUrl = normalizePageUrl(urlValue);

  if (cleanPlatform && cleanUrl) {
    return `${cleanPlatform}:url:${cleanUrl}`;
  }

  return "";
}

function getExistingPageKey(page: Page) {
  if (page.page_key) return page.page_key;

  if (page.external_account_id) {
    return `${String(page.platform || "").toLowerCase()}:external:${String(page.external_account_id).trim()}`;
  }

  return getPageDedupeKey(page.platform, page.handle, page.url);
}


const Pages = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [user, setUser] = useState<NeonUser | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isConnectingInstagram, setIsConnectingInstagram] = useState(false);
  const [isConnectingTikTok, setIsConnectingTikTok] = useState(false);

  const [platform, setPlatform] = useState("");
  const [handle, setHandle] = useState("");
  const [url, setUrl] = useState("");
  const [followerCount, setFollowerCount] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const [editingPage, setEditingPage] = useState<Page | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editHandle, setEditHandle] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editFollowerCount, setEditFollowerCount] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);

  const cleanHandle = (value: string) => {
    const cleaned = value.replace(/@/g, "");
    return cleaned ? `@${cleaned}` : "";
  };

  const resetForm = () => {
    setPlatform("");
    setHandle("");
    setUrl("");
    setFollowerCount("");
    setSelectedTags([]);
    setIsConnectingInstagram(false);
    setIsConnectingTikTok(false);
  };

  const resetEditForm = () => {
    setEditingPage(null);
    setEditHandle("");
    setEditUrl("");
    setEditFollowerCount("");
    setEditTags([]);
    setIsSavingEdit(false);
  };

  const openEditDialog = (page: Page) => {
    setEditingPage(page);
    setEditHandle(page.handle || "");
    setEditUrl(page.url || "");
    setEditFollowerCount(
      page.follower_count === null || page.follower_count === undefined
        ? ""
        : String(page.follower_count)
    );
    setEditTags(normalizeTags(page.tags));
    setIsEditDialogOpen(true);
  };

  const fetchPages = async () => {
    try {
      const data = await apiClient.pages.list();
      const normalizedPages = (data || []).map((page: any) => ({
        ...page,
        tags: normalizeTags(page.tags),
      }));
      setPages(normalizedPages);
    } catch (err) {
      console.error("Failed to load pages:", err);
      toast({
        title: "Error",
        description: "Failed to load pages",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    getNeonUser()
      .then((currentUser) => {
        if (!currentUser) {
          navigate("/auth");
          return;
        }
        setUser(currentUser);
      })
      .catch(() => navigate("/auth"));
  }, [navigate]);

  useEffect(() => {
    if (!user) return;
    fetchPages();
  }, [user]);

  useEffect(() => {
    const instagramStatus = searchParams.get("instagram");
    const tiktokStatus = searchParams.get("tiktok");
    const message = searchParams.get("message");

    if (instagramStatus === "connected") {
      toast({
        title: "Instagram connected",
        description: "Your Instagram page was verified and added.",
      });
      fetchPages();
      setSearchParams({});
    }

    if (instagramStatus === "error" || instagramStatus === "denied") {
      toast({
        title: "Instagram connection failed",
        description: "Please try connecting Instagram again.",
        variant: "destructive",
      });
      setSearchParams({});
    }

    if (tiktokStatus === "connected") {
      toast({
        title: "TikTok connected",
        description: "Your TikTok page was verified and added.",
      });
      fetchPages();
      setSearchParams({});
    }

    if (tiktokStatus === "error" || tiktokStatus === "missing_code") {
      toast({
        title: "TikTok connection failed",
        description: message || "Please try connecting TikTok again.",
        variant: "destructive",
      });
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  const handlePlatformChange = (value: string) => {
    setPlatform(value);
    setHandle("");
    setUrl("");
    setFollowerCount("");
  };

  const handleConnectInstagram = async () => {
    if (!user) {
      toast({
        title: "Not signed in",
        description: "Please sign in before connecting Instagram.",
        variant: "destructive",
      });
      return;
    }

    if (selectedTags.length === 0) {
      toast({
        title: "Tags required",
        description: "Select at least one tag before connecting Instagram.",
        variant: "destructive",
      });
      return;
    }

    setIsConnectingInstagram(true);

    try {
      const token = await getNeonAccessToken();

      if (!token) {
        throw new Error("Missing login token. Please sign out and sign in again.");
      }

      /*
        The backend should create the Instagram OAuth URL and return:
        { "url": "https://..." }

        It should also handle the callback by saving:
        - platform = instagram
        - handle = @username
        - url = https://www.instagram.com/username
        - follower_count from Instagram
        - verified = true

        selectedTags are stored before redirect so future backend support can read them
        from session/localStorage if you add a tag-sync step after callback.
      */
      localStorage.setItem("pending_instagram_page_tags", JSON.stringify(selectedTags));

      const response = await fetch(
        `${API_BASE}/api/integrations/instagram/start`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const json = await response.json();

      if (!response.ok || !json.url) {
        throw new Error(json.error || "Failed to start Instagram connection");
      }

      window.location.href = json.url;
    } catch (err: any) {
      console.error("Instagram connection error:", err);
      setIsConnectingInstagram(false);
      toast({
        title: "Instagram connection failed",
        description: err.message || "Could not start Instagram login",
        variant: "destructive",
      });
    }
  };

  const handleConnectTikTok = async () => {
    if (!user) {
      toast({
        title: "Not signed in",
        description: "Please sign in before connecting TikTok.",
        variant: "destructive",
      });
      return;
    }

    if (selectedTags.length === 0) {
      toast({
        title: "Tags required",
        description: "Select at least one tag before connecting TikTok.",
        variant: "destructive",
      });
      return;
    }

    setIsConnectingTikTok(true);

    try {
      const token = await getNeonAccessToken();

      if (!token) {
        throw new Error("Missing login token. Please sign out and sign in again.");
      }

      localStorage.setItem("pending_tiktok_page_tags", JSON.stringify(selectedTags));

      const response = await fetch(`${API_BASE}/api/integrations/tiktok/auth-url`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await response.json();

      if (!response.ok || !json.data?.url) {
        throw new Error(json.error || json.details || "Failed to start TikTok connection");
      }

      window.location.href = json.data.url;
    } catch (err: any) {
      console.error("TikTok connection error:", err);
      setIsConnectingTikTok(false);
      toast({
        title: "TikTok connection failed",
        description: err.message || "Could not start TikTok login",
        variant: "destructive",
      });
    }
  };


  const handleAddManualPage = async () => {
    if (!user || !platform || !handle || !url || !followerCount) {
      toast({
        title: "Erro",
        description: "Por favor, preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    if (selectedTags.length === 0) {
      toast({
        title: "Erro",
        description: "Por favor, selecione pelo menos uma tag para sua página",
        variant: "destructive",
      });
      return;
    }

    const cleanHandleValue = normalizePageHandle(handle);
    const newPageKey = getPageDedupeKey(platform, cleanHandleValue, url);
    const duplicatePage = pages.find(
      (page) => getExistingPageKey(page) === newPageKey
    );

    if (duplicatePage) {
      toast({
        title: "Page already added",
        description: `${duplicatePage.handle} is already saved on your account.`,
        variant: "destructive",
      });
      return;
    }

    try {
      const newPage = await apiClient.pages.create({
        platform: platform as "youtube_shorts",
        handle: cleanHandleValue,
        url,
        follower_count: parseInt(followerCount, 10),
        tags: selectedTags,
        verified: false,
      });

      if (!newPage) throw new Error("Failed to create page");

      toast({
        title: "Success",
        description: "Page added successfully!",
      });

      setIsDialogOpen(false);
      resetForm();
      await fetchPages();
    } catch (err: any) {
      const message = err.message || String(err);
      toast({
        title: message.toLowerCase().includes("already") ? "Page already added" : "Error",
        description: message,
        variant: "destructive",
      });
    }
  };

  const toggleEditTag = (tag: string) => {
    setEditTags((currentTags) =>
      currentTags.includes(tag)
        ? currentTags.filter((currentTag) => currentTag !== tag)
        : [...currentTags, tag]
    );
  };

  const handleSavePageEdit = async () => {
    if (!editingPage) return;

    if (editTags.length === 0) {
      toast({
        title: "Tags required",
        description: "Select at least one tag for this page.",
        variant: "destructive",
      });
      return;
    }

    const isVerified = Boolean(editingPage.verified);
    const body: Record<string, unknown> = {
      tags: editTags,
    };

    if (!isVerified) {
      const cleanHandleValue = normalizePageHandle(editHandle);

      if (!cleanHandleValue || !editUrl || !editFollowerCount) {
        toast({
          title: "Missing page details",
          description: "Handle, profile URL, follower count, and tags are required for manual pages.",
          variant: "destructive",
        });
        return;
      }

      const updatedPageKey = getPageDedupeKey(
        editingPage.platform,
        cleanHandleValue,
        editUrl
      );

      const duplicatePage = pages.find(
        (page) =>
          page.id !== editingPage.id &&
          getExistingPageKey(page) === updatedPageKey
      );

      if (duplicatePage) {
        toast({
          title: "Page already added",
          description: `${duplicatePage.handle} is already saved on your account.`,
          variant: "destructive",
        });
        return;
      }

      body.handle = cleanHandleValue;
      body.url = editUrl;
      body.follower_count = parseInt(editFollowerCount, 10);
    }

    setIsSavingEdit(true);

    try {
      const token = await getNeonAccessToken();

      if (!token) {
        throw new Error("Missing login token. Please sign out and sign in again.");
      }

      const response = await fetch(`${API_BASE}/api/pages/${editingPage.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const json = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(json?.error || json?.details || "Failed to update page");
      }

      const updatedPage = {
        ...json.data,
        tags: normalizeTags(json.data?.tags),
      };

      setPages((currentPages) =>
        currentPages.map((page) =>
          page.id === editingPage.id ? updatedPage : page
        )
      );

      toast({
        title: "Page updated",
        description: isVerified
          ? "Your page tags were updated."
          : "Your manual page details were updated.",
      });

      setIsEditDialogOpen(false);
      resetEditForm();
    } catch (err: any) {
      toast({
        title: "Could not update page",
        description: err.message || String(err),
        variant: "destructive",
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeletePage = async (pageId: string) => {
    try {
      await apiClient.pages.remove(pageId);
      toast({
        title: "Success",
        description: "Page deleted successfully!",
      });
      setPages((currentPages) => currentPages.filter((page) => page.id !== pageId));
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || String(err),
        variant: "destructive",
      });
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((currentTags) =>
      currentTags.includes(tag)
        ? currentTags.filter((currentTag) => currentTag !== tag)
        : [...currentTags, tag]
    );
  };

  const renderTagPicker = () => (
    <div>
      <Label>Tags (selecione pelo menos uma) *</Label>
      <div className="flex flex-wrap gap-2 mt-2">
        {availableTags.map((tag) => (
          <Badge
            key={tag}
            variant={selectedTags.includes(tag) ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => toggleTag(tag)}
          >
            {tag}
          </Badge>
        ))}
      </div>
      {selectedTags.length === 0 && (
        <p className="text-xs text-destructive mt-1">
          Obrigatório: selecione pelo menos uma tag
        </p>
      )}
    </div>
  );


  const renderEditTagPicker = () => (
    <div>
      <Label>Tags *</Label>
      <div className="flex flex-wrap gap-2 mt-2">
        {availableTags.map((tag) => (
          <Badge
            key={tag}
            variant={editTags.includes(tag) ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => toggleEditTag(tag)}
          >
            {tag}
          </Badge>
        ))}
      </div>
      {editTags.length === 0 && (
        <p className="text-xs text-destructive mt-1">
          Select at least one tag.
        </p>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <Navbar />
        <div className="container mx-auto px-4 pt-24 pb-12">
          <p className="text-center text-muted-foreground">Loading pages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">Your Pages</h1>
              <p className="text-muted-foreground">
                Manage and verify your social media pages
              </p>
            </div>

            <Dialog
              open={isDialogOpen}
              onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) resetForm();
              }}
            >
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Page
                </Button>
              </DialogTrigger>

              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add New Page</DialogTitle>
                  <DialogDescription>
                    Instagram and TikTok pages are verified through platform login. YouTube can be added manually for now.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div>
                    <Label>Platform *</Label>
                    <Select value={platform} onValueChange={handlePlatformChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select platform" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="instagram">Instagram</SelectItem>
                        <SelectItem value="tiktok">TikTok</SelectItem>
                        <SelectItem value="youtube_shorts">YouTube Shorts</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {platform === "instagram" && (
                    <div className="space-y-4">
                      <Card className="bg-muted/40 border-border">
                        <CardContent className="pt-6 space-y-3">
                          <div className="flex items-center gap-3">
                            <Instagram className="h-8 w-8 text-primary" />
                            <div>
                              <p className="font-semibold">Verify Instagram ownership</p>
                              <p className="text-sm text-muted-foreground">
                                You will be sent to Instagram to log in. After approval, Somma will automatically save your username, profile URL, follower count, and verified status.
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {renderTagPicker()}

                      <Button
                        onClick={handleConnectInstagram}
                        disabled={isConnectingInstagram}
                        className="w-full"
                      >
                        <Instagram className="h-4 w-4 mr-2" />
                        {isConnectingInstagram ? "Connecting..." : "Connect Instagram"}
                      </Button>

                      <p className="text-xs text-muted-foreground">
                        You should not manually type Instagram follower counts. Verification happens through Instagram login.
                      </p>
                    </div>
                  )}



                  {platform === "tiktok" && (
                    <div className="space-y-4">
                      <Card className="bg-muted/40 border-border">
                        <CardContent className="pt-6 space-y-3">
                          <div className="flex items-center gap-3">
                            <Play className="h-8 w-8 text-primary" />
                            <div>
                              <p className="font-semibold">Verify TikTok ownership</p>
                              <p className="text-sm text-muted-foreground">
                                You will be sent to TikTok to authorize Somma. After approval, Somma will save your TikTok account as a verified page and can load your authorized public videos.
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {renderTagPicker()}

                      <Button
                        onClick={handleConnectTikTok}
                        disabled={isConnectingTikTok}
                        className="w-full"
                      >
                        <Play className="h-4 w-4 mr-2" />
                        {isConnectingTikTok ? "Connecting..." : "Connect TikTok"}
                      </Button>

                      <p className="text-xs text-muted-foreground">
                        TikTok verification happens through TikTok login. Do not manually type TikTok follower counts for verified accounts.
                      </p>
                    </div>
                  )}


                  {platform && platform !== "instagram" && platform !== "tiktok" && (
                    <div className="space-y-4">
                      <div>
                        <Label>Handle/Username *</Label>
                        <Input
                          placeholder="@yourhandle"
                          value={handle}
                          onChange={(event) => setHandle(cleanHandle(event.target.value))}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Handles are automatically stored as @username
                        </p>
                      </div>

                      <div>
                        <Label>Profile URL *</Label>
                        <Input
                          placeholder="https://..."
                          value={url}
                          onChange={(event) => setUrl(event.target.value)}
                        />
                      </div>

                      <div>
                        <Label>Follower Count *</Label>
                        <Input
                          type="number"
                          placeholder="10000"
                          value={followerCount}
                          onChange={(event) => setFollowerCount(event.target.value)}
                          required
                        />
                      </div>

                      {renderTagPicker()}

                      <Button onClick={handleAddManualPage} className="w-full">
                        Add Page
                      </Button>

                      <p className="text-xs text-muted-foreground">
                        Manual pages are saved as unverified until you add OAuth verification for this platform.
                      </p>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Dialog
            open={isEditDialogOpen}
            onOpenChange={(open) => {
              setIsEditDialogOpen(open);
              if (!open) resetEditForm();
            }}
          >
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Page</DialogTitle>
                <DialogDescription>
                  Verified pages can only edit tags. Manual pages can edit the fields you entered yourself.
                </DialogDescription>
              </DialogHeader>

              {editingPage && (
                <div className="space-y-4">
                  <Card className="bg-muted/40 border-border">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-semibold">{editingPage.handle}</p>
                          <p className="text-sm text-muted-foreground">
                            {platformLabels[editingPage.platform] || editingPage.platform}
                          </p>
                        </div>
                        {editingPage.verified ? (
                          <Badge className="gap-1">
                            <ShieldCheck className="h-3 w-3" />
                            Verified
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1">
                            <ShieldAlert className="h-3 w-3" />
                            Unverified
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {!editingPage.verified && (
                    <>
                      <div>
                        <Label>Handle/Username *</Label>
                        <Input
                          placeholder="@yourhandle"
                          value={editHandle}
                          onChange={(event) => setEditHandle(cleanHandle(event.target.value))}
                        />
                      </div>

                      <div>
                        <Label>Profile URL *</Label>
                        <Input
                          placeholder="https://..."
                          value={editUrl}
                          onChange={(event) => setEditUrl(event.target.value)}
                        />
                      </div>

                      <div>
                        <Label>Follower Count *</Label>
                        <Input
                          type="number"
                          placeholder="10000"
                          value={editFollowerCount}
                          onChange={(event) => setEditFollowerCount(event.target.value)}
                        />
                      </div>
                    </>
                  )}

                  {editingPage.verified && (
                    <p className="text-sm text-muted-foreground">
                      This page was verified through OAuth, so account identity fields are locked. You can still edit campaign matching tags.
                    </p>
                  )}

                  {renderEditTagPicker()}

                  <Button
                    onClick={handleSavePageEdit}
                    disabled={isSavingEdit}
                    className="w-full"
                  >
                    {isSavingEdit ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {pages.length === 0 ? (
            <Card className="bg-gradient-card border-border">
              <CardContent className="pt-6 text-center text-muted-foreground">
                No pages added yet. Add your first page to start joining campaigns!
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {pages.map((page) => {
                const IconComponent = platformIcons[page.platform as keyof typeof platformIcons];
                const label = platformLabels[page.platform] || page.platform.replace("_", " ");
                const isVerified = Boolean(page.verified);

                return (
                  <Card key={page.id} className="bg-gradient-card border-border">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          {IconComponent && <IconComponent className="h-8 w-8 text-primary" />}
                          <div>
                            <div className="flex items-center gap-2">
                              <CardTitle>{page.handle}</CardTitle>
                              {isVerified ? (
                                <Badge className="gap-1">
                                  <ShieldCheck className="h-3 w-3" />
                                  Verified
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="gap-1">
                                  <ShieldAlert className="h-3 w-3" />
                                  Unverified
                                </Badge>
                              )}
                            </div>
                            <CardDescription className="capitalize">{label}</CardDescription>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(page)}
                            aria-label={`Edit ${page.handle}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeletePage(page.id)}
                            aria-label={`Delete ${page.handle}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent>
                      <div className="space-y-3">
                        {page.url && (
                          <a
                            href={page.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                          >
                            View profile
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}

                        {page.follower_count !== null && page.follower_count !== undefined && (
                          <p className="text-sm text-muted-foreground">
                            {page.follower_count.toLocaleString()} followers
                          </p>
                        )}

                        {page.tags.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {page.tags.map((tag) => (
                              <Badge key={tag} variant="secondary">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Pages;




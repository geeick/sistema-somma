import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "@/integrations/apiClient";
import { getNeonUser, type NeonUser } from "@/lib/auth";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Instagram, Play, Youtube, Plus, Trash2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Page {
  id: string;
  platform: string;
  handle: string;
  url: string;
  follower_count: number | null;
  tags: string[];
}

const platformIcons: Record<string, LucideIcon> = {
  instagram: Instagram,
  tiktok: Play,
  youtube_shorts: Youtube,
};

const availableTags = [
  "Funk", "Rap/Trap", "Pop", "Sertanejo", "Forró", "Piseiro", 
  "Arrocha", "Gospel", "Internacional", "Fofoca", "Influencer", "Edição", "Letras"
];

const Pages = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<NeonUser | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const [platform, setPlatform] = useState("");
  const [handle, setHandle] = useState("");
  const [url, setUrl] = useState("");
  const [followerCount, setFollowerCount] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Clean handle to ensure only one @ at the beginning
  const cleanHandle = (value: string) => {
    // Remove all @ symbols
    let cleaned = value.replace(/@/g, '');
    // Add single @ at the beginning if there's content
    return cleaned ? '@' + cleaned : '';
  };

  useEffect(() => {
    getNeonUser().then((currentUser) => {
      if (!currentUser) {
        navigate('/auth');
        return;
      }
      setUser(currentUser);
    }).catch(() => navigate('/auth'));
  }, [navigate]);

  useEffect(() => {
    if (!user) return;

    const fetchPages = async () => {
      try {
        const data = await apiClient.pages.list();
        setPages(data || []);
      } catch (err) {
        console.error(err);
      }
      setIsLoading(false);
    };

    fetchPages();
  }, [user]);

  const handleAddPage = async () => {
    if (!user || !platform || !handle || !url || !followerCount) {
      toast({ title: "Erro", description: "Por favor, preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }

    if (selectedTags.length === 0) {
      toast({ title: "Erro", description: "Por favor, selecione pelo menos uma tag para sua página", variant: "destructive" });
      return;
    }

    // Insert the page
    try {
      const newPage = await apiClient.pages.create({
        user_id: user?.id,
        platform: platform as 'instagram' | 'tiktok' | 'youtube_shorts',
        handle,
        url,
        follower_count: parseInt(followerCount),
        tags: selectedTags,
      });
      // tag linking should be handled by server-side logic if required
      if (!newPage) throw new Error('Failed to create page');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || String(err), variant: 'destructive' });
      return;
    }

    toast({ title: "Success", description: "Page added successfully!" });
    setIsDialogOpen(false);
    setPlatform("");
    setHandle("");
    setUrl("");
    setFollowerCount("");
    setSelectedTags([]);
    
    try {
      const data = await apiClient.pages.list();
      if (data) setPages(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeletePage = async (pageId: string) => {
    try {
      await apiClient.pages.remove(pageId);
      toast({ title: "Success", description: "Page deleted successfully!" });
      setPages(pages.filter(p => p.id !== pageId));
    } catch (err: any) {
      toast({ title: "Error", description: err.message || String(err), variant: "destructive" });
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

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
              <p className="text-muted-foreground">Manage your social media pages</p>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Page
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add New Page</DialogTitle>
                  <DialogDescription>Connect your social media page to start joining campaigns</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Platform *</Label>
                    <Select value={platform} onValueChange={setPlatform}>
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

                  <div>
                    <Label>Handle/Username *</Label>
                    <Input 
                      placeholder="@yourhandle" 
                      value={handle} 
                      onChange={(e) => setHandle(cleanHandle(e.target.value))} 
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Handles are automatically stored as @username
                    </p>
                  </div>

                  <div>
                    <Label>Profile URL *</Label>
                    <Input placeholder="https://..." value={url} onChange={(e) => setUrl(e.target.value)} />
                  </div>

                  <div>
                    <Label>Follower Count *</Label>
                    <Input type="number" placeholder="10000" value={followerCount} onChange={(e) => setFollowerCount(e.target.value)} required />
                  </div>

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

                  <Button onClick={handleAddPage} className="w-full">Add Page</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

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
                return (
                  <Card key={page.id} className="bg-gradient-card border-border">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          {IconComponent && <IconComponent className="h-8 w-8 text-primary" />}
                          <div>
                            <CardTitle>{page.handle}</CardTitle>
                            <CardDescription className="capitalize">{page.platform.replace("_", " ")}</CardDescription>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => handleDeletePage(page.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {page.follower_count && (
                          <p className="text-sm text-muted-foreground">
                            {page.follower_count.toLocaleString()} followers
                          </p>
                        )}
                        {page.tags.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {page.tags.map((tag) => (
                              <Badge key={tag} variant="secondary">{tag}</Badge>
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

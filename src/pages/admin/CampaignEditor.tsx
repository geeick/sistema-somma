import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

const platformOptions = [
  { label: 'TikTok', value: 'tiktok' },
  { label: 'Instagram', value: 'instagram' },
  { label: 'YouTube Shorts', value: 'youtube_shorts' },
  { label: 'Twitter / X', value: 'twitter' }
];
const availableTags = ['Funk', 'Rap/Trap', 'Pop', 'Sertanejo', 'Forró', 'Piseiro', 'Arrocha', 'Gospel', 'Internacional', 'Fofoca', 'Influencer', 'Edição', 'Letras', 'Futebol', 'Phonk'];

export default function CampaignEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isNew = !id || id === 'new';

  const [formData, setFormData] = useState({
    title: '',
    code: '',
    client: '',
    artist: '',
    brief: '',
    status: 'draft',
    budget: '',
    start_date: '',
    end_date: '',
    platforms: [] as string[],
    required_tags: [] as string[],
    audio_urls: {} as Record<string, string>,
    example_urls: {} as Record<string, string>,
    min_posts_per_creator: '1',
    max_posts_per_creator: '3',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isNew && id) {
      fetchCampaign();
    }
  }, [id, isNew]);

  async function fetchCampaign() {
    try {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      setFormData({
        title: data.title || '',
        code: data.code || '',
        client: data.client || '',
        artist: (data as any).artist || '',
        brief: data.brief || '',
        status: data.status || 'draft',
        budget: data.budget?.toString() || '',
        start_date: data.start_date?.split('T')[0] || '',
        end_date: data.end_date?.split('T')[0] || '',
        platforms: data.platforms || [],
        required_tags: data.required_tags || [],
        audio_urls: (data.audio_urls as Record<string, string>) || {},
        example_urls: ((data as any).example_urls as Record<string, string>) || {},
        min_posts_per_creator: data.min_posts_per_creator?.toString() || '1',
        max_posts_per_creator: data.max_posts_per_creator?.toString() || '3',
      });
    } catch (error) {
      console.error('Error fetching campaign:', error);
      toast({
        title: 'Error',
        description: 'Failed to load campaign',
        variant: 'destructive',
      });
    }
  }

  function validateForm(): boolean {
    const newErrors: Record<string, string> = {};

    if (!formData.client.trim()) {
      newErrors.client = 'Client é obrigatório';
    }
    if (!formData.artist.trim()) {
      newErrors.artist = 'Artist é obrigatório';
    }
    if (!formData.budget || parseFloat(formData.budget) <= 0) {
      newErrors.budget = 'Budget é obrigatório e deve ser maior que zero';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!validateForm()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha todos os campos obrigatórios antes de salvar',
        variant: 'destructive',
      });
      return;
    }

    // Validate at least one audio URL is provided
    const hasAudioUrl = Object.values(formData.audio_urls).some(url => url && url.trim() !== '');
    if (!hasAudioUrl) {
      toast({
        title: 'Error',
        description: 'Please add at least one audio URL for any platform',
        variant: 'destructive',
      });
      return;
    }

    // Validate Exemplo 1 is provided
    if (!formData.example_urls['example_1']?.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Exemplo 1 é obrigatório',
        variant: 'destructive',
      });
      return;
    }

    // Validate that filled example URLs are valid URLs
    const urlPattern = /^https?:\/\/.+/i;
    for (const [key, url] of Object.entries(formData.example_urls)) {
      if (url && url.trim() && !urlPattern.test(url.trim())) {
        const num = key.replace('example_', '');
        toast({
          title: 'URL inválida',
          description: `Exemplo ${num} deve ser um link válido (começando com http:// ou https://)`,
          variant: 'destructive',
        });
        return;
      }
    }

    try {
      const campaignData = {
        title: formData.title,
        code: formData.code.trim() || null,
        client: formData.client,
        artist: formData.artist,
        brief: formData.brief,
        status: formData.status,
        budget: parseFloat(formData.budget) || 0,
        start_date: formData.start_date,
        end_date: formData.end_date,
        platforms: formData.platforms,
        required_tags: formData.required_tags,
        audio_urls: formData.audio_urls,
        example_urls: formData.example_urls,
        min_posts_per_creator: parseInt(formData.min_posts_per_creator) || 1,
        max_posts_per_creator: parseInt(formData.max_posts_per_creator) || 3,
      };

      if (isNew) {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          toast({
            title: 'Erro de autenticação',
            description: 'Você precisa estar logado para criar uma campanha',
            variant: 'destructive',
          });
          return;
        }
        const { error } = await supabase
          .from('campaigns')
          .insert([{ 
            ...campaignData, 
            created_by: user.id,
            platforms: campaignData.platforms as any
          }]);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('campaigns')
          .update({
            ...campaignData,
            platforms: campaignData.platforms as any
          })
          .eq('id', id);

        if (error) throw error;
      }

      toast({
        title: 'Success',
        description: `Campaign ${isNew ? 'created' : 'updated'} successfully`,
      });
      navigate('/admin/campaigns');
    } catch (error) {
      console.error('Error saving campaign:', error);
      toast({
        title: 'Error',
        description: 'Failed to save campaign',
        variant: 'destructive',
      });
    }
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => navigate('/admin/campaigns')}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Campaigns
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>{isNew ? 'Create New Campaign' : 'Edit Campaign'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Campaign Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  maxLength={200}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="code">Código da Campanha</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="SMM83"
                  maxLength={20}
                />
                <p className="text-xs text-muted-foreground">
                  Código único para identificar a campanha (ex: SMM83)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="client">Client *</Label>
                <Input
                  id="client"
                  value={formData.client}
                  onChange={(e) => {
                    setFormData({ ...formData, client: e.target.value });
                    if (errors.client) setErrors({ ...errors, client: '' });
                  }}
                  maxLength={200}
                  className={errors.client ? 'border-destructive' : ''}
                />
                {errors.client && <p className="text-sm text-destructive">{errors.client}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="artist">Artist *</Label>
                <Input
                  id="artist"
                  value={formData.artist}
                  onChange={(e) => {
                    setFormData({ ...formData, artist: e.target.value });
                    if (errors.artist) setErrors({ ...errors, artist: '' });
                  }}
                  maxLength={200}
                  className={errors.artist ? 'border-destructive' : ''}
                />
                {errors.artist && <p className="text-sm text-destructive">{errors.artist}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                  <SelectTrigger>
                    <SelectValue />
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
                  value={formData.budget}
                  onChange={(e) => {
                    setFormData({ ...formData, budget: e.target.value });
                    if (errors.budget) setErrors({ ...errors, budget: '' });
                  }}
                  className={errors.budget ? 'border-destructive' : ''}
                />
                {errors.budget && <p className="text-sm text-destructive">{errors.budget}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date *</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="end_date">End Date *</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="min_posts">Min Posts per Creator</Label>
                <Input
                  id="min_posts"
                  type="number"
                  min="1"
                  value={formData.min_posts_per_creator}
                  onChange={(e) => setFormData({ ...formData, min_posts_per_creator: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="max_posts">Max Posts per Creator</Label>
                <Input
                  id="max_posts"
                  type="number"
                  min="1"
                  value={formData.max_posts_per_creator}
                  onChange={(e) => setFormData({ ...formData, max_posts_per_creator: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="brief">Creative Brief *</Label>
              <Textarea
                id="brief"
                value={formData.brief}
                onChange={(e) => setFormData({ ...formData, brief: e.target.value })}
                rows={5}
                required
                maxLength={2000}
              />
            </div>

            <div className="space-y-2">
              <Label>Áudio da Campanha *</Label>
              <p className="text-sm text-muted-foreground">
                Pelo menos um link de áudio deve ser fornecido
              </p>
              <div className="space-y-3 p-4 border rounded-md">
                {[
                  { label: 'TikTok', value: 'tiktok' },
                  { label: 'Instagram', value: 'instagram' },
                  { label: 'YouTube Shorts', value: 'youtube_shorts' },
                ].map((platform) => (
                  <div key={platform.value} className="space-y-2">
                    <Label htmlFor={`audio_${platform.value}`} className="text-sm font-medium">
                      {platform.label}
                    </Label>
                    <Input
                      id={`audio_${platform.value}`}
                      value={formData.audio_urls[platform.value] || ''}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        audio_urls: { ...formData.audio_urls, [platform.value]: e.target.value }
                      })}
                      placeholder={`https://... (${platform.label} audio reference)`}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Exemplos *</Label>
              <p className="text-sm text-muted-foreground">
                Adicione links de exemplos de conteúdo. Exemplo 1 é obrigatório.
              </p>
              <div className="space-y-3 p-4 border rounded-md">
                {[1, 2, 3, 4].map((num) => (
                  <div key={num} className="space-y-2">
                    <Label htmlFor={`example_${num}`} className="text-sm font-medium">
                      Exemplo {num} {num === 1 ? '*' : '(opcional)'}
                    </Label>
                    <Input
                      id={`example_${num}`}
                      value={formData.example_urls[`example_${num}`] || ''}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        example_urls: { ...formData.example_urls, [`example_${num}`]: e.target.value }
                      })}
                      placeholder="https://..."
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Platforms *</Label>
              <div className="flex gap-4">

                {platformOptions.map((platform) => (
                  <div key={platform.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={platform.value}
                      checked={formData.platforms.includes(platform.value)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFormData({ ...formData, platforms: [...formData.platforms, platform.value] });
                        } else {
                          setFormData({ ...formData, platforms: formData.platforms.filter((p) => p !== platform.value) });
                        }
                      }}
                    />
                    <Label htmlFor={platform.value} className="font-normal cursor-pointer">{platform.label}</Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Required Tags *</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {availableTags.map((tag) => (
                  <div key={tag} className="flex items-center space-x-2">
                    <Checkbox
                      id={tag}
                      checked={formData.required_tags.includes(tag)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFormData({ ...formData, required_tags: [...formData.required_tags, tag] });
                        } else {
                          setFormData({ ...formData, required_tags: formData.required_tags.filter((t) => t !== tag) });
                        }
                      }}
                    />
                    <Label htmlFor={tag} className="font-normal cursor-pointer">{tag}</Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-4">
              <Button type="submit">
                {isNew ? 'Create Campaign' : 'Update Campaign'}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate('/admin/campaigns')}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

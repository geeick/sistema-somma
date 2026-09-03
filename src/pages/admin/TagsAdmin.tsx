import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Plus, Pencil, Trash2, Tag, Users, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { LoadingState } from '@/components/LoadingState';

interface TagType {
  id: string;
  name: string;
  slug: string;
  synonyms: string[];
  active: boolean;
  created_at: string;
}

interface PageWithProfile {
  id: string;
  handle: string;
  platform: string;
  url: string;
  follower_count: number | null;
  average_views: number | null;
  profiles: {
    full_name: string | null;
    username: string | null;
  } | null;
}

export default function TagsAdmin() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<TagType | null>(null);
  const [selectedTag, setSelectedTag] = useState<TagType | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    synonyms: '',
  });

  const queryClient = useQueryClient();

  const { data: tags, isLoading } = useQuery({
    queryKey: ['tags'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as TagType[];
    },
  });

  const { data: tagPages, isLoading: isLoadingPages } = useQuery({
    queryKey: ['tag-pages', selectedTag?.id],
    enabled: !!selectedTag,
    queryFn: async () => {
      if (!selectedTag) return [];
      
      // Query using the page_tags junction table
      const { data, error } = await supabase
        .from('page_tags')
        .select('pages(id, handle, platform, url, follower_count, average_views, profiles(full_name, username))')
        .eq('tag_id', selectedTag.id);
      
      if (error) throw error;
      
      // Extract pages from the nested structure
      const pages = data
        .map(item => item.pages)
        .filter((page): page is NonNullable<typeof page> => page !== null) as PageWithProfile[];
      
      return pages;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (tag: { name: string; slug: string; synonyms: string[] }) => {
      const { error } = await supabase.from('tags').insert(tag);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      toast.success('Tag criada com sucesso');
      setIsCreateOpen(false);
      resetForm();
    },
    onError: () => {
      toast.error('Não foi possível criar a tag');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...tag }: { id: string; name: string; slug: string; synonyms: string[] }) => {
      const { error } = await supabase.from('tags').update(tag).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      toast.success('Tag atualizada com sucesso');
      setEditingTag(null);
      resetForm();
    },
    onError: () => {
      toast.error('Não foi possível atualizar a tag');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tags').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      toast.success('Tag excluída com sucesso');
    },
    onError: () => {
      toast.error('Não foi possível excluir a tag');
    },
  });

  const resetForm = () => {
    setFormData({ name: '', slug: '', synonyms: '' });
  };

  const handleSubmit = () => {
    const synonymsArray = formData.synonyms
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (editingTag) {
      updateMutation.mutate({
        id: editingTag.id,
        name: formData.name,
        slug: formData.slug,
        synonyms: synonymsArray,
      });
    } else {
      createMutation.mutate({
        name: formData.name,
        slug: formData.slug,
        synonyms: synonymsArray,
      });
    }
  };

  const handleEdit = (tag: TagType) => {
    setEditingTag(tag);
    setFormData({
      name: tag.name,
      slug: tag.slug,
      synonyms: tag.synonyms.join(', '),
    });
  };

  const handleViewPages = (tag: TagType) => {
    setSelectedTag(tag);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] px-6">
        <LoadingState label="Carregando tags..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="admin-page-intro flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-4xl font-bold mb-2">Gerenciador de Tags</h1>
          <p className="text-muted-foreground">Gerenciar tags, categorias e taxonomia</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              if (!tags || tags.length === 0) return;
              const csv = [
                ['Nome', 'Slug', 'Sinônimos', 'Status', 'Criado em'],
                ...tags.map(tag => [
                  tag.name,
                  tag.slug,
                  tag.synonyms.join('; '),
                  tag.active ? 'Ativo' : 'Inativo',
                  new Date(tag.created_at).toLocaleDateString('pt-BR'),
                ]),
              ].map(row => row.join(',')).join('\n');
              
              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `tags-${new Date().toISOString()}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            disabled={!tags || tags.length === 0}
          >
            Exportar CSV
          </Button>
          <Dialog open={isCreateOpen || !!editingTag} onOpenChange={(open) => {
            setIsCreateOpen(open);
            if (!open) {
              setEditingTag(null);
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Tag
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingTag ? 'Editar Tag' : 'Criar Nova Tag'}</DialogTitle>
                <DialogDescription>
                  {editingTag ? 'Atualize os detalhes da tag abaixo.' : 'Adicione uma nova tag para organizar seu conteúdo.'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Tecnologia"
                  />
                </div>
                <div>
                  <Label htmlFor="slug">Slug</Label>
                  <Input
                    id="slug"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    placeholder="tecnologia"
                  />
                </div>
                <div>
                  <Label htmlFor="synonyms">Sinônimos (separados por vírgula)</Label>
                  <Input
                    id="synonyms"
                    value={formData.synonyms}
                    onChange={(e) => setFormData({ ...formData, synonyms: e.target.value })}
                    placeholder="tecnologia, software, digital"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={handleSubmit}
                  disabled={!formData.name || !formData.slug || createMutation.isPending || updateMutation.isPending}
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {editingTag ? 'Atualizar' : 'Criar'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Todas as tags</CardTitle>
          <CardDescription>
            Gerencie a classificação e a organização do conteúdo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Sinônimos</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tags && tags.length > 0 ? (
                tags.map((tag) => (
                  <TableRow key={tag.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4 text-muted-foreground" />
                        {tag.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">{tag.slug}</code>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {tag.synonyms.map((syn, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {syn}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={tag.active ? 'default' : 'secondary'}>
                        {tag.active ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleViewPages(tag)}
                          title="Ver páginas com esta tag"
                        >
                          <Users className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(tag)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm('Tem certeza de que deseja excluir esta tag?')) {
                              deleteMutation.mutate(tag.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Nenhuma tag encontrada. Crie a primeira tag para começar.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pages Sheet */}
      <Sheet open={!!selectedTag} onOpenChange={(open) => !open && setSelectedTag(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5" />
                Páginas com tag: {selectedTag?.name}
              </SheetTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!tagPages || tagPages.length === 0) return;
                  const csv = [
                    ['Perfil', 'Plataforma', 'Criador', 'Seguidores', 'Visualizações médias', 'URL'],
                    ...tagPages.map(page => [
                      page.handle,
                      page.platform.replace('_', ' '),
                      page.profiles?.full_name || page.profiles?.username || 'Desconhecido',
                      page.follower_count?.toString() || 'N/A',
                      page.average_views?.toString() || 'N/A',
                      page.url,
                    ]),
                  ].map(row => row.join(',')).join('\n');
                  
                  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `pages-tag-${selectedTag?.slug}-${new Date().toISOString()}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                disabled={!tagPages || tagPages.length === 0}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Exportar CSV
              </Button>
            </div>
            <SheetDescription>
              Todas as páginas que possuem esta tag
            </SheetDescription>
          </SheetHeader>
          
          <div className="mt-6">
            {isLoadingPages ? (
              <LoadingState label="Carregando páginas desta tag..." compact className="my-8" />
            ) : tagPages && tagPages.length > 0 ? (
              <div className="space-y-4">
                {tagPages.map((page) => (
                  <Card key={page.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{page.handle}</CardTitle>
                          <CardDescription>
                            {page.profiles?.full_name || page.profiles?.username || 'Criador desconhecido'}
                          </CardDescription>
                        </div>
                        <Badge variant="outline" className="capitalize">
                          {page.platform.replace('_', ' ')}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {page.follower_count !== null && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Seguidores</span>
                            <span className="font-medium">{page.follower_count.toLocaleString()}</span>
                          </div>
                        )}
                        {page.average_views !== null && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Média de visualizações</span>
                            <span className="font-medium">{page.average_views.toLocaleString()}</span>
                          </div>
                        )}
                        <div className="pt-2">
                          <a 
                            href={page.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-1 text-sm"
                          >
                            Abrir página <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma página encontrada com esta tag
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

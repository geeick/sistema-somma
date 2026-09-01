import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Save, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { Separator } from '@/components/ui/separator';

interface FeatureFlag {
  id: string;
  key: string;
  description: string;
  enabled: boolean;
}

const featureFlagLabels: Record<string, { label: string; description: string }> = {
  leaderboard_enabled: {
    label: 'Ranking de campanhas',
    description: 'Ativa os rankings das campanhas',
  },
  audio_fingerprint_phase2: {
    label: 'Identificação avançada de áudio',
    description: 'Ativa a identificação avançada de áudio',
  },
  allow_resubmission: {
    label: 'Reenvio de conteúdo',
    description: 'Permite que criadores reenviem conteúdos rejeitados',
  },
  auto_payout_on_approval: {
    label: 'Pagamento automático após aprovação',
    description: 'Disponibiliza pagamentos automaticamente após a aprovação',
  },
};

export default function SettingsAdmin() {
  const queryClient = useQueryClient();
  const [localFlags, setLocalFlags] = useState<Record<string, boolean>>({});

  const { data: featureFlags, isLoading } = useQuery({
    queryKey: ['feature-flags'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feature_flags')
        .select('*')
        .order('key');
      
      if (error) throw error;
      
      // Initialize local state with current values
      const flagsMap: Record<string, boolean> = {};
      data.forEach((flag: FeatureFlag) => {
        flagsMap[flag.key] = flag.enabled;
      });
      setLocalFlags(flagsMap);
      
      return data as FeatureFlag[];
    },
  });

  const updateFlagMutation = useMutation({
    mutationFn: async ({ key, enabled }: { key: string; enabled: boolean }) => {
      const { error } = await supabase
        .from('feature_flags')
        .update({ enabled })
        .eq('key', key);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feature-flags'] });
      toast.success('Configurações atualizadas com sucesso');
    },
    onError: () => {
      toast.error('Não foi possível atualizar as configurações');
    },
  });

  const handleToggle = (key: string, enabled: boolean) => {
    setLocalFlags(prev => ({ ...prev, [key]: enabled }));
  };

  const handleSave = () => {
    const updates = Object.entries(localFlags).map(([key, enabled]) =>
      updateFlagMutation.mutateAsync({ key, enabled })
    );
    
    Promise.all(updates);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold mb-2">Configurações</h1>
        <p className="text-muted-foreground">Configurações gerais do sistema</p>
      </div>

      <div className="grid gap-6">
        {/* Feature Flags Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Controle de recursos
            </CardTitle>
            <CardDescription>
              Ative ou desative recursos específicos da plataforma
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {featureFlags && featureFlags.length > 0 ? (
              <>
                {featureFlags.map((flag, index) => (
                  <div key={flag.id}>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor={flag.key} className="text-base font-medium">
                          {featureFlagLabels[flag.key]?.label || flag.key.replaceAll('_', ' ')}
                        </Label>
                        {flag.description && (
                          <p className="text-sm text-muted-foreground">
                            {featureFlagLabels[flag.key]?.description || flag.description}
                          </p>
                        )}
                      </div>
                      <Switch
                        id={flag.key}
                        checked={localFlags[flag.key] ?? flag.enabled}
                        onCheckedChange={(checked) => handleToggle(flag.key, checked)}
                      />
                    </div>
                    {index < featureFlags.length - 1 && <Separator className="mt-6" />}
                  </div>
                ))}
                <div className="flex justify-end pt-4">
                  <Button 
                    onClick={handleSave}
                    disabled={updateFlagMutation.isPending}
                  >
                    {updateFlagMutation.isPending && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    <Save className="h-4 w-4 mr-2" />
                    Salvar alterações
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhum controle de recurso configurado.
              </p>
            )}
          </CardContent>
        </Card>

        {/* System Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Configuração do sistema</CardTitle>
            <CardDescription>
              Configurações gerais e integrações do sistema
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="min-withdrawal">Valor mínimo para saque (BRL)</Label>
              <Input
                id="min-withdrawal"
                type="number"
                placeholder="50.00"
                disabled
              />
              <p className="text-sm text-muted-foreground">
                Valor mínimo que os usuários podem sacar do saldo
              </p>
            </div>
            
            <Separator />
            
            <div className="space-y-2">
              <Label htmlFor="max-strikes">Máximo de advertências antes do bloqueio</Label>
              <Input
                id="max-strikes"
                type="number"
                placeholder="3"
                disabled
              />
              <p className="text-sm text-muted-foreground">
                Número de advertências antes de o usuário ser bloqueado automaticamente
              </p>
            </div>

            <div className="flex justify-end pt-4">
              <Button disabled>
                <Save className="h-4 w-4 mr-2" />
                Salvar configuração
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

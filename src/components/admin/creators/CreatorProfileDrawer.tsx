import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { PagesList } from './drawer/PagesList';
import { ActivityList } from './drawer/ActivityList';
import { WalletView } from './drawer/WalletView';
import { StrikesList } from './drawer/StrikesList';

interface Creator {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  created_at: string;
}

interface CreatorProfileDrawerProps {
  creator: Creator;
  open: boolean;
  onClose: () => void;
}

export function CreatorProfileDrawer({ creator, open, onClose }: CreatorProfileDrawerProps) {
  const [activeTab, setActiveTab] = useState('pages');

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Creator Profile</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Header */}
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={creator.avatar_url || undefined} />
              <AvatarFallback>
                {creator.full_name?.charAt(0) || creator.email?.charAt(0) || '?'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="text-xl font-semibold">{creator.full_name || 'No name'}</h3>
              <p className="text-sm text-muted-foreground">{creator.email}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Joined {new Date(creator.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Sub-tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="pages">Pages</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="wallet">Wallet</TabsTrigger>
              <TabsTrigger value="strikes">Strikes</TabsTrigger>
            </TabsList>

            <TabsContent value="pages" className="mt-4">
              <PagesList userId={creator.id} />
            </TabsContent>

            <TabsContent value="activity" className="mt-4">
              <ActivityList userId={creator.id} />
            </TabsContent>

            <TabsContent value="wallet" className="mt-4">
              <WalletView userId={creator.id} />
            </TabsContent>

            <TabsContent value="strikes" className="mt-4">
              <StrikesList userId={creator.id} />
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}

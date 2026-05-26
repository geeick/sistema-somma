import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreatorsTab } from '@/components/admin/creators/CreatorsTab';
import { PagesTab } from '@/components/admin/creators/PagesTab';

export default function CreatorsAdmin() {
  const [activeTab, setActiveTab] = useState('creators');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold mb-2">Creators & Pages</h1>
        <p className="text-muted-foreground">Manage creators, pages, and verification</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="creators">Creators</TabsTrigger>
          <TabsTrigger value="pages">Pages</TabsTrigger>
        </TabsList>

        <TabsContent value="creators" className="mt-6">
          <CreatorsTab />
        </TabsContent>

        <TabsContent value="pages" className="mt-6">
          <PagesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

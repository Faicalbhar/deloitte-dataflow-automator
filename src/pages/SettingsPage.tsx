import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const SettingsPage = () => {
  const { user } = useAuth();
  const [emailSuccess, setEmailSuccess] = useState(true);
  const [emailFailure, setEmailFailure] = useState(true);
  const [emailQuarantine, setEmailQuarantine] = useState(false);

  return (
    <div className="max-w-3xl mx-auto">
      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="api">API Keys</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-6 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Personal Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input defaultValue={user?.name} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input defaultValue={user?.email} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Input defaultValue={user?.role} disabled />
              </div>
              <Button onClick={() => toast.success('Profile updated')}>Save Changes</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Change Password</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2"><Label>Current Password</Label><Input type="password" /></div>
              <div className="space-y-2"><Label>New Password</Label><Input type="password" /></div>
              <div className="space-y-2"><Label>Confirm Password</Label><Input type="password" /></div>
              <Button onClick={() => toast.success('Password changed')}>Update Password</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="mt-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Email Preferences</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: 'Pipeline Success', desc: 'Receive notifications on successful runs', checked: emailSuccess, set: setEmailSuccess },
                { label: 'Pipeline Failure', desc: 'Receive notifications on failed runs', checked: emailFailure, set: setEmailFailure },
                { label: 'Quarantine Threshold', desc: 'Alert when quarantine exceeds 10%', checked: emailQuarantine, set: setEmailQuarantine },
              ].map((n) => (
                <div key={n.label} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{n.label}</p>
                    <p className="text-xs text-muted-foreground">{n.desc}</p>
                  </div>
                  <Switch checked={n.checked} onCheckedChange={n.set} />
                </div>
              ))}
              <Button onClick={() => toast.success('Preferences saved')}>Save</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api" className="mt-6">
          <Card>
            <CardHeader><CardTitle className="text-base">API Keys</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">Generate API keys for programmatic access.</p>
              <Button onClick={() => toast.success('API key generated: dk_live_xxxxxxxxxxxx')}>Generate New Key</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences" className="mt-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Preferences</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div><p className="text-sm font-medium">Dark Mode</p><p className="text-xs text-muted-foreground">Toggle dark theme</p></div>
                <Switch />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsPage;

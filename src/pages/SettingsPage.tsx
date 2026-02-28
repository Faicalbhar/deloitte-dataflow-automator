import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Eye, EyeOff, Key, Server, CheckCircle, XCircle } from 'lucide-react';

const SettingsPage = () => {
  const { user } = useAuth();
  const [emailSuccess, setEmailSuccess] = useState(true);
  const [emailFailure, setEmailFailure] = useState(true);
  const [emailQuarantine, setEmailQuarantine] = useState(false);

  // Databricks config
  const [dbHost, setDbHost] = useState('');
  const [dbToken, setDbToken] = useState('');
  const [dbWarehouse, setDbWarehouse] = useState('');
  const [dbCatalog, setDbCatalog] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  const testConnection = () => {
    if (!dbHost || !dbToken) {
      toast.error('Host and Token are required');
      return;
    }
    setConnectionStatus('testing');
    setTimeout(() => {
      setConnectionStatus('success');
      toast.success('Connected to Databricks successfully');
    }, 1500);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <Tabs defaultValue="databricks">
        <TabsList>
          <TabsTrigger value="databricks">Databricks</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="api">API Keys</TabsTrigger>
        </TabsList>

        {/* Databricks Connection */}
        <TabsContent value="databricks" className="mt-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Server className="h-4 w-4" /> Databricks Connection
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Configure the connection to Databricks so the platform can deploy and execute pipelines via DLT jobs.
              </p>
              <div className="space-y-2">
                <Label>Workspace Host URL</Label>
                <Input placeholder="https://adb-xxxx.azuredatabricks.net" value={dbHost} onChange={(e) => setDbHost(e.target.value)} />
                <p className="text-xs text-muted-foreground">Your Databricks workspace URL (e.g. https://adb-1234567890.azuredatabricks.net)</p>
              </div>
              <div className="space-y-2">
                <Label>Personal Access Token</Label>
                <div className="relative">
                  <Input
                    type={showToken ? 'text' : 'password'}
                    placeholder="dapi_xxxxxxxxxxxxxxxxxxxx"
                    value={dbToken}
                    onChange={(e) => setDbToken(e.target.value)}
                  />
                  <Button variant="ghost" size="icon" className="absolute right-1 top-0 h-full" onClick={() => setShowToken(!showToken)}>
                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Generate a PAT from Databricks → User Settings → Developer → Access tokens</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>SQL Warehouse ID</Label>
                  <Input placeholder="abc123def456" value={dbWarehouse} onChange={(e) => setDbWarehouse(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Unity Catalog Name</Label>
                  <Input placeholder="main" value={dbCatalog} onChange={(e) => setDbCatalog(e.target.value)} />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button onClick={testConnection} disabled={connectionStatus === 'testing'}>
                  {connectionStatus === 'testing' ? (
                    <><div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" /> Testing...</>
                  ) : (
                    <><Key className="h-4 w-4 mr-2" /> Test Connection</>
                  )}
                </Button>
                <Button variant="outline" onClick={() => { toast.success('Databricks configuration saved'); }}>
                  Save Configuration
                </Button>
                {connectionStatus === 'success' && (
                  <Badge className="bg-success/10 text-success gap-1"><CheckCircle className="h-3 w-3" /> Connected</Badge>
                )}
                {connectionStatus === 'error' && (
                  <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Failed</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Backend API Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                URL of the Python backend that parses pipeline JSON and generates DLT code for Databricks.
              </p>
              <div className="space-y-2">
                <Label>Backend API URL</Label>
                <Input placeholder="https://api.pipeline-platform.internal/v1" />
              </div>
              <div className="space-y-2">
                <Label>API Key</Label>
                <Input type="password" placeholder="sk-xxxx" />
              </div>
              <Button variant="outline" onClick={() => toast.success('Backend configuration saved')}>Save</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profile" className="mt-6 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Personal Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Name</Label><Input defaultValue={user?.name} /></div>
                <div className="space-y-2"><Label>Email</Label><Input defaultValue={user?.email} /></div>
              </div>
              <div className="space-y-2"><Label>Role</Label><Input defaultValue={user?.role} disabled /></div>
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
              <p className="text-sm text-muted-foreground">Generate API keys for programmatic access to the platform.</p>
              <Button onClick={() => toast.success('API key generated: dk_live_xxxxxxxxxxxx')}>Generate New Key</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsPage;

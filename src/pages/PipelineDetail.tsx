import { useParams, useNavigate } from 'react-router-dom';
import { Play, Pencil, Copy, Trash2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { mockPipelines, mockRuns } from '@/data/mock-data';
import { formatDistanceToNow } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const statusBadge: Record<string, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-muted text-muted-foreground' },
  ready: { label: 'Ready', className: 'bg-info text-info-foreground' },
  deployed: { label: 'Deployed', className: 'bg-success text-success-foreground' },
  failed: { label: 'Failed', className: 'bg-destructive text-destructive-foreground' },
  running: { label: 'Running', className: 'bg-info text-info-foreground' },
};

const runStatusColor: Record<string, string> = {
  success: 'bg-success',
  failed: 'bg-destructive',
  warning: 'bg-warning',
  running: 'bg-info animate-pulse-dot',
};

const PipelineDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const pipeline = mockPipelines.find((p) => p.id === id);
  const runs = mockRuns.filter((r) => r.pipelineId === id);

  if (!pipeline) {
    return (
      <div className="text-center py-16">
        <p className="text-lg">Pipeline not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/pipelines')}>
          Back to Pipelines
        </Button>
      </div>
    );
  }

  const sb = statusBadge[pipeline.status] || statusBadge.draft;

  const chartData = runs
    .filter((r) => r.completedAt)
    .map((r) => ({
      date: r.startedAt.slice(0, 10),
      rows: r.rowsWritten,
      quarantined: r.rowsQuarantined,
    }))
    .reverse();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/pipelines')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">{pipeline.name}</h1>
            <p className="text-sm text-muted-foreground">{pipeline.description}</p>
          </div>
          <Badge className={sb.className}>{sb.label}</Badge>
        </div>
        <div className="flex gap-2">
          <Button className="gap-2"><Play className="h-4 w-4" /> Run Now</Button>
          <Button variant="outline" size="icon"><Pencil className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon"><Copy className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="runs">Runs History</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="quarantine">Quarantine</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-4">
          {/* Quick metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Last Run', value: pipeline.lastExecution ? formatDistanceToNow(new Date(pipeline.lastExecution.startedAt), { addSuffix: true }) : '—' },
              { label: 'Duration', value: pipeline.lastExecution?.duration || '—' },
              { label: 'Rows Written', value: pipeline.lastExecution?.rowsWritten.toLocaleString() || '—' },
              { label: 'Quarantined', value: pipeline.lastExecution?.rowsQuarantined.toLocaleString() || '—' },
            ].map((m) => (
              <Card key={m.label}>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{m.label}</p>
                  <p className="text-lg font-bold mt-1">{m.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {chartData.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Data Volume</CardTitle></CardHeader>
              <CardContent>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="rows" stroke="hsl(86,66%,44%)" strokeWidth={2} name="Written" />
                      <Line type="monotone" dataKey="quarantined" stroke="hsl(45,100%,51%)" strokeWidth={2} name="Quarantined" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="runs" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Run ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Rows</TableHead>
                    <TableHead>Quarantined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.id}</TableCell>
                      <TableCell>
                        <span className={`inline-block h-2.5 w-2.5 rounded-full ${runStatusColor[r.status]}`} />
                      </TableCell>
                      <TableCell className="text-sm">{formatDistanceToNow(new Date(r.startedAt), { addSuffix: true })}</TableCell>
                      <TableCell>{r.duration}</TableCell>
                      <TableCell>{r.rowsWritten.toLocaleString()}</TableCell>
                      <TableCell>{r.rowsQuarantined.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config" className="mt-4">
          <Card>
            <CardContent className="p-4">
              <pre className="bg-muted p-4 rounded-md overflow-auto text-xs">
                {JSON.stringify({ ...pipeline, schema: undefined, qualityRules: undefined }, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quarantine" className="mt-4">
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <p>Quarantine data viewer coming soon.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PipelineDetail;

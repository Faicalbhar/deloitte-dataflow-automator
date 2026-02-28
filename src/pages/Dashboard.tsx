import { Square, Pencil, Eye, Circle, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useNavigate } from 'react-router-dom';
import { mockPipelines } from '@/data/mock-data';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

const lampColor: Record<string, string> = {
  success: 'text-success',
  deployed: 'text-success',
  failed: 'text-destructive',
  running: 'text-warning',
  warning: 'text-warning',
  draft: 'text-muted-foreground',
  ready: 'text-info',
};

const Dashboard = () => {
  const navigate = useNavigate();

  const handleStop = (pipelineId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toast.success('Pipeline stopped. A data engineer can stop a pipeline only during the "Running" phase — while data is being ingested or transformed. Once completed, the run cannot be interrupted.');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Pipeline History & Status</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-12">Status</TableHead>
                <TableHead>Pipeline</TableHead>
                <TableHead>Last Execution</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Rows Processed</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockPipelines.map((p) => {
                const isRunning = p.status === 'running';
                const color = lampColor[p.status] || 'text-muted-foreground';
                return (
                  <TableRow key={p.id} className="hover:bg-accent/30">
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger>
                          <div className="flex items-center justify-center">
                            <Circle className={`h-4 w-4 fill-current ${color} ${isRunning ? 'animate-pulse' : ''}`} />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          {p.status === 'running' ? 'Running — can be stopped' :
                           p.status === 'failed' ? 'Failed' :
                           p.status === 'deployed' ? 'Success / Deployed' :
                           p.status === 'draft' ? 'Draft' :
                           p.status === 'ready' ? 'Ready' : p.status}
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.description}</p>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.lastExecution
                        ? formatDistanceToNow(new Date(p.lastExecution.startedAt), { addSuffix: true })
                        : '—'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {p.lastExecution?.duration || '—'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {p.lastExecution
                        ? `${p.lastExecution.rowsWritten.toLocaleString()} / ${p.lastExecution.rowsRead.toLocaleString()}`
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={!isRunning} onClick={(e) => handleStop(p.id, e)}>
                              <Square className={`h-3.5 w-3.5 ${isRunning ? 'text-destructive' : ''}`} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {isRunning ? 'Stop pipeline (available during Running phase only)' : 'Stop is only available while the pipeline is running'}
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); navigate(`/pipelines/${p.id}/edit`); }}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Modify pipeline transformations</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); navigate(`/pipelines/${p.id}`); }}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>View pipeline details & transformations</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Button className="fixed bottom-6 right-6 h-12 rounded-full shadow-lg gap-2 px-5" onClick={() => navigate('/create-pipeline')}>
        <Plus className="h-5 w-5" />
        New Pipeline
      </Button>
    </div>
  );
};

export default Dashboard;

import { useState } from 'react';
import { Search, Plus, Play, Copy, Pencil, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useNavigate } from 'react-router-dom';
import { mockPipelines } from '@/data/mock-data';
import { formatDistanceToNow } from 'date-fns';
import type { Pipeline, PipelineStatus } from '@/types';

const statusBadge: Record<PipelineStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-muted text-muted-foreground' },
  ready: { label: 'Ready', className: 'bg-info text-info-foreground' },
  deployed: { label: 'Deployed', className: 'bg-success text-success-foreground' },
  failed: { label: 'Failed', className: 'bg-destructive text-destructive-foreground' },
  running: { label: 'Running', className: 'bg-info text-info-foreground animate-pulse-dot' },
};

const Pipelines = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Pipeline | null>(null);

  const filtered = mockPipelines.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search pipelines..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button className="gap-2" onClick={() => navigate('/create-pipeline')}>
          <Plus className="h-4 w-4" /> Create Pipeline
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-lg font-medium mb-2">No pipelines yet</p>
              <p className="text-muted-foreground mb-4">Create your first pipeline to get started.</p>
              <Button onClick={() => navigate('/create-pipeline')}>Create Pipeline</Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Execution</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => {
                  const sb = statusBadge[p.status];
                  return (
                    <TableRow
                      key={p.id}
                      className="cursor-pointer hover:bg-accent/50"
                      onClick={() => setSelected(p)}
                    >
                      <TableCell className="font-medium text-primary hover:underline">{p.name}</TableCell>
                      <TableCell>
                        <Badge className={sb.className}>{sb.label}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {p.lastExecution
                          ? formatDistanceToNow(new Date(p.lastExecution.startedAt), { addSuffix: true })
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-[10px] bg-muted">
                              {p.owner.name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{p.owner.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8"><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><Copy className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><Play className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail Drawer */}
      <Sheet open={!!selected} onOpenChange={() => setSelected(null)}>
        <SheetContent className="sm:max-w-lg">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.name}</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Badge className={statusBadge[selected.status].className}>
                    {statusBadge[selected.status].label}
                  </Badge>
                  <span className="text-sm text-muted-foreground">{selected.environment}</span>
                </div>
                <p className="text-sm text-muted-foreground">{selected.description}</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Owner</p>
                    <p className="font-medium">{selected.owner.name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Last Run</p>
                    <p className="font-medium">
                      {selected.lastExecution
                        ? `${selected.lastExecution.duration} — ${selected.lastExecution.rowsWritten.toLocaleString()} rows`
                        : '—'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 pt-4">
                  <Button className="flex-1" onClick={() => navigate(`/pipelines/${selected.id}`)}>
                    View Details
                  </Button>
                  <Button variant="outline" className="flex-1">Run Now</Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Pipelines;

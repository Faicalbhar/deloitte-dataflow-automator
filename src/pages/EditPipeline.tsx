import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Save, Plus, Trash2, GripVertical, Send, Code, ArrowRight, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { mockPipelines, mockSchemaColumns, mockFirstRow, availableTransformationTypes } from '@/data/mock-data';
import type { Transformation, TransformationType, ColumnType } from '@/types';
import { toast } from 'sonner';

const typeColors: Record<ColumnType, string> = {
  STRING: 'bg-info text-info-foreground',
  INTEGER: 'bg-success text-success-foreground',
  DECIMAL: 'bg-warning text-warning-foreground',
  DATE: 'bg-accent text-accent-foreground',
  BOOLEAN: 'bg-muted text-muted-foreground',
  TIMESTAMP: 'bg-accent text-accent-foreground',
};

interface ChatMessage { role: 'user' | 'assistant'; content: string; }

const EDIT_STEPS = ['Transformations', 'Review & Deploy'];

const EditPipeline = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const pipeline = mockPipelines.find((p) => p.id === id);
  const columns = mockSchemaColumns;

  const [step, setStep] = useState(0);
  const [transformations, setTransformations] = useState<Transformation[]>(pipeline?.transformations || []);
  const [aiOpen, setAiOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: "👋 I'm your AI Transformation Agent. Describe what transformations you need in natural language.\n\nExamples:\n• \"Filter cancelled rows, rename transaction_date to txn_date\"\n• \"Cast amount to DECIMAL and deduplicate by transaction_id\"\n• \"Aggregate total amount by client_id, sort by date DESC\"" }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Review & Deploy state
  const [partitions, setPartitions] = useState<string[]>(['default_output']);
  const [outputPath, setOutputPath] = useState('/mnt/data/output/');
  const [scheduled, setScheduled] = useState(false);
  const [cronExpr, setCronExpr] = useState('0 6 * * *');
  const [env, setEnv] = useState<'development' | 'production'>(pipeline?.environment || 'development');
  const [deployModal, setDeployModal] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployStep, setDeployStep] = useState(0);

  if (!pipeline) {
    return (
      <div className="text-center py-16">
        <p>Pipeline not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/pipelines')}>Back</Button>
      </div>
    );
  }

  const addTransformation = (type: TransformationType) => {
    const newT: Transformation = {
      id: `t-${Date.now()}`,
      order: transformations.length + 1,
      type,
      config: {},
      sourceColumns: [],
      description: availableTransformationTypes.find(t => t.type === type)?.label || type,
    };
    setTransformations([...transformations, newT]);
  };

  const removeTransformation = (tid: string) => {
    setTransformations(transformations.filter(t => t.id !== tid).map((t, i) => ({ ...t, order: i + 1 })));
  };

  const updateTransformation = (tid: string, updates: Partial<Transformation>) => {
    setTransformations(transformations.map(t => t.id === tid ? { ...t, ...updates } : t));
  };

  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput.trim();
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setChatInput('');
    setAiLoading(true);

    setTimeout(() => {
      const lower = userMsg.toLowerCase();
      const newTransformations: Transformation[] = [];

      if (lower.includes('filter')) {
        const cond = lower.includes('cancel') ? "status != 'cancelled'" : lower.includes('amount') ? 'amount > 0' : "status = 'completed'";
        newTransformations.push({ id: `t-${Date.now()}-f`, order: transformations.length + newTransformations.length + 1, type: 'filter', config: { condition: cond }, sourceColumns: ['status'], description: `Filter: ${cond}` });
      }
      if (lower.includes('rename')) {
        const src = lower.includes('transaction_date') ? 'transaction_date' : columns[0]?.name || 'column';
        const tgt = lower.includes('txn_date') ? 'txn_date' : 'renamed_col';
        newTransformations.push({ id: `t-${Date.now()}-r`, order: transformations.length + newTransformations.length + 1, type: 'rename', config: { newName: tgt }, sourceColumns: [src], targetColumn: tgt, description: `Rename ${src} → ${tgt}` });
      }
      if (lower.includes('cast')) {
        const col = lower.includes('amount') ? 'amount' : columns[0]?.name || 'column';
        const typ = lower.includes('decimal') ? 'DECIMAL' : lower.includes('integer') ? 'INTEGER' : 'STRING';
        newTransformations.push({ id: `t-${Date.now()}-c`, order: transformations.length + newTransformations.length + 1, type: 'cast', config: { targetType: typ }, sourceColumns: [col], targetColumn: col, description: `Cast ${col} to ${typ}` });
      }
      if (lower.includes('deduplic') || lower.includes('duplicate')) {
        newTransformations.push({ id: `t-${Date.now()}-dd`, order: transformations.length + newTransformations.length + 1, type: 'deduplicate', config: { columns: ['transaction_id'] }, sourceColumns: ['transaction_id'], description: 'Remove duplicate rows' });
      }
      if (lower.includes('aggregate') || lower.includes('group')) {
        const grp = lower.includes('client') ? 'client_id' : columns[0]?.name || 'id';
        newTransformations.push({ id: `t-${Date.now()}-a`, order: transformations.length + newTransformations.length + 1, type: 'aggregate', config: { groupBy: [grp], aggregations: [{ column: 'amount', func: 'SUM', alias: 'total_amount' }] }, sourceColumns: [grp, 'amount'], targetColumn: 'total_amount', description: `Aggregate amount by ${grp}` });
      }
      if (lower.includes('drop')) {
        const col = lower.includes('email') ? 'email' : 'client_name';
        newTransformations.push({ id: `t-${Date.now()}-d`, order: transformations.length + newTransformations.length + 1, type: 'drop_column', config: {}, sourceColumns: [col], description: `Drop column ${col}` });
      }
      if (lower.includes('sort') || lower.includes('order')) {
        const col = lower.includes('date') ? 'transaction_date' : 'amount';
        newTransformations.push({ id: `t-${Date.now()}-s`, order: transformations.length + newTransformations.length + 1, type: 'sort', config: { direction: 'DESC' }, sourceColumns: [col], description: `Sort by ${col} DESC` });
      }
      if (lower.includes('add') && lower.includes('column')) {
        newTransformations.push({ id: `t-${Date.now()}-ac`, order: transformations.length + newTransformations.length + 1, type: 'add_column', config: { expression: "CONCAT(client_id, '-', transaction_id)" }, sourceColumns: ['client_id', 'transaction_id'], targetColumn: 'composite_key', description: 'Create composite key' });
      }

      let response: string;
      if (newTransformations.length > 0) {
        setTransformations(prev => [...prev, ...newTransformations]);
        response = `✅ Created **${newTransformations.length} transformation(s)**:\n\n${newTransformations.map((t, i) => `${i + 1}. **${t.type.replace('_', ' ').toUpperCase()}** — ${t.description}`).join('\n')}\n\nYou can edit each one or ask me for more.`;
      } else {
        response = "I couldn't identify transformations. Try:\n• \"Filter rows where status is cancelled\"\n• \"Rename transaction_date to txn_date, cast amount to DECIMAL\"\n• \"Aggregate amount by client_id, deduplicate, sort by date\"";
      }
      setChatMessages(prev => [...prev, { role: 'assistant', content: response }]);
      setAiLoading(false);
    }, 1200);
  };

  const generateJson = () => ({
    pipeline: pipeline.name,
    environment: env,
    outputPartitions: partitions,
    outputPath,
    scheduled,
    cronExpression: scheduled ? cronExpr : null,
    transformations: transformations.map(t => ({
      order: t.order, type: t.type, config: t.config,
      sourceColumns: t.sourceColumns, targetColumn: t.targetColumn, description: t.description,
    })),
  });

  const deploySteps = ['Validating configuration', 'Generating DLT code', 'Creating bundle', 'Deploying to Databricks', 'Running smoke tests', 'Completed'];
  const handleDeploy = async () => {
    setDeploying(true);
    for (let i = 0; i < deploySteps.length; i++) {
      setDeployStep(i);
      await new Promise((r) => setTimeout(r, 800));
    }
    setDeploying(false);
    setDeployModal(false);
    toast.success('Pipeline updated and deployed successfully!');
    navigate(`/pipelines/${id}`);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/pipelines/${id}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Edit: {pipeline.name}</h1>
            <p className="text-sm text-muted-foreground">Modify transformations, then review & redeploy</p>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          {EDIT_STEPS.map((s, i) => (
            <span key={s} className={`${i === step ? 'text-primary font-semibold' : i < step ? 'text-success' : 'text-muted-foreground'}`}>
              {i < step ? '✓ ' : ''}{s}
            </span>
          ))}
        </div>
        <Progress value={((step + 1) / EDIT_STEPS.length) * 100} className="h-1.5" />
      </div>

      {/* Step 1: Transformations */}
      {step === 0 && (
        <div className="flex gap-4">
          {/* Left: columns */}
          <div className="w-1/3 space-y-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Data Contract — Columns</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs">Column</TableHead>
                      <TableHead className="text-xs">Type</TableHead>
                      <TableHead className="text-xs">Sample</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {columns.map((col) => (
                      <TableRow key={col.id} className="text-xs">
                        <TableCell className="font-mono py-2">{col.name}</TableCell>
                        <TableCell className="py-2"><Badge className={`${typeColors[col.type]} text-[10px]`}>{col.type}</Badge></TableCell>
                        <TableCell className="py-2 text-muted-foreground truncate max-w-[100px]">{mockFirstRow[col.name] || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Right: transformations */}
          <div className="flex-1 space-y-4">
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm">Transformations</CardTitle>
                <div className="flex gap-2">
                  <Select onValueChange={(v) => addTransformation(v as TransformationType)}>
                    <SelectTrigger className="h-8 w-44 text-xs">
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      <SelectValue placeholder="Add transformation" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTransformationTypes.map((t) => (
                        <SelectItem key={t.type} value={t.type}>
                          <div><span className="font-medium">{t.label}</span><span className="text-muted-foreground ml-2 text-[10px]">{t.description}</span></div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" className="gap-2 h-8 text-xs" onClick={() => setAiOpen(true)}>
                    <Sparkles className="h-3.5 w-3.5 text-primary" /> AI Agent
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {transformations.length === 0 ? (
                  <div className="border border-dashed rounded-lg p-8 text-center text-muted-foreground">
                    <p className="text-sm">No transformations. Use the dropdown above or AI Agent.</p>
                  </div>
                ) : (
                  transformations.map((t) => (
                    <Card key={t.id} className="border bg-muted/30">
                      <CardContent className="p-3 flex items-start gap-3">
                        <div className="flex items-center gap-2 shrink-0 pt-0.5">
                          <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                          <Badge variant="outline" className="text-xs font-mono w-7 justify-center">{t.order}</Badge>
                        </div>
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge className="bg-primary/10 text-primary text-[10px]">{t.type.replace('_', ' ').toUpperCase()}</Badge>
                            <span className="text-xs font-medium">{t.description}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-[10px]">Source Column(s)</Label>
                              <Select value={t.sourceColumns[0] || ''} onValueChange={(v) => updateTransformation(t.id, { sourceColumns: [v] })}>
                                <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                                <SelectContent>{columns.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                            {t.type === 'rename' && (
                              <div><Label className="text-[10px]">New Name</Label><Input className="h-7 text-xs" value={(t.config.newName as string) || ''} onChange={(e) => updateTransformation(t.id, { config: { ...t.config, newName: e.target.value } })} /></div>
                            )}
                            {t.type === 'filter' && (
                              <div><Label className="text-[10px]">Condition</Label><Input className="h-7 text-xs font-mono" value={(t.config.condition as string) || ''} onChange={(e) => updateTransformation(t.id, { config: { ...t.config, condition: e.target.value } })} /></div>
                            )}
                            {t.type === 'cast' && (
                              <div><Label className="text-[10px]">Target Type</Label>
                                <Select value={(t.config.targetType as string) || ''} onValueChange={(v) => updateTransformation(t.id, { config: { ...t.config, targetType: v } })}>
                                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>{['STRING','INTEGER','DECIMAL','DATE','BOOLEAN'].map(tp => <SelectItem key={tp} value={tp}>{tp}</SelectItem>)}</SelectContent>
                                </Select>
                              </div>
                            )}
                            {t.type === 'add_column' && (
                              <div><Label className="text-[10px]">Expression</Label><Input className="h-7 text-xs font-mono" value={(t.config.expression as string) || ''} onChange={(e) => updateTransformation(t.id, { config: { ...t.config, expression: e.target.value } })} /></div>
                            )}
                            {t.type === 'aggregate' && (
                              <div><Label className="text-[10px]">Group By</Label><Input className="h-7 text-xs font-mono" value={(t.config.groupBy as string[])?.join(', ') || ''} onChange={(e) => updateTransformation(t.id, { config: { ...t.config, groupBy: e.target.value.split(',').map(s => s.trim()) } })} /></div>
                            )}
                            {t.type === 'custom_sql' && (
                              <div className="col-span-2"><Label className="text-[10px]">SQL Expression</Label><Textarea className="text-xs font-mono" rows={2} value={(t.config.sql as string) || ''} onChange={(e) => updateTransformation(t.id, { config: { ...t.config, sql: e.target.value } })} /></div>
                            )}
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive" onClick={() => removeTransformation(t.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))
                )}
              </CardContent>
            </Card>

            {/* JSON Preview */}
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center gap-2">
                <Code className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm">Updated JSON (for backend)</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted rounded-md p-3 text-[10px] font-mono overflow-auto max-h-48">
                  {JSON.stringify(generateJson(), null, 2)}
                </pre>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Step 2: Review & Deploy */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Environment</Label>
              <Select value={env} onValueChange={(v) => setEnv(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="development">Development</SelectItem>
                  <SelectItem value="production">Production</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Output Path (DBFS)</Label>
              <Input value={outputPath} onChange={(e) => setOutputPath(e.target.value)} placeholder="/mnt/data/output/" />
            </div>
          </div>

          {/* Partitions */}
          <div className="space-y-2">
            <Label>Output Partition(s)</Label>
            <p className="text-xs text-muted-foreground">Define output table names.</p>
            <div className="space-y-2">
              {partitions.map((p, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={p} onChange={(e) => { const np = [...partitions]; np[i] = e.target.value; setPartitions(np); }} placeholder="table_name" />
                  {partitions.length > 1 && (
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setPartitions(partitions.filter((_, j) => j !== i))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setPartitions([...partitions, `output_${partitions.length + 1}`])}>
                <Plus className="h-3.5 w-3.5" /> Add Partition
              </Button>
            </div>
          </div>

          {/* Scheduling */}
          <div className="flex items-center gap-4">
            <Switch checked={scheduled} onCheckedChange={setScheduled} />
            <Label>Enable Scheduling</Label>
            {scheduled && (
              <Input className="w-48" value={cronExpr} onChange={(e) => setCronExpr(e.target.value)} placeholder="cron expression" />
            )}
          </div>

          {/* JSON & Code preview */}
          <Tabs defaultValue="config">
            <TabsList>
              <TabsTrigger value="config">Configuration JSON</TabsTrigger>
              <TabsTrigger value="transforms">Transformations ({transformations.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="config" className="mt-4">
              <pre className="bg-muted p-4 rounded-md text-xs overflow-auto max-h-80 font-mono">
                {JSON.stringify(generateJson(), null, 2)}
              </pre>
            </TabsContent>
            <TabsContent value="transforms" className="mt-4">
              <div className="space-y-2">
                {transformations.map(t => (
                  <div key={t.id} className="flex items-center gap-3 p-3 rounded-md bg-muted/50 border text-sm">
                    <Badge variant="outline" className="font-mono text-xs">{t.order}</Badge>
                    <Badge className="bg-primary/10 text-primary text-[10px]">{t.type.replace('_', ' ')}</Badge>
                    <span className="flex-1">{t.description}</span>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between border-t pt-4">
        <div>
          {step === 0 ? (
            <Button variant="outline" onClick={() => navigate(`/pipelines/${id}`)}>Cancel</Button>
          ) : (
            <Button variant="outline" className="gap-2" onClick={() => setStep(0)}>
              <ArrowLeft className="h-4 w-4" /> Previous
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          {step === 0 ? (
            <Button className="gap-2" onClick={() => setStep(1)}>
              Next: Review & Deploy <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button className="gap-2" onClick={() => setDeployModal(true)}>
              Deploy Changes
            </Button>
          )}
        </div>
      </div>

      {/* Deploy Modal */}
      <Dialog open={deployModal} onOpenChange={setDeployModal}>
        <DialogContent>
          {!deploying ? (
            <>
              <DialogHeader><DialogTitle>Confirm Redeployment</DialogTitle></DialogHeader>
              <p className="text-sm text-muted-foreground">
                Redeploy <strong>{pipeline.name}</strong> to <strong>{env}</strong> with {transformations.length} transformation(s) and {partitions.length} output partition(s).
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeployModal(false)}>Cancel</Button>
                <Button onClick={handleDeploy}>Deploy</Button>
              </DialogFooter>
            </>
          ) : (
            <div className="py-4 space-y-3">
              <p className="font-semibold text-center mb-4">Deploying...</p>
              {deploySteps.map((ds, i) => (
                <div key={ds} className="flex items-center gap-3 text-sm">
                  {i < deployStep ? <span className="text-success">✓</span> : i === deployStep ? <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <div className="h-4 w-4 rounded-full border border-border" />}
                  <span className={i <= deployStep ? 'text-foreground' : 'text-muted-foreground'}>{ds}</span>
                </div>
              ))}
              <Progress value={(deployStep / (deploySteps.length - 1)) * 100} className="mt-4" />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* AI Agent Sheet */}
      <Sheet open={aiOpen} onOpenChange={setAiOpen}>
        <SheetContent className="sm:max-w-lg flex flex-col">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> AI Transformation Agent
            </SheetTitle>
            <p className="text-xs text-muted-foreground">
              Describe transformations in natural language. The agent creates them automatically.
            </p>
          </SheetHeader>
          <ScrollArea className="flex-1 mt-4 pr-4">
            <div className="space-y-4">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}
              {aiLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg px-4 py-3 flex items-center gap-2">
                    <div className="h-3 w-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs text-muted-foreground">Generating transformations...</span>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
          <div className="flex gap-2 mt-4 pt-4 border-t">
            <Input
              placeholder="e.g. Filter cancelled rows, rename transaction_date..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !aiLoading && handleSendChat()}
              className="text-sm"
              disabled={aiLoading}
            />
            <Button size="icon" onClick={handleSendChat} disabled={aiLoading || !chatInput.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default EditPipeline;

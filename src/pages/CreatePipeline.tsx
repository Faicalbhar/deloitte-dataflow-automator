import { useState } from 'react';
import {
  Upload, FileSpreadsheet, Check, X, HelpCircle, ArrowLeft, ArrowRight, Save,
  Plus, Trash2, GripVertical, Bot, Send, Code, CheckCircle2, XCircle, Download, Eye,
  Square, Pause, Play, RotateCcw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNavigate } from 'react-router-dom';
import { mockSchemaColumns, mockFirstRow, availableTransformationTypes } from '@/data/mock-data';
import type { SchemaColumn, ColumnType, Transformation, TransformationType } from '@/types';
import { toast } from 'sonner';

const STEPS = ['Contract Upload', 'Schema & Transformations', 'Review & Deploy', 'Execution'];

const typeColors: Record<ColumnType, string> = {
  STRING: 'bg-info text-info-foreground',
  INTEGER: 'bg-success text-success-foreground',
  DECIMAL: 'bg-warning text-warning-foreground',
  DATE: 'bg-accent text-accent-foreground',
  BOOLEAN: 'bg-muted text-muted-foreground',
  TIMESTAMP: 'bg-accent text-accent-foreground',
};

interface ChatMessage { role: 'user' | 'assistant'; content: string; }

const CreatePipeline = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  // Step 1
  const [file, setFile] = useState<File | null>(null);
  const [fileValid, setFileValid] = useState(false);
  const [fileMask, setFileMask] = useState('');
  const [columns, setColumns] = useState<SchemaColumn[]>([]);
  const [matchInfo, setMatchInfo] = useState<{ message: string; matchPercent: number; missingColumns: string[]; matchedFile: string } | null>(null);
  const [userApproved, setUserApproved] = useState(false);

  // Step 2
  const [transformations, setTransformations] = useState<Transformation[]>([]);
  const [aiOpen, setAiOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: "Hi! I'm your AI assistant. I can help create transformations:\n- \"Filter out cancelled rows\"\n- \"Rename column X to Y\"\n- \"Aggregate amount by client_id\"\n- \"Create a composite key\"" }
  ]);
  const [chatInput, setChatInput] = useState('');

  // Step 3
  const [pipelineName, setPipelineName] = useState('');
  const [pipelineDesc, setPipelineDesc] = useState('');
  const [env, setEnv] = useState<'development' | 'production'>('development');
  const [notifications, setNotifications] = useState(true);
  const [partitions, setPartitions] = useState<string[]>(['default_output']);
  const [outputPath, setOutputPath] = useState('/mnt/data/output/');
  const [scheduled, setScheduled] = useState(false);
  const [cronExpr, setCronExpr] = useState('0 6 * * *');

  // Step 4 — Execution
  const [execStatus, setExecStatus] = useState<'idle' | 'running' | 'paused' | 'success' | 'failed'>('idle');
  const [execStep, setExecStep] = useState(0);
  const [execError, setExecError] = useState<string | null>(null);
  const [execLogs, setExecLogs] = useState<string[]>([]);

  // Step 1 handlers
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setUserApproved(false);
      setTimeout(() => {
        setFileValid(true);
        setColumns(mockSchemaColumns);
        setMatchInfo({
          message: 'Backend searched DBFS with mask "' + (fileMask || 'client_*.csv') + '" and found 3 files. Best match:',
          matchPercent: 92,
          matchedFile: 'transactions_2025_01.csv',
          missingColumns: ['currency'],
        });
        toast.success('Contract parsed — DBFS file matched');
      }, 1200);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) {
      setFile(f);
      setUserApproved(false);
      setTimeout(() => {
        setFileValid(true);
        setColumns(mockSchemaColumns);
        setMatchInfo({
          message: 'Backend searched DBFS and found best match:',
          matchPercent: 92,
          matchedFile: 'transactions_2025_01.csv',
          missingColumns: ['currency'],
        });
        toast.success('Contract parsed successfully');
      }, 1200);
    }
  };

  // Transformation handlers
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

  const removeTransformation = (id: string) => {
    setTransformations(transformations.filter(t => t.id !== id).map((t, i) => ({ ...t, order: i + 1 })));
  };

  const updateTransformation = (id: string, updates: Partial<Transformation>) => {
    setTransformations(transformations.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  // AI Chat
  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput.trim();
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setChatInput('');
    setTimeout(() => {
      let response = '';
      let newTransformation: Transformation | null = null;
      if (userMsg.toLowerCase().includes('filter')) {
        newTransformation = { id: `t-${Date.now()}`, order: transformations.length + 1, type: 'filter', config: { condition: "status != 'cancelled'" }, sourceColumns: ['status'], description: "Filter out cancelled rows" };
        response = "✅ Added a **Filter** transformation (#" + (transformations.length + 1) + ").";
      } else if (userMsg.toLowerCase().includes('rename')) {
        newTransformation = { id: `t-${Date.now()}`, order: transformations.length + 1, type: 'rename', config: { newName: 'txn_date' }, sourceColumns: ['transaction_date'], targetColumn: 'txn_date', description: "Rename transaction_date → txn_date" };
        response = "✅ Added a **Rename** transformation (#" + (transformations.length + 1) + ").";
      } else if (userMsg.toLowerCase().includes('aggregate') || userMsg.toLowerCase().includes('group')) {
        newTransformation = { id: `t-${Date.now()}`, order: transformations.length + 1, type: 'aggregate', config: { groupBy: ['client_id'], aggregations: [{ column: 'amount', func: 'SUM', alias: 'total_amount' }] }, sourceColumns: ['client_id', 'amount'], targetColumn: 'total_amount', description: "Aggregate total amount by client" };
        response = "✅ Added an **Aggregate** transformation.";
      } else if (userMsg.toLowerCase().includes('composite') || userMsg.toLowerCase().includes('concat') || userMsg.toLowerCase().includes('merge')) {
        newTransformation = { id: `t-${Date.now()}`, order: transformations.length + 1, type: 'add_column', config: { expression: "CONCAT(client_id, '-', transaction_id)" }, sourceColumns: ['client_id', 'transaction_id'], targetColumn: 'composite_key', description: "Create composite key" };
        response = "✅ Added an **Add Column** transformation.";
      } else {
        response = "Could you be more specific? Try:\n- \"Filter rows where amount > 1000\"\n- \"Rename column X to Y\"\n- \"Aggregate amount by client_id\"";
      }
      if (newTransformation) setTransformations(prev => [...prev, newTransformation!]);
      setChatMessages(prev => [...prev, { role: 'assistant', content: response }]);
    }, 800);
  };

  // Execution simulation
  const execSteps = ['Validating configuration', 'Generating DLT code', 'Creating Databricks bundle', 'Submitting job to cluster', 'Running Bronze layer', 'Running Silver layer', 'Running quality checks', 'Running Gold layer (if applicable)', 'Finalizing output'];
  const startExecution = async () => {
    setExecStatus('running');
    setExecError(null);
    setExecLogs([]);
    for (let i = 0; i < execSteps.length; i++) {
      if (execStatus === 'paused') {
        await new Promise(r => { const check = setInterval(() => { if (execStatus !== 'paused') { clearInterval(check); r(null); } }, 200); });
      }
      setExecStep(i);
      setExecLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${execSteps[i]}...`]);
      await new Promise(r => setTimeout(r, 1000));
    }
    setExecLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Pipeline completed successfully!`]);
    setExecStatus('success');
  };

  const simulateFailure = async () => {
    setExecStatus('running');
    setExecError(null);
    setExecLogs([]);
    for (let i = 0; i < 5; i++) {
      setExecStep(i);
      setExecLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${execSteps[i]}...`]);
      await new Promise(r => setTimeout(r, 800));
    }
    setExecError('SchemaValidationError: Column "currency" expected in Silver layer but not found in source data. DLT expectation "expect_column_exists(currency)" failed.');
    setExecLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ERROR: Pipeline failed at Silver layer`]);
    setExecStatus('failed');
  };

  // Generate JSON
  const generatePipelineJson = () => ({
    name: pipelineName || 'unnamed',
    description: pipelineDesc,
    environment: env,
    notifications,
    outputPartitions: partitions,
    outputPath,
    scheduled,
    cronExpression: scheduled ? cronExpr : null,
    source: { fileMask, path: '/mnt/data/transactions/', format: 'csv' },
    schema: columns.map(c => ({ name: c.name, type: c.type, nullable: c.nullable, sensitive: c.sensitive })),
    transformations: transformations.map(t => ({ order: t.order, type: t.type, config: t.config, sourceColumns: t.sourceColumns, targetColumn: t.targetColumn, description: t.description })),
  });

  const canNext = step === 0 ? (fileValid && userApproved) : step === 1 ? columns.length > 0 : step === 2 ? !!pipelineName : false;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          {STEPS.map((s, i) => (
            <span key={s} className={`${i === step ? 'text-primary font-semibold' : i < step ? 'text-success' : 'text-muted-foreground'}`}>
              {i < step ? '✓ ' : ''}{s}
            </span>
          ))}
        </div>
        <Progress value={((step + 1) / STEPS.length) * 100} className="h-1.5" />
      </div>

      {/* Step 1: Contract Upload */}
      {step === 0 && (
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>File Mask (DBFS pattern)</Label>
              <Tooltip>
                <TooltipTrigger><HelpCircle className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
                <TooltipContent>Pattern used by backend to search DBFS for matching files, e.g. client_*.csv</TooltipContent>
              </Tooltip>
            </div>
            <Input placeholder="e.g. client_2024_*.csv" value={fileMask} onChange={(e) => setFileMask(e.target.value)} />
          </div>

          <div
            className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${file ? 'border-success bg-success/5' : 'border-border hover:border-primary'}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            {!file ? (
              <label className="cursor-pointer block">
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="font-medium">Upload your Data Contract (Excel)</p>
                <p className="text-sm text-muted-foreground mt-1">.xlsx, .xls — Max 10MB</p>
                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileUpload} />
              </label>
            ) : (
              <div className="flex items-center justify-center gap-3">
                <FileSpreadsheet className="h-8 w-8 text-success" />
                <div className="text-left">
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">{columns.length} columns detected</p>
                </div>
                {fileValid ? <Check className="h-5 w-5 text-success" /> : <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />}
                <Button variant="ghost" size="icon" onClick={() => { setFile(null); setFileValid(false); setColumns([]); setMatchInfo(null); setUserApproved(false); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Match info from backend */}
          {matchInfo && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-4 space-y-3">
                <p className="font-medium text-primary text-sm">📋 DBFS File Match Result</p>
                <p className="text-sm text-muted-foreground">{matchInfo.message}</p>
                <div className="flex items-center gap-4 text-sm">
                  <Badge className="bg-success text-success-foreground">{matchInfo.matchPercent}% match</Badge>
                  <span className="font-mono text-xs">{matchInfo.matchedFile}</span>
                </div>
                {matchInfo.missingColumns.length > 0 && (
                  <div className="text-sm">
                    <span className="text-warning font-medium">Missing columns vs data contract: </span>
                    {matchInfo.missingColumns.map(c => (
                      <Badge key={c} variant="outline" className="text-xs ml-1 text-warning border-warning/30">{c}</Badge>
                    ))}
                    <p className="text-xs text-muted-foreground mt-1">These optional columns will use default values.</p>
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <Button size="sm" className="gap-2" onClick={() => { setUserApproved(true); toast.success('File approved!'); }}>
                    <Check className="h-4 w-4" /> Approve this file
                  </Button>
                  <Button size="sm" variant="outline" className="gap-2" onClick={() => toast.info('In production, a file picker would appear to let you choose another DBFS file.')}>
                    Choose another file
                  </Button>
                </div>
                {userApproved && <Badge className="bg-success text-success-foreground">✓ File approved by user</Badge>}
              </CardContent>
            </Card>
          )}

          <Button variant="outline" size="sm" className="gap-2">
            <FileSpreadsheet className="h-4 w-4" /> Download Contract Template
          </Button>
        </div>
      )}

      {/* Step 2: Schema + Transformations */}
      {step === 1 && (
        <div className="flex gap-4 relative">
          {/* Left: Columns */}
          <div className="w-1/3 space-y-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Source Columns</CardTitle></CardHeader>
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
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Data Preview (1st row)</CardTitle></CardHeader>
              <CardContent className="p-3">
                <pre className="bg-muted rounded p-2 text-[10px] overflow-auto max-h-40">{JSON.stringify(mockFirstRow, null, 2)}</pre>
              </CardContent>
            </Card>
          </div>

          {/* Right: Transformation Builder */}
          <div className="flex-1 space-y-4">
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm">Transformations</CardTitle>
                <Select onValueChange={(v) => {
                  if (v === '__ai_assistant__') setAiOpen(true);
                  else addTransformation(v as TransformationType);
                }}>
                  <SelectTrigger className="h-8 w-52 text-xs">
                    <SelectValue placeholder="+ Add transformation" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTransformationTypes.map((t) => (
                      <SelectItem key={t.type} value={t.type}>
                        <div><span className="font-medium">{t.label}</span><span className="text-muted-foreground ml-2 text-[10px]">{t.description}</span></div>
                      </SelectItem>
                    ))}
                    <SelectItem value="__ai_assistant__">
                      <div className="flex items-center gap-1"><Bot className="h-3.5 w-3.5" /><span className="font-medium">AI Assistant</span><span className="text-muted-foreground ml-1 text-[10px]">Natural language</span></div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent className="space-y-2">
                {transformations.length === 0 ? (
                  <div className="border border-dashed rounded-lg p-8 text-center text-muted-foreground">
                    <p className="text-sm font-medium mb-1">No transformations yet</p>
                    <p className="text-xs">Use the dropdown above or AI assistant to add transformations.</p>
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
                                <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Select column" /></SelectTrigger>
                                <SelectContent>{columns.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                            {t.type === 'rename' && <div><Label className="text-[10px]">New Name</Label><Input className="h-7 text-xs" value={(t.config.newName as string) || ''} onChange={(e) => updateTransformation(t.id, { config: { ...t.config, newName: e.target.value } })} /></div>}
                            {t.type === 'cast' && <div><Label className="text-[10px]">Target Type</Label><Select value={(t.config.targetType as string) || ''} onValueChange={(v) => updateTransformation(t.id, { config: { ...t.config, targetType: v } })}><SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger><SelectContent>{['STRING','INTEGER','DECIMAL','DATE','BOOLEAN','TIMESTAMP'].map(tp => <SelectItem key={tp} value={tp}>{tp}</SelectItem>)}</SelectContent></Select></div>}
                            {t.type === 'filter' && <div><Label className="text-[10px]">Condition</Label><Input className="h-7 text-xs font-mono" value={(t.config.condition as string) || ''} onChange={(e) => updateTransformation(t.id, { config: { ...t.config, condition: e.target.value } })} /></div>}
                            {t.type === 'add_column' && <div><Label className="text-[10px]">Expression</Label><Input className="h-7 text-xs font-mono" value={(t.config.expression as string) || ''} onChange={(e) => updateTransformation(t.id, { config: { ...t.config, expression: e.target.value } })} /></div>}
                            {t.type === 'aggregate' && <div><Label className="text-[10px]">Group By</Label><Input className="h-7 text-xs font-mono" value={(t.config.groupBy as string[])?.join(', ') || ''} onChange={(e) => updateTransformation(t.id, { config: { ...t.config, groupBy: e.target.value.split(',').map(s => s.trim()) } })} /></div>}
                            {t.type === 'custom_sql' && <div className="col-span-2"><Label className="text-[10px]">SQL</Label><Textarea className="text-xs font-mono" rows={2} value={(t.config.sql as string) || ''} onChange={(e) => updateTransformation(t.id, { config: { ...t.config, sql: e.target.value } })} /></div>}
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

            {transformations.length > 0 && (
              <Card>
                <CardHeader className="pb-2 flex flex-row items-center gap-2">
                  <Code className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm">Pipeline JSON (sent to backend)</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="bg-muted rounded-md p-3 text-[10px] font-mono overflow-auto max-h-48">{JSON.stringify(generatePipelineJson(), null, 2)}</pre>
                </CardContent>
              </Card>
            )}
          </div>

          {/* AI Assistant */}
          <Sheet open={aiOpen} onOpenChange={setAiOpen}>
            <SheetContent className="sm:max-w-md flex flex-col">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary" /> AI Transformation Assistant
                </SheetTitle>
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
                </div>
              </ScrollArea>
              <div className="flex gap-2 mt-4 pt-4 border-t">
                <Input placeholder="Describe a transformation..." value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendChat()} className="text-sm" />
                <Button size="icon" onClick={handleSendChat}><Send className="h-4 w-4" /></Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      )}

      {/* Step 3: Review & Deploy */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Pipeline Name</Label>
              <Input value={pipelineName} onChange={(e) => setPipelineName(e.target.value)} placeholder="my-pipeline" />
            </div>
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
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={pipelineDesc} onChange={(e) => setPipelineDesc(e.target.value)} placeholder="Describe your pipeline..." />
          </div>

          {/* Output Partitions */}
          <div className="space-y-2">
            <Label>Output Partition(s)</Label>
            <p className="text-xs text-muted-foreground">Define output table names. Aggregations may produce separate tables.</p>
            <div className="space-y-2">
              {partitions.map((p, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={p} onChange={(e) => { const np = [...partitions]; np[i] = e.target.value; setPartitions(np); }} placeholder="table_name" />
                  {partitions.length > 1 && <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setPartitions(partitions.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>}
                </div>
              ))}
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setPartitions([...partitions, `output_${partitions.length + 1}`])}>
                <Plus className="h-3.5 w-3.5" /> Add Partition
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Output Path (DBFS)</Label>
            <Input value={outputPath} onChange={(e) => setOutputPath(e.target.value)} placeholder="/mnt/data/output/" />
          </div>

          {/* Scheduling */}
          <div className="flex items-center gap-4">
            <Switch checked={scheduled} onCheckedChange={setScheduled} />
            <Label>Enable Scheduling</Label>
            {scheduled && <Input className="w-48" value={cronExpr} onChange={(e) => setCronExpr(e.target.value)} placeholder="cron expression" />}
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={notifications} onCheckedChange={setNotifications} />
            <Label className="text-sm">Enable email notifications</Label>
          </div>

          <Tabs defaultValue="config">
            <TabsList>
              <TabsTrigger value="config">Configuration JSON</TabsTrigger>
              <TabsTrigger value="code">DLT Code Preview</TabsTrigger>
              <TabsTrigger value="transforms">Transformations ({transformations.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="config" className="mt-4">
              <pre className="bg-muted p-4 rounded-md text-xs overflow-auto max-h-80 font-mono">{JSON.stringify(generatePipelineJson(), null, 2)}</pre>
            </TabsContent>
            <TabsContent value="code" className="mt-4">
              <pre className="bg-muted p-4 rounded-md text-xs overflow-auto max-h-80 font-mono">
{`import dlt
from pyspark.sql.functions import *

# Auto-generated by Data Pipeline Automation Platform
# Pipeline: ${pipelineName || 'unnamed'}

@dlt.table(name="bronze_${pipelineName || 'data'}")
def bronze():
    return spark.read.format("csv")\\
        .option("header", "true")\\
        .load("${outputPath}${fileMask || '*.csv'}")

@dlt.table(name="silver_${pipelineName || 'data'}")
def silver():
    df = dlt.read("bronze_${pipelineName || 'data'}")
${transformations.filter(t => t.type !== 'aggregate').map(t => {
  if (t.type === 'filter') return `    df = df.filter("${t.config.condition || ''}")`;
  if (t.type === 'rename') return `    df = df.withColumnRenamed("${t.sourceColumns[0] || ''}", "${t.config.newName || ''}")`;
  if (t.type === 'cast') return `    df = df.withColumn("${t.sourceColumns[0] || ''}", col("${t.sourceColumns[0] || ''}").cast("${t.config.targetType || ''}"))`;
  if (t.type === 'add_column') return `    df = df.withColumn("${t.targetColumn || 'new_col'}", expr("${t.config.expression || ''}"))`;
  if (t.type === 'drop_column') return `    df = df.drop("${t.sourceColumns[0] || ''}")`;
  return `    # ${t.type}: ${t.description}`;
}).join('\n')}
    return df`}
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
                {transformations.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No transformations configured</p>}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* Step 4: Execution Monitor */}
      {step === 3 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Pipeline Execution: {pipelineName}</CardTitle>
              <p className="text-sm text-muted-foreground">Environment: {env} • {transformations.length} transformations • {partitions.length} output partition(s)</p>
            </CardHeader>
            <CardContent className="space-y-6">
              {execStatus === 'idle' && (
                <div className="text-center py-8 space-y-4">
                  <p className="text-muted-foreground">Ready to start the pipeline. Click below to begin execution.</p>
                  <div className="flex gap-2 justify-center">
                    <Button className="gap-2" onClick={startExecution}><Play className="h-4 w-4" /> Start Pipeline</Button>
                    <Button variant="outline" className="gap-2" onClick={simulateFailure}><XCircle className="h-4 w-4" /> Simulate Failure</Button>
                  </div>
                </div>
              )}

              {(execStatus === 'running' || execStatus === 'paused') && (
                <div className="space-y-4">
                  <Progress value={(execStep / (execSteps.length - 1)) * 100} className="h-2" />
                  <div className="space-y-2">
                    {execSteps.map((es, i) => (
                      <div key={es} className="flex items-center gap-3 text-sm">
                        {i < execStep ? <Check className="h-4 w-4 text-success" /> : i === execStep ? <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <div className="h-4 w-4 rounded-full border border-border" />}
                        <span className={i <= execStep ? 'text-foreground' : 'text-muted-foreground'}>{es}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="destructive" size="sm" className="gap-2" onClick={() => { setExecStatus('idle'); toast.info('Pipeline stopped'); }}>
                      <Square className="h-3.5 w-3.5" /> Stop
                    </Button>
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => setExecStatus(execStatus === 'paused' ? 'running' : 'paused')}>
                      {execStatus === 'paused' ? <><Play className="h-3.5 w-3.5" /> Resume</> : <><Pause className="h-3.5 w-3.5" /> Pause</>}
                    </Button>
                  </div>
                </div>
              )}

              {execStatus === 'success' && (
                <div className="text-center py-8 space-y-6">
                  <CheckCircle2 className="h-20 w-20 text-success mx-auto" />
                  <div>
                    <h3 className="text-xl font-bold text-success">Pipeline Completed Successfully!</h3>
                    <p className="text-muted-foreground mt-1">{pipelineName} — {partitions.length} partition(s) written to {outputPath}</p>
                  </div>
                  <div className="flex gap-3 justify-center">
                    <Button className="gap-2" onClick={() => toast.success('Downloading output partitions...')}>
                      <Download className="h-4 w-4" /> Download Output
                    </Button>
                    <Button variant="outline" className="gap-2" onClick={() => toast.info('Preview: First rows of the transformed output would appear here.')}>
                      <Eye className="h-4 w-4" /> Preview Results
                    </Button>
                  </div>
                  <Button variant="outline" onClick={() => navigate('/pipelines')}>Go to Pipelines</Button>
                </div>
              )}

              {execStatus === 'failed' && (
                <div className="text-center py-8 space-y-6">
                  <XCircle className="h-20 w-20 text-destructive mx-auto" />
                  <div>
                    <h3 className="text-xl font-bold text-destructive">Pipeline Failed</h3>
                    <p className="text-muted-foreground mt-1">{pipelineName} failed during execution.</p>
                  </div>
                  <Card className="border-destructive/30 bg-destructive/5 text-left">
                    <CardContent className="p-4">
                      <p className="text-sm font-medium text-destructive mb-2">Error Details:</p>
                      <pre className="text-xs font-mono whitespace-pre-wrap text-destructive">{execError}</pre>
                    </CardContent>
                  </Card>
                  <div className="flex gap-3 justify-center">
                    <Button variant="destructive" className="gap-2" onClick={() => { setExecStatus('idle'); }}>
                      <Square className="h-4 w-4" /> Stop
                    </Button>
                    <Button className="gap-2" onClick={() => { setExecStatus('idle'); startExecution(); }}>
                      <RotateCcw className="h-4 w-4" /> Restart from failure
                    </Button>
                    <Button variant="outline" className="gap-2" onClick={() => setStep(1)}>
                      <ArrowLeft className="h-4 w-4" /> Back to Transformations
                    </Button>
                  </div>
                </div>
              )}

              {/* Execution Logs */}
              {execLogs.length > 0 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Execution Logs</CardTitle></CardHeader>
                  <CardContent>
                    <pre className="bg-muted rounded-md p-3 text-[10px] font-mono overflow-auto max-h-40">
                      {execLogs.join('\n')}
                    </pre>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Navigation */}
      {step < 3 && (
        <div className="flex items-center justify-between border-t pt-4">
          <div>
            {step === 0 ? (
              <Button variant="outline" onClick={() => navigate('/pipelines')}>Cancel</Button>
            ) : (
              <Button variant="outline" className="gap-2" onClick={() => setStep(step - 1)}>
                <ArrowLeft className="h-4 w-4" /> Previous
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outline" className="gap-2" onClick={() => { toast.success('Draft saved'); navigate('/pipelines'); }}>
                <Save className="h-4 w-4" /> Save as Draft
              </Button>
            )}
            {step < 2 ? (
              <Button className="gap-2" disabled={!canNext} onClick={() => setStep(step + 1)}>
                Next Step <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button className="gap-2" disabled={!pipelineName} onClick={() => setStep(3)}>
                Deploy & Execute <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CreatePipeline;

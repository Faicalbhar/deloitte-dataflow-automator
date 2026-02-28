import { useState, useCallback } from 'react';
import {
  Upload, FileSpreadsheet, Check, X, HelpCircle, ArrowLeft, ArrowRight, Save,
  Plus, Trash2, GripVertical, MessageSquare, Send, Bot, ChevronRight, Code
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

const STEPS = ['Contract Upload', 'Schema & Transformations', 'Review & Deploy'];

const typeColors: Record<ColumnType, string> = {
  STRING: 'bg-info text-info-foreground',
  INTEGER: 'bg-success text-success-foreground',
  DECIMAL: 'bg-warning text-warning-foreground',
  DATE: 'bg-accent text-accent-foreground',
  BOOLEAN: 'bg-muted text-muted-foreground',
  TIMESTAMP: 'bg-accent text-accent-foreground',
};

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const CreatePipeline = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  // Step 1
  const [file, setFile] = useState<File | null>(null);
  const [fileValid, setFileValid] = useState(false);
  const [fileMask, setFileMask] = useState('');
  const [columns, setColumns] = useState<SchemaColumn[]>([]);
  const [matchInfo, setMatchInfo] = useState<string | null>(null);

  // Step 2 — Transformations
  const [transformations, setTransformations] = useState<Transformation[]>([]);
  const [aiOpen, setAiOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: "Hi! I'm your AI assistant. I can help you create transformations. Try asking:\n- \"Filter out rows where status is cancelled\"\n- \"Rename column transaction_date to txn_date\"\n- \"Create a composite key from client_id and transaction_id\"" }
  ]);
  const [chatInput, setChatInput] = useState('');

  // Step 3 — Deploy
  const [pipelineName, setPipelineName] = useState('');
  const [pipelineDesc, setPipelineDesc] = useState('');
  const [env, setEnv] = useState<'development' | 'production'>('development');
  const [notifications, setNotifications] = useState(true);
  const [deployModal, setDeployModal] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployStep, setDeployStep] = useState(0);
  const [confirmName, setConfirmName] = useState('');

  // Step 1 handlers
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setTimeout(() => {
        setFileValid(true);
        setColumns(mockSchemaColumns);
        setMatchInfo('Backend matched file "transactions_2025_01.csv" (92% match with data contract). All required columns present. Missing optional column: "currency" (will default to EUR).');
        toast.success('Contract parsed — file matched to data contract');
      }, 1200);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) {
      setFile(f);
      setTimeout(() => {
        setFileValid(true);
        setColumns(mockSchemaColumns);
        setMatchInfo('Backend matched file "transactions_2025_01.csv" (92% match). Missing optional: "currency".');
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

    // Simulate AI response
    setTimeout(() => {
      let response = '';
      let newTransformation: Transformation | null = null;

      if (userMsg.toLowerCase().includes('filter')) {
        newTransformation = {
          id: `t-${Date.now()}`,
          order: transformations.length + 1,
          type: 'filter',
          config: { condition: "status != 'cancelled'" },
          sourceColumns: ['status'],
          description: "Filter out cancelled rows",
        };
        response = "✅ I've added a **Filter** transformation to remove rows where status is 'cancelled'. You can see it in your transformation list (#" + (transformations.length + 1) + ").";
      } else if (userMsg.toLowerCase().includes('rename')) {
        newTransformation = {
          id: `t-${Date.now()}`,
          order: transformations.length + 1,
          type: 'rename',
          config: { newName: 'txn_date' },
          sourceColumns: ['transaction_date'],
          targetColumn: 'txn_date',
          description: "Rename transaction_date → txn_date",
        };
        response = "✅ I've added a **Rename** transformation: `transaction_date` → `txn_date`. Check transformation #" + (transformations.length + 1) + ".";
      } else if (userMsg.toLowerCase().includes('aggregate') || userMsg.toLowerCase().includes('group')) {
        newTransformation = {
          id: `t-${Date.now()}`,
          order: transformations.length + 1,
          type: 'aggregate',
          config: { groupBy: ['client_id'], aggregations: [{ column: 'amount', func: 'SUM', alias: 'total_amount' }] },
          sourceColumns: ['client_id', 'amount'],
          targetColumn: 'total_amount',
          description: "Aggregate total amount by client",
        };
        response = "✅ I've added an **Aggregate** transformation: SUM(amount) grouped by client_id. This will create a new output table with aggregated results.";
      } else if (userMsg.toLowerCase().includes('composite') || userMsg.toLowerCase().includes('concat') || userMsg.toLowerCase().includes('merge')) {
        newTransformation = {
          id: `t-${Date.now()}`,
          order: transformations.length + 1,
          type: 'add_column',
          config: { expression: "CONCAT(client_id, '-', transaction_id)" },
          sourceColumns: ['client_id', 'transaction_id'],
          targetColumn: 'composite_key',
          description: "Create composite key from client_id + transaction_id",
        };
        response = "✅ I've added an **Add Column** transformation to create `composite_key` = `CONCAT(client_id, '-', transaction_id)`.";
      } else {
        response = "I understand you want to create a transformation. Could you be more specific? For example:\n- \"Filter rows where amount > 1000\"\n- \"Rename column X to Y\"\n- \"Aggregate amount by client_id\"\n- \"Add a composite key column\"";
      }

      if (newTransformation) {
        setTransformations(prev => [...prev, newTransformation!]);
      }

      setChatMessages(prev => [...prev, { role: 'assistant', content: response }]);
    }, 800);
  };

  // Deploy
  const deploySteps = ['Validating configuration', 'Generating DLT code', 'Creating bundle', 'Deploying to Databricks', 'Running smoke tests', 'Completed'];
  const handleDeploy = async () => {
    setDeploying(true);
    for (let i = 0; i < deploySteps.length; i++) {
      setDeployStep(i);
      await new Promise((r) => setTimeout(r, 800));
    }
    setDeploying(false);
    setDeployModal(false);
    toast.success('Pipeline deployed successfully!');
    navigate('/pipelines');
  };

  const canNext = step === 0 ? fileValid : step === 1 ? columns.length > 0 : !!pipelineName;

  // Generate JSON for backend
  const generatePipelineJson = () => ({
    name: pipelineName || 'unnamed',
    description: pipelineDesc,
    environment: env,
    notifications: notifications,
    source: {
      fileMask: fileMask,
      path: '/mnt/data/transactions/',
      format: 'csv',
    },
    schema: columns.map(c => ({ name: c.name, type: c.type, nullable: c.nullable, sensitive: c.sensitive })),
    transformations: transformations.map(t => ({
      order: t.order,
      type: t.type,
      config: t.config,
      sourceColumns: t.sourceColumns,
      targetColumn: t.targetColumn,
      description: t.description,
    })),
  });

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
          <div
            className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${file ? 'border-success bg-success/5' : 'border-border hover:border-primary'}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            {!file ? (
              <label className="cursor-pointer block">
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="font-medium">Drag and drop your Excel contract here, or click to browse</p>
                <p className="text-sm text-muted-foreground mt-1">.xlsx, .xls — Max 10MB</p>
                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileUpload} />
              </label>
            ) : (
              <div className="flex items-center justify-center gap-3">
                <FileSpreadsheet className="h-8 w-8 text-success" />
                <div className="text-left">
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">{columns.length} columns detected · {fileValid ? 'Valid' : 'Validating...'}</p>
                </div>
                {fileValid ? <Check className="h-5 w-5 text-success" /> : <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />}
                <Button variant="ghost" size="icon" onClick={() => { setFile(null); setFileValid(false); setColumns([]); setMatchInfo(null); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Match info from backend */}
          {matchInfo && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-4 text-sm">
                <p className="font-medium text-primary mb-1">📋 File Match Result</p>
                <p className="text-muted-foreground">{matchInfo}</p>
              </CardContent>
            </Card>
          )}

          <Button variant="outline" size="sm" className="gap-2">
            <FileSpreadsheet className="h-4 w-4" /> Download Contract Template
          </Button>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>File Mask</Label>
              <Tooltip>
                <TooltipTrigger><HelpCircle className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
                <TooltipContent>Pattern used by backend to find matching files, e.g. client_*.csv</TooltipContent>
              </Tooltip>
            </div>
            <Input placeholder="e.g. client_2024_*.csv" value={fileMask} onChange={(e) => setFileMask(e.target.value)} />
          </div>
        </div>
      )}

      {/* Step 2: Schema + Transformations */}
      {step === 1 && (
        <div className="flex gap-4 relative">
          {/* Left: Columns with types + first row preview */}
          <div className="w-1/3 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Source Columns</CardTitle>
              </CardHeader>
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
                        <TableCell className="py-2">
                          <Badge className={`${typeColors[col.type]} text-[10px]`}>{col.type}</Badge>
                        </TableCell>
                        <TableCell className="py-2 text-muted-foreground truncate max-w-[100px]">
                          {mockFirstRow[col.name] || '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* First row preview */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Data Preview (1st row)</CardTitle>
              </CardHeader>
              <CardContent className="p-3">
                <pre className="bg-muted rounded p-2 text-[10px] overflow-auto max-h-40">
                  {JSON.stringify(mockFirstRow, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </div>

          {/* Right: Transformation Builder */}
          <div className="flex-1 space-y-4">
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm">Transformations</CardTitle>
                <Select onValueChange={(v) => {
                  if (v === '__ai_assistant__') {
                    setAiOpen(true);
                  } else {
                    addTransformation(v as TransformationType);
                  }
                }}>
                  <SelectTrigger className="h-8 w-52 text-xs">
                    <SelectValue placeholder="+ Add transformation" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTransformationTypes.map((t) => (
                      <SelectItem key={t.type} value={t.type}>
                        <div>
                          <span className="font-medium">{t.label}</span>
                          <span className="text-muted-foreground ml-2 text-[10px]">{t.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                    <SelectItem value="__ai_assistant__">
                      <div className="flex items-center gap-1">
                        <Bot className="h-3.5 w-3.5" />
                        <span className="font-medium">AI Assistant</span>
                        <span className="text-muted-foreground ml-1 text-[10px]">Natural language</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent className="space-y-2">
                {transformations.length === 0 ? (
                  <div className="border border-dashed rounded-lg p-8 text-center text-muted-foreground">
                    <p className="text-sm font-medium mb-1">No transformations yet</p>
                    <p className="text-xs">Add transformations using the dropdown above, drag & drop, or ask the AI assistant.</p>
                  </div>
                ) : (
                  transformations.map((t, i) => (
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

                          {/* Transformation-specific config */}
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-[10px]">Source Column(s)</Label>
                              <Select
                                value={t.sourceColumns[0] || ''}
                                onValueChange={(v) => updateTransformation(t.id, { sourceColumns: [v] })}
                              >
                                <SelectTrigger className="h-7 text-xs">
                                  <SelectValue placeholder="Select column" />
                                </SelectTrigger>
                                <SelectContent>
                                  {columns.map(c => (
                                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {t.type === 'rename' && (
                              <div>
                                <Label className="text-[10px]">New Name</Label>
                                <Input
                                  className="h-7 text-xs"
                                  placeholder="new_column_name"
                                  value={(t.config.newName as string) || ''}
                                  onChange={(e) => updateTransformation(t.id, { config: { ...t.config, newName: e.target.value } })}
                                />
                              </div>
                            )}

                            {t.type === 'cast' && (
                              <div>
                                <Label className="text-[10px]">Target Type</Label>
                                <Select
                                  value={(t.config.targetType as string) || ''}
                                  onValueChange={(v) => updateTransformation(t.id, { config: { ...t.config, targetType: v } })}
                                >
                                  <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
                                  <SelectContent>
                                    {['STRING', 'INTEGER', 'DECIMAL', 'DATE', 'BOOLEAN', 'TIMESTAMP'].map(t => (
                                      <SelectItem key={t} value={t}>{t}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}

                            {t.type === 'filter' && (
                              <div>
                                <Label className="text-[10px]">Condition</Label>
                                <Input
                                  className="h-7 text-xs font-mono"
                                  placeholder="column != 'value'"
                                  value={(t.config.condition as string) || ''}
                                  onChange={(e) => updateTransformation(t.id, { config: { ...t.config, condition: e.target.value } })}
                                />
                              </div>
                            )}

                            {t.type === 'add_column' && (
                              <div>
                                <Label className="text-[10px]">Expression</Label>
                                <Input
                                  className="h-7 text-xs font-mono"
                                  placeholder="CONCAT(a, b)"
                                  value={(t.config.expression as string) || ''}
                                  onChange={(e) => updateTransformation(t.id, { config: { ...t.config, expression: e.target.value } })}
                                />
                              </div>
                            )}

                            {t.type === 'aggregate' && (
                              <div>
                                <Label className="text-[10px]">Group By</Label>
                                <Input
                                  className="h-7 text-xs font-mono"
                                  placeholder="column1, column2"
                                  value={(t.config.groupBy as string[])?.join(', ') || ''}
                                  onChange={(e) => updateTransformation(t.id, { config: { ...t.config, groupBy: e.target.value.split(',').map(s => s.trim()) } })}
                                />
                              </div>
                            )}

                            {t.type === 'custom_sql' && (
                              <div className="col-span-2">
                                <Label className="text-[10px]">SQL Expression</Label>
                                <Textarea
                                  className="text-xs font-mono"
                                  rows={2}
                                  placeholder="SELECT * FROM ..."
                                  value={(t.config.sql as string) || ''}
                                  onChange={(e) => updateTransformation(t.id, { config: { ...t.config, sql: e.target.value } })}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                          onClick={() => removeTransformation(t.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))
                )}

                {/* Quick add button */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2 border-dashed text-xs"
                  onClick={() => addTransformation('filter')}
                >
                  <Plus className="h-3.5 w-3.5" /> Add Transformation
                </Button>
              </CardContent>
            </Card>

            {/* JSON Preview */}
            {transformations.length > 0 && (
              <Card>
                <CardHeader className="pb-2 flex flex-row items-center gap-2">
                  <Code className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm">Pipeline JSON (sent to backend)</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="bg-muted rounded-md p-3 text-[10px] font-mono overflow-auto max-h-48">
                    {JSON.stringify(generatePipelineJson(), null, 2)}
                  </pre>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    This JSON will be parsed by the Python backend to generate a Databricks DLT declarative pipeline.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* AI Assistant Drawer */}
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
                      <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}>
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <div className="flex gap-2 mt-4 pt-4 border-t">
                <Input
                  placeholder="Describe a transformation..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                  className="text-sm"
                />
                <Button size="icon" onClick={handleSendChat}>
                  <Send className="h-4 w-4" />
                </Button>
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
              <pre className="bg-muted p-4 rounded-md text-xs overflow-auto max-h-80 font-mono">
                {JSON.stringify(generatePipelineJson(), null, 2)}
              </pre>
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
        .load("/mnt/data/${fileMask || '*.csv'}")

@dlt.table(name="silver_${pipelineName || 'data'}")
def silver():
    df = dlt.read("bronze_${pipelineName || 'data'}")
${transformations.map(t => {
  if (t.type === 'filter') return `    df = df.filter("${t.config.condition || ''}")  # ${t.description}`;
  if (t.type === 'rename') return `    df = df.withColumnRenamed("${t.sourceColumns[0] || ''}", "${t.config.newName || ''}")  # ${t.description}`;
  if (t.type === 'cast') return `    df = df.withColumn("${t.sourceColumns[0] || ''}", col("${t.sourceColumns[0] || ''}").cast("${t.config.targetType || ''}"))  # ${t.description}`;
  if (t.type === 'add_column') return `    df = df.withColumn("${t.targetColumn || 'new_col'}", expr("${t.config.expression || ''}"))  # ${t.description}`;
  if (t.type === 'drop_column') return `    df = df.drop("${t.sourceColumns[0] || ''}")  # ${t.description}`;
  return `    # ${t.type}: ${t.description}`;
}).join('\n')}
    return df

${transformations.some(t => t.type === 'aggregate') ? `@dlt.table(name="gold_${pipelineName || 'data'}")
def gold():
    df = dlt.read("silver_${pipelineName || 'data'}")
${transformations.filter(t => t.type === 'aggregate').map(t => 
  `    df = df.groupBy(${(t.config.groupBy as string[])?.map(c => `"${c}"`).join(', ') || ''}).agg(sum("amount").alias("total_amount"))`
).join('\n')}
    return df` : `# No aggregation transformations — Gold layer not generated`}`}
              </pre>
            </TabsContent>
            <TabsContent value="transforms" className="mt-4">
              <div className="space-y-2">
                {transformations.map(t => (
                  <div key={t.id} className="flex items-center gap-3 p-3 rounded-md bg-muted/50 border text-sm">
                    <Badge variant="outline" className="font-mono text-xs">{t.order}</Badge>
                    <Badge className="bg-primary/10 text-primary text-[10px]">{t.type.replace('_', ' ')}</Badge>
                    <span className="flex-1">{t.description}</span>
                    <span className="text-xs text-muted-foreground">{t.sourceColumns.join(', ')}</span>
                  </div>
                ))}
                {transformations.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No transformations configured</p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* Navigation */}
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
            <Button className="gap-2" disabled={!pipelineName} onClick={() => setDeployModal(true)}>
              Deploy Pipeline
            </Button>
          )}
        </div>
      </div>

      {/* Deploy Modal */}
      <Dialog open={deployModal} onOpenChange={setDeployModal}>
        <DialogContent>
          {!deploying ? (
            <>
              <DialogHeader>
                <DialogTitle>Confirm Deployment</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Deploy <strong>{pipelineName}</strong> to <strong>{env}</strong> with {transformations.length} transformation(s).
                </p>
                <div className="space-y-2">
                  <Label className="text-sm">Type the pipeline name to confirm:</Label>
                  <Input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder={pipelineName} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeployModal(false)}>Cancel</Button>
                <Button disabled={confirmName !== pipelineName} onClick={handleDeploy}>Deploy</Button>
              </DialogFooter>
            </>
          ) : (
            <div className="py-4 space-y-3">
              <p className="font-semibold text-center mb-4">Deploying Pipeline...</p>
              {deploySteps.map((ds, i) => (
                <div key={ds} className="flex items-center gap-3 text-sm">
                  {i < deployStep ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : i === deployStep ? (
                    <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <div className="h-4 w-4 rounded-full border border-border" />
                  )}
                  <span className={i <= deployStep ? 'text-foreground' : 'text-muted-foreground'}>{ds}</span>
                </div>
              ))}
              <Progress value={(deployStep / (deploySteps.length - 1)) * 100} className="mt-4" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CreatePipeline;

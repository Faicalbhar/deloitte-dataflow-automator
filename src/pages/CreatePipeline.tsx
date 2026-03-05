import { useState } from 'react';
import {
  Upload, FileSpreadsheet, Check, X, HelpCircle, ArrowLeft, ArrowRight, Save,
  Plus, Trash2, GripVertical, Bot, Send, Code, CheckCircle2, XCircle, Download, Eye,
  Square, Pause, Play, RotateCcw, Sparkles, FileSearch
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

interface DbfsFile {
  name: string;
  path: string;
  matchPercent: number;
  size: string;
  lastModified: string;
  missingColumns: string[];
  extraColumns: string[];
}

const CreatePipeline = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  // Step 1
  const [file, setFile] = useState<File | null>(null);
  const [fileValid, setFileValid] = useState(false);
  const [fileMask, setFileMask] = useState('');
  const [columns, setColumns] = useState<SchemaColumn[]>([]);
  const [dbfsFiles, setDbfsFiles] = useState<DbfsFile[]>([]);
  const [selectedDbfsFile, setSelectedDbfsFile] = useState<DbfsFile | null>(null);
  const [userApproved, setUserApproved] = useState(false);
  const [searching, setSearching] = useState(false);

  // Step 2
  const [transformations, setTransformations] = useState<Transformation[]>([]);
  const [aiOpen, setAiOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: "👋 I'm your AI Transformation Agent. Describe what transformations you need in natural language and I'll create them automatically.\n\nExamples:\n• \"Filter cancelled rows, rename transaction_date to txn_date, and cast amount to DECIMAL\"\n• \"Create a composite key from client_id and transaction_id\"\n• \"Aggregate total amount by client, remove duplicates, and drop the email column\"" }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

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
  const [jobDetails, setJobDetails] = useState<{ jobId: string; clusterId: string; startTime: string } | null>(null);

  // Step 1: Upload contract then search DBFS
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setFileValid(true);
      setColumns(mockSchemaColumns);
      setUserApproved(false);
      setDbfsFiles([]);
      setSelectedDbfsFile(null);
      toast.success('Data contract parsed — ' + mockSchemaColumns.length + ' columns detected');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) {
      setFile(f);
      setFileValid(true);
      setColumns(mockSchemaColumns);
      setUserApproved(false);
      setDbfsFiles([]);
      setSelectedDbfsFile(null);
      toast.success('Data contract parsed successfully');
    }
  };

  const handleSearchDbfs = () => {
    if (!fileMask.trim()) { toast.error('Enter a file mask first'); return; }
    if (!file) { toast.error('Upload a data contract first'); return; }
    setSearching(true);
    setDbfsFiles([]);
    setSelectedDbfsFile(null);
    setUserApproved(false);

    // Simulate backend DBFS search
    setTimeout(() => {
      const mockFiles: DbfsFile[] = [
        { name: 'transactions_2025_01.csv', path: '/mnt/data/raw/transactions_2025_01.csv', matchPercent: 95, size: '245 MB', lastModified: '2025-02-20', missingColumns: ['currency'], extraColumns: [] },
        { name: 'transactions_2025_02.csv', path: '/mnt/data/raw/transactions_2025_02.csv', matchPercent: 95, size: '312 MB', lastModified: '2025-02-25', missingColumns: ['currency'], extraColumns: [] },
        { name: 'transactions_2024_12.csv', path: '/mnt/data/raw/transactions_2024_12.csv', matchPercent: 88, size: '198 MB', lastModified: '2025-01-05', missingColumns: ['currency', 'is_verified'], extraColumns: ['legacy_flag'] },
        { name: 'client_data_2025.csv', path: '/mnt/data/raw/client_data_2025.csv', matchPercent: 62, size: '89 MB', lastModified: '2025-02-18', missingColumns: ['transaction_id', 'amount', 'transaction_date', 'status'], extraColumns: ['address', 'phone'] },
      ];
      setDbfsFiles(mockFiles);
      setSearching(false);
      toast.success(`Found ${mockFiles.length} files matching "${fileMask}"`);
    }, 1500);
  };

  const selectDbfsFile = (f: DbfsFile) => {
    setSelectedDbfsFile(f);
    setUserApproved(false);
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

  // AI Agent - parse natural language prompt into multiple transformations
  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput.trim();
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setChatInput('');
    setAiLoading(true);

    setTimeout(() => {
      const lower = userMsg.toLowerCase();
      const newTransformations: Transformation[] = [];
      let response = '';

      // Parse multiple transformations from a single prompt
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
      if (lower.includes('aggregate') || lower.includes('group')) {
        const grp = lower.includes('client') ? 'client_id' : columns[0]?.name || 'id';
        newTransformations.push({ id: `t-${Date.now()}-a`, order: transformations.length + newTransformations.length + 1, type: 'aggregate', config: { groupBy: [grp], aggregations: [{ column: 'amount', func: 'SUM', alias: 'total_amount' }] }, sourceColumns: [grp, 'amount'], targetColumn: 'total_amount', description: `Aggregate amount by ${grp}` });
      }
      if (lower.includes('composite') || lower.includes('concat') || lower.includes('merge')) {
        newTransformations.push({ id: `t-${Date.now()}-m`, order: transformations.length + newTransformations.length + 1, type: 'add_column', config: { expression: "CONCAT(client_id, '-', transaction_id)" }, sourceColumns: ['client_id', 'transaction_id'], targetColumn: 'composite_key', description: 'Create composite key' });
      }
      if (lower.includes('drop')) {
        const col = lower.includes('email') ? 'email' : lower.includes('name') ? 'client_name' : 'email';
        newTransformations.push({ id: `t-${Date.now()}-d`, order: transformations.length + newTransformations.length + 1, type: 'drop_column', config: {}, sourceColumns: [col], description: `Drop column ${col}` });
      }
      if (lower.includes('deduplic') || lower.includes('duplicate')) {
        newTransformations.push({ id: `t-${Date.now()}-dd`, order: transformations.length + newTransformations.length + 1, type: 'deduplicate', config: { columns: ['transaction_id'] }, sourceColumns: ['transaction_id'], description: 'Remove duplicate rows' });
      }
      if (lower.includes('sort') || lower.includes('order')) {
        const col = lower.includes('date') ? 'transaction_date' : lower.includes('amount') ? 'amount' : 'transaction_id';
        newTransformations.push({ id: `t-${Date.now()}-s`, order: transformations.length + newTransformations.length + 1, type: 'sort', config: { direction: 'DESC' }, sourceColumns: [col], description: `Sort by ${col} DESC` });
      }

      if (newTransformations.length > 0) {
        setTransformations(prev => [...prev, ...newTransformations]);
        response = `✅ Created **${newTransformations.length} transformation(s)** from your prompt:\n\n${newTransformations.map((t, i) => `${i + 1}. **${t.type.replace('_', ' ').toUpperCase()}** — ${t.description}`).join('\n')}\n\nYou can edit each one in the transformation list or ask me for more.`;
      } else {
        response = "I couldn't identify specific transformations from your prompt. Try being more explicit:\n\n• \"Filter rows where status is cancelled\"\n• \"Rename transaction_date to txn_date and cast amount to DECIMAL\"\n• \"Aggregate amount by client_id, deduplicate, and sort by date\"";
      }

      setChatMessages(prev => [...prev, { role: 'assistant', content: response }]);
      setAiLoading(false);
    }, 1200);
  };

  // Execution
  const execSteps = ['Validating configuration', 'Generating DLT notebook', 'Creating Databricks job', 'Submitting to cluster', 'Running Bronze ingestion', 'Running Silver transformations', 'Running quality expectations', 'Writing Gold output', 'Finalizing partitions'];

  const startExecution = async () => {
    setExecStatus('running');
    setExecError(null);
    setExecLogs([]);
    setJobDetails({
      jobId: `job-${Math.floor(Math.random() * 90000) + 10000}`,
      clusterId: `cluster-${Math.floor(Math.random() * 9000) + 1000}`,
      startTime: new Date().toLocaleString(),
    });

    for (let i = 0; i < execSteps.length; i++) {
      setExecStep(i);
      setExecLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${execSteps[i]}...`]);
      await new Promise(r => setTimeout(r, 1200 + Math.random() * 800));
    }
    setExecLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ✓ Pipeline completed successfully — all partitions written.`]);
    setExecStatus('success');
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
    source: { fileMask, path: selectedDbfsFile?.path || '/mnt/data/', format: 'csv' },
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

      {/* ============ Step 1: Contract Upload ============ */}
      {step === 0 && (
        <div className="space-y-6">
          {/* Data Contract Upload */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="h-4 w-4" /> 1. Upload Data Contract
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${file ? 'border-success bg-success/5' : 'border-border hover:border-primary'}`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
              >
                {!file ? (
                  <label className="cursor-pointer block">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="font-medium text-sm">Drop your Data Contract here or click to upload</p>
                    <p className="text-xs text-muted-foreground mt-1">.xlsx, .xls — Defines expected schema (columns, types, constraints)</p>
                    <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileUpload} />
                  </label>
                ) : (
                  <div className="flex items-center justify-center gap-3">
                    <FileSpreadsheet className="h-6 w-6 text-success" />
                    <div className="text-left">
                      <p className="font-medium text-sm">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{columns.length} columns detected from contract</p>
                    </div>
                    <Check className="h-5 w-5 text-success" />
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setFile(null); setFileValid(false); setColumns([]); setDbfsFiles([]); setSelectedDbfsFile(null); setUserApproved(false); }}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* File Mask & DBFS Search */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileSearch className="h-4 w-4" /> 2. Search DBFS Files
                <Tooltip>
                  <TooltipTrigger><HelpCircle className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
                  <TooltipContent className="max-w-xs">Enter a file mask pattern. The backend will search DBFS, parse each matching file, and compare it against your data contract to find the best match.</TooltipContent>
                </Tooltip>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. transactions_2025_*.csv"
                  value={fileMask}
                  onChange={(e) => setFileMask(e.target.value)}
                  className="flex-1"
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchDbfs()}
                />
                <Button onClick={handleSearchDbfs} disabled={searching || !file} className="gap-2">
                  {searching ? <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> : <FileSearch className="h-4 w-4" />}
                  Search DBFS
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                The backend will search DBFS for files matching this pattern, parse their headers, and rank them by compatibility with your data contract.
              </p>
            </CardContent>
          </Card>

          {/* DBFS Search Results */}
          {dbfsFiles.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  DBFS Files Found — {dbfsFiles.length} result(s)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs">File</TableHead>
                      <TableHead className="text-xs">Match</TableHead>
                      <TableHead className="text-xs">Size</TableHead>
                      <TableHead className="text-xs">Modified</TableHead>
                      <TableHead className="text-xs">Missing Columns</TableHead>
                      <TableHead className="text-xs text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dbfsFiles.sort((a, b) => b.matchPercent - a.matchPercent).map((f) => (
                      <TableRow
                        key={f.path}
                        className={`cursor-pointer transition-colors ${selectedDbfsFile?.path === f.path ? 'bg-primary/10' : 'hover:bg-muted/30'}`}
                        onClick={() => selectDbfsFile(f)}
                      >
                        <TableCell className="font-mono text-xs">{f.name}</TableCell>
                        <TableCell>
                          <Badge className={f.matchPercent >= 90 ? 'bg-success text-success-foreground' : f.matchPercent >= 70 ? 'bg-warning text-warning-foreground' : 'bg-destructive text-destructive-foreground'}>
                            {f.matchPercent}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{f.size}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{f.lastModified}</TableCell>
                        <TableCell>
                          {f.missingColumns.length === 0 ? (
                            <span className="text-xs text-success">All matched</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {f.missingColumns.map(c => (
                                <Badge key={c} variant="outline" className="text-[10px] text-warning border-warning/30">{c}</Badge>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant={selectedDbfsFile?.path === f.path ? 'default' : 'outline'}
                            className="text-xs h-7"
                            onClick={(e) => { e.stopPropagation(); selectDbfsFile(f); }}
                          >
                            {selectedDbfsFile?.path === f.path ? 'Selected' : 'Select'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Selected File Details & Approval */}
          {selectedDbfsFile && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm text-primary">Selected: {selectedDbfsFile.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{selectedDbfsFile.path}</p>
                  </div>
                  <Badge className={selectedDbfsFile.matchPercent >= 90 ? 'bg-success text-success-foreground' : 'bg-warning text-warning-foreground'}>
                    {selectedDbfsFile.matchPercent}% match with contract
                  </Badge>
                </div>

                {selectedDbfsFile.missingColumns.length > 0 && (
                  <div className="bg-warning/10 border border-warning/20 rounded-md p-3">
                    <p className="text-xs font-medium text-warning mb-1">⚠ Missing columns (not in file but in contract):</p>
                    <div className="flex gap-1 flex-wrap">
                      {selectedDbfsFile.missingColumns.map(c => (
                        <Badge key={c} variant="outline" className="text-xs text-warning border-warning/40">{c}</Badge>
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">These columns will use default/null values.</p>
                  </div>
                )}

                {selectedDbfsFile.extraColumns.length > 0 && (
                  <div className="bg-info/10 border border-info/20 rounded-md p-3">
                    <p className="text-xs font-medium text-info mb-1">ℹ Extra columns (in file but not in contract):</p>
                    <div className="flex gap-1 flex-wrap">
                      {selectedDbfsFile.extraColumns.map(c => (
                        <Badge key={c} variant="outline" className="text-xs text-info border-info/40">{c}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <Button size="sm" className="gap-2" onClick={() => { setUserApproved(true); toast.success('File approved — proceed to next step'); }}>
                    <Check className="h-4 w-4" /> Approve & Continue
                  </Button>
                </div>
                {userApproved && <Badge className="bg-success text-success-foreground">✓ Approved</Badge>}
              </CardContent>
            </Card>
          )}

          <Button variant="outline" size="sm" className="gap-2">
            <FileSpreadsheet className="h-4 w-4" /> Download Contract Template
          </Button>
        </div>
      )}

      {/* ============ Step 2: Schema & Transformations ============ */}
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
                <div className="flex gap-2">
                  {/* Manual Add Transformation Dropdown */}
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

                  {/* AI Agent Button */}
                  <Button variant="outline" size="sm" className="gap-2 h-8 text-xs" onClick={() => setAiOpen(true)}>
                    <Sparkles className="h-3.5 w-3.5 text-primary" /> AI Agent
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {transformations.length === 0 ? (
                  <div className="border border-dashed rounded-lg p-8 text-center text-muted-foreground">
                    <p className="text-sm font-medium mb-1">No transformations yet</p>
                    <p className="text-xs">Use <strong>+ Add transformation</strong> for manual selection or <strong>AI Agent</strong> to describe what you need in natural language.</p>
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
                            {t.type === 'filter' && <div><Label className="text-[10px]">Condition (SQL)</Label><Input className="h-7 text-xs font-mono" value={(t.config.condition as string) || ''} onChange={(e) => updateTransformation(t.id, { config: { ...t.config, condition: e.target.value } })} /></div>}
                            {t.type === 'add_column' && <div><Label className="text-[10px]">Expression (Spark SQL)</Label><Input className="h-7 text-xs font-mono" value={(t.config.expression as string) || ''} onChange={(e) => updateTransformation(t.id, { config: { ...t.config, expression: e.target.value } })} /></div>}
                            {t.type === 'aggregate' && <div><Label className="text-[10px]">Group By</Label><Input className="h-7 text-xs font-mono" value={(t.config.groupBy as string[])?.join(', ') || ''} onChange={(e) => updateTransformation(t.id, { config: { ...t.config, groupBy: e.target.value.split(',').map(s => s.trim()) } })} /></div>}
                            {t.type === 'custom_sql' && <div className="col-span-2"><Label className="text-[10px]">SQL Expression</Label><Textarea className="text-xs font-mono" rows={2} value={(t.config.sql as string) || ''} onChange={(e) => updateTransformation(t.id, { config: { ...t.config, sql: e.target.value } })} /></div>}
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

          {/* AI Agent Sheet */}
          <Sheet open={aiOpen} onOpenChange={setAiOpen}>
            <SheetContent className="sm:max-w-lg flex flex-col">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" /> AI Transformation Agent
                </SheetTitle>
                <p className="text-xs text-muted-foreground">
                  Describe your transformations in natural language. The agent will create multiple transformations at once — no need to add them one by one.
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
                  placeholder="e.g. Filter cancelled rows, rename transaction_date, aggregate by client..."
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
      )}

      {/* ============ Step 3: Review & Deploy ============ */}
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
            <p className="text-xs text-muted-foreground">Define output table names. Each partition becomes a Delta table in DBFS.</p>
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
  if (t.type === 'deduplicate') return `    df = df.dropDuplicates()`;
  if (t.type === 'sort') return `    df = df.orderBy(col("${t.sourceColumns[0] || ''}").${(t.config.direction as string) === 'ASC' ? 'asc' : 'desc'}())`;
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

      {/* ============ Step 4: Execution Monitor ============ */}
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
                  <p className="text-muted-foreground">Ready to deploy and execute. This will submit a Databricks job.</p>
                  <Button className="gap-2" size="lg" onClick={startExecution}>
                    <Play className="h-5 w-5" /> Start Pipeline
                  </Button>
                </div>
              )}

              {(execStatus === 'running' || execStatus === 'paused') && (
                <div className="space-y-4">
                  {/* Job details */}
                  {jobDetails && (
                    <div className="bg-muted/50 border rounded-md p-3 flex gap-6 text-xs">
                      <div><span className="text-muted-foreground">Job ID:</span> <span className="font-mono">{jobDetails.jobId}</span></div>
                      <div><span className="text-muted-foreground">Cluster:</span> <span className="font-mono">{jobDetails.clusterId}</span></div>
                      <div><span className="text-muted-foreground">Started:</span> <span>{jobDetails.startTime}</span></div>
                    </div>
                  )}

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
                    <Button variant="destructive" size="sm" className="gap-2" onClick={() => { setExecStatus('idle'); setJobDetails(null); toast.info('Pipeline stopped'); }}>
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
                    {jobDetails && <p className="text-xs text-muted-foreground mt-1">Job {jobDetails.jobId} • Started {jobDetails.startTime}</p>}
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
                    <p className="text-muted-foreground mt-1">{pipelineName} encountered an error during execution.</p>
                    {jobDetails && <p className="text-xs text-muted-foreground mt-1">Job {jobDetails.jobId} • Cluster {jobDetails.clusterId}</p>}
                  </div>
                  <Card className="border-destructive/30 bg-destructive/5 text-left">
                    <CardContent className="p-4">
                      <p className="text-sm font-medium text-destructive mb-2">Error Details:</p>
                      <pre className="text-xs font-mono whitespace-pre-wrap text-destructive">{execError}</pre>
                    </CardContent>
                  </Card>
                  <div className="flex gap-3 justify-center">
                    <Button variant="destructive" className="gap-2" onClick={() => { setExecStatus('idle'); setJobDetails(null); }}>
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

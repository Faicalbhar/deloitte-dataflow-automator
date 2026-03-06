import { useState, useCallback } from 'react';
import {
  Upload, FileSpreadsheet, Check, X, HelpCircle, ArrowLeft, ArrowRight, Save,
  Plus, Trash2, GripVertical, Send, Code, CheckCircle2, XCircle, Download, Eye,
  Square, Pause, Play, RotateCcw, Sparkles, FileSearch, AlertTriangle, Database,
  ArrowRightCircle, Layers, ChevronRight
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
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNavigate } from 'react-router-dom';
import { mockSchemaColumns, mockFirstRow, availableTransformationTypes } from '@/data/mock-data';
import type { SchemaColumn, ColumnType, Transformation, TransformationType } from '@/types';
import { toast } from 'sonner';

const STEPS = ['Contract Upload', 'Pipeline Builder', 'Review & Deploy', 'Execution'];

const typeColors: Record<ColumnType, string> = {
  STRING: 'bg-info text-info-foreground',
  INTEGER: 'bg-success text-success-foreground',
  DECIMAL: 'bg-warning text-warning-foreground',
  DATE: 'bg-accent text-accent-foreground',
  BOOLEAN: 'bg-muted text-muted-foreground',
  TIMESTAMP: 'bg-accent text-accent-foreground',
};

type DagLayer = 'source' | 'bronze' | 'silver' | 'gold';

interface ChatMessage { role: 'user' | 'assistant'; content: string; }

interface DbfsFile {
  name: string;
  path: string;
  matchPercent: number;
  size: string;
  lastModified: string;
  missingColumns: string[];
  extraColumns: string[];
  status: 'conforming' | 'rejected';
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
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);

  // Step 2 — DAG + per-layer transformations
  const [activeLayer, setActiveLayer] = useState<DagLayer | null>(null);
  const [bronzeTransformations, setBronzeTransformations] = useState<Transformation[]>([]);
  const [silverTransformations, setSilverTransformations] = useState<Transformation[]>([]);
  const [goldTransformations, setGoldTransformations] = useState<Transformation[]>([]);
  const [aiOpen, setAiOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: "👋 I'm your AI Transformation Agent. Describe what transformations you need in natural language.\n\nExamples:\n• \"Filter cancelled rows, rename transaction_date to txn_date\"\n• \"Cast amount to DECIMAL and deduplicate by transaction_id\"\n• \"Aggregate total amount by client_id, sort by date DESC\"" }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Step 3
  const [pipelineName, setPipelineName] = useState('');
  const [pipelineDesc, setPipelineDesc] = useState('');
  const [env, setEnv] = useState<'development' | 'production'>('development');
  const [notifications, setNotifications] = useState(true);
  const [outputTableName, setOutputTableName] = useState('');
  const [outputPath, setOutputPath] = useState('/mnt/data/output/');
  const [scheduled, setScheduled] = useState(false);
  const [cronExpr, setCronExpr] = useState('0 6 * * *');

  // Step 4
  const [execStatus, setExecStatus] = useState<'idle' | 'running' | 'paused' | 'success' | 'failed'>('idle');
  const [execStep, setExecStep] = useState(0);
  const [execError, setExecError] = useState<string | null>(null);
  const [execLogs, setExecLogs] = useState<string[]>([]);
  const [jobDetails, setJobDetails] = useState<{ jobId: string; clusterId: string; startTime: string } | null>(null);

  // Get/set transformations for active layer
  const getLayerTransformations = useCallback((layer: DagLayer) => {
    if (layer === 'bronze') return bronzeTransformations;
    if (layer === 'silver') return silverTransformations;
    if (layer === 'gold') return goldTransformations;
    return [];
  }, [bronzeTransformations, silverTransformations, goldTransformations]);

  const setLayerTransformations = useCallback((layer: DagLayer, t: Transformation[]) => {
    if (layer === 'bronze') setBronzeTransformations(t);
    if (layer === 'silver') setSilverTransformations(t);
    if (layer === 'gold') setGoldTransformations(t);
  }, []);

  const allTransformations = [...bronzeTransformations, ...silverTransformations, ...goldTransformations];

  // Step 1 handlers
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setFileValid(true);
      setColumns(mockSchemaColumns);
      setDbfsFiles([]);
      setSelectedFiles([]);
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
      setDbfsFiles([]);
      setSelectedFiles([]);
      toast.success('Data contract parsed successfully');
    }
  };

  const handleSearchDbfs = () => {
    if (!fileMask.trim()) { toast.error('Enter a file mask first'); return; }
    if (!file) { toast.error('Upload a data contract first'); return; }
    setSearching(true);
    setDbfsFiles([]);
    setSelectedFiles([]);

    setTimeout(() => {
      const mockFiles: DbfsFile[] = [
        { name: 'transactions_2025_01.csv', path: '/mnt/data/raw/transactions_2025_01.csv', matchPercent: 100, size: '245 MB', lastModified: '2025-02-20', missingColumns: [], extraColumns: [], status: 'conforming' },
        { name: 'transactions_2025_02.csv', path: '/mnt/data/raw/transactions_2025_02.csv', matchPercent: 95, size: '312 MB', lastModified: '2025-02-25', missingColumns: ['currency'], extraColumns: [], status: 'conforming' },
        { name: 'transactions_2024_12.csv', path: '/mnt/data/raw/transactions_2024_12.csv', matchPercent: 88, size: '198 MB', lastModified: '2025-01-05', missingColumns: ['currency', 'is_verified'], extraColumns: ['legacy_flag'], status: 'conforming' },
        { name: 'transactions_corrupt.csv', path: '/mnt/data/raw/transactions_corrupt.csv', matchPercent: 35, size: '89 MB', lastModified: '2025-02-18', missingColumns: ['transaction_id', 'amount', 'transaction_date', 'status'], extraColumns: ['unknown_col1', 'unknown_col2'], status: 'rejected' },
        { name: 'client_data_2025.csv', path: '/mnt/data/raw/client_data_2025.csv', matchPercent: 22, size: '67 MB', lastModified: '2025-02-10', missingColumns: ['transaction_id', 'amount', 'transaction_date', 'status', 'client_id'], extraColumns: ['address', 'phone', 'zip'], status: 'rejected' },
      ];
      setDbfsFiles(mockFiles);
      const conforming = mockFiles.filter(f => f.status === 'conforming');
      setSelectedFiles(conforming.map(f => f.path));
      setSearching(false);
      toast.success(`Found ${mockFiles.length} files — ${conforming.length} conforming, ${mockFiles.length - conforming.length} rejected`);
    }, 1500);
  };

  const toggleFileSelection = (path: string) => {
    const f = dbfsFiles.find(x => x.path === path);
    if (f?.status === 'rejected') return;
    setSelectedFiles(prev => prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]);
  };

  // Transformation handlers for current active layer
  const addTransformation = (type: TransformationType) => {
    if (!activeLayer || activeLayer === 'source') return;
    const current = getLayerTransformations(activeLayer);
    const newT: Transformation = {
      id: `t-${Date.now()}`,
      order: current.length + 1,
      type,
      config: {},
      sourceColumns: [],
      description: availableTransformationTypes.find(t => t.type === type)?.label || type,
    };
    setLayerTransformations(activeLayer, [...current, newT]);
  };

  const removeTransformation = (id: string) => {
    if (!activeLayer || activeLayer === 'source') return;
    const current = getLayerTransformations(activeLayer);
    setLayerTransformations(activeLayer, current.filter(t => t.id !== id).map((t, i) => ({ ...t, order: i + 1 })));
  };

  const updateTransformation = (id: string, updates: Partial<Transformation>) => {
    if (!activeLayer || activeLayer === 'source') return;
    const current = getLayerTransformations(activeLayer);
    setLayerTransformations(activeLayer, current.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  // AI Agent
  const handleSendChat = () => {
    if (!chatInput.trim() || !activeLayer || activeLayer === 'source') return;
    const userMsg = chatInput.trim();
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setChatInput('');
    setAiLoading(true);

    setTimeout(() => {
      const lower = userMsg.toLowerCase();
      const current = getLayerTransformations(activeLayer);
      const newTransformations: Transformation[] = [];

      if (lower.includes('filter')) {
        const cond = lower.includes('cancel') ? "status != 'cancelled'" : lower.includes('amount') ? 'amount > 0' : "status = 'completed'";
        newTransformations.push({ id: `t-${Date.now()}-f`, order: current.length + newTransformations.length + 1, type: 'filter', config: { condition: cond }, sourceColumns: ['status'], description: `Filter: ${cond}` });
      }
      if (lower.includes('rename')) {
        const src = lower.includes('transaction_date') ? 'transaction_date' : columns[0]?.name || 'column';
        const tgt = lower.includes('txn_date') ? 'txn_date' : 'renamed_col';
        newTransformations.push({ id: `t-${Date.now()}-r`, order: current.length + newTransformations.length + 1, type: 'rename', config: { newName: tgt }, sourceColumns: [src], targetColumn: tgt, description: `Rename ${src} → ${tgt}` });
      }
      if (lower.includes('cast')) {
        const col = lower.includes('amount') ? 'amount' : columns[0]?.name || 'column';
        const typ = lower.includes('decimal') ? 'DECIMAL' : lower.includes('integer') ? 'INTEGER' : 'STRING';
        newTransformations.push({ id: `t-${Date.now()}-c`, order: current.length + newTransformations.length + 1, type: 'cast', config: { targetType: typ }, sourceColumns: [col], targetColumn: col, description: `Cast ${col} to ${typ}` });
      }
      if (lower.includes('deduplic') || lower.includes('duplicate')) {
        newTransformations.push({ id: `t-${Date.now()}-dd`, order: current.length + newTransformations.length + 1, type: 'deduplicate', config: { columns: ['transaction_id'] }, sourceColumns: ['transaction_id'], description: 'Remove duplicate rows' });
      }
      if (lower.includes('aggregate') || lower.includes('group')) {
        const grp = lower.includes('client') ? 'client_id' : columns[0]?.name || 'id';
        newTransformations.push({ id: `t-${Date.now()}-a`, order: current.length + newTransformations.length + 1, type: 'aggregate', config: { groupBy: [grp], aggregations: [{ column: 'amount', func: 'SUM', alias: 'total_amount' }] }, sourceColumns: [grp, 'amount'], targetColumn: 'total_amount', description: `Aggregate amount by ${grp}` });
      }
      if (lower.includes('drop')) {
        const col = lower.includes('email') ? 'email' : 'client_name';
        newTransformations.push({ id: `t-${Date.now()}-d`, order: current.length + newTransformations.length + 1, type: 'drop_column', config: {}, sourceColumns: [col], description: `Drop column ${col}` });
      }
      if (lower.includes('sort') || lower.includes('order')) {
        const col = lower.includes('date') ? 'transaction_date' : 'amount';
        newTransformations.push({ id: `t-${Date.now()}-s`, order: current.length + newTransformations.length + 1, type: 'sort', config: { direction: 'DESC' }, sourceColumns: [col], description: `Sort by ${col} DESC` });
      }
      if (lower.includes('add') && lower.includes('column')) {
        newTransformations.push({ id: `t-${Date.now()}-ac`, order: current.length + newTransformations.length + 1, type: 'add_column', config: { expression: "CONCAT(client_id, '-', transaction_id)" }, sourceColumns: ['client_id', 'transaction_id'], targetColumn: 'composite_key', description: 'Create composite key' });
      }

      let response: string;
      if (newTransformations.length > 0) {
        setLayerTransformations(activeLayer, [...current, ...newTransformations]);
        response = `✅ Created **${newTransformations.length} transformation(s)** for **${activeLayer.toUpperCase()}**:\n\n${newTransformations.map((t, i) => `${i + 1}. **${t.type.replace('_', ' ').toUpperCase()}** — ${t.description}`).join('\n')}\n\nYou can edit each one or ask me for more.`;
      } else {
        response = "I couldn't identify transformations. Try:\n• \"Filter rows where status is cancelled\"\n• \"Rename transaction_date to txn_date, cast amount to DECIMAL\"\n• \"Aggregate amount by client_id, deduplicate, sort by date\"";
      }
      setChatMessages(prev => [...prev, { role: 'assistant', content: response }]);
      setAiLoading(false);
    }, 1200);
  };

  // Execution
  const execSteps = ['Validating configuration', 'Generating DLT notebook', 'Creating Databricks job', 'Submitting to cluster', 'Running Bronze layer', 'Running Silver transformations', 'Running quality expectations', 'Writing Gold output', 'Finalizing tables'];

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
    setExecLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ✓ Pipeline completed — all tables written.`]);
    setExecStatus('success');
  };

  const generatePipelineJson = () => ({
    name: pipelineName || 'unnamed',
    description: pipelineDesc,
    environment: env,
    notifications,
    outputTable: outputTableName,
    outputPath,
    scheduled,
    cronExpression: scheduled ? cronExpr : null,
    source: { fileMask, files: selectedFiles, format: 'csv' },
    schema: columns.map(c => ({ name: c.name, type: c.type, nullable: c.nullable, sensitive: c.sensitive })),
    layers: {
      bronze: bronzeTransformations.map(t => ({ order: t.order, type: t.type, config: t.config, sourceColumns: t.sourceColumns, targetColumn: t.targetColumn, description: t.description })),
      silver: silverTransformations.map(t => ({ order: t.order, type: t.type, config: t.config, sourceColumns: t.sourceColumns, targetColumn: t.targetColumn, description: t.description })),
      gold: goldTransformations.map(t => ({ order: t.order, type: t.type, config: t.config, sourceColumns: t.sourceColumns, targetColumn: t.targetColumn, description: t.description })),
    },
  });

  const conformingFiles = dbfsFiles.filter(f => f.status === 'conforming');
  const rejectedFiles = dbfsFiles.filter(f => f.status === 'rejected');
  const canNext = step === 0 ? (fileValid && selectedFiles.length > 0) : step === 1 ? true : step === 2 ? !!pipelineName && !!outputTableName : false;

  // DAG layer config
  const dagLayers: { key: DagLayer; label: string; icon: React.ReactNode; color: string; bgColor: string; borderColor: string }[] = [
    { key: 'source', label: 'Source', icon: <Database className="h-5 w-5" />, color: 'text-blue-400', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/40' },
    { key: 'bronze', label: 'Bronze', icon: <Layers className="h-5 w-5" />, color: 'text-amber-600', bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500/40' },
    { key: 'silver', label: 'Silver', icon: <Layers className="h-5 w-5" />, color: 'text-slate-400', bgColor: 'bg-slate-400/10', borderColor: 'border-slate-400/40' },
    { key: 'gold', label: 'Gold', icon: <Layers className="h-5 w-5" />, color: 'text-yellow-500', bgColor: 'bg-yellow-500/10', borderColor: 'border-yellow-500/40' },
  ];

  // Current active layer transformations
  const currentTransformations = activeLayer ? getLayerTransformations(activeLayer) : [];

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
                      <p className="text-xs text-muted-foreground">{columns.length} columns detected</p>
                    </div>
                    <Check className="h-5 w-5 text-success" />
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setFile(null); setFileValid(false); setColumns([]); setDbfsFiles([]); setSelectedFiles([]); }}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileSearch className="h-4 w-4" /> 2. File Mask — Search DBFS
                <Tooltip>
                  <TooltipTrigger><HelpCircle className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
                  <TooltipContent className="max-w-xs">Enter a file mask pattern. The backend searches DBFS for all matching files, compares each against the data contract. Conforming files proceed, non-conforming are rejected (visible in Quarantine).</TooltipContent>
                </Tooltip>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. transactions_*.csv"
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
            </CardContent>
          </Card>

          {/* Conforming Files */}
          {conformingFiles.length > 0 && (
            <Card className="border-success/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-success">
                  <CheckCircle2 className="h-4 w-4" /> Conforming Files — {conformingFiles.length} file(s) match data contract
                </CardTitle>
                <p className="text-xs text-muted-foreground">These files match the file mask and conform to the data contract. Select which ones to include in the pipeline.</p>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-success/5">
                      <TableHead className="text-xs w-10"></TableHead>
                      <TableHead className="text-xs">File</TableHead>
                      <TableHead className="text-xs">Match</TableHead>
                      <TableHead className="text-xs">Size</TableHead>
                      <TableHead className="text-xs">Modified</TableHead>
                      <TableHead className="text-xs">Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {conformingFiles.map((f) => (
                      <TableRow
                        key={f.path}
                        className={`cursor-pointer transition-colors ${selectedFiles.includes(f.path) ? 'bg-success/10' : 'hover:bg-muted/30'}`}
                        onClick={() => toggleFileSelection(f.path)}
                      >
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedFiles.includes(f.path)}
                            onChange={() => toggleFileSelection(f.path)}
                            className="rounded border-input"
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs">{f.name}</TableCell>
                        <TableCell>
                          <Badge className="bg-success text-success-foreground text-[10px]">{f.matchPercent}%</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{f.size}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{f.lastModified}</TableCell>
                        <TableCell>
                          {f.missingColumns.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {f.missingColumns.map(c => (
                                <Badge key={c} variant="outline" className="text-[10px] text-warning border-warning/30">missing: {c}</Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-success">Full match</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Rejected Files */}
          {rejectedFiles.length > 0 && (
            <Card className="border-destructive/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-4 w-4" /> Rejected Files — {rejectedFiles.length} file(s) do not match data contract
                </CardTitle>
                <p className="text-xs text-muted-foreground">These files matched the file mask but do not conform to the data contract. They are sent to Quarantine for review.</p>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-destructive/5">
                      <TableHead className="text-xs">File</TableHead>
                      <TableHead className="text-xs">Match</TableHead>
                      <TableHead className="text-xs">Size</TableHead>
                      <TableHead className="text-xs">Missing Columns</TableHead>
                      <TableHead className="text-xs">Extra Columns</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rejectedFiles.map((f) => (
                      <TableRow key={f.path} className="opacity-70">
                        <TableCell className="font-mono text-xs">{f.name}</TableCell>
                        <TableCell>
                          <Badge className="bg-destructive text-destructive-foreground text-[10px]">{f.matchPercent}%</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{f.size}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {f.missingColumns.map(c => (
                              <Badge key={c} variant="outline" className="text-[10px] text-destructive border-destructive/30">{c}</Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {f.extraColumns.map(c => (
                              <Badge key={c} variant="outline" className="text-[10px] text-muted-foreground">{c}</Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] text-destructive border-destructive/40">
                            <XCircle className="h-3 w-3 mr-1" /> Quarantined
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {selectedFiles.length > 0 && (
            <div className="bg-success/10 border border-success/20 rounded-lg p-3 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">{selectedFiles.length} file(s) selected for pipeline</p>
                <p className="text-xs text-muted-foreground">{rejectedFiles.length > 0 ? `${rejectedFiles.length} file(s) rejected → sent to Quarantine` : 'All matching files conform to the data contract'}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============ Step 2: Pipeline Builder (DAG) ============ */}
      {step === 1 && !activeLayer && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pipeline Builder — Databricks DLT Flow</CardTitle>
              <p className="text-xs text-muted-foreground">Click on each layer to configure its transformations. The data flows from Source → Bronze → Silver → Gold.</p>
            </CardHeader>
            <CardContent>
              {/* DAG Visual */}
              <div className="flex items-center justify-center gap-0 py-8">
                {dagLayers.map((layer, idx) => (
                  <div key={layer.key} className="flex items-center">
                    {/* Rectangle Node */}
                    <div
                      className={`relative cursor-pointer transition-all hover:scale-105 border-2 rounded-xl px-6 py-5 min-w-[160px] text-center ${layer.bgColor} ${layer.borderColor} hover:shadow-lg`}
                      onClick={() => layer.key !== 'source' ? setActiveLayer(layer.key) : null}
                    >
                      <div className={`flex items-center justify-center gap-2 mb-2 ${layer.color}`}>
                        {layer.icon}
                        <span className="font-bold text-sm">{layer.label}</span>
                      </div>

                      {layer.key === 'source' ? (
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">{selectedFiles.length} file(s)</p>
                          <Badge variant="outline" className="text-[10px]">{fileMask || 'no mask'}</Badge>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <p className="text-xs font-medium">{getLayerTransformations(layer.key).length} transformation(s)</p>
                          {getLayerTransformations(layer.key).length > 0 && (
                            <div className="flex flex-wrap gap-1 justify-center">
                              {getLayerTransformations(layer.key).slice(0, 3).map(t => (
                                <Badge key={t.id} variant="outline" className="text-[9px]">{t.type.replace('_', ' ')}</Badge>
                              ))}
                              {getLayerTransformations(layer.key).length > 3 && (
                                <Badge variant="outline" className="text-[9px]">+{getLayerTransformations(layer.key).length - 3}</Badge>
                              )}
                            </div>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-1">Click to configure</p>
                        </div>
                      )}

                      {/* Status indicator */}
                      {layer.key !== 'source' && getLayerTransformations(layer.key).length > 0 && (
                        <div className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-success flex items-center justify-center">
                          <Check className="h-3 w-3 text-success-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Connector Arrow */}
                    {idx < dagLayers.length - 1 && (
                      <div className="flex items-center mx-2">
                        <div className="w-8 h-0.5 bg-border" />
                        <ChevronRight className="h-5 w-5 text-muted-foreground -ml-1" />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div className="border-t pt-4 mt-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-2xl font-bold text-amber-600">{bronzeTransformations.length}</p>
                    <p className="text-xs text-muted-foreground">Bronze Transformations</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-2xl font-bold text-slate-400">{silverTransformations.length}</p>
                    <p className="text-xs text-muted-foreground">Silver Transformations</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-2xl font-bold text-yellow-500">{goldTransformations.length}</p>
                    <p className="text-xs text-muted-foreground">Gold Transformations</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ============ Step 2: Layer Transformation Editor ============ */}
      {step === 1 && activeLayer && activeLayer !== 'source' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="gap-2" onClick={() => setActiveLayer(null)}>
              <ArrowLeft className="h-4 w-4" /> Back to Pipeline
            </Button>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${dagLayers.find(l => l.key === activeLayer)?.bgColor} ${dagLayers.find(l => l.key === activeLayer)?.borderColor} border`}>
              <span className={`font-bold text-sm ${dagLayers.find(l => l.key === activeLayer)?.color}`}>
                {activeLayer.charAt(0).toUpperCase() + activeLayer.slice(1)} Layer
              </span>
            </div>
            <Badge variant="outline" className="text-xs">{currentTransformations.length} transformation(s)</Badge>
          </div>

          <div className="flex gap-4">
            {/* Left: Source Columns */}
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
            </div>

            {/* Right: Transformation Builder */}
            <div className="flex-1 space-y-4">
              <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm">{activeLayer.charAt(0).toUpperCase() + activeLayer.slice(1)} Transformations</CardTitle>
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
                  {currentTransformations.length === 0 ? (
                    <div className="border border-dashed rounded-lg p-8 text-center text-muted-foreground">
                      <p className="text-sm font-medium mb-1">No transformations for {activeLayer}</p>
                      <p className="text-xs">Use <strong>+ Add transformation</strong> or <strong>AI Agent</strong> to configure this layer.</p>
                    </div>
                  ) : (
                    currentTransformations.map((t) => (
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

              <div className="flex justify-end">
                <Button className="gap-2" onClick={() => { setActiveLayer(null); toast.success(`${activeLayer} layer saved with ${currentTransformations.length} transformation(s)`); }}>
                  <Check className="h-4 w-4" /> Validate & Return to Pipeline
                </Button>
              </div>
            </div>
          </div>

          {/* AI Agent Sheet */}
          <Sheet open={aiOpen} onOpenChange={setAiOpen}>
            <SheetContent className="sm:max-w-lg flex flex-col">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" /> AI Agent — {activeLayer.charAt(0).toUpperCase() + activeLayer.slice(1)} Layer
                </SheetTitle>
                <p className="text-xs text-muted-foreground">
                  Describe transformations in natural language. The agent creates them automatically for the {activeLayer} layer.
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
      )}

      {/* ============ Step 3: Review & Deploy ============ */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Pipeline Name *</Label>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Output Table Name *</Label>
              <Input value={outputTableName} onChange={(e) => setOutputTableName(e.target.value)} placeholder="e.g. gold_transactions" />
            </div>
            <div className="space-y-2">
              <Label>Output Path (DBFS)</Label>
              <Input value={outputPath} onChange={(e) => setOutputPath(e.target.value)} placeholder="/mnt/data/output/" />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Switch checked={scheduled} onCheckedChange={setScheduled} />
            <Label>Enable Scheduling</Label>
            {scheduled && <Input className="w-48" value={cronExpr} onChange={(e) => setCronExpr(e.target.value)} placeholder="cron expression" />}
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={notifications} onCheckedChange={setNotifications} />
            <Label className="text-sm">Enable email notifications</Label>
          </div>

          {/* Pipeline Summary */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Pipeline Summary</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-3 mb-4">
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-blue-400">{selectedFiles.length}</p>
                  <p className="text-[10px] text-muted-foreground">Source Files</p>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-amber-600">{bronzeTransformations.length}</p>
                  <p className="text-[10px] text-muted-foreground">Bronze</p>
                </div>
                <div className="bg-slate-400/10 border border-slate-400/20 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-slate-400">{silverTransformations.length}</p>
                  <p className="text-[10px] text-muted-foreground">Silver</p>
                </div>
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-yellow-500">{goldTransformations.length}</p>
                  <p className="text-[10px] text-muted-foreground">Gold</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="config">
            <TabsList>
              <TabsTrigger value="config">Configuration JSON</TabsTrigger>
              <TabsTrigger value="code">DLT Code Preview</TabsTrigger>
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

@dlt.table(name="bronze_${outputTableName || 'data'}")
def bronze():
    df = spark.read.format("csv")\\
        .option("header", "true")\\
        .load("${outputPath}${fileMask || '*.csv'}")
${bronzeTransformations.map(t => {
  if (t.type === 'filter') return `    df = df.filter("${t.config.condition || ''}")`;
  if (t.type === 'rename') return `    df = df.withColumnRenamed("${t.sourceColumns[0]}", "${t.config.newName}")`;
  if (t.type === 'cast') return `    df = df.withColumn("${t.sourceColumns[0]}", col("${t.sourceColumns[0]}").cast("${t.config.targetType}"))`;
  if (t.type === 'drop_column') return `    df = df.drop("${t.sourceColumns[0]}")`;
  if (t.type === 'deduplicate') return `    df = df.dropDuplicates()`;
  return `    # ${t.description}`;
}).join('\n')}
    return df

@dlt.table(name="silver_${outputTableName || 'data'}")
def silver():
    df = dlt.read("bronze_${outputTableName || 'data'}")
${silverTransformations.map(t => {
  if (t.type === 'filter') return `    df = df.filter("${t.config.condition || ''}")`;
  if (t.type === 'rename') return `    df = df.withColumnRenamed("${t.sourceColumns[0]}", "${t.config.newName}")`;
  if (t.type === 'cast') return `    df = df.withColumn("${t.sourceColumns[0]}", col("${t.sourceColumns[0]}").cast("${t.config.targetType}"))`;
  if (t.type === 'add_column') return `    df = df.withColumn("${t.targetColumn}", expr("${t.config.expression}"))`;
  if (t.type === 'aggregate') return `    df = df.groupBy("${(t.config.groupBy as string[])?.join('","')}").agg(sum("amount").alias("total_amount"))`;
  if (t.type === 'deduplicate') return `    df = df.dropDuplicates()`;
  if (t.type === 'sort') return `    df = df.orderBy(col("${t.sourceColumns[0]}").desc())`;
  return `    # ${t.description}`;
}).join('\n')}
    return df

@dlt.table(name="gold_${outputTableName || 'data'}")
def gold():
    df = dlt.read("silver_${outputTableName || 'data'}")
${goldTransformations.map(t => {
  if (t.type === 'filter') return `    df = df.filter("${t.config.condition || ''}")`;
  if (t.type === 'aggregate') return `    df = df.groupBy("${(t.config.groupBy as string[])?.join('","')}").agg(sum("amount").alias("total_amount"))`;
  if (t.type === 'drop_column') return `    df = df.drop("${t.sourceColumns[0]}")`;
  return `    # ${t.description}`;
}).join('\n')}
    return df`}
              </pre>
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* ============ Step 4: Execution ============ */}
      {step === 3 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Pipeline Execution: {pipelineName}</CardTitle>
              <p className="text-sm text-muted-foreground">
                Environment: {env} • {allTransformations.length} transformations (Bronze: {bronzeTransformations.length}, Silver: {silverTransformations.length}, Gold: {goldTransformations.length}) • Output: {outputTableName}
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {execStatus === 'idle' && (
                <div className="text-center py-8 space-y-4">
                  <p className="text-muted-foreground">Ready to deploy and execute. This will submit a Databricks DLT job.</p>
                  <Button className="gap-2" size="lg" onClick={startExecution}>
                    <Play className="h-5 w-5" /> Start Pipeline
                  </Button>
                </div>
              )}

              {(execStatus === 'running' || execStatus === 'paused') && (
                <div className="space-y-4">
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
                    <p className="text-muted-foreground mt-1">{pipelineName} — Table "{outputTableName}" written to {outputPath}</p>
                    {jobDetails && <p className="text-xs text-muted-foreground mt-1">Job {jobDetails.jobId} • Started {jobDetails.startTime}</p>}
                  </div>
                  <div className="flex gap-3 justify-center">
                    <Button className="gap-2" onClick={() => toast.success('Downloading output...')}>
                      <Download className="h-4 w-4" /> Download Output
                    </Button>
                    <Button variant="outline" className="gap-2" onClick={() => toast.info('Preview: first rows of the transformed output.')}>
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
                    <p className="text-muted-foreground mt-1">{pipelineName} encountered an error.</p>
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
                      <ArrowLeft className="h-4 w-4" /> Back to Pipeline Builder
                    </Button>
                  </div>
                </div>
              )}

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
      {step < 3 && !activeLayer && (
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
              <Button className="gap-2" disabled={!pipelineName || !outputTableName} onClick={() => setStep(3)}>
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

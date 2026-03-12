import { useState, useCallback } from 'react';
import {
  Upload, FileSpreadsheet, Check, X, HelpCircle, ArrowLeft, ArrowRight, Save,
  Plus, Trash2, GripVertical, Send, Code, CheckCircle2, XCircle, Download, Eye,
  Square, Pause, Play, RotateCcw, Sparkles, FileSearch, AlertTriangle, Database,
  ArrowRightCircle, Layers, ChevronRight, Clock, Cpu, Server, Activity, Terminal
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
  size: string;
  lastModified: string;
  totalRows: number;
  validRows: number;
  rescuedRows: number;
  rescueReasons: { reason: string; count: number }[];
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
  const [jobDetails, setJobDetails] = useState<{
    jobId: string; runId: string; clusterId: string; clusterName: string;
    startTime: string; endTime?: string; sparkUiUrl: string;
    driverType: string; workerType: string; numWorkers: number;
    tasks: { name: string; status: 'pending' | 'running' | 'completed' | 'failed'; duration?: string; recordsIn?: number; recordsOut?: number }[];
  } | null>(null);

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
      // Only files matching the file mask are returned. Files not matching are simply not shown.
      // Each file is then validated row-by-row against the data contract.
      // Rows not matching → rescued (quarantined) with reasons.
      const mockFiles: DbfsFile[] = [
        {
          name: 'transactions_2025_01.csv', path: '/mnt/data/raw/transactions_2025_01.csv',
          size: '245 MB', lastModified: '2025-02-20', totalRows: 48500, validRows: 48500, rescuedRows: 0, rescueReasons: []
        },
        {
          name: 'transactions_2025_02.csv', path: '/mnt/data/raw/transactions_2025_02.csv',
          size: '312 MB', lastModified: '2025-02-25', totalRows: 62300, validRows: 61450, rescuedRows: 850,
          rescueReasons: [
            { reason: 'Column "amount" is NULL — violates NOT NULL constraint', count: 520 },
            { reason: 'Column "amount" value -350 out of range [0, 1000000]', count: 180 },
            { reason: 'Column "status" value "unknown" not in allowed set', count: 150 },
          ]
        },
        {
          name: 'transactions_2024_12.csv', path: '/mnt/data/raw/transactions_2024_12.csv',
          size: '198 MB', lastModified: '2025-01-05', totalRows: 39800, validRows: 38200, rescuedRows: 1600,
          rescueReasons: [
            { reason: 'Column "amount" is NULL — violates NOT NULL constraint', count: 800 },
            { reason: 'Column "email" format invalid — does not match regex', count: 450 },
            { reason: 'Column "transaction_id" duplicate found — violates uniqueness', count: 350 },
          ]
        },
        {
          name: 'transactions_2024_11.csv', path: '/mnt/data/raw/transactions_2024_11.csv',
          size: '175 MB', lastModified: '2024-12-05', totalRows: 35200, validRows: 34800, rescuedRows: 400,
          rescueReasons: [
            { reason: 'Column "client_id" is empty string — treated as NULL', count: 250 },
            { reason: 'Column "amount" value 99999999 exceeds maximum 1000000', count: 150 },
          ]
        },
      ];
      setDbfsFiles(mockFiles);
      setSelectedFiles(mockFiles.map(f => f.path));
      setSearching(false);
      const totalRescued = mockFiles.reduce((s, f) => s + f.rescuedRows, 0);
      toast.success(`Found ${mockFiles.length} files matching "${fileMask}" — ${totalRescued.toLocaleString()} rows will be rescued to quarantine`);
    }, 1500);
  };

  const toggleFileSelection = (path: string) => {
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
  const execSteps = ['Validating configuration', 'Generating DLT notebook', 'Creating Databricks job', 'Provisioning cluster', 'Installing libraries', 'Running Bronze layer', 'Running Silver transformations', 'Applying quality expectations', 'Writing Gold output', 'Updating Unity Catalog', 'Finalizing tables'];

  const startExecution = async () => {
    setExecStatus('running');
    setExecError(null);
    setExecLogs([]);
    const jid = `job-${Math.floor(Math.random() * 90000) + 10000}`;
    const rid = `run-${Math.floor(Math.random() * 900000) + 100000}`;
    const cid = `0226-${Math.floor(Math.random() * 9000) + 1000}-abcd${Math.floor(Math.random() * 100)}`;
    setJobDetails({
      jobId: jid, runId: rid, clusterId: cid,
      clusterName: `dlt-pipeline-${pipelineName || 'unnamed'}`,
      startTime: new Date().toISOString(),
      sparkUiUrl: `https://adb-1234567890.azuredatabricks.net/#/setting/clusters/${cid}/sparkUi`,
      driverType: 'Standard_DS3_v2 (14 GB, 4 Cores)',
      workerType: 'Standard_DS3_v2 (14 GB, 4 Cores)',
      numWorkers: 2,
      tasks: [
        { name: 'bronze_ingestion', status: 'pending' },
        { name: 'silver_transformations', status: 'pending' },
        { name: 'quality_expectations', status: 'pending' },
        { name: 'gold_aggregations', status: 'pending' },
        { name: 'catalog_update', status: 'pending' },
      ],
    });

    const totalSelected = dbfsFiles.filter(f => selectedFiles.includes(f.path));
    const totalRows = totalSelected.reduce((s, f) => s + f.totalRows, 0);
    const totalValid = totalSelected.reduce((s, f) => s + f.validRows, 0);
    const totalRescued = totalSelected.reduce((s, f) => s + f.rescuedRows, 0);

    setExecLogs(prev => [...prev,
      `[${new Date().toLocaleTimeString()}] Pipeline "${pipelineName}" starting...`,
      `[${new Date().toLocaleTimeString()}] Job ID: ${jid} | Run ID: ${rid}`,
      `[${new Date().toLocaleTimeString()}] Cluster: ${cid} (${2} workers × Standard_DS3_v2)`,
    ]);

    for (let i = 0; i < execSteps.length; i++) {
      if (execStatus === 'failed') return;
      setExecStep(i);

      // Update task statuses
      setJobDetails(prev => {
        if (!prev) return prev;
        const tasks = [...prev.tasks];
        if (i >= 5 && i <= 5) tasks[0] = { ...tasks[0], status: i === 5 ? 'running' : 'completed', recordsIn: totalRows, recordsOut: totalValid };
        if (i > 5) tasks[0] = { ...tasks[0], status: 'completed', duration: '2m 14s', recordsIn: totalRows, recordsOut: totalValid };
        if (i >= 6 && i <= 6) tasks[1] = { ...tasks[1], status: 'running' };
        if (i > 6) tasks[1] = { ...tasks[1], status: 'completed', duration: '3m 42s', recordsIn: totalValid, recordsOut: totalValid };
        if (i >= 7 && i <= 7) tasks[2] = { ...tasks[2], status: 'running' };
        if (i > 7) tasks[2] = { ...tasks[2], status: 'completed', duration: '1m 08s', recordsIn: totalValid, recordsOut: totalValid - totalRescued };
        if (i >= 8 && i <= 8) tasks[3] = { ...tasks[3], status: 'running' };
        if (i > 8) tasks[3] = { ...tasks[3], status: 'completed', duration: '2m 31s', recordsIn: totalValid - totalRescued, recordsOut: totalValid - totalRescued };
        if (i >= 9) tasks[4] = { ...tasks[4], status: i === 9 ? 'running' : 'completed', duration: i > 9 ? '0m 12s' : undefined };
        return { ...prev, tasks };
      });

      setExecLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${execSteps[i]}...`]);
      await new Promise(r => setTimeout(r, 1200 + Math.random() * 800));
    }

    setJobDetails(prev => prev ? { ...prev, endTime: new Date().toISOString() } : prev);
    setExecLogs(prev => [...prev,
      `[${new Date().toLocaleTimeString()}] ✓ All tasks completed successfully`,
      `[${new Date().toLocaleTimeString()}] Total rows processed: ${totalRows.toLocaleString()}`,
      `[${new Date().toLocaleTimeString()}] Rows written: ${totalValid.toLocaleString()} | Rescued: ${totalRescued.toLocaleString()}`,
      `[${new Date().toLocaleTimeString()}] Output: ${outputPath}${outputTableName}`,
    ]);
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

  const totalRescuedRows = dbfsFiles.filter(f => selectedFiles.includes(f.path)).reduce((s, f) => s + f.rescuedRows, 0);
  const totalValidRows = dbfsFiles.filter(f => selectedFiles.includes(f.path)).reduce((s, f) => s + f.validRows, 0);
  const canNext = step === 0 ? (fileValid && selectedFiles.length > 0) : step === 1 ? true : step === 2 ? !!pipelineName && !!outputTableName : false;

  // DAG layer config
  const dagLayers: { key: DagLayer; label: string; icon: React.ReactNode; color: string; bgColor: string; borderColor: string }[] = [
    { key: 'source', label: 'Source', icon: <Database className="h-5 w-5" />, color: 'text-blue-400', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/40' },
    { key: 'bronze', label: 'Bronze', icon: <Layers className="h-5 w-5" />, color: 'text-amber-600', bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500/40' },
    { key: 'silver', label: 'Silver', icon: <Layers className="h-5 w-5" />, color: 'text-slate-400', bgColor: 'bg-slate-400/10', borderColor: 'border-slate-400/40' },
    { key: 'gold', label: 'Gold', icon: <Layers className="h-5 w-5" />, color: 'text-yellow-500', bgColor: 'bg-yellow-500/10', borderColor: 'border-yellow-500/40' },
  ];

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
                  <TooltipContent className="max-w-xs">
                    Enter a file mask pattern (e.g. transactions_*.csv). Only files matching this pattern are returned from DBFS.
                    Each file is then validated row-by-row against the data contract. Rows that don't match are rescued to Quarantine.
                  </TooltipContent>
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
              {file && (
                <p className="text-xs text-muted-foreground">
                  Files not matching this pattern are excluded. Matching files are validated against the data contract — non-conforming <strong>rows</strong> are rescued to Quarantine.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Matched Files */}
          {dbfsFiles.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" /> {dbfsFiles.length} file(s) match "{fileMask}"
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Each file is validated against the data contract. Rows that don't conform are <strong>rescued</strong> (quarantined) with the reason — like Databricks <code className="bg-muted px-1 rounded">_rescued_data</code>.
                </p>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs w-10"></TableHead>
                      <TableHead className="text-xs">File</TableHead>
                      <TableHead className="text-xs text-right">Total Rows</TableHead>
                      <TableHead className="text-xs text-right">Valid</TableHead>
                      <TableHead className="text-xs text-right">Rescued</TableHead>
                      <TableHead className="text-xs">Size</TableHead>
                      <TableHead className="text-xs">Modified</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dbfsFiles.map((f) => (
                      <>
                        <TableRow
                          key={f.path}
                          className={`cursor-pointer transition-colors ${selectedFiles.includes(f.path) ? 'bg-success/5' : 'hover:bg-muted/30'}`}
                          onClick={() => toggleFileSelection(f.path)}
                        >
                          <TableCell>
                            <input type="checkbox" checked={selectedFiles.includes(f.path)} onChange={() => toggleFileSelection(f.path)} className="rounded border-input" />
                          </TableCell>
                          <TableCell className="font-mono text-xs">{f.name}</TableCell>
                          <TableCell className="text-xs text-right font-medium">{f.totalRows.toLocaleString()}</TableCell>
                          <TableCell className="text-xs text-right text-success font-medium">{f.validRows.toLocaleString()}</TableCell>
                          <TableCell className="text-xs text-right">
                            {f.rescuedRows > 0 ? (
                              <Badge variant="outline" className="text-[10px] text-warning border-warning/30">
                                <AlertTriangle className="h-3 w-3 mr-1" />{f.rescuedRows.toLocaleString()}
                              </Badge>
                            ) : (
                              <span className="text-success text-[10px]">0</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{f.size}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{f.lastModified}</TableCell>
                        </TableRow>
                        {/* Rescue reasons detail row */}
                        {f.rescuedRows > 0 && selectedFiles.includes(f.path) && (
                          <TableRow key={`${f.path}-rescue`} className="bg-warning/5">
                            <TableCell colSpan={7} className="py-2 px-6">
                              <div className="flex items-start gap-2">
                                <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                  <p className="text-[11px] font-medium text-warning">Rescued rows — will be sent to Quarantine:</p>
                                  {f.rescueReasons.map((r, i) => (
                                    <div key={i} className="flex items-center gap-2 text-[11px]">
                                      <Badge variant="outline" className="text-[9px] font-mono">{r.count}</Badge>
                                      <span className="text-muted-foreground">{r.reason}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Summary */}
          {selectedFiles.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-success/10 border border-success/20 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-success">{selectedFiles.length}</p>
                <p className="text-[10px] text-muted-foreground">Files selected</p>
              </div>
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-primary">{totalValidRows.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">Valid rows → Pipeline</p>
              </div>
              <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-warning">{totalRescuedRows.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">Rescued → Quarantine</p>
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
              <div className="flex items-center justify-center gap-0 py-8">
                {dagLayers.map((layer, idx) => (
                  <div key={layer.key} className="flex items-center">
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
                      {layer.key !== 'source' && getLayerTransformations(layer.key).length > 0 && (
                        <div className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-success flex items-center justify-center">
                          <Check className="h-3 w-3 text-success-foreground" />
                        </div>
                      )}
                    </div>
                    {idx < dagLayers.length - 1 && (
                      <div className="flex items-center mx-2">
                        <div className="w-8 h-0.5 bg-border" />
                        <ChevronRight className="h-5 w-5 text-muted-foreground -ml-1" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
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

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Pipeline Summary</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-3 mb-4">
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
                <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-warning">{totalRescuedRows.toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">Rescued</p>
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
@dlt.expect_or_drop("valid_amount", "amount IS NOT NULL AND amount >= 0 AND amount <= 1000000")
@dlt.expect_or_drop("valid_status", "status IN ('completed', 'pending', 'cancelled')")
def bronze():
    df = spark.read.format("csv")\\
        .option("header", "true")\\
        .option("rescuedDataColumn", "_rescued_data")\\
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
              <CardTitle className="text-lg flex items-center gap-2">
                <Terminal className="h-5 w-5" /> Pipeline Execution: {pipelineName}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Environment: {env} • {allTransformations.length} transformations • Output: {outputTableName}
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {execStatus === 'idle' && (
                <div className="text-center py-8 space-y-4">
                  <p className="text-muted-foreground">Ready to deploy and execute. This will create a Databricks DLT pipeline and submit a job run.</p>
                  <Button className="gap-2" size="lg" onClick={startExecution}>
                    <Play className="h-5 w-5" /> Start Pipeline
                  </Button>
                </div>
              )}

              {(execStatus === 'running' || execStatus === 'paused') && (
                <div className="space-y-4">
                  {/* Cluster & Job Info */}
                  {jobDetails && (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="bg-muted/50 border rounded-lg p-3">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Activity className="h-3 w-3" /> Job</div>
                        <p className="font-mono text-xs font-medium">{jobDetails.jobId}</p>
                        <p className="font-mono text-[10px] text-muted-foreground">Run: {jobDetails.runId}</p>
                      </div>
                      <div className="bg-muted/50 border rounded-lg p-3">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Server className="h-3 w-3" /> Cluster</div>
                        <p className="font-mono text-xs font-medium">{jobDetails.clusterId}</p>
                        <p className="text-[10px] text-muted-foreground">{jobDetails.clusterName}</p>
                      </div>
                      <div className="bg-muted/50 border rounded-lg p-3">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Cpu className="h-3 w-3" /> Compute</div>
                        <p className="text-xs font-medium">{jobDetails.numWorkers} workers</p>
                        <p className="text-[10px] text-muted-foreground">{jobDetails.workerType}</p>
                      </div>
                      <div className="bg-muted/50 border rounded-lg p-3">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Clock className="h-3 w-3" /> Started</div>
                        <p className="text-xs font-medium">{new Date(jobDetails.startTime).toLocaleTimeString()}</p>
                        <p className="text-[10px] text-muted-foreground">{new Date(jobDetails.startTime).toLocaleDateString()}</p>
                      </div>
                    </div>
                  )}

                  <Progress value={(execStep / (execSteps.length - 1)) * 100} className="h-2" />

                  {/* Tasks Table */}
                  {jobDetails && (
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm">Tasks</CardTitle></CardHeader>
                      <CardContent className="p-0">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/50">
                              <TableHead className="text-xs">Task</TableHead>
                              <TableHead className="text-xs">Status</TableHead>
                              <TableHead className="text-xs">Duration</TableHead>
                              <TableHead className="text-xs text-right">Records In</TableHead>
                              <TableHead className="text-xs text-right">Records Out</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {jobDetails.tasks.map((task) => (
                              <TableRow key={task.name}>
                                <TableCell className="font-mono text-xs">{task.name}</TableCell>
                                <TableCell>
                                  {task.status === 'completed' && <Badge className="bg-success text-success-foreground text-[10px]">Completed</Badge>}
                                  {task.status === 'running' && (
                                    <Badge className="bg-primary text-primary-foreground text-[10px] gap-1">
                                      <div className="h-2 w-2 border border-primary-foreground border-t-transparent rounded-full animate-spin" /> Running
                                    </Badge>
                                  )}
                                  {task.status === 'pending' && <Badge variant="outline" className="text-[10px]">Pending</Badge>}
                                  {task.status === 'failed' && <Badge className="bg-destructive text-destructive-foreground text-[10px]">Failed</Badge>}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">{task.duration || '—'}</TableCell>
                                <TableCell className="text-xs text-right font-mono">{task.recordsIn?.toLocaleString() || '—'}</TableCell>
                                <TableCell className="text-xs text-right font-mono">{task.recordsOut?.toLocaleString() || '—'}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  )}

                  {/* Pipeline Steps */}
                  <div className="space-y-1">
                    {execSteps.map((es, i) => (
                      <div key={es} className="flex items-center gap-3 text-sm py-1">
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
                <div className="space-y-6">
                  <div className="text-center py-6">
                    <CheckCircle2 className="h-20 w-20 text-success mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-success">Pipeline Completed Successfully</h3>
                    <p className="text-muted-foreground mt-1">{pipelineName} — Table "{outputTableName}" written to {outputPath}</p>
                  </div>

                  {/* Final metrics */}
                  {jobDetails && (
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                      <div className="bg-muted/50 border rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground">Job ID</p>
                        <p className="font-mono text-xs font-medium">{jobDetails.jobId}</p>
                      </div>
                      <div className="bg-muted/50 border rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground">Cluster</p>
                        <p className="font-mono text-xs font-medium">{jobDetails.clusterId}</p>
                      </div>
                      <div className="bg-muted/50 border rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground">Duration</p>
                        <p className="text-xs font-medium">{jobDetails.endTime ? `${Math.round((new Date(jobDetails.endTime).getTime() - new Date(jobDetails.startTime).getTime()) / 1000)}s` : '—'}</p>
                      </div>
                      <div className="bg-success/10 border border-success/20 rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground">Rows Written</p>
                        <p className="text-sm font-bold text-success">{totalValidRows.toLocaleString()}</p>
                      </div>
                      <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground">Rescued</p>
                        <p className="text-sm font-bold text-warning">{totalRescuedRows.toLocaleString()}</p>
                      </div>
                    </div>
                  )}

                  {/* Tasks final status */}
                  {jobDetails && (
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm">Completed Tasks</CardTitle></CardHeader>
                      <CardContent className="p-0">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/50">
                              <TableHead className="text-xs">Task</TableHead>
                              <TableHead className="text-xs">Status</TableHead>
                              <TableHead className="text-xs">Duration</TableHead>
                              <TableHead className="text-xs text-right">Records In</TableHead>
                              <TableHead className="text-xs text-right">Records Out</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {jobDetails.tasks.map((task) => (
                              <TableRow key={task.name}>
                                <TableCell className="font-mono text-xs">{task.name}</TableCell>
                                <TableCell><Badge className="bg-success text-success-foreground text-[10px]">Completed</Badge></TableCell>
                                <TableCell className="text-xs">{task.duration || '—'}</TableCell>
                                <TableCell className="text-xs text-right font-mono">{task.recordsIn?.toLocaleString() || '—'}</TableCell>
                                <TableCell className="text-xs text-right font-mono">{task.recordsOut?.toLocaleString() || '—'}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  )}

                  <div className="flex gap-3 justify-center">
                    <Button className="gap-2" onClick={() => toast.success('Downloading output...')}>
                      <Download className="h-4 w-4" /> Download Output
                    </Button>
                    <Button variant="outline" className="gap-2" onClick={() => toast.info('Preview: first rows of the transformed output.')}>
                      <Eye className="h-4 w-4" /> Preview Results
                    </Button>
                  </div>
                  <div className="text-center">
                    <Button variant="outline" onClick={() => navigate('/pipelines')}>Go to Pipelines</Button>
                  </div>
                </div>
              )}

              {execStatus === 'failed' && (
                <div className="space-y-6">
                  <div className="text-center py-6">
                    <XCircle className="h-20 w-20 text-destructive mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-destructive">Pipeline Failed</h3>
                    <p className="text-muted-foreground mt-1">{pipelineName} encountered an error.</p>
                  </div>

                  {jobDetails && (
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-muted/50 border rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground">Job ID</p>
                        <p className="font-mono text-xs">{jobDetails.jobId}</p>
                      </div>
                      <div className="bg-muted/50 border rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground">Cluster</p>
                        <p className="font-mono text-xs">{jobDetails.clusterId}</p>
                      </div>
                      <div className="bg-muted/50 border rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground">Failed At</p>
                        <p className="text-xs">{new Date().toLocaleTimeString()}</p>
                      </div>
                    </div>
                  )}

                  <Card className="border-destructive/30 bg-destructive/5">
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
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Terminal className="h-4 w-4" /> Execution Logs</CardTitle></CardHeader>
                  <CardContent>
                    <pre className="bg-background border rounded-md p-3 text-[10px] font-mono overflow-auto max-h-48 text-foreground">
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

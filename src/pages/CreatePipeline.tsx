import { useState, useCallback, useMemo } from 'react';
import {
  Upload, FileSpreadsheet, Check, X, HelpCircle, ArrowLeft, ArrowRight, Save,
  Plus, Trash2, GripVertical, Send, Code, CheckCircle2, XCircle, Download, Eye,
  Square, Pause, Play, RotateCcw, Sparkles, FileSearch, AlertTriangle, Database,
  ArrowRightCircle, Layers, ChevronRight, Clock, Cpu, Server, Activity, Terminal,
  ShieldCheck, FolderSearch
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
import { mockSchemaColumns, availableTransformationTypes } from '@/data/mock-data';
import type { SchemaColumn, ColumnType, Transformation, TransformationType } from '@/types';
import { toast } from 'sonner';

// ─── Types ───────────────────────────────────────────────────────────────────

const STEPS = ['Pipeline Builder', 'Review & Deploy', 'Execution'];

interface DbfsFile {
  name: string; path: string; size: string; lastModified: string;
  totalRows: number; validRows: number; rescuedRows: number;
  rescueReasons: { reason: string; count: number }[];
}

interface SourceDefinition {
  id: string;
  name: string;
  dbfsPath: string;
  fileMask: string;
  contractFile: File | null;
  contractValid: boolean;
  columns: SchemaColumn[];
  dbfsFiles: DbfsFile[];
  selectedFiles: string[];
  searching: boolean;
}

interface QualityCheck {
  id: string;
  sourceId: string;
  columnName: string;
  rule: 'not_null' | 'unique' | 'range' | 'regex' | 'values_in_set';
  config: Record<string, string>;
  onFailure: 'drop' | 'quarantine' | 'warn';
}

type DagLayer = 'source' | 'bronze' | 'silver' | 'gold';
interface ChatMessage { role: 'user' | 'assistant'; content: string; }

const typeColors: Record<ColumnType, string> = {
  STRING: 'bg-info text-info-foreground',
  INTEGER: 'bg-success text-success-foreground',
  DECIMAL: 'bg-warning text-warning-foreground',
  DATE: 'bg-accent text-accent-foreground',
  BOOLEAN: 'bg-muted text-muted-foreground',
  TIMESTAMP: 'bg-accent text-accent-foreground',
};

// Mock DBFS files generator per source
const generateMockDbfsFiles = (fileMask: string, sourceIndex: number): DbfsFile[] => {
  const baseName = fileMask.replace('*', '').replace('.csv', '').replace('.parquet', '');
  const files: DbfsFile[] = [
    {
      name: `${baseName}2025_01.csv`, path: `/mnt/data/raw/${baseName}2025_01.csv`,
      size: `${180 + sourceIndex * 40} MB`, lastModified: '2025-02-20',
      totalRows: 45000 + sourceIndex * 10000, validRows: 44500 + sourceIndex * 9500, rescuedRows: 500 + sourceIndex * 200,
      rescueReasons: [
        { reason: `Column "${sourceIndex === 0 ? 'amount' : 'score'}" is NULL — violates NOT NULL`, count: 300 + sourceIndex * 100 },
        { reason: `Column "${sourceIndex === 0 ? 'status' : 'category'}" value invalid`, count: 200 + sourceIndex * 100 },
      ]
    },
    {
      name: `${baseName}2025_02.csv`, path: `/mnt/data/raw/${baseName}2025_02.csv`,
      size: `${220 + sourceIndex * 30} MB`, lastModified: '2025-02-25',
      totalRows: 58000 + sourceIndex * 5000, validRows: 58000 + sourceIndex * 5000, rescuedRows: 0, rescueReasons: []
    },
    {
      name: `${baseName}2024_12.csv`, path: `/mnt/data/raw/${baseName}2024_12.csv`,
      size: `${160 + sourceIndex * 20} MB`, lastModified: '2025-01-05',
      totalRows: 38000 + sourceIndex * 8000, validRows: 36500 + sourceIndex * 7000, rescuedRows: 1500 + sourceIndex * 300,
      rescueReasons: [
        { reason: `Column "${sourceIndex === 0 ? 'email' : 'ref_id'}" format invalid — regex mismatch`, count: 800 + sourceIndex * 100 },
        { reason: `Column "${sourceIndex === 0 ? 'transaction_id' : 'id'}" duplicate — uniqueness violation`, count: 700 + sourceIndex * 200 },
      ]
    },
  ];
  return files;
};

const secondSourceColumns: SchemaColumn[] = [
  { id: 's2c1', name: 'risk_id', type: 'STRING', nullable: false, unique: true, description: 'Risk identifier', sensitive: false, sampleValues: ['RSK-001'] },
  { id: 's2c2', name: 'client_id', type: 'STRING', nullable: false, unique: false, description: 'Client reference', sensitive: false, sampleValues: ['CLT-100'] },
  { id: 's2c3', name: 'score', type: 'DECIMAL', nullable: false, unique: false, description: 'Risk score', sensitive: false, sampleValues: ['85.5'] },
  { id: 's2c4', name: 'category', type: 'STRING', nullable: false, unique: false, description: 'Risk category', sensitive: false, sampleValues: ['HIGH'] },
  { id: 's2c5', name: 'assessed_at', type: 'TIMESTAMP', nullable: false, unique: false, description: 'Assessment timestamp', sensitive: false, sampleValues: ['2025-01-15T10:00:00Z'] },
  { id: 's2c6', name: 'assessor', type: 'STRING', nullable: true, unique: false, description: 'Assessor name', sensitive: true, sampleValues: ['John Smith'] },
];

const createEmptySource = (index: number): SourceDefinition => ({
  id: `src-${Date.now()}-${index}`,
  name: `Source ${index + 1}`,
  dbfsPath: '/mnt/data/raw/',
  fileMask: '',
  contractFile: null,
  contractValid: false,
  columns: [],
  dbfsFiles: [],
  selectedFiles: [],
  searching: false,
});

// ─── Component ───────────────────────────────────────────────────────────────

const CreatePipeline = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  // Sources
  const [sources, setSources] = useState<SourceDefinition[]>([createEmptySource(0)]);
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null);

  // DAG
  const [activeLayer, setActiveLayer] = useState<DagLayer | null>(null);
  const [bronzeTransformations, setBronzeTransformations] = useState<Transformation[]>([]);
  const [silverTransformations, setSilverTransformations] = useState<Transformation[]>([]);
  const [goldTransformations, setGoldTransformations] = useState<Transformation[]>([]);
  const [qualityChecks, setQualityChecks] = useState<QualityCheck[]>([]);

  // AI
  const [aiOpen, setAiOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: "👋 I'm your AI Transformation Agent. Describe transformations in natural language.\n\nExamples:\n• \"Filter cancelled rows, rename transaction_date to txn_date\"\n• \"Join source 1 and source 2 on client_id\"\n• \"Aggregate total amount by client_id, sort by date DESC\"" }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Review & Deploy
  const [pipelineName, setPipelineName] = useState('');
  const [pipelineDesc, setPipelineDesc] = useState('');
  const [env, setEnv] = useState<'development' | 'production'>('development');
  const [notifications, setNotifications] = useState(true);
  const [outputTableName, setOutputTableName] = useState('');
  const [outputPath, setOutputPath] = useState('/mnt/data/output/');
  const [scheduled, setScheduled] = useState(false);
  const [cronExpr, setCronExpr] = useState('0 6 * * *');

  // Execution
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

  // ─── Computed columns ──────────────────────────────────────────────────────

  type SourceColumn = SchemaColumn & { sourceId: string; sourceName: string; transformed?: boolean; transformedFrom?: string };

  // All source columns (from all sources)
  const allSourceColumns = useMemo(() => {
    const cols: SourceColumn[] = [];
    sources.forEach(s => {
      s.columns.forEach(c => cols.push({ ...c, sourceId: s.id, sourceName: s.name }));
    });
    return cols;
  }, [sources]);

  // Compute columns after a layer's transformations — preserves sourceId/sourceName
  const computeLayerOutputColumns = useCallback((inputCols: SourceColumn[], transformations: Transformation[]): SourceColumn[] => {
    let cols = [...inputCols.map(c => ({ ...c }))];
    transformations.forEach(t => {
      if (t.type === 'rename' && t.config.newName) {
        cols = cols.map(c => c.name === t.sourceColumns[0] ? { ...c, name: t.config.newName as string, transformed: true, transformedFrom: t.sourceColumns[0] } : c);
      }
      if (t.type === 'cast' && t.config.targetType) {
        cols = cols.map(c => c.name === t.sourceColumns[0] ? { ...c, type: t.config.targetType as ColumnType, transformed: true } : c);
      }
      if (t.type === 'drop_column') {
        cols = cols.filter(c => !t.sourceColumns.includes(c.name));
      }
      if (t.type === 'add_column' && t.targetColumn) {
        if (!cols.find(c => c.name === t.targetColumn)) {
          cols.push({ id: `derived-${t.id}`, name: t.targetColumn!, type: 'STRING', nullable: true, unique: false, description: t.description, sensitive: false, sampleValues: [], sourceId: 'derived', sourceName: 'Derived', transformed: true });
        }
      }
      if (t.type === 'aggregate' && t.targetColumn) {
        const groupBy = (t.config.groupBy as string[]) || [];
        const kept = cols.filter(c => groupBy.includes(c.name));
        if (t.targetColumn && !kept.find(c => c.name === t.targetColumn)) {
          kept.push({ id: `agg-${t.id}`, name: t.targetColumn!, type: 'DECIMAL', nullable: false, unique: false, description: t.description, sensitive: false, sampleValues: [], sourceId: 'derived', sourceName: 'Aggregated', transformed: true });
        }
        cols = kept;
      }
    });
    return cols;
  }, []);

  const baseSourceColumns = useMemo(() => allSourceColumns.map(c => ({ ...c })), [allSourceColumns]);
  const bronzeOutputColumns = useMemo(() => computeLayerOutputColumns(baseSourceColumns, bronzeTransformations), [baseSourceColumns, bronzeTransformations, computeLayerOutputColumns]);
  const silverOutputColumns = useMemo(() => computeLayerOutputColumns(bronzeOutputColumns, silverTransformations), [bronzeOutputColumns, silverTransformations, computeLayerOutputColumns]);
  const goldOutputColumns = useMemo(() => computeLayerOutputColumns(silverOutputColumns, goldTransformations), [silverOutputColumns, goldTransformations, computeLayerOutputColumns]);

  const getLayerInputColumns = useCallback((layer: DagLayer): SourceColumn[] => {
    if (layer === 'bronze') return baseSourceColumns;
    if (layer === 'silver') return bronzeOutputColumns;
    if (layer === 'gold') return silverOutputColumns;
    return [];
  }, [baseSourceColumns, bronzeOutputColumns, silverOutputColumns]);

  // Group columns by source for display
  const getColumnsGroupedBySource = useCallback((layer: DagLayer): { sourceId: string; sourceName: string; columns: SourceColumn[] }[] => {
    const cols = getLayerInputColumns(layer);
    const groups: Record<string, { sourceId: string; sourceName: string; columns: SourceColumn[] }> = {};
    cols.forEach(c => {
      const key = c.sourceId;
      if (!groups[key]) groups[key] = { sourceId: c.sourceId, sourceName: c.sourceName, columns: [] };
      groups[key].columns.push(c);
    });
    return Object.values(groups);
  }, [getLayerInputColumns]);

  // ─── Layer transformations ─────────────────────────────────────────────────

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

  // ─── Source handlers ───────────────────────────────────────────────────────

  const updateSource = (id: string, updates: Partial<SourceDefinition>) => {
    setSources(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const addSource = () => {
    const newSrc = createEmptySource(sources.length);
    setSources(prev => [...prev, newSrc]);
    setEditingSourceId(newSrc.id);
  };

  const removeSource = (id: string) => {
    if (sources.length <= 1) { toast.error('At least one source is required'); return; }
    setSources(prev => prev.filter(s => s.id !== id));
    if (editingSourceId === id) setEditingSourceId(null);
  };

  const handleSourceContractUpload = (sourceId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const idx = sources.findIndex(s => s.id === sourceId);
    const cols = idx === 0 ? mockSchemaColumns : secondSourceColumns;
    updateSource(sourceId, { contractFile: f, contractValid: true, columns: cols, dbfsFiles: [], selectedFiles: [] });
    toast.success(`Data contract parsed — ${cols.length} columns detected`);
  };

  const handleSourceSearchDbfs = (sourceId: string) => {
    const src = sources.find(s => s.id === sourceId);
    if (!src) return;
    if (!src.fileMask.trim()) { toast.error('Enter a file mask first'); return; }
    if (!src.contractFile) { toast.error('Upload a data contract first'); return; }

    updateSource(sourceId, { searching: true, dbfsFiles: [], selectedFiles: [] });

    setTimeout(() => {
      const idx = sources.findIndex(s => s.id === sourceId);
      const files = generateMockDbfsFiles(src.fileMask, idx);
      updateSource(sourceId, { searching: false, dbfsFiles: files, selectedFiles: files.map(f => f.path) });
      const totalRescued = files.reduce((s, f) => s + f.rescuedRows, 0);
      toast.success(`Found ${files.length} files matching "${src.fileMask}" — ${totalRescued.toLocaleString()} rows rescued`);
    }, 1500);
  };

  const toggleSourceFileSelection = (sourceId: string, path: string) => {
    const src = sources.find(s => s.id === sourceId);
    if (!src) return;
    const newSel = src.selectedFiles.includes(path) ? src.selectedFiles.filter(p => p !== path) : [...src.selectedFiles, path];
    updateSource(sourceId, { selectedFiles: newSel });
  };

  // ─── Transformation handlers ──────────────────────────────────────────────

  const addTransformation = (type: TransformationType) => {
    if (!activeLayer || activeLayer === 'source') return;
    const current = getLayerTransformations(activeLayer);
    const newT: Transformation = {
      id: `t-${Date.now()}`, order: current.length + 1, type, config: {}, sourceColumns: [],
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

  // ─── Quality Check handlers ────────────────────────────────────────────────

  const addQualityCheck = (sourceId: string, columnName: string) => {
    setQualityChecks(prev => [...prev, {
      id: `qc-${Date.now()}`, sourceId, columnName,
      rule: 'not_null', config: {}, onFailure: 'quarantine',
    }]);
  };

  const removeQualityCheck = (id: string) => {
    setQualityChecks(prev => prev.filter(q => q.id !== id));
  };

  const updateQualityCheck = (id: string, updates: Partial<QualityCheck>) => {
    setQualityChecks(prev => prev.map(q => q.id === id ? { ...q, ...updates } : q));
  };

  // ─── AI Agent ──────────────────────────────────────────────────────────────

  const handleSendChat = () => {
    if (!chatInput.trim() || !activeLayer || activeLayer === 'source') return;
    const userMsg = chatInput.trim();
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setChatInput('');
    setAiLoading(true);

    setTimeout(() => {
      const lower = userMsg.toLowerCase();
      const current = getLayerTransformations(activeLayer);
      const inputCols = getLayerInputColumns(activeLayer);
      const newT: Transformation[] = [];

      if (lower.includes('filter')) {
        const cond = lower.includes('cancel') ? "status != 'cancelled'" : lower.includes('amount') ? 'amount > 0' : "status = 'completed'";
        newT.push({ id: `t-${Date.now()}-f`, order: current.length + newT.length + 1, type: 'filter', config: { condition: cond }, sourceColumns: ['status'], description: `Filter: ${cond}` });
      }
      if (lower.includes('rename')) {
        const src = lower.includes('transaction_date') ? 'transaction_date' : inputCols[0]?.name || 'col';
        const tgt = lower.includes('txn_date') ? 'txn_date' : 'renamed_col';
        newT.push({ id: `t-${Date.now()}-r`, order: current.length + newT.length + 1, type: 'rename', config: { newName: tgt }, sourceColumns: [src], targetColumn: tgt, description: `Rename ${src} → ${tgt}` });
      }
      if (lower.includes('cast')) {
        const col = lower.includes('amount') ? 'amount' : lower.includes('score') ? 'score' : inputCols[0]?.name || 'col';
        const typ = lower.includes('decimal') ? 'DECIMAL' : lower.includes('integer') ? 'INTEGER' : 'STRING';
        newT.push({ id: `t-${Date.now()}-c`, order: current.length + newT.length + 1, type: 'cast', config: { targetType: typ }, sourceColumns: [col], targetColumn: col, description: `Cast ${col} to ${typ}` });
      }
      if (lower.includes('join')) {
        const joinCol = lower.includes('client') ? 'client_id' : inputCols[0]?.name || 'id';
        newT.push({ id: `t-${Date.now()}-j`, order: current.length + newT.length + 1, type: 'join', config: { joinType: 'inner', joinColumn: joinCol }, sourceColumns: [joinCol], description: `Join on ${joinCol}` });
      }
      if (lower.includes('deduplic') || lower.includes('duplicate')) {
        newT.push({ id: `t-${Date.now()}-dd`, order: current.length + newT.length + 1, type: 'deduplicate', config: {}, sourceColumns: ['*'], description: 'Remove duplicate rows' });
      }
      if (lower.includes('aggregate') || lower.includes('group')) {
        const grp = lower.includes('client') ? 'client_id' : inputCols[0]?.name || 'id';
        newT.push({ id: `t-${Date.now()}-a`, order: current.length + newT.length + 1, type: 'aggregate', config: { groupBy: [grp], aggregations: [{ column: 'amount', func: 'SUM', alias: 'total_amount' }] }, sourceColumns: [grp, 'amount'], targetColumn: 'total_amount', description: `Aggregate amount by ${grp}` });
      }
      if (lower.includes('drop')) {
        const col = lower.includes('email') ? 'email' : lower.includes('assessor') ? 'assessor' : 'client_name';
        newT.push({ id: `t-${Date.now()}-d`, order: current.length + newT.length + 1, type: 'drop_column', config: {}, sourceColumns: [col], description: `Drop column ${col}` });
      }
      if (lower.includes('sort') || lower.includes('order')) {
        const col = lower.includes('date') ? 'transaction_date' : lower.includes('score') ? 'score' : 'amount';
        newT.push({ id: `t-${Date.now()}-s`, order: current.length + newT.length + 1, type: 'sort', config: { direction: 'DESC' }, sourceColumns: [col], description: `Sort by ${col} DESC` });
      }
      if (lower.includes('add') && lower.includes('column')) {
        newT.push({ id: `t-${Date.now()}-ac`, order: current.length + newT.length + 1, type: 'add_column', config: { expression: "CONCAT(client_id, '-', risk_id)" }, sourceColumns: ['client_id'], targetColumn: 'composite_key', description: 'Create composite key' });
      }

      let response: string;
      if (newT.length > 0) {
        setLayerTransformations(activeLayer, [...current, ...newT]);
        response = `✅ Created **${newT.length} transformation(s)** for **${activeLayer.toUpperCase()}**:\n\n${newT.map((t, i) => `${i + 1}. **${t.type.replace('_', ' ').toUpperCase()}** — ${t.description}`).join('\n')}\n\nYou can edit each one or ask me for more.`;
      } else {
        response = "I couldn't parse that. Try:\n• \"Filter rows where status is cancelled\"\n• \"Join on client_id\"\n• \"Rename transaction_date to txn_date, cast amount to DECIMAL\"\n• \"Drop column email, deduplicate, sort by date\"";
      }
      setChatMessages(prev => [...prev, { role: 'assistant', content: response }]);
      setAiLoading(false);
    }, 1200);
  };

  // ─── Execution ─────────────────────────────────────────────────────────────

  const execSteps = ['Validating configuration', 'Generating DLT notebook', 'Creating Databricks job', 'Provisioning cluster', 'Installing libraries', 'Running Bronze layer', 'Running Silver transformations', 'Applying quality expectations', 'Writing Gold output', 'Updating Unity Catalog', 'Finalizing tables'];

  const totalSelectedFiles = sources.reduce((s, src) => s + src.selectedFiles.length, 0);
  const totalRows = sources.reduce((s, src) => s + src.dbfsFiles.filter(f => src.selectedFiles.includes(f.path)).reduce((a, f) => a + f.totalRows, 0), 0);
  const totalValidRows = sources.reduce((s, src) => s + src.dbfsFiles.filter(f => src.selectedFiles.includes(f.path)).reduce((a, f) => a + f.validRows, 0), 0);
  const totalRescuedRows = sources.reduce((s, src) => s + src.dbfsFiles.filter(f => src.selectedFiles.includes(f.path)).reduce((a, f) => a + f.rescuedRows, 0), 0);

  const startExecution = async () => {
    setExecStatus('running'); setExecError(null); setExecLogs([]);
    const jid = `job-${Math.floor(Math.random() * 90000) + 10000}`;
    const rid = `run-${Math.floor(Math.random() * 900000) + 100000}`;
    const cid = `0226-${Math.floor(Math.random() * 9000) + 1000}-abcd${Math.floor(Math.random() * 100)}`;
    setJobDetails({
      jobId: jid, runId: rid, clusterId: cid, clusterName: `dlt-pipeline-${pipelineName || 'unnamed'}`,
      startTime: new Date().toISOString(), sparkUiUrl: '#',
      driverType: 'Standard_DS3_v2 (14 GB, 4 Cores)', workerType: 'Standard_DS3_v2 (14 GB, 4 Cores)', numWorkers: 2,
      tasks: [
        { name: 'bronze_ingestion', status: 'pending' }, { name: 'silver_transformations', status: 'pending' },
        { name: 'quality_expectations', status: 'pending' }, { name: 'gold_aggregations', status: 'pending' },
        { name: 'catalog_update', status: 'pending' },
      ],
    });
    setExecLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Pipeline "${pipelineName}" starting...`, `[${new Date().toLocaleTimeString()}] Job: ${jid} | Run: ${rid} | Cluster: ${cid}`]);

    for (let i = 0; i < execSteps.length; i++) {
      setExecStep(i);
      setJobDetails(prev => {
        if (!prev) return prev;
        const tasks = [...prev.tasks];
        if (i >= 5 && i <= 5) tasks[0] = { ...tasks[0], status: 'running', recordsIn: totalRows, recordsOut: totalValidRows };
        if (i > 5) tasks[0] = { ...tasks[0], status: 'completed', duration: '2m 14s', recordsIn: totalRows, recordsOut: totalValidRows };
        if (i >= 6 && i <= 6) tasks[1] = { ...tasks[1], status: 'running' };
        if (i > 6) tasks[1] = { ...tasks[1], status: 'completed', duration: '3m 42s', recordsIn: totalValidRows, recordsOut: totalValidRows };
        if (i >= 7 && i <= 7) tasks[2] = { ...tasks[2], status: 'running' };
        if (i > 7) tasks[2] = { ...tasks[2], status: 'completed', duration: '1m 08s', recordsIn: totalValidRows, recordsOut: totalValidRows - totalRescuedRows };
        if (i >= 8 && i <= 8) tasks[3] = { ...tasks[3], status: 'running' };
        if (i > 8) tasks[3] = { ...tasks[3], status: 'completed', duration: '2m 31s', recordsIn: totalValidRows - totalRescuedRows, recordsOut: totalValidRows - totalRescuedRows };
        if (i >= 9) tasks[4] = { ...tasks[4], status: i === 9 ? 'running' : 'completed', duration: i > 9 ? '0m 12s' : undefined };
        return { ...prev, tasks };
      });
      setExecLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${execSteps[i]}...`]);
      await new Promise(r => setTimeout(r, 1000 + Math.random() * 600));
    }
    setJobDetails(prev => prev ? { ...prev, endTime: new Date().toISOString() } : prev);
    setExecLogs(prev => [...prev,
      `[${new Date().toLocaleTimeString()}] ✓ All tasks completed`,
      `[${new Date().toLocaleTimeString()}] Rows: ${totalRows.toLocaleString()} read | ${totalValidRows.toLocaleString()} written | ${totalRescuedRows.toLocaleString()} rescued`,
      `[${new Date().toLocaleTimeString()}] Output: ${outputPath}${outputTableName}`,
    ]);
    setExecStatus('success');
  };

  const allTransformations = [...bronzeTransformations, ...silverTransformations, ...goldTransformations];
  const sourcesReady = sources.every(s => s.contractValid && s.selectedFiles.length > 0);
  const canNext = step === 0 ? true : step === 1 ? !!pipelineName && !!outputTableName : false;

  const dagLayers: { key: DagLayer; label: string; icon: React.ReactNode; color: string; bgColor: string; borderColor: string }[] = [
    { key: 'source', label: 'Source', icon: <Database className="h-5 w-5" />, color: 'text-info', bgColor: 'bg-info/10', borderColor: 'border-info/40' },
    { key: 'bronze', label: 'Bronze', icon: <Layers className="h-5 w-5" />, color: 'text-warning', bgColor: 'bg-warning/10', borderColor: 'border-warning/40' },
    { key: 'silver', label: 'Silver', icon: <Layers className="h-5 w-5" />, color: 'text-muted-foreground', bgColor: 'bg-muted', borderColor: 'border-border' },
    { key: 'gold', label: 'Gold', icon: <Layers className="h-5 w-5" />, color: 'text-warning', bgColor: 'bg-warning/5', borderColor: 'border-warning/30' },
  ];

  const currentTransformations = activeLayer ? getLayerTransformations(activeLayer) : [];
  const currentInputColumns = activeLayer ? getLayerInputColumns(activeLayer) : [];

  // ─── Render ────────────────────────────────────────────────────────────────

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

      {/* ============ Step 1: Pipeline Builder (DAG) ============ */}
      {step === 0 && !activeLayer && !editingSourceId && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pipeline Builder — Databricks DLT Flow</CardTitle>
              <p className="text-xs text-muted-foreground">Click <strong>Source</strong> to define data sources (file masks + data contracts). Click <strong>Bronze / Silver / Gold</strong> to configure transformations & quality checks. Data flows left to right — output of each layer becomes input of the next.</p>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center gap-0 py-8 overflow-x-auto">
                {dagLayers.map((layer, idx) => (
                  <div key={layer.key} className="flex items-center">
                    <div
                      className={`relative cursor-pointer transition-all hover:scale-105 border-2 rounded-xl px-6 py-5 min-w-[170px] text-center ${layer.bgColor} ${layer.borderColor} hover:shadow-lg`}
                      onClick={() => {
                        if (layer.key === 'source') setEditingSourceId(sources[0]?.id || null);
                        else setActiveLayer(layer.key);
                      }}
                    >
                      <div className={`flex items-center justify-center gap-2 mb-2 ${layer.color}`}>
                        {layer.icon}
                        <span className="font-bold text-sm">{layer.label}</span>
                      </div>
                      {layer.key === 'source' ? (
                        <div className="space-y-1">
                          <p className="text-xs font-medium">{sources.length} source(s)</p>
                          <p className="text-[10px] text-muted-foreground">{totalSelectedFiles} file(s) selected</p>
                          {sourcesReady && <Badge className="bg-success text-success-foreground text-[9px]">Ready</Badge>}
                          {!sourcesReady && <Badge variant="outline" className="text-[9px]">Click to configure</Badge>}
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <p className="text-xs font-medium">{getLayerTransformations(layer.key).length} transformation(s)</p>
                          {layer.key === 'bronze' && qualityChecks.length > 0 && (
                            <p className="text-[10px] text-muted-foreground">{qualityChecks.length} quality check(s)</p>
                          )}
                          {getLayerTransformations(layer.key).length > 0 && (
                            <div className="flex flex-wrap gap-1 justify-center">
                              {getLayerTransformations(layer.key).slice(0, 3).map(t => (
                                <Badge key={t.id} variant="outline" className="text-[9px]">{t.type.replace('_', ' ')}</Badge>
                              ))}
                              {getLayerTransformations(layer.key).length > 3 && <Badge variant="outline" className="text-[9px]">+{getLayerTransformations(layer.key).length - 3}</Badge>}
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
                      {layer.key === 'source' && sourcesReady && (
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

              {/* Summary counters */}
              <div className="border-t pt-4 mt-4 grid grid-cols-4 gap-3 text-center">
                <div className="bg-info/10 rounded-lg p-3">
                  <p className="text-2xl font-bold text-info">{sources.length}</p>
                  <p className="text-xs text-muted-foreground">Sources</p>
                </div>
                <div className="bg-warning/10 rounded-lg p-3">
                  <p className="text-2xl font-bold text-warning">{bronzeTransformations.length}</p>
                  <p className="text-xs text-muted-foreground">Bronze</p>
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-2xl font-bold text-muted-foreground">{silverTransformations.length}</p>
                  <p className="text-xs text-muted-foreground">Silver</p>
                </div>
                <div className="bg-warning/5 rounded-lg p-3">
                  <p className="text-2xl font-bold text-warning">{goldTransformations.length}</p>
                  <p className="text-xs text-muted-foreground">Gold</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ============ Source Editor ============ */}
      {step === 0 && editingSourceId && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => setEditingSourceId(null)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h2 className="text-lg font-bold">Configure Sources</h2>
                <p className="text-xs text-muted-foreground">Define data contracts and file masks for each source. Each source contributes columns to the pipeline.</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="gap-2" onClick={addSource}>
              <Plus className="h-3.5 w-3.5" /> Add Source
            </Button>
          </div>

          {sources.map((src, srcIdx) => (
            <Card key={src.id} className={`border-2 ${editingSourceId === src.id ? 'border-primary/30' : 'border-border'}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Database className="h-4 w-4 text-info" />
                    <Input
                      value={src.name}
                      onChange={(e) => updateSource(src.id, { name: e.target.value })}
                      className="h-7 w-48 text-sm font-semibold"
                    />
                    {src.contractValid && src.selectedFiles.length > 0 && (
                      <Badge className="bg-success text-success-foreground text-[9px]"><Check className="h-3 w-3 mr-1" />Ready</Badge>
                    )}
                  </CardTitle>
                  {sources.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeSource(src.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Contract Upload */}
                <div>
                  <Label className="text-xs font-medium mb-2 block">Data Contract</Label>
                  <div
                    className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${src.contractFile ? 'border-success bg-success/5' : 'border-border hover:border-primary'}`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) { const idx = sources.findIndex(s => s.id === src.id); updateSource(src.id, { contractFile: f, contractValid: true, columns: idx === 0 ? mockSchemaColumns : secondSourceColumns }); }}}
                  >
                    {!src.contractFile ? (
                      <label className="cursor-pointer block">
                        <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
                        <p className="text-xs font-medium">Drop data contract (.xlsx, .xls)</p>
                        <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => handleSourceContractUpload(src.id, e)} />
                      </label>
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <FileSpreadsheet className="h-4 w-4 text-success" />
                        <span className="text-xs font-medium">{src.contractFile.name}</span>
                        <Badge variant="outline" className="text-[9px]">{src.columns.length} columns</Badge>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateSource(src.id, { contractFile: null, contractValid: false, columns: [], dbfsFiles: [], selectedFiles: [] })}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Schema preview */}
                {src.columns.length > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="text-[10px]">Column</TableHead>
                          <TableHead className="text-[10px]">Type</TableHead>
                          <TableHead className="text-[10px]">Nullable</TableHead>
                          <TableHead className="text-[10px]">Sensitive</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {src.columns.map(col => (
                          <TableRow key={col.id} className="text-[11px]">
                            <TableCell className="py-1 font-mono">{col.name}</TableCell>
                            <TableCell className="py-1"><Badge className={`${typeColors[col.type]} text-[9px]`}>{col.type}</Badge></TableCell>
                            <TableCell className="py-1">{col.nullable ? 'Yes' : 'No'}</TableCell>
                            <TableCell className="py-1">{col.sensitive ? <Badge variant="outline" className="text-[9px] text-destructive border-destructive/30">PII</Badge> : '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* File Mask + DBFS Search */}
                <div>
                  <Label className="text-xs font-medium mb-2 block">File Mask & DBFS Path</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="DBFS path: /mnt/data/raw/"
                      value={src.dbfsPath}
                      onChange={(e) => updateSource(src.id, { dbfsPath: e.target.value })}
                      className="w-48 text-xs"
                    />
                    <Input
                      placeholder="File mask: transactions_*.csv"
                      value={src.fileMask}
                      onChange={(e) => updateSource(src.id, { fileMask: e.target.value })}
                      className="flex-1 text-xs"
                      onKeyDown={(e) => e.key === 'Enter' && handleSourceSearchDbfs(src.id)}
                    />
                    <Button size="sm" onClick={() => handleSourceSearchDbfs(src.id)} disabled={src.searching || !src.contractFile} className="gap-2 text-xs">
                      {src.searching ? <div className="h-3 w-3 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> : <FolderSearch className="h-3.5 w-3.5" />}
                      Search
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">Only files matching the mask are returned. Rows not matching the data contract are rescued to Quarantine.</p>
                </div>

                {/* DBFS Files */}
                {src.dbfsFiles.length > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="text-[10px] w-8"></TableHead>
                          <TableHead className="text-[10px]">File</TableHead>
                          <TableHead className="text-[10px] text-right">Total</TableHead>
                          <TableHead className="text-[10px] text-right">Valid</TableHead>
                          <TableHead className="text-[10px] text-right">Rescued</TableHead>
                          <TableHead className="text-[10px]">Size</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {src.dbfsFiles.map(f => (
                          <TableRow key={f.path} className={`cursor-pointer text-[11px] ${src.selectedFiles.includes(f.path) ? 'bg-success/5' : ''}`} onClick={() => toggleSourceFileSelection(src.id, f.path)}>
                            <TableCell className="py-1">
                              <input type="checkbox" checked={src.selectedFiles.includes(f.path)} onChange={() => toggleSourceFileSelection(src.id, f.path)} className="rounded border-input h-3 w-3" />
                            </TableCell>
                            <TableCell className="py-1 font-mono">{f.name}</TableCell>
                            <TableCell className="py-1 text-right">{f.totalRows.toLocaleString()}</TableCell>
                            <TableCell className="py-1 text-right text-success">{f.validRows.toLocaleString()}</TableCell>
                            <TableCell className="py-1 text-right">
                              {f.rescuedRows > 0 ? (
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Badge variant="outline" className="text-[9px] text-warning border-warning/30">
                                      <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />{f.rescuedRows.toLocaleString()}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-sm">
                                    {f.rescueReasons.map((r, i) => <p key={i} className="text-[10px]"><strong>{r.count}</strong> — {r.reason}</p>)}
                                  </TooltipContent>
                                </Tooltip>
                              ) : <span className="text-success">0</span>}
                            </TableCell>
                            <TableCell className="py-1 text-muted-foreground">{f.size}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          <div className="flex justify-end">
            <Button className="gap-2" onClick={() => {
              if (!sourcesReady) { toast.error('All sources must have a contract and selected files'); return; }
              setEditingSourceId(null);
              toast.success(`${sources.length} source(s) configured with ${totalSelectedFiles} file(s)`);
            }}>
              <Check className="h-4 w-4" /> Validate & Return to Pipeline
            </Button>
          </div>
        </div>
      )}

      {/* ============ Layer Editor (Bronze/Silver/Gold) ============ */}
      {step === 0 && activeLayer && activeLayer !== 'source' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setActiveLayer(null)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h2 className="text-lg font-bold">{activeLayer.charAt(0).toUpperCase() + activeLayer.slice(1)} Layer — Schema & Transformations</h2>
              <p className="text-xs text-muted-foreground">
                {activeLayer === 'bronze' && 'Input: raw source columns. Define transformations and quality checks.'}
                {activeLayer === 'silver' && 'Input: Bronze output (post-transformation). Apply further cleaning & enrichment.'}
                {activeLayer === 'gold' && 'Input: Silver output. Apply final aggregations and business logic.'}
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            {/* Left: Input Columns grouped by source */}
            <div className="w-1/3 space-y-4">
              {getColumnsGroupedBySource(activeLayer).map(group => (
                <Card key={group.sourceId}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Database className="h-3.5 w-3.5 text-info" />
                      {group.sourceName}
                      <Badge variant="outline" className="text-[9px] ml-auto">{group.columns.length} cols</Badge>
                    </CardTitle>
                    {activeLayer !== 'bronze' && (
                      <p className="text-[10px] text-muted-foreground">
                        After {activeLayer === 'silver' ? 'Bronze' : 'Silver'} transformations
                      </p>
                    )}
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="max-h-[250px]">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="text-[10px]">Column</TableHead>
                            <TableHead className="text-[10px]">Type</TableHead>
                            {activeLayer !== 'bronze' && <TableHead className="text-[10px]">Changed</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.columns.map((col, i) => (
                            <TableRow key={`${col.id}-${i}`} className={`text-[11px] ${col.transformed ? 'bg-primary/5' : ''}`}>
                              <TableCell className="py-1 font-mono">
                                {col.name}
                                {col.transformedFrom && (
                                  <span className="text-[9px] text-muted-foreground block">← {col.transformedFrom}</span>
                                )}
                              </TableCell>
                              <TableCell className="py-1">
                                <Badge className={`${typeColors[col.type]} text-[9px]`}>{col.type}</Badge>
                              </TableCell>
                              {activeLayer !== 'bronze' && (
                                <TableCell className="py-1">
                                  {col.transformed && (
                                    <Badge className="bg-primary/10 text-primary text-[8px]">Modified</Badge>
                                  )}
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </CardContent>
                </Card>
              ))}

              {getColumnsGroupedBySource(activeLayer).length === 0 && (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground text-sm">
                    <p>No source columns. Configure sources first.</p>
                  </CardContent>
                </Card>
              )}

              {/* Quality Checks (Bronze only) */}
              {activeLayer === 'bronze' && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4" /> Quality Checks
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {qualityChecks.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-2">No quality checks. Click a column name above or add below.</p>
                    )}
                    {qualityChecks.map(qc => (
                      <div key={qc.id} className="border rounded-lg p-2 space-y-1">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-[9px] font-mono">{qc.columnName}</Badge>
                          <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => removeQualityCheck(qc.id)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                          <Select value={qc.rule} onValueChange={(v) => updateQualityCheck(qc.id, { rule: v as any })}>
                            <SelectTrigger className="h-6 text-[10px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="not_null">Not Null</SelectItem>
                              <SelectItem value="unique">Unique</SelectItem>
                              <SelectItem value="range">Range</SelectItem>
                              <SelectItem value="regex">Regex</SelectItem>
                              <SelectItem value="values_in_set">Values In Set</SelectItem>
                            </SelectContent>
                          </Select>
                          <Select value={qc.onFailure} onValueChange={(v) => updateQualityCheck(qc.id, { onFailure: v as any })}>
                            <SelectTrigger className="h-6 text-[10px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="quarantine">Quarantine</SelectItem>
                              <SelectItem value="drop">Drop</SelectItem>
                              <SelectItem value="warn">Warn</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {qc.rule === 'range' && (
                          <div className="flex gap-1">
                            <Input className="h-6 text-[10px]" placeholder="Min" value={qc.config.min || ''} onChange={e => updateQualityCheck(qc.id, { config: { ...qc.config, min: e.target.value } })} />
                            <Input className="h-6 text-[10px]" placeholder="Max" value={qc.config.max || ''} onChange={e => updateQualityCheck(qc.id, { config: { ...qc.config, max: e.target.value } })} />
                          </div>
                        )}
                        {qc.rule === 'regex' && (
                          <Input className="h-6 text-[10px] font-mono" placeholder="^[A-Z].*" value={qc.config.pattern || ''} onChange={e => updateQualityCheck(qc.id, { config: { ...qc.config, pattern: e.target.value } })} />
                        )}
                        {qc.rule === 'values_in_set' && (
                          <Input className="h-6 text-[10px]" placeholder="val1, val2, val3" value={qc.config.values || ''} onChange={e => updateQualityCheck(qc.id, { config: { ...qc.config, values: e.target.value } })} />
                        )}
                      </div>
                    ))}
                    <Select onValueChange={(colName) => addQualityCheck(sources[0]?.id || '', colName)}>
                      <SelectTrigger className="h-7 text-xs">
                        <Plus className="h-3 w-3 mr-1" />
                        <SelectValue placeholder="Add quality check on..." />
                      </SelectTrigger>
                      <SelectContent>
                        {currentInputColumns.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right: Transformations */}
            <div className="flex-1 space-y-4">
              <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm">Transformations — {activeLayer.charAt(0).toUpperCase() + activeLayer.slice(1)}</CardTitle>
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
                      <p className="text-xs">Use <strong>+ Add transformation</strong> or <strong>AI Agent</strong> to configure.</p>
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
                                  <SelectContent>{currentInputColumns.map(c => <SelectItem key={`${c.id}-sel`} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
                                </Select>
                              </div>
                              {t.type === 'rename' && <div><Label className="text-[10px]">New Name</Label><Input className="h-7 text-xs" value={(t.config.newName as string) || ''} onChange={(e) => updateTransformation(t.id, { config: { ...t.config, newName: e.target.value } })} /></div>}
                              {t.type === 'cast' && <div><Label className="text-[10px]">Target Type</Label><Select value={(t.config.targetType as string) || ''} onValueChange={(v) => updateTransformation(t.id, { config: { ...t.config, targetType: v } })}><SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger><SelectContent>{['STRING','INTEGER','DECIMAL','DATE','BOOLEAN','TIMESTAMP'].map(tp => <SelectItem key={tp} value={tp}>{tp}</SelectItem>)}</SelectContent></Select></div>}
                              {t.type === 'filter' && <div><Label className="text-[10px]">Condition (SQL)</Label><Input className="h-7 text-xs font-mono" value={(t.config.condition as string) || ''} onChange={(e) => updateTransformation(t.id, { config: { ...t.config, condition: e.target.value } })} /></div>}
                              {t.type === 'add_column' && <div><Label className="text-[10px]">Expression</Label><Input className="h-7 text-xs font-mono" value={(t.config.expression as string) || ''} onChange={(e) => updateTransformation(t.id, { config: { ...t.config, expression: e.target.value } })} /></div>}
                              {t.type === 'aggregate' && <div><Label className="text-[10px]">Group By</Label><Input className="h-7 text-xs font-mono" value={(t.config.groupBy as string[])?.join(', ') || ''} onChange={(e) => updateTransformation(t.id, { config: { ...t.config, groupBy: e.target.value.split(',').map(s => s.trim()) } })} /></div>}
                              {t.type === 'join' && <div><Label className="text-[10px]">Join Column</Label><Input className="h-7 text-xs font-mono" value={(t.config.joinColumn as string) || ''} onChange={(e) => updateTransformation(t.id, { config: { ...t.config, joinColumn: e.target.value } })} /></div>}
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

              <div className="flex justify-end">
                <Button className="gap-2" onClick={() => { setActiveLayer(null); toast.success(`${activeLayer} layer saved — ${currentTransformations.length} transformation(s)`); }}>
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
                        <span className="text-xs text-muted-foreground">Generating...</span>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
              <div className="flex gap-2 mt-4 pt-4 border-t">
                <Input placeholder="e.g. Filter cancelled rows, join on client_id..." value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !aiLoading && handleSendChat()} className="text-sm" disabled={aiLoading} />
                <Button size="icon" onClick={handleSendChat} disabled={aiLoading || !chatInput.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      )}

      {/* ============ Step 2: Review & Deploy ============ */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Pipeline Name *</Label><Input value={pipelineName} onChange={(e) => setPipelineName(e.target.value)} placeholder="my-pipeline" /></div>
            <div className="space-y-2"><Label>Environment</Label>
              <Select value={env} onValueChange={(v) => setEnv(v as any)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="development">Development</SelectItem><SelectItem value="production">Production</SelectItem></SelectContent></Select>
            </div>
          </div>
          <div className="space-y-2"><Label>Description</Label><Textarea value={pipelineDesc} onChange={(e) => setPipelineDesc(e.target.value)} placeholder="Describe your pipeline..." /></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Output Table Name *</Label><Input value={outputTableName} onChange={(e) => setOutputTableName(e.target.value)} placeholder="gold_transactions" /></div>
            <div className="space-y-2"><Label>Output Path (DBFS)</Label><Input value={outputPath} onChange={(e) => setOutputPath(e.target.value)} /></div>
          </div>
          <div className="flex items-center gap-4">
            <Switch checked={scheduled} onCheckedChange={setScheduled} /><Label>Enable Scheduling</Label>
            {scheduled && <Input className="w-48" value={cronExpr} onChange={(e) => setCronExpr(e.target.value)} />}
          </div>
          <div className="flex items-center gap-2"><Switch checked={notifications} onCheckedChange={setNotifications} /><Label className="text-sm">Email notifications</Label></div>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Pipeline Summary</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-3 mb-4">
                <div className="bg-info/10 border border-info/20 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-info">{sources.length}</p><p className="text-[10px] text-muted-foreground">Sources</p>
                </div>
                <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-warning">{bronzeTransformations.length}</p><p className="text-[10px] text-muted-foreground">Bronze</p>
                </div>
                <div className="bg-muted border rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-muted-foreground">{silverTransformations.length}</p><p className="text-[10px] text-muted-foreground">Silver</p>
                </div>
                <div className="bg-warning/5 border border-warning/20 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-warning">{goldTransformations.length}</p><p className="text-[10px] text-muted-foreground">Gold</p>
                </div>
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-destructive">{totalRescuedRows.toLocaleString()}</p><p className="text-[10px] text-muted-foreground">Rescued</p>
                </div>
              </div>
              {/* Sources detail */}
              <div className="space-y-1 mb-3">
                {sources.map(s => (
                  <div key={s.id} className="flex items-center gap-2 text-xs">
                    <Database className="h-3 w-3 text-info" />
                    <span className="font-medium">{s.name}</span>
                    <Badge variant="outline" className="text-[9px]">{s.fileMask}</Badge>
                    <span className="text-muted-foreground">{s.selectedFiles.length} files, {s.columns.length} columns</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="code">
            <TabsList>
              <TabsTrigger value="code">DLT Code Preview</TabsTrigger>
              <TabsTrigger value="config">Configuration JSON</TabsTrigger>
            </TabsList>
            <TabsContent value="code" className="mt-4">
              <pre className="bg-muted p-4 rounded-md text-xs overflow-auto max-h-80 font-mono">
{`import dlt
from pyspark.sql.functions import *

# Auto-generated DLT Pipeline
# Pipeline: ${pipelineName || 'unnamed'}
# Sources: ${sources.map(s => s.name).join(', ')}

${sources.map((s, i) => `@dlt.table(name="bronze_${s.name.toLowerCase().replace(/\\s+/g, '_')}")
@dlt.expect_or_drop("valid_rows", "_rescued_data IS NULL")
${qualityChecks.filter(q => q.sourceId === s.id || i === 0).map(q => {
  if (q.rule === 'not_null') return `@dlt.expect_or_${q.onFailure === 'drop' ? 'drop' : 'fail'}("${q.columnName}_not_null", "${q.columnName} IS NOT NULL")`;
  if (q.rule === 'unique') return `@dlt.expect("${q.columnName}_unique", "/* uniqueness check */")`;
  if (q.rule === 'range') return `@dlt.expect_or_${q.onFailure === 'drop' ? 'drop' : 'fail'}("${q.columnName}_range", "${q.columnName} BETWEEN ${q.config.min || 0} AND ${q.config.max || 999999}")`;
  return '';
}).filter(Boolean).join('\n')}
def bronze_source_${i + 1}():
    return spark.read.format("csv")\\
        .option("header", "true")\\
        .option("rescuedDataColumn", "_rescued_data")\\
        .load("${s.dbfsPath}${s.fileMask}")
`).join('\n')}
@dlt.table(name="silver_${outputTableName || 'data'}")
def silver():
    ${sources.length > 1 ? `# Join sources\n    df = dlt.read("bronze_${sources[0].name.toLowerCase().replace(/\\s+/g, '_')}")` : `df = dlt.read("bronze_${sources[0]?.name.toLowerCase().replace(/\\s+/g, '_') || 'source'}")`}
${sources.length > 1 ? sources.slice(1).map((s, i) => `    df${i + 2} = dlt.read("bronze_${s.name.toLowerCase().replace(/\\s+/g, '_')}")\n    df = df.join(df${i + 2}, "client_id", "left")`).join('\n') : ''}
${silverTransformations.map(t => {
  if (t.type === 'filter') return `    df = df.filter("${t.config.condition || ''}")`;
  if (t.type === 'rename') return `    df = df.withColumnRenamed("${t.sourceColumns[0]}", "${t.config.newName}")`;
  if (t.type === 'cast') return `    df = df.withColumn("${t.sourceColumns[0]}", col("${t.sourceColumns[0]}").cast("${t.config.targetType}"))`;
  return `    # ${t.description}`;
}).join('\n')}
    return df

@dlt.table(name="gold_${outputTableName || 'data'}")
def gold():
    df = dlt.read("silver_${outputTableName || 'data'}")
${goldTransformations.map(t => {
  if (t.type === 'aggregate') return `    df = df.groupBy("${(t.config.groupBy as string[])?.join('","')}").agg(sum("amount").alias("total_amount"))`;
  if (t.type === 'filter') return `    df = df.filter("${t.config.condition || ''}")`;
  return `    # ${t.description}`;
}).join('\n')}
    return df`}
              </pre>
            </TabsContent>
            <TabsContent value="config" className="mt-4">
              <pre className="bg-muted p-4 rounded-md text-xs overflow-auto max-h-80 font-mono">{JSON.stringify({
                name: pipelineName, environment: env, outputTable: outputTableName, outputPath,
                sources: sources.map(s => ({ name: s.name, fileMask: s.fileMask, dbfsPath: s.dbfsPath, files: s.selectedFiles.length, columns: s.columns.length })),
                layers: { bronze: bronzeTransformations.length, silver: silverTransformations.length, gold: goldTransformations.length },
                qualityChecks: qualityChecks.length, totalRescued: totalRescuedRows,
              }, null, 2)}</pre>
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* ============ Step 3: Execution ============ */}
      {step === 2 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Terminal className="h-5 w-5" /> Pipeline Execution: {pipelineName}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {sources.length} source(s) • {allTransformations.length} transformations • {qualityChecks.length} quality checks • Output: {outputTableName}
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {execStatus === 'idle' && (
                <div className="text-center py-8 space-y-4">
                  <p className="text-muted-foreground">Ready to deploy. This creates a Databricks DLT pipeline and submits a job.</p>
                  <Button className="gap-2" size="lg" onClick={startExecution}><Play className="h-5 w-5" /> Start Pipeline</Button>
                </div>
              )}

              {(execStatus === 'running' || execStatus === 'paused') && (
                <div className="space-y-4">
                  {jobDetails && (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="bg-muted/50 border rounded-lg p-3"><div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Activity className="h-3 w-3" /> Job</div><p className="font-mono text-xs font-medium">{jobDetails.jobId}</p><p className="font-mono text-[10px] text-muted-foreground">Run: {jobDetails.runId}</p></div>
                      <div className="bg-muted/50 border rounded-lg p-3"><div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Server className="h-3 w-3" /> Cluster</div><p className="font-mono text-xs font-medium">{jobDetails.clusterId}</p></div>
                      <div className="bg-muted/50 border rounded-lg p-3"><div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Cpu className="h-3 w-3" /> Compute</div><p className="text-xs font-medium">{jobDetails.numWorkers} workers</p><p className="text-[10px] text-muted-foreground">{jobDetails.workerType}</p></div>
                      <div className="bg-muted/50 border rounded-lg p-3"><div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Clock className="h-3 w-3" /> Started</div><p className="text-xs font-medium">{new Date(jobDetails.startTime).toLocaleTimeString()}</p></div>
                    </div>
                  )}
                  <Progress value={(execStep / (execSteps.length - 1)) * 100} className="h-2" />
                  {jobDetails && (
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm">Tasks</CardTitle></CardHeader>
                      <CardContent className="p-0">
                        <Table>
                          <TableHeader><TableRow className="bg-muted/50"><TableHead className="text-xs">Task</TableHead><TableHead className="text-xs">Status</TableHead><TableHead className="text-xs">Duration</TableHead><TableHead className="text-xs text-right">Records In</TableHead><TableHead className="text-xs text-right">Records Out</TableHead></TableRow></TableHeader>
                          <TableBody>
                            {jobDetails.tasks.map(task => (
                              <TableRow key={task.name}>
                                <TableCell className="font-mono text-xs">{task.name}</TableCell>
                                <TableCell>
                                  {task.status === 'completed' && <Badge className="bg-success text-success-foreground text-[10px]">Completed</Badge>}
                                  {task.status === 'running' && <Badge className="bg-primary text-primary-foreground text-[10px] gap-1"><div className="h-2 w-2 border border-primary-foreground border-t-transparent rounded-full animate-spin" />Running</Badge>}
                                  {task.status === 'pending' && <Badge variant="outline" className="text-[10px]">Pending</Badge>}
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
                  <div className="space-y-1">
                    {execSteps.map((es, i) => (
                      <div key={es} className="flex items-center gap-3 text-sm py-1">
                        {i < execStep ? <Check className="h-4 w-4 text-success" /> : i === execStep ? <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <div className="h-4 w-4 rounded-full border border-border" />}
                        <span className={i <= execStep ? 'text-foreground' : 'text-muted-foreground'}>{es}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="destructive" size="sm" className="gap-2" onClick={() => { setExecStatus('idle'); setJobDetails(null); }}><Square className="h-3.5 w-3.5" /> Stop</Button>
                  </div>
                </div>
              )}

              {execStatus === 'success' && (
                <div className="space-y-6">
                  <div className="text-center py-6">
                    <CheckCircle2 className="h-20 w-20 text-success mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-success">Pipeline Completed Successfully</h3>
                    <p className="text-muted-foreground mt-1">{pipelineName} — Table "{outputTableName}" written</p>
                  </div>
                  {jobDetails && (
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                      <div className="bg-muted/50 border rounded-lg p-3 text-center"><p className="text-xs text-muted-foreground">Job</p><p className="font-mono text-xs">{jobDetails.jobId}</p></div>
                      <div className="bg-muted/50 border rounded-lg p-3 text-center"><p className="text-xs text-muted-foreground">Cluster</p><p className="font-mono text-xs">{jobDetails.clusterId}</p></div>
                      <div className="bg-muted/50 border rounded-lg p-3 text-center"><p className="text-xs text-muted-foreground">Duration</p><p className="text-xs">{jobDetails.endTime ? `${Math.round((new Date(jobDetails.endTime).getTime() - new Date(jobDetails.startTime).getTime()) / 1000)}s` : '—'}</p></div>
                      <div className="bg-success/10 border border-success/20 rounded-lg p-3 text-center"><p className="text-xs text-muted-foreground">Written</p><p className="text-sm font-bold text-success">{totalValidRows.toLocaleString()}</p></div>
                      <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 text-center"><p className="text-xs text-muted-foreground">Rescued</p><p className="text-sm font-bold text-warning">{totalRescuedRows.toLocaleString()}</p></div>
                    </div>
                  )}
                  <div className="flex gap-3 justify-center">
                    <Button className="gap-2" onClick={() => toast.success('Downloading...')}><Download className="h-4 w-4" /> Download Output</Button>
                    <Button variant="outline" onClick={() => navigate('/pipelines')}>Go to Pipelines</Button>
                  </div>
                </div>
              )}

              {execLogs.length > 0 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Terminal className="h-4 w-4" /> Logs</CardTitle></CardHeader>
                  <CardContent>
                    <pre className="bg-background border rounded-md p-3 text-[10px] font-mono overflow-auto max-h-48">{execLogs.join('\n')}</pre>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Navigation */}
      {!activeLayer && !editingSourceId && (
        <div className="flex items-center justify-between border-t pt-4">
          <div>
            {step === 0 ? (
              <Button variant="outline" onClick={() => navigate('/pipelines')}>Cancel</Button>
            ) : step < 2 ? (
              <Button variant="outline" className="gap-2" onClick={() => setStep(step - 1)}><ArrowLeft className="h-4 w-4" /> Previous</Button>
            ) : null}
          </div>
          <div className="flex gap-2">
            {step === 0 && (
              <Button className="gap-2" disabled={!sourcesReady} onClick={() => setStep(1)}>
                Next: Review & Deploy <ArrowRight className="h-4 w-4" />
              </Button>
            )}
            {step === 1 && (
              <Button className="gap-2" disabled={!pipelineName || !outputTableName} onClick={() => setStep(2)}>
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

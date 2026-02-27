export type PipelineStatus = 'draft' | 'ready' | 'deployed' | 'failed' | 'running';

export interface Pipeline {
  id: string;
  name: string;
  description: string;
  status: PipelineStatus;
  owner: User;
  createdAt: string;
  updatedAt: string;
  lastExecution?: PipelineRun;
  environment: 'development' | 'production';
  notificationsEnabled: boolean;
  schema: SchemaColumn[];
  qualityRules: QualityRule[];
  transformations: Transformation[];
  config: Record<string, unknown>;
}

export interface PipelineRun {
  id: string;
  pipelineId: string;
  pipelineName: string;
  status: 'success' | 'failed' | 'warning' | 'running';
  startedAt: string;
  completedAt?: string;
  duration: string;
  rowsRead: number;
  rowsWritten: number;
  rowsQuarantined: number;
  logs?: string;
}

export interface SchemaColumn {
  id: string;
  name: string;
  type: ColumnType;
  nullable: boolean;
  unique: boolean;
  description: string;
  sensitive: boolean;
  sampleValues: string[];
}

export type ColumnType = 'STRING' | 'INTEGER' | 'DECIMAL' | 'DATE' | 'BOOLEAN' | 'TIMESTAMP';

export type QualityRuleType = 'not_null' | 'unique' | 'range' | 'regex' | 'values_in_set' | 'referential_integrity';
export type OnFailureAction = 'fail' | 'drop' | 'quarantine' | 'warn';

export interface QualityRule {
  id: string;
  type: QualityRuleType;
  columnId: string;
  columnName: string;
  config: Record<string, unknown>;
  onFailure: OnFailureAction;
}

export interface QuarantineRecord {
  id: string;
  pipelineId: string;
  pipelineName: string;
  tableName: string;
  rowCount: number;
  lastRejectionDate: string;
  mostViolatedRule: string;
  records: QuarantineRow[];
}

export interface QuarantineRow {
  id: string;
  data: Record<string, unknown>;
  quarantineReason: string;
  violatedRule: string;
  quarantineTimestamp: string;
}

export interface DataCatalogTable {
  id: string;
  name: string;
  database: string;
  environment: 'dev' | 'prod';
  layer: 'bronze' | 'silver' | 'gold' | 'quarantine';
  description: string;
  owner: string;
  createdAt: string;
  rowCount: number;
  sizeBytes: number;
  lastModified: string;
  columns: SchemaColumn[];
  tags: DataTag[];
}

export type DataTag = 'PII' | 'Public' | 'Internal';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: string;
}

export interface MetricCard {
  title: string;
  value: string | number;
  change: number;
  changeLabel: string;
  icon: string;
}

export type TransformationType =
  | 'rename'
  | 'cast'
  | 'filter'
  | 'aggregate'
  | 'join'
  | 'drop_column'
  | 'add_column'
  | 'split'
  | 'merge'
  | 'deduplicate'
  | 'sort'
  | 'custom_sql';

export interface Transformation {
  id: string;
  order: number;
  type: TransformationType;
  config: Record<string, unknown>;
  sourceColumns: string[];
  targetColumn?: string;
  description: string;
}

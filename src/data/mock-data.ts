import type { Pipeline, PipelineRun, SchemaColumn, QualityRule, QuarantineRecord, DataCatalogTable, User, Transformation } from '@/types';

export const currentUser: User = {
  id: '1',
  name: 'Faical Mohamed',
  email: 'faical.mohamed@deloitte.com',
  avatar: undefined,
  role: 'Data Engineer',
};

export type Notification = {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  read: boolean;
  createdAt: string;
  pipelineId?: string;
};

export const mockNotifications: Notification[] = [
  { id: 'n1', title: 'Pipeline Succeeded', message: 'Client Transactions ETL completed — 143,800 rows written', type: 'success', read: false, createdAt: '2025-02-26T06:12:00Z', pipelineId: 'p1' },
  { id: 'n2', title: 'Pipeline Failed', message: 'Regulatory Reporting failed after 5m — schema mismatch detected', type: 'error', read: false, createdAt: '2025-02-25T14:05:00Z', pipelineId: 'p3' },
  { id: 'n3', title: 'Quarantine Alert', message: 'Client Transactions ETL: 10,000 rows quarantined (6.7% rejection rate)', type: 'warning', read: false, createdAt: '2025-02-24T06:15:00Z', pipelineId: 'p1' },
  { id: 'n4', title: 'Pipeline Deployed', message: 'Customer Master Data successfully deployed to production', type: 'info', read: true, createdAt: '2025-02-24T10:00:00Z', pipelineId: 'p4' },
  { id: 'n5', title: 'Pipeline Succeeded', message: 'Risk Assessment Feed completed — 11,900 rows written', type: 'success', read: true, createdAt: '2025-02-23T08:03:00Z', pipelineId: 'p2' },
];

const users: User[] = [
  currentUser,
  { id: '2', name: 'Marc Dupont', email: 'marc.dupont@deloitte.com', role: 'Senior Analyst' },
  { id: '3', name: 'Emily Watson', email: 'emily.watson@deloitte.com', role: 'Tech Lead' },
  { id: '4', name: 'Ahmed Khalil', email: 'ahmed.khalil@deloitte.com', role: 'Data Engineer' },
];

export const mockTransformations: Transformation[] = [
  { id: 't1', order: 1, type: 'filter', config: { condition: "status != 'cancelled'" }, sourceColumns: ['status'], description: "Filter out cancelled transactions" },
  { id: 't2', order: 2, type: 'cast', config: { targetType: 'DECIMAL' }, sourceColumns: ['amount'], targetColumn: 'amount', description: "Cast amount to DECIMAL" },
  { id: 't3', order: 3, type: 'rename', config: { newName: 'txn_date' }, sourceColumns: ['transaction_date'], targetColumn: 'txn_date', description: "Rename transaction_date to txn_date" },
  { id: 't4', order: 4, type: 'add_column', config: { expression: "CONCAT(client_id, '-', transaction_id)" }, sourceColumns: ['client_id', 'transaction_id'], targetColumn: 'composite_key', description: "Create composite key" },
  { id: 't5', order: 5, type: 'aggregate', config: { groupBy: ['client_id'], aggregations: [{ column: 'amount', func: 'SUM', alias: 'total_amount' }] }, sourceColumns: ['client_id', 'amount'], targetColumn: 'total_amount', description: "Aggregate total amount by client" },
];

export const mockPipelines: Pipeline[] = [
  {
    id: 'p1', name: 'Client Transactions ETL', description: 'Daily client transaction ingestion from SFTP', status: 'deployed',
    owner: users[0], createdAt: '2024-11-15T10:00:00Z', updatedAt: '2025-02-20T14:30:00Z', environment: 'production', notificationsEnabled: true,
    schema: [], qualityRules: [], transformations: mockTransformations.slice(0, 3), config: {},
    lastExecution: { id: 'r1', pipelineId: 'p1', pipelineName: 'Client Transactions ETL', status: 'success', startedAt: '2025-02-26T06:00:00Z', completedAt: '2025-02-26T06:12:00Z', duration: '12m', rowsRead: 145200, rowsWritten: 143800, rowsQuarantined: 1400 },
  },
  {
    id: 'p2', name: 'Risk Assessment Feed', description: 'Hourly risk scoring data pipeline', status: 'running',
    owner: users[1], createdAt: '2024-12-01T09:00:00Z', updatedAt: '2025-02-26T08:00:00Z', environment: 'production', notificationsEnabled: true,
    schema: [], qualityRules: [], transformations: mockTransformations.slice(0, 2), config: {},
    lastExecution: { id: 'r2', pipelineId: 'p2', pipelineName: 'Risk Assessment Feed', status: 'running', startedAt: '2025-02-26T08:00:00Z', duration: '—', rowsRead: 0, rowsWritten: 0, rowsQuarantined: 0 },
  },
  {
    id: 'p3', name: 'Regulatory Reporting', description: 'Monthly regulatory compliance data', status: 'failed',
    owner: users[2], createdAt: '2025-01-10T11:00:00Z', updatedAt: '2025-02-25T15:00:00Z', environment: 'production', notificationsEnabled: true,
    schema: [], qualityRules: [], transformations: [mockTransformations[0]], config: {},
    lastExecution: { id: 'r3', pipelineId: 'p3', pipelineName: 'Regulatory Reporting', status: 'failed', startedAt: '2025-02-25T14:00:00Z', completedAt: '2025-02-25T14:05:00Z', duration: '5m', rowsRead: 50000, rowsWritten: 0, rowsQuarantined: 0 },
  },
  {
    id: 'p4', name: 'Customer Master Data', description: 'Customer reference data synchronization', status: 'deployed',
    owner: users[0], createdAt: '2025-01-20T08:00:00Z', updatedAt: '2025-02-24T10:00:00Z', environment: 'development', notificationsEnabled: false,
    schema: [], qualityRules: [], transformations: mockTransformations, config: {},
    lastExecution: { id: 'r4', pipelineId: 'p4', pipelineName: 'Customer Master Data', status: 'success', startedAt: '2025-02-24T09:00:00Z', completedAt: '2025-02-24T09:08:00Z', duration: '8m', rowsRead: 89000, rowsWritten: 88500, rowsQuarantined: 500 },
  },
  {
    id: 'p5', name: 'Market Data Ingestion', description: 'Real-time market data feed processing', status: 'ready',
    owner: users[3], createdAt: '2025-02-10T14:00:00Z', updatedAt: '2025-02-22T16:00:00Z', environment: 'development', notificationsEnabled: false,
    schema: [], qualityRules: [], transformations: [], config: {},
  },
  {
    id: 'p6', name: 'AML Screening Pipeline', description: 'Anti-money laundering screening data', status: 'draft',
    owner: users[1], createdAt: '2025-02-20T10:00:00Z', updatedAt: '2025-02-20T10:00:00Z', environment: 'development', notificationsEnabled: false,
    schema: [], qualityRules: [], transformations: [], config: {},
  },
];

export const mockRuns: PipelineRun[] = [
  { id: 'r1', pipelineId: 'p1', pipelineName: 'Client Transactions ETL', status: 'success', startedAt: '2025-02-26T06:00:00Z', completedAt: '2025-02-26T06:12:00Z', duration: '12m', rowsRead: 145200, rowsWritten: 143800, rowsQuarantined: 1400 },
  { id: 'r2', pipelineId: 'p2', pipelineName: 'Risk Assessment Feed', status: 'running', startedAt: '2025-02-26T08:00:00Z', duration: '—', rowsRead: 0, rowsWritten: 0, rowsQuarantined: 0 },
  { id: 'r3', pipelineId: 'p3', pipelineName: 'Regulatory Reporting', status: 'failed', startedAt: '2025-02-25T14:00:00Z', completedAt: '2025-02-25T14:05:00Z', duration: '5m', rowsRead: 50000, rowsWritten: 0, rowsQuarantined: 0 },
  { id: 'r5', pipelineId: 'p1', pipelineName: 'Client Transactions ETL', status: 'success', startedAt: '2025-02-25T06:00:00Z', completedAt: '2025-02-25T06:11:00Z', duration: '11m', rowsRead: 142000, rowsWritten: 141500, rowsQuarantined: 500 },
  { id: 'r6', pipelineId: 'p4', pipelineName: 'Customer Master Data', status: 'success', startedAt: '2025-02-24T09:00:00Z', completedAt: '2025-02-24T09:08:00Z', duration: '8m', rowsRead: 89000, rowsWritten: 88500, rowsQuarantined: 500 },
  { id: 'r7', pipelineId: 'p1', pipelineName: 'Client Transactions ETL', status: 'warning', startedAt: '2025-02-24T06:00:00Z', completedAt: '2025-02-24T06:15:00Z', duration: '15m', rowsRead: 150000, rowsWritten: 140000, rowsQuarantined: 10000 },
  { id: 'r8', pipelineId: 'p3', pipelineName: 'Regulatory Reporting', status: 'success', startedAt: '2025-02-23T14:00:00Z', completedAt: '2025-02-23T14:10:00Z', duration: '10m', rowsRead: 48000, rowsWritten: 47800, rowsQuarantined: 200 },
  { id: 'r9', pipelineId: 'p2', pipelineName: 'Risk Assessment Feed', status: 'success', startedAt: '2025-02-23T08:00:00Z', completedAt: '2025-02-23T08:03:00Z', duration: '3m', rowsRead: 12000, rowsWritten: 11900, rowsQuarantined: 100 },
];

export const mockExecutionHistory = [
  { date: '2025-02-20', success: 8, failures: 1 },
  { date: '2025-02-21', success: 10, failures: 0 },
  { date: '2025-02-22', success: 7, failures: 2 },
  { date: '2025-02-23', success: 9, failures: 1 },
  { date: '2025-02-24', success: 11, failures: 0 },
  { date: '2025-02-25', success: 8, failures: 2 },
  { date: '2025-02-26', success: 6, failures: 0 },
];

export const mockQuarantine: QuarantineRecord[] = [
  { id: 'q1', pipelineId: 'p1', pipelineName: 'Client Transactions ETL', tableName: 'quarantine_transactions', rowCount: 1400, lastRejectionDate: '2025-02-26T06:12:00Z', mostViolatedRule: 'expect_not_null(amount)', records: [] },
  { id: 'q2', pipelineId: 'p4', pipelineName: 'Customer Master Data', tableName: 'quarantine_customers', rowCount: 500, lastRejectionDate: '2025-02-24T09:08:00Z', mostViolatedRule: 'expect_regex(email)', records: [] },
  { id: 'q3', pipelineId: 'p1', pipelineName: 'Client Transactions ETL', tableName: 'quarantine_transactions_range', rowCount: 10000, lastRejectionDate: '2025-02-24T06:15:00Z', mostViolatedRule: 'expect_range(amount, 0, 1000000)', records: [] },
];

export const mockCatalogTables: DataCatalogTable[] = [
  { id: 'ct1', name: 'bronze_transactions', database: 'finance_db', environment: 'prod', layer: 'bronze', description: 'Raw transaction data', owner: 'Sarah Chen', createdAt: '2024-11-15', rowCount: 2500000, sizeBytes: 1073741824, lastModified: '2025-02-26', columns: [], tags: ['Internal'] },
  { id: 'ct2', name: 'silver_transactions', database: 'finance_db', environment: 'prod', layer: 'silver', description: 'Cleaned transaction data', owner: 'Sarah Chen', createdAt: '2024-11-15', rowCount: 2480000, sizeBytes: 953641824, lastModified: '2025-02-26', columns: [], tags: ['Internal'] },
  { id: 'ct3', name: 'gold_transactions', database: 'finance_db', environment: 'prod', layer: 'gold', description: 'Aggregated transaction metrics', owner: 'Sarah Chen', createdAt: '2024-11-15', rowCount: 150000, sizeBytes: 104857600, lastModified: '2025-02-26', columns: [], tags: ['Internal'] },
  { id: 'ct4', name: 'bronze_customers', database: 'customer_db', environment: 'prod', layer: 'bronze', description: 'Raw customer master data', owner: 'Emily Watson', createdAt: '2025-01-20', rowCount: 89000, sizeBytes: 52428800, lastModified: '2025-02-24', columns: [], tags: ['PII'] },
  { id: 'ct5', name: 'silver_customers', database: 'customer_db', environment: 'prod', layer: 'silver', description: 'Validated customer data', owner: 'Emily Watson', createdAt: '2025-01-20', rowCount: 88500, sizeBytes: 50331648, lastModified: '2025-02-24', columns: [], tags: ['PII'] },
];

export const mockSchemaColumns: SchemaColumn[] = [
  { id: 'c1', name: 'transaction_id', type: 'STRING', nullable: false, unique: true, description: 'Unique transaction identifier', sensitive: false, sampleValues: ['TXN-001', 'TXN-002', 'TXN-003'] },
  { id: 'c2', name: 'client_id', type: 'STRING', nullable: false, unique: false, description: 'Client reference', sensitive: false, sampleValues: ['CLT-100', 'CLT-200', 'CLT-300'] },
  { id: 'c3', name: 'amount', type: 'DECIMAL', nullable: false, unique: false, description: 'Transaction amount in EUR', sensitive: false, sampleValues: ['1500.00', '250.50', '99999.99'] },
  { id: 'c4', name: 'transaction_date', type: 'DATE', nullable: false, unique: false, description: 'Date of transaction', sensitive: false, sampleValues: ['2025-01-15', '2025-01-16', '2025-01-17'] },
  { id: 'c5', name: 'client_name', type: 'STRING', nullable: true, unique: false, description: 'Full name of the client', sensitive: true, sampleValues: ['Jean Dupont', 'Marie Martin', 'Pierre Durand'] },
  { id: 'c6', name: 'email', type: 'STRING', nullable: true, unique: false, description: 'Client email address', sensitive: true, sampleValues: ['jean@example.com', 'marie@test.fr', 'pierre@mail.com'] },
  { id: 'c7', name: 'status', type: 'STRING', nullable: false, unique: false, description: 'Transaction status', sensitive: false, sampleValues: ['completed', 'pending', 'cancelled'] },
  { id: 'c8', name: 'is_verified', type: 'BOOLEAN', nullable: false, unique: false, description: 'Verification flag', sensitive: false, sampleValues: ['true', 'false', 'true'] },
];

export const availableTransformationTypes = [
  { type: 'rename', label: 'Rename Column', description: 'Change column name' },
  { type: 'cast', label: 'Cast Type', description: 'Change column data type' },
  { type: 'filter', label: 'Filter Rows', description: 'Filter rows by condition' },
  { type: 'aggregate', label: 'Aggregate', description: 'Group by and aggregate' },
  { type: 'join', label: 'Join Tables', description: 'Join with another table' },
  { type: 'drop_column', label: 'Drop Column', description: 'Remove a column' },
  { type: 'add_column', label: 'Add Column', description: 'Create derived column' },
  { type: 'split', label: 'Split Column', description: 'Split into multiple columns' },
  { type: 'merge', label: 'Merge Columns', description: 'Concatenate columns' },
  { type: 'deduplicate', label: 'Deduplicate', description: 'Remove duplicate rows' },
  { type: 'sort', label: 'Sort', description: 'Order rows by column' },
  { type: 'custom_sql', label: 'Custom SQL', description: 'Write custom SQL expression' },
] as const;

export const mockFirstRow: Record<string, string> = {
  transaction_id: 'TXN-001',
  client_id: 'CLT-100',
  amount: '1500.00',
  transaction_date: '2025-01-15',
  client_name: 'Jean Dupont',
  email: 'jean@example.com',
  status: 'completed',
  is_verified: 'true',
};

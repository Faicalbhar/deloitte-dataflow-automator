

## Deloitte Data Pipeline Automation Platform

### Phase 1: Foundation & Design System
- Set up Deloitte color palette (#86BC25 primary green, #000000 text, #7D7D7D secondary, #FFFFFF backgrounds) in Tailwind/CSS variables
- Configure Inter font as the default typography
- Create reusable UI components following Deloitte branding: styled buttons (primary green, secondary, danger), inputs with green focus states, status badges, metric cards, and styled data tables with alternating rows
- Build the main layout with collapsible sidebar navigation (Dashboard, Pipelines, Create Pipeline, Data Catalog, Quarantine, Settings, Documentation) and top header with "Deloitte." text logo, page title, notifications, and user profile dropdown

### Phase 2: Authentication
- Build login page with centered white card on light gray background, Deloitte logo, email/password fields (with show/hide toggle), "Forgot password?" link, green login button with loading state, error alerts, and copyright footer
- Implement mock auth context with protected routes

### Phase 3: Dashboard
- Metrics grid: Total Active Pipelines, Pipelines Executed Today, Global Success Rate, Data Volume Processed — each with icon, large value, and trend indicator (green/red arrow)
- Line chart (Recharts) showing 7-day execution history (success vs failures)
- Recent executions list with status indicators (green/red/orange dots), pipeline name, time, duration
- "Attention needed" table for failed pipelines with "View Details" action
- Floating "+ New Pipeline" green button

### Phase 4: Pipelines List Page
- Professional data table with columns: Name (clickable), Status (colored badge: Draft/Ready/Deployed/Failed/Running), Last Execution (relative time), Owner (avatar), Actions (edit/duplicate/run/delete)
- Toolbar with search field, multi-select status filter, and "Create Pipeline" button
- Sort on all columns, pagination
- Empty state with illustration and CTA
- Right-side drawer for pipeline details on row click

### Phase 5: Pipeline Creation Wizard (4 Steps)
**Step 1 — Contract Upload:**
- Visual progress bar (4 steps)
- Drag-and-drop zone for Excel files (.xlsx/.xls, max 10MB) with hover effects
- Template download link with explanation
- Post-upload summary: sources detected, columns count, validation status
- File mask input field with contextual help
- Cancel / Next navigation (Next disabled until valid)

**Step 2 — Schema Validation:**
- Interactive table of extracted columns: name, detected type (colored badge), constraints (NOT_NULL/UNIQUE icons), sample values
- Editable type dropdown, description field, PII "sensitive" toggle per column
- Source info header with "Test Connection" button and success/failure indicator
- Expandable data preview (first 10 rows)
- Previous / Save as Draft / Next buttons

**Step 3 — Quality Checks Configuration:**
- Left panel (25%): Palette of draggable quality check cards (Not Null, Unique, Range, Regex, Values In Set, Referential Integrity) with distinctive colors and hover descriptions
- Center panel (50%): Column cards with drop zones; dropped rules appear as badges
- Right panel (25%): Contextual configurator per rule (min/max for Range, pattern for Regex, values for Set), "On Failure" action (Fail/Drop/Quarantine/Warn), impact preview
- Bottom summary: Bronze → Silver → Gold flow with rule counts per stage
- "Simulate on Sample" button opening results modal (conformity table, pie chart, alerts)

**Step 4 — Review & Deploy:**
- 3 tabs: Configuration (formatted JSON with syntax highlighting), Preview Code (Python DLT code, read-only), Execution Plan (visual Bronze→Silver→Gold diagram)
- Resource summary table (Delta tables, job, cluster)
- Pipeline name input, description, environment toggle (Dev/Prod), notifications checkbox
- Deploy confirmation modal with name re-entry
- Deployment progress modal with step-by-step status (Validating → Generating → Creating → Deploying → Testing → Completed)
- Success redirect or error display with Retry/Edit options

### Phase 6: Pipeline Detail Page
- Header with pipeline name, status badge, action buttons (Run Now, Edit, Duplicate, Delete)
- Tabs: Overview (real-time metrics grid + execution chart + quality trends), Runs History (detailed table with View Logs), Configuration (JSON view + rules table + deployment info), Quarantine Data (paginated rejected rows with filters, export CSV, reprocess button), Settings

### Phase 7: Data Catalog
- Explorer layout: left sidebar with hierarchy (env → database → tables)
- Main panel: table metadata, schema, data preview (10 rows), statistics, visual lineage graph
- Global search across table names and descriptions
- Tagging system (PII, Public, Internal) with colored badges

### Phase 8: Centralized Quarantine Page
- Aggregated table: source pipeline, quarantine table, rejected row count, last rejection date, most violated rule
- Filters by pipeline, period, rule type
- Bar chart: top 10 most violated rules
- Timeline chart: quarantine volume evolution
- "Generate Report" export button

### Phase 9: Settings Page
- Tabs: Profile (personal info, password change), Notifications (email preferences for success/failure/quarantine threshold), API Keys (generate/revoke), Preferences (light/dark theme toggle, language)
- Toast confirmations on save

### Technical Foundation (Throughout)
- TypeScript interfaces for all domain objects (Pipeline, PipelineRun, QualityRule, SchemaColumn, etc.)
- Mock data service layer ready for FastAPI integration
- React Query for state management with caching
- React Hook Form + Zod for form validation
- Mock auth with JWT interceptor pattern
- Responsive design: collapsible sidebar on mobile, responsive grids


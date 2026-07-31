-- Experiments schema alignment.
-- 0015 creates the base experiments table (project-scoped only).
-- This migration adds the columns the code expects (ExperimentRepository).
ALTER TABLE experiments ADD COLUMN organization_id TEXT;
ALTER TABLE experiments ADD COLUMN dataset_id TEXT;
ALTER TABLE experiments ADD COLUMN benchmark_id TEXT;
ALTER TABLE experiments ADD COLUMN deleted_at TEXT;

CREATE INDEX IF NOT EXISTS idx_experiments_org ON experiments(organization_id);
CREATE INDEX IF NOT EXISTS idx_experiments_project ON experiments(project_id);
CREATE INDEX IF NOT EXISTS idx_experiments_status ON experiments(status);

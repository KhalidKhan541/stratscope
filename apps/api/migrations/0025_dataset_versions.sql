-- Dataset versions schema alignment.
-- 0017 creates the base dataset_versions table (version INTEGER).
-- This migration adds the columns the code expects (DatasetVersionRepository).
ALTER TABLE dataset_versions ADD COLUMN organization_id TEXT;
ALTER TABLE dataset_versions ADD COLUMN status TEXT NOT NULL DEFAULT 'validating';
ALTER TABLE dataset_versions ADD COLUMN filters TEXT NOT NULL DEFAULT '{}';
ALTER TABLE dataset_versions ADD COLUMN updated_at TEXT;

CREATE INDEX IF NOT EXISTS idx_dataset_versions_dataset ON dataset_versions(dataset_id);
CREATE INDEX IF NOT EXISTS idx_dataset_versions_status ON dataset_versions(status);

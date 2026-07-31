-- Research agents schema alignment.
-- 0021 creates the base research_agents table without project_id/capabilities/deleted_at.
-- This migration aligns the table with the schema the code expects.
ALTER TABLE research_agents ADD COLUMN project_id TEXT;
ALTER TABLE research_agents ADD COLUMN capabilities TEXT NOT NULL DEFAULT '[]';
ALTER TABLE research_agents ADD COLUMN deleted_at TEXT;

CREATE INDEX IF NOT EXISTS idx_research_agents_org ON research_agents(organization_id);
CREATE INDEX IF NOT EXISTS idx_research_agents_project ON research_agents(project_id);
CREATE INDEX IF NOT EXISTS idx_research_agents_status ON research_agents(status);

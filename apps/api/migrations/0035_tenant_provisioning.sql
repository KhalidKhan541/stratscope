-- Tenant provisioning: contact requests that issue an API key now create
-- a fully isolated org/project/agent/user/key. These columns record what
-- was provisioned so support/audit can trace the tenant.
ALTER TABLE contact_requests ADD COLUMN organization_id TEXT;
ALTER TABLE contact_requests ADD COLUMN project_id TEXT;
ALTER TABLE contact_requests ADD COLUMN agent_id TEXT;
ALTER TABLE contact_requests ADD COLUMN user_id TEXT;
ALTER TABLE contact_requests ADD COLUMN api_key_id TEXT;

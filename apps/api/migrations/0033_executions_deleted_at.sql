-- Add soft-delete support to executions (used by dashboard + access reads).
ALTER TABLE executions ADD COLUMN deleted_at TEXT;

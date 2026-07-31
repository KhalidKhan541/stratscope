4. Database Schema

Postgres

Organizations

Projects

Users

Agents

Workflows

Executions

Events

Evaluations

Experiments

PromptVersions

ToolCalls

Feedback

Datasets

Dataset

id, organization_id, project_id, name, description, category, status, version, parent_dataset_id, record_count, schema_definition, filters, tags, export_formats, storage_path, checksum, metadata, created_at, updated_at

Dataset Versions

DatasetVersion

id, dataset_id, version, record_count, schema_definition, storage_path, checksum, change_summary, metadata, created_at

Dataset Exports

DatasetExport

id, dataset_id, organization_id, format, status, storage_path, file_size_bytes, record_count, checksum, error, metadata, created_at, completed_at

Benchmarks

Benchmark

id, organization_id, project_id, name, description, benchmark_type, status, entries, dataset_id, config, results, started_at, completed_at, created_at, updated_at

Corpora

Corpus

id, organization_id, project_id, name, description, status, dataset_ids, benchmark_ids, tags, version, metadata, created_at, updated_at

Research Agents

ResearchAgent

id, organization_id, agent_type, name, description, config, status, last_execution_at, execution_count, created_at, updated_at

APIKeys

Billing

Invoices

Executions

id

organization_id

workflow_id

agent_id

status

start_time

end_time

latency

cost

tokens

model

confidence

created_at

Events

id

execution_id

type

payload

timestamp

Evaluation

execution_id

accuracy

cost

latency

hallucination_score

goal_completion

summary
Knowledge Graph

Nodes

Agent

Prompt

Workflow

Customer

Document

Tool

Execution

Task

Memory

Failure

Success

Edges

USED

FAILED

GENERATED

CORRECTED

REFERENCES

IMPROVED

SIMILAR

BELONGS_TO
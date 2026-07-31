Volume 5
Data Architecture & Database Design

Version: 1.0

Category: AI Execution Intelligence Platform

Status: Internal Engineering Specification

Table of Contents
1. Philosophy

2. Data Architecture

3. Storage Strategy

4. Database Selection

5. Execution Intelligence Pipeline Storage

6. SQL Schema

7. Event Schema

8. Knowledge Graph

9. Vector Memory

10. Object Storage

11. Indexing Strategy

12. Future Migration
Philosophy

Most AI platforms store conversations.

StratScope stores experience.

Every execution becomes an immutable asset.

Nothing is overwritten.

Knowledge accumulates forever.

Think of Git.

Git never edits history.

It creates commits.

Execution Intelligence works the same way.

Storage Philosophy

Different kinds of data belong in different databases.

Trying to store everything in SQL creates bottlenecks.

Instead we use the right storage engine for each responsibility.

                    StratScope

      ┌─────────────────────────────────┐

      │                                 │

      ▼                                 ▼

 Relational Data                 Execution Data

      │                                 │

      ▼                                 ▼

Cloudflare D1                 Cloudflare Queues

      │                                 │

      ▼                                 ▼

 Organization DB             Event Pipeline

      │                                 │

      └──────────────┬──────────────────┘

                     ▼

          Execution Intelligence Pipeline

                     ▼

     ┌───────────────┴────────────────┐

     ▼                                ▼

Knowledge Graph                 Vector Memory

     ▼                                ▼

 Neo4j (Future)            Vectorize (MVP)

     ▼                                ▼

          Dashboard & API
Why Cloudflare?

For MVP we optimize for:

speed
low cost
serverless deployment
edge latency

Cloudflare gives us:

Workers
D1
Queues
KV
R2
Durable Objects
Vectorize

without DevOps complexity.

Database Responsibilities
Cloudflare D1

Stores structured business data.

Never store embeddings here.

Never store giant prompts here.

Tables include:

Organizations

Projects

Users

Agents

Executions

API Keys

Billing

Feedback

Evaluations

Experiments

Cloudflare R2

Stores large objects.

Examples

Full prompt history

LLM responses

Replay payloads

Logs

Exports

Screenshots

Attachments

Artifacts

Cloudflare KV

Stores

Feature Flags

Rate Limits

Configuration

Temporary Sessions

API Cache

Cloudflare Queues

Every execution becomes messages.

Execution

↓

Queue

↓

Normalization

↓

Evaluation

↓

Reflection

↓

Knowledge Extraction

↓

Learning

↓

Optimization
Execution Intelligence Pipeline

This is the heart of StratScope.

Every stage consumes an artifact and produces a richer artifact.

Stage	Input	Output
Normalization	Raw SDK payload	Canonical Execution Record
Evaluation	Execution Record	Evaluation Report
Reflection	Evaluation Report	Reflection Report
Knowledge Extraction	Reflection Report	Knowledge Facts
Learning	Knowledge Facts	Learned Patterns
Optimization	Learned Patterns	Recommendations

Nothing skips stages.

Each stage is versioned.

Each stage is replayable.

Each stage is independently testable.

SQL Database Schema
Organizations
Organization

id

name

slug

plan

created_at

updated_at
Projects
Project

id

organization_id

name

environment

created_at
Users
User

id

organization_id

email

role

status

created_at
API Keys
APIKey

id

project_id

key_hash

permissions

last_used

created_at
Agents
Agent

id

project_id

name

framework

provider

version

created_at
Executions

This is the most important table.

Execution

id

organization_id

project_id

agent_id

status

model

provider

started_at

finished_at

latency_ms

tokens_input

tokens_output

total_tokens

estimated_cost

pipeline_version

sdk_version

trace_id

parent_execution

created_at

Notice there is no mutable execution state beyond lifecycle fields. Historical facts remain immutable.

Evaluations
Evaluation

id

execution_id

accuracy

goal_completion

hallucination_score

confidence

cost_efficiency

latency_score

evaluation_model

created_at
Reflections
Reflection

id

execution_id

summary

strengths

weaknesses

recommendations

confidence

reflection_model

created_at
Learning Records
LearningRecord

id

execution_id

pattern

frequency

severity

suggestion

created_at
Feedback
Feedback

id

execution_id

user_id

rating

comment

resolved
created_at

Datasets

Dataset

- id
- organization_id
- project_id
- name
- description
- category (failure/reasoning/tool_selection/model_routing/prompt_improvement/reflection/evaluation/knowledge/coding/planning/research)
- status (building/validating/ready/archived)
- version
- parent_dataset_id
- record_count
- schema_definition (JSON)
- filters (JSON)
- tags (JSON array)
- export_formats (JSON array)
- storage_path
- checksum
- metadata (JSON)
- created_at
- updated_at

Dataset Versions

DatasetVersion

- id
- dataset_id
- version
- record_count
- schema_definition (JSON)
- storage_path
- checksum
- change_summary
- metadata (JSON)
- created_at

Dataset Exports

DatasetExport

- id
- dataset_id
- organization_id
- format (jsonl/parquet/csv/arrow/rest)
- status (pending/processing/completed/failed)
- storage_path
- file_size_bytes
- record_count
- checksum
- error
- metadata (JSON)
- created_at
- completed_at

Benchmarks

Benchmark

- id
- organization_id
- project_id
- name
- description
- benchmark_type (model_comparison/tool_comparison/latency_comparison/cost_comparison/success_rate/hallucination_rate/agent_comparison/execution_quality)
- status (draft/running/completed/failed)
- entries (JSON array)
- dataset_id
- config (JSON)
- results (JSON)
- started_at
- completed_at
- created_at
- updated_at

Corpora

Corpus

- id
- organization_id
- project_id
- name
- description
- status (draft/published/archived)
- dataset_ids (JSON array)
- benchmark_ids (JSON array)
- tags (JSON array)
- version
- metadata (JSON)
- created_at
- updated_at

Research Agents

ResearchAgent

- id
- organization_id
- agent_type (research/coding/browser/qa/planning/documentation/evaluation)
- name
- description
- config (JSON)
- status (active/inactive)
- last_execution_at
- execution_count
- created_at
- updated_at

Event Store

Every execution creates dozens of events.

Event

id

execution_id

event_type

service

payload

metadata

timestamp

schema_version

Event Types

ExecutionStarted

PromptPrepared

PromptSent

ModelInvoked

ModelReturned

ToolSelected

ToolExecuted

ToolFailed

MemoryRead

MemoryWritten

EvaluationStarted

EvaluationCompleted

ReflectionStarted

ReflectionCompleted

KnowledgeExtracted

LearningGenerated

OptimizationSuggested

ExecutionFinished

Events are append-only.

Never UPDATE.

Never DELETE.

Knowledge Graph

In the MVP, represent graph relationships in D1 to reduce operational complexity. When graph queries become a bottleneck, migrate the Knowledge Service to a dedicated graph database without changing the public API.

Nodes:

Organization

Project

Agent

Workflow

Execution

Prompt

Tool

Model

Memory

Recommendation

Failure

Success

Pattern

Document

Dataset

Benchmark

Corpus

Relationships:

USED

GENERATED

FAILED

CORRECTED

BELONGS_TO

REFERENCES

SIMILAR_TO

LEARNED_FROM

OPTIMIZES
EXECUTED_BY

GENERATED_FROM

COMPARED_IN

INCLUDED_IN

Vector Memory

Every important artifact becomes searchable.

Embed:

prompts
responses
reflections
recommendations
documentation
user feedback

Store metadata separately in D1.

Store vectors in Vectorize behind an abstraction layer.

Object Storage

Everything too large for SQL belongs in R2.

Examples:

Replay files

Prompt templates

Response archives

Knowledge exports

Training datasets

Attachments

Execution recordings
Indexing Strategy

Create indexes for common queries from day one.

Executions:

organization_id
project_id
started_at
status
trace_id

Events:

execution_id
event_type
timestamp

Evaluations:

execution_id
created_at

Feedback:

execution_id
rating

Datasets:

- organization_id
- project_id
- category
- status
- created_at

Benchmarks:

- organization_id
- project_id
- benchmark_type
- status
- created_at

Corpora:

- organization_id
- project_id
- status
- created_at

Dataset Exports:

- dataset_id
- organization_id
- status

Design indexes around real dashboard queries, not hypothetical ones.

Data Retention

Execution history is never modified.

Retention policies apply only to large artifacts stored in R2, according to customer configuration.

Customers can export all data at any time.

Migration Strategy

The architecture assumes growth.

Potential future migrations:

D1 → PostgreSQL-compatible managed database (if scale requires)
Vectorize → Dedicated vector database
Graph layer → Dedicated graph database
Queue workers → Dedicated compute for high-volume processing

These changes should occur behind service interfaces so customers and SDKs remain unaffected.

Data Architecture Principles
Every execution is immutable.
Every stage in the Execution Intelligence Pipeline produces a durable artifact.
Business data, events, vectors, and large objects have distinct storage responsibilities.
Services own their data and expose APIs instead of sharing databases.
Infrastructure is replaceable; interfaces are stable.
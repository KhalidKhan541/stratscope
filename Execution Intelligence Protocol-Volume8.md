Execution Intelligence Protocol (EIP)

Category: AI Execution Intelligence Platform

Protocol Version: 1.0

Status: Public Specification

Compatible With: Execution Intelligence Operating System (EIOS)

1. Purpose

The Execution Intelligence Protocol defines the universal language between:

SDKs
Applications
Agent Frameworks
AI Providers
StratScope Cloud
Enterprise Installations
Future Third-Party Plugins

Any system implementing EIP can communicate with StratScope.

Think of:

HTTP for the Web
Git Protocol for Git
OpenTelemetry for telemetry

EIP is the protocol for AI execution intelligence.

2. Design Principles

Every request must be:

Stateless
Idempotent where possible
Versioned
Authenticated
Traceable
Replayable

No endpoint should depend on hidden session state.

3. Authentication

Supported methods:

API Keys

Future:

OAuth

OIDC

Enterprise SSO

Every request includes

Authorization: Bearer <API_KEY>

X-Organization-ID

X-Project-ID

X-SDK-Version

X-EIP-Version

Trace-ID
4. API Resources

Everything revolves around resources.

Organizations

Projects

Agents

Executions

Artifacts

Events

Evaluations

Reflections

Knowledge

Recommendations

Experiments

API Keys

Datasets

Benchmarks

Corpora

Dataset Exports

Research Agents

Users
5. Execution Lifecycle API
POST /v1/executions

Creates an execution.

Returns

execution_id
trace_id
accepted_at
status

Update execution

PATCH /v1/executions/{id}

Allowed operations

status

metadata

Execution payloads remain immutable.

Complete execution

POST /v1/executions/{id}/complete

Triggers

Evaluation

Reflection

Learning

Optimization

Replay execution

POST /v1/executions/{id}/replay

Options

Different Model

Different Prompt

Different Pipeline Version

Different Reflection Engine

Replay never modifies the original execution.

6. Artifact API

List artifacts

GET /v1/executions/{id}/artifacts

Retrieve

GET /v1/artifacts/{artifact_id}

Artifact types

Execution

Evaluation

Reflection

Knowledge

Learning

Optimization

Recommendation
7. Event API

Publish event

POST /v1/events

Retrieve events

GET /v1/executions/{id}/events

Streaming

GET /v1/events/stream

Future

WebSocket

Server Sent Events
8. Knowledge API

Retrieve learned knowledge

GET /v1/knowledge

Search

GET /v1/knowledge/search

Graph traversal

POST /v1/knowledge/query

Future

GraphQL

9. Recommendation API
GET /v1/recommendations

Filter

Agent

Project

Execution

Priority

Confidence

Apply recommendation

POST /v1/recommendations/{id}/apply

Initially requires explicit user approval.

10. Evaluation API
GET /v1/evaluations

Retrieve

GET /v1/evaluations/{id}

Compare

POST /v1/evaluations/compare
11. Reflection API
GET /v1/reflections

Retrieve

GET /v1/reflections/{id}

Generate

POST /v1/reflections

Supports regeneration using newer models while preserving historical artifacts.

12. Dataset API

Create dataset

POST /v1/datasets

List datasets

GET /v1/datasets

Retrieve dataset

GET /v1/datasets/{id}

Validate dataset

POST /v1/datasets/{id}/validate

Export dataset

POST /v1/datasets/{id}/export

List dataset versions

GET /v1/datasets/{id}/versions

13. Benchmark API

Create benchmark

POST /v1/benchmarks

List benchmarks

GET /v1/benchmarks

Retrieve benchmark

GET /v1/benchmarks/{id}

Run benchmark

POST /v1/benchmarks/{id}/run

14. Corpus API

Create corpus

POST /v1/corpora

List corpora

GET /v1/corpora

Retrieve corpus

GET /v1/corpora/{id}

Publish corpus

POST /v1/corpora/{id}/publish

Add dataset to corpus

POST /v1/corpora/{id}/datasets

15. Research API

Research overview

GET /v1/research/overview

Search across datasets, benchmarks, corpora

GET /v1/research/search?q={query}

16. Webhooks

Organizations can subscribe to events.

Examples

Execution Completed

Reflection Generated

Recommendation Published

Pipeline Failed

Agent Registered

Project Created

Delivery guarantees

At Least Once

Retries use exponential backoff.

13. SDK Protocol

Every SDK must implement

Create Execution

Start Span

End Span

Record Event

Record Tool Call

Record Model Call

Record Memory Read

Record Memory Write

Complete Execution

The SDK speaks EIP regardless of language.

14. Provider Protocol

Every model provider adapter must implement

Generate

Stream

Embeddings

Health Check

Token Counting

Cost Estimation

Future capabilities

Tool Calling

Reasoning Tokens

Structured Output

Vision

Audio

Video
15. Plugin Protocol

Every plugin receives

Artifact

Metadata

Execution Context

Every plugin returns

Artifact

Recommendation

Event

Plugins are sandboxed.

They cannot mutate historical artifacts.

16. Error Model

Every error follows one schema.

Code

Message

Category

Recoverable

Retry After

Documentation URL

Request ID

This makes SDK implementations predictable.

17. Versioning

Protocol version

EIP 1.0

Version independently from:

SDK

Pipeline

Evaluation Engine

Reflection Engine

Learning Engine

Older SDKs remain supported through compatibility layers where feasible.

18. Future Extensions

The protocol is designed to support future capabilities without breaking existing integrations.

Planned extensions include:

Multi-agent coordination metadata
Policy evaluation results
Human approval workflows
Simulation sessions
Predictive execution planning
Federated execution intelligence across deployments

Extensions should be additive rather than breaking.

EIP Principles
Every execution is addressable.
Every artifact is immutable.
Every event is append-only.
Every API is versioned.
Every request is traceable.
Every recommendation is explainable.
Every execution can be replayed.
Every dataset is versioned.
Every dataset is exportable.
Every benchmark is reproducible.
Every corpus is publishable.
Every protocol evolution preserves compatibility whenever possible
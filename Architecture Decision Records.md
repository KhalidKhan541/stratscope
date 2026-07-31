Architecture Decision Records

Every important decision gets one.

Example

ADR-001

Title

Use Event Sourcing

Context

AI systems generate many independent actions.

Decision

Every execution becomes immutable events.

Consequences

Pros

Replay

Debugging

Learning

Audit

Cons

Higher storage

More complexity

ADR-002

Knowledge Graph

Decision

Use Neo4j.

Reason

Relationships matter more than tables.

ADR-003

Vector Search

Decision

Qdrant.

Reason

Open source

Fast

Easy filtering

ADR-004

Reflection

Decision

Asynchronous.

Reason

Never slow production traffic.

ADR-005

Evaluation

Decision

Runs after execution.

Reason

Does not affect latency.

ADR-006

Title

Research Intelligence Module

Context

Organizations need standardized execution intelligence datasets for AI research, model evaluation, and optimization.

Decision

Add a Research Intelligence bounded context with Dataset Builder, Benchmark Builder, Corpus Builder, and Dataset Export services.

Consequences

Pros

- Generates real execution intelligence datasets from production data
- Enables model comparison and benchmarking
- Creates research-grade corpora
- Supports multiple export formats (JSONL, Parquet, CSV, Arrow, REST)

Cons

- Additional storage requirements for datasets
- More complex pipeline (12 stages instead of 9)
- Requires dataset validation logic

ADR-007

Title

Dataset Versioning Strategy

Context

Datasets must be immutable and versioned to ensure reproducibility.

Decision

Every dataset modification creates a new version record. The original dataset record is updated with the new version number, but all historical versions are preserved in the dataset_versions table.

Consequences

Pros

- Full version history preserved
- Reproducible dataset exports
- Audit trail for dataset changes

Cons

- Additional storage for version metadata
- Version management complexity

ADR-008

Title

Export Format Support

Context

Researchers and enterprises need datasets in various formats for different use cases.

Decision

Support JSONL (default), CSV, Parquet, Apache Arrow, and REST API access. Parquet and Arrow exports use JSON representation for MVP, with native binary formats planned for Phase 2.

Consequences

Pros

- Broad compatibility with existing tools
- REST API enables real-time access
- Progressive enhancement path

Cons

- Parquet/Arrow not native for MVP
- Multiple format implementations to maintain
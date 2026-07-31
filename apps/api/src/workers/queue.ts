/**
 * Queue consumer for processing execution intelligence events.
 *
 * Receives batches of DomainEvents, routes them to the appropriate
 * handler (evaluation, reflection, knowledge extraction, learning),
 * and manages retries and dead-letter routing.
 */

import type { DomainEvent } from "@stratscope/events";
import type { Env } from "./env";

interface QueueMessage {
  readonly batch: readonly DomainEvent[];
}

interface EventHandler {
  (event: DomainEvent, env: Env): Promise<void>;
}

const handlers: Record<string, EventHandler> = {
  "execution.completed": handleExecutionCompleted,
  "execution.failed": handleExecutionFailed,
  "evaluation.generated": handleEvaluationGenerated,
  "reflection.generated": handleReflectionGenerated,
  "knowledge.extracted": handleKnowledgeExtracted,
  "learning.generated": handleLearningGenerated,
  "dataset.created": handleDatasetCreated,
  "benchmark.completed": handleBenchmarkCompleted,
  "corpus.published": handleCorpusPublished,
  "consent_policy.created": handleConsentPolicyCreated,
  "consent_policy.updated": handleConsentPolicyUpdated,
  "execution.anonymized": handleExecutionAnonymized,
  "research_agent.created": handleResearchAgentCreated,
  "research_agent.status_changed": handleResearchAgentStatusChanged,
  "dataset_version.created": handleDatasetVersionCreated,
  "dataset_version.validated": handleDatasetVersionValidated,
  "experiment.created": handleExperimentCreated,
  "experiment.started": handleExperimentStarted,
  "experiment.completed": handleExperimentCompleted,
  "benchmark_run.created": handleBenchmarkRunCreated,
  "benchmark_run.completed": handleBenchmarkRunCompleted,
  "synthetic_data.generated": handleSyntheticDataGenerated,
  "research_export.completed": handleResearchExportCompleted,
};

export async function queueHandler(
  batch: MessageBatch<QueueMessage>,
  env: Env
): Promise<void> {
  for (const message of batch.messages) {
    try {
      const { batch: events } = message.body;

      for (const event of events) {
        const handler = handlers[event.event_type];

        if (handler) {
          await handler(event, env);
        } else {
          logEvent("warn", "No handler registered for event type", {
            eventType: event.event_type,
            eventId: event.event_id,
          });
        }
      }

      message.ack();
    } catch (error) {
      logEvent("error", "Failed to process queue message", {
        messageId: message.id,
        error: error instanceof Error ? error.message : String(error),
      });

      message.retry();
    }
  }
}

async function handleExecutionCompleted(
  event: DomainEvent,
  env: Env
): Promise<void> {
  logEvent("info", "Processing execution.completed", {
    eventId: event.event_id,
    executionId: event.execution_id,
  });

  await env.DB.prepare(
    `UPDATE executions SET status = 'completed', completed_at = ? WHERE id = ?`
  )
    .bind(new Date().toISOString(), event.execution_id)
    .run();

  await queueEvaluation(event, env);
}

async function handleExecutionFailed(
  event: DomainEvent,
  env: Env
): Promise<void> {
  logEvent("info", "Processing execution.failed", {
    eventId: event.event_id,
    executionId: event.execution_id,
  });

  await env.DB.prepare(
    `UPDATE executions SET status = 'failed', error = ? WHERE id = ?`
  )
    .bind(JSON.stringify(event.payload), event.execution_id)
    .run();
}

async function handleEvaluationGenerated(
  event: DomainEvent,
  env: Env
): Promise<void> {
  logEvent("info", "Processing evaluation.generated", {
    eventId: event.event_id,
    executionId: event.execution_id,
  });

  const payload = event.payload as Record<string, unknown>;

  await env.DB.prepare(
    `INSERT INTO evaluations (id, execution_id, accuracy, goal_completion, hallucination_score, confidence, cost_efficiency, latency_score, safety_score, evaluation_model, summary, details, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      crypto.randomUUID(),
      event.execution_id,
      (payload.accuracy as number) ?? null,
      (payload.goal_completion as number) ?? null,
      (payload.hallucination_score as number) ?? null,
      (payload.confidence as number) ?? null,
      (payload.cost_efficiency as number) ?? null,
      (payload.latency_score as number) ?? null,
      (payload.safety_score as number) ?? null,
      (payload.evaluation_model as string) ?? null,
      (payload.summary as string) ?? null,
      JSON.stringify(payload.details ?? {}),
      event.timestamp
    )
    .run();

  await queueReflection(event, env);
}

async function handleReflectionGenerated(
  event: DomainEvent,
  env: Env
): Promise<void> {
  logEvent("info", "Processing reflection.generated", {
    eventId: event.event_id,
    executionId: event.execution_id,
  });

  const payload = event.payload as Record<string, unknown>;

  await env.DB.prepare(
    `INSERT INTO reflections (id, execution_id, summary, strengths, weaknesses, recommendations, confidence, reflection_model, reasoning, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      crypto.randomUUID(),
      event.execution_id,
      (payload.summary as string) ?? null,
      JSON.stringify(payload.strengths ?? []),
      JSON.stringify(payload.weaknesses ?? []),
      JSON.stringify(payload.recommendations ?? []),
      (payload.confidence as number) ?? null,
      (payload.reflection_model as string) ?? null,
      (payload.reasoning as string) ?? null,
      event.timestamp
    )
    .run();

  await queueKnowledgeExtraction(event, env);
}

async function handleKnowledgeExtracted(
  event: DomainEvent,
  env: Env
): Promise<void> {
  logEvent("info", "Processing knowledge.extracted", {
    eventId: event.event_id,
    executionId: event.execution_id,
  });

  const payload = event.payload as Record<string, unknown>;

  await env.DB.prepare(
    `INSERT INTO knowledge_nodes (id, organization_id, node_type, name, description, properties, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      crypto.randomUUID(),
      event.organization_id,
      (payload.node_type as string) ?? "execution",
      (payload.name as string) ?? `knowledge-${event.execution_id}`,
      (payload.description as string) ?? null,
      JSON.stringify(payload.properties ?? {}),
      event.timestamp,
      event.timestamp
    )
    .run();
}

async function handleLearningGenerated(
  event: DomainEvent,
  env: Env
): Promise<void> {
  logEvent("info", "Processing learning.generated", {
    eventId: event.event_id,
    executionId: event.execution_id,
  });

  const payload = event.payload as Record<string, unknown>;

  await env.DB.prepare(
    `INSERT INTO learning_records (id, execution_id, project_id, pattern_type, pattern, frequency, severity, suggestion, evidence, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      crypto.randomUUID(),
      event.execution_id,
      event.project_id,
      (payload.pattern_type as string) ?? "general",
      (payload.pattern as string) ?? null,
      (payload.frequency as number) ?? 1,
      (payload.severity as string) ?? "low",
      (payload.suggestion as string) ?? null,
      JSON.stringify(payload.evidence ?? []),
      event.timestamp
    )
    .run();
}

async function handleDatasetCreated(
  event: DomainEvent,
  env: Env
): Promise<void> {
  logEvent("info", "Processing dataset.created", {
    eventId: event.event_id,
    executionId: event.execution_id,
  });

  const payload = event.payload as Record<string, unknown>;

  await env.DB.prepare(
    `INSERT INTO datasets (id, organization_id, project_id, name, description, category, status, version, record_count, schema_definition, filters, tags, export_formats, metadata, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      (payload.dataset_id as string) ?? crypto.randomUUID(),
      event.organization_id,
      event.project_id,
      (payload.name as string) ?? "Untitled Dataset",
      (payload.description as string) ?? "",
      (payload.category as string) ?? "evaluation",
      (payload.status as string) ?? "building",
      (payload.version as number) ?? 1,
      (payload.record_count as number) ?? 0,
      JSON.stringify(payload.schema_definition ?? {}),
      JSON.stringify(payload.filters ?? {}),
      JSON.stringify(payload.tags ?? []),
      JSON.stringify(payload.export_formats ?? ["jsonl", "csv"]),
      JSON.stringify(payload.metadata ?? {}),
      event.timestamp,
      event.timestamp
    )
    .run();
}

async function handleBenchmarkCompleted(
  event: DomainEvent,
  env: Env
): Promise<void> {
  logEvent("info", "Processing benchmark.completed", {
    eventId: event.event_id,
    executionId: event.execution_id,
  });

  const payload = event.payload as Record<string, unknown>;
  const now = new Date().toISOString();

  await env.DB.prepare(
    `UPDATE benchmarks SET status = 'completed', results = ?, completed_at = ?, updated_at = ? WHERE id = ?`
  )
    .bind(
      JSON.stringify(payload.results ?? {}),
      now,
      now,
      payload.benchmark_id as string
    )
    .run();
}

async function handleCorpusPublished(
  event: DomainEvent,
  env: Env
): Promise<void> {
  logEvent("info", "Processing corpus.published", {
    eventId: event.event_id,
    executionId: event.execution_id,
  });

  const payload = event.payload as Record<string, unknown>;
  const now = new Date().toISOString();

  await env.DB.prepare(
    `UPDATE corpora SET status = 'published', metadata = ?, updated_at = ? WHERE id = ?`
  )
    .bind(
      JSON.stringify({
        ...(JSON.parse((payload.metadata as string) ?? "{}") as Record<string, unknown>),
        published_at: now,
        published_by: event.producer ?? "system",
      }),
      now,
      payload.corpus_id as string
    )
    .run();
}

async function handleConsentPolicyCreated(
  event: DomainEvent,
  env: Env
): Promise<void> {
  logEvent("info", "Processing consent_policy.created", {
    eventId: event.event_id,
  });
}

async function handleConsentPolicyUpdated(
  event: DomainEvent,
  env: Env
): Promise<void> {
  logEvent("info", "Processing consent_policy.updated", {
    eventId: event.event_id,
  });
}

async function handleExecutionAnonymized(
  event: DomainEvent,
  env: Env
): Promise<void> {
  logEvent("info", "Processing execution.anonymized", {
    eventId: event.event_id,
  });
}

async function handleResearchAgentCreated(
  event: DomainEvent,
  env: Env
): Promise<void> {
  logEvent("info", "Processing research_agent.created", {
    eventId: event.event_id,
  });
}

async function handleResearchAgentStatusChanged(
  event: DomainEvent,
  env: Env
): Promise<void> {
  logEvent("info", "Processing research_agent.status_changed", {
    eventId: event.event_id,
  });
}

async function handleDatasetVersionCreated(
  event: DomainEvent,
  env: Env
): Promise<void> {
  logEvent("info", "Processing dataset_version.created", {
    eventId: event.event_id,
  });
}

async function handleDatasetVersionValidated(
  event: DomainEvent,
  env: Env
): Promise<void> {
  logEvent("info", "Processing dataset_version.validated", {
    eventId: event.event_id,
  });
}

async function handleExperimentCreated(
  event: DomainEvent,
  env: Env
): Promise<void> {
  logEvent("info", "Processing experiment.created", {
    eventId: event.event_id,
  });
}

async function handleExperimentStarted(
  event: DomainEvent,
  env: Env
): Promise<void> {
  logEvent("info", "Processing experiment.started", {
    eventId: event.event_id,
  });
}

async function handleExperimentCompleted(
  event: DomainEvent,
  env: Env
): Promise<void> {
  logEvent("info", "Processing experiment.completed", {
    eventId: event.event_id,
  });
}

async function handleBenchmarkRunCreated(
  event: DomainEvent,
  env: Env
): Promise<void> {
  logEvent("info", "Processing benchmark_run.created", {
    eventId: event.event_id,
  });
}

async function handleBenchmarkRunCompleted(
  event: DomainEvent,
  env: Env
): Promise<void> {
  logEvent("info", "Processing benchmark_run.completed", {
    eventId: event.event_id,
  });
}

async function handleSyntheticDataGenerated(
  event: DomainEvent,
  env: Env
): Promise<void> {
  logEvent("info", "Processing synthetic_data.generated", {
    eventId: event.event_id,
  });
}

async function handleResearchExportCompleted(
  event: DomainEvent,
  env: Env
): Promise<void> {
  logEvent("info", "Processing research_export.completed", {
    eventId: event.event_id,
  });
}

async function queueEvaluation(
  event: DomainEvent,
  env: Env
): Promise<void> {
  await env.QUEUE.send({
    batch: [
      {
        ...event,
        event_type: "evaluation.generated",
        event_id: crypto.randomUUID() as DomainEvent["event_id"],
        producer: "evaluation-orchestrator",
      },
    ],
  });
}

async function queueReflection(
  event: DomainEvent,
  env: Env
): Promise<void> {
  await env.QUEUE.send({
    batch: [
      {
        ...event,
        event_type: "reflection.generated",
        event_id: crypto.randomUUID() as DomainEvent["event_id"],
        producer: "reflection-orchestrator",
      },
    ],
  });
}

async function queueKnowledgeExtraction(
  event: DomainEvent,
  env: Env
): Promise<void> {
  await env.QUEUE.send({
    batch: [
      {
        ...event,
        event_type: "knowledge.extracted",
        event_id: crypto.randomUUID() as DomainEvent["event_id"],
        producer: "knowledge-extractor",
      },
    ],
  });
}

function logEvent(
  level: "info" | "warn" | "error",
  message: string,
  data?: Record<string, unknown>
): void {
  const entry = {
    level,
    message,
    service: "queue-consumer",
    timestamp: new Date().toISOString(),
    ...data,
  };

  if (level === "error") {
    console.error(JSON.stringify(entry));
  } else if (level === "warn") {
    console.warn(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

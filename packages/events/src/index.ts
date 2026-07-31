/**
 * @stratscope/events
 *
 * Event types, bus interface, and Cloudflare Queue-backed implementation
 * for the StratScope execution intelligence event system.
 */

export type {
  EventType,
  DomainEvent,
  PaginationOptions,
  PaginatedResult,
  EventId,
  ConsentPolicyCreatedEvent,
  ConsentPolicyUpdatedEvent,
  ExecutionAnonymizedEvent,
  ResearchAgentCreatedEvent,
  ResearchAgentStatusChangedEvent,
  DatasetVersionCreatedEvent,
  DatasetVersionValidatedEvent,
  ExperimentCreatedEvent,
  ExperimentStartedEvent,
  ExperimentCompletedEvent,
  BenchmarkRunCreatedEvent,
  BenchmarkRunCompletedEvent,
  SyntheticDataGeneratedEvent,
  ResearchExportCompletedEvent,
  ErpEvent,
} from "./EventTypes";

export { CURRENT_SCHEMA_VERSION, createEventId } from "./EventTypes";

export type { EventBus } from "./EventBus";
export type { EventStore } from "./EventStore";
export { CloudflareEventBus } from "./CloudflareEventBus";

import type {
  ExecutionId,
  OrganizationId,
} from '@stratscope/core';
import type {
  DomainEvent,
  EventType,
  PaginatedResult,
  PaginationOptions,
} from './EventTypes';

export interface EventStore {
  append(event: DomainEvent): Promise<void>;
  appendBatch(events: DomainEvent[]): Promise<void>;
  getByExecutionId(executionId: ExecutionId): Promise<DomainEvent[]>;
  getByOrganizationId(
    organizationId: OrganizationId,
    options: PaginationOptions
  ): Promise<PaginatedResult<DomainEvent>>;
  getByType(
    eventType: EventType,
    options: PaginationOptions
  ): Promise<PaginatedResult<DomainEvent>>;
}

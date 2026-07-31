import type { Queue } from '@cloudflare/workers-types';
import type { DomainEvent } from './EventTypes';
import type { EventBus } from './EventBus';

interface QueueMessage {
  readonly batch: readonly DomainEvent[];
}

interface EventBusConfig {
  readonly queueBinding: Queue<QueueMessage>;
  readonly producer: string;
  readonly maxRetries?: number;
  readonly initialRetryDelayMs?: number;
  readonly maxRetryDelayMs?: number;
}

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_INITIAL_RETRY_DELAY_MS = 100;
const DEFAULT_MAX_RETRY_DELAY_MS = 5000;
const MAX_BATCH_SIZE = 100;

export class CloudflareEventBus implements EventBus {
  private readonly queueBinding: Queue<QueueMessage>;
  private readonly producer: string;
  private readonly maxRetries: number;
  private readonly initialRetryDelayMs: number;
  private readonly maxRetryDelayMs: number;

  constructor(config: EventBusConfig) {
    this.queueBinding = config.queueBinding;
    this.producer = config.producer;
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.initialRetryDelayMs = config.initialRetryDelayMs ?? DEFAULT_INITIAL_RETRY_DELAY_MS;
    this.maxRetryDelayMs = config.maxRetryDelayMs ?? DEFAULT_MAX_RETRY_DELAY_MS;
  }

  async publish(event: DomainEvent): Promise<void> {
    await this.publishWithRetry([event]);
  }

  async publishBatch(events: DomainEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }

    const batches = this.chunkArray(events, MAX_BATCH_SIZE);
    
    for (const batch of batches) {
      await this.publishWithRetry(batch);
    }
  }

  private async publishWithRetry(batch: readonly DomainEvent[]): Promise<void> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        await this.queueBinding.send({
          batch,
        });
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.maxRetries) {
          const delay = this.calculateRetryDelay(attempt);
          await this.sleep(delay);
        }
      }
    }

    console.error(
      JSON.stringify({
        level: 'error',
        message: 'Failed to publish events after max retries',
        producer: this.producer,
        batchSize: batch.length,
        retryCount: this.maxRetries,
        error: lastError?.message,
        eventTypes: batch.map((e) => e.event_type),
      })
    );
  }

  private calculateRetryDelay(attempt: number): number {
    const exponentialDelay = this.initialRetryDelayMs * Math.pow(2, attempt);
    const jitter = Math.random() * 0.5 + 0.75;
    return Math.min(exponentialDelay * jitter, this.maxRetryDelayMs);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private chunkArray<T>(array: readonly T[], chunkSize: number): readonly (readonly T[])[] {
    const chunks: (readonly T[])[] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}

import type { SDKEvent } from "./types";

export class EventBuffer {
  private readonly maxCapacity: number;
  private buffer: SDKEvent[] = [];

  constructor(maxCapacity: number) {
    this.maxCapacity = maxCapacity;
  }

  push(event: SDKEvent): void {
    if (this.buffer.length >= this.maxCapacity) {
      this.buffer.shift(); // Drop oldest if full
    }
    this.buffer.push(event);
  }

  drain(): SDKEvent[] {
    const events = [...this.buffer];
    this.buffer = [];
    return events;
  }

  size(): number {
    return this.buffer.length;
  }

  peek(): SDKEvent | undefined {
    return this.buffer[0];
  }
}
export abstract class DomainEvent {
  public readonly occurredAt: Date;
  public readonly eventId: string;

  constructor() {
    this.occurredAt = new Date();
    this.eventId = crypto.randomUUID();
  }

  public abstract get eventName(): string;
}

export type DomainEventHandler<T extends DomainEvent> = (event: T) => Promise<void> | void;

export interface DomainEventPublisher {
  publish<T extends DomainEvent>(event: T): Promise<void>;
  subscribe<T extends DomainEvent>(eventClass: new (...args: any[]) => T, handler: DomainEventHandler<T>): void;
}
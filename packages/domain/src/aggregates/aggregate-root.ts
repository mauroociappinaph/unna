import { DomainEvent } from '../events/domain-event';

export abstract class AggregateRoot<Props extends Record<string, any>> {
  public readonly id: string;
  private _domainEvents: DomainEvent[] = [];

  protected constructor(id: string, protected props: Props) {
    this.id = id;
  }

  public get domainEvents(): readonly DomainEvent[] {
    return this._domainEvents;
  }

  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  public clearDomainEvents(): void {
    this._domainEvents = [];
  }

  protected abstract validate(): void;
}
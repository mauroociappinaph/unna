/** A requested entity does not exist (or is hidden from the caller); adapters map it to "not found". */
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

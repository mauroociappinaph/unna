import { NotFoundError } from '../errors';

describe('NotFoundError', () => {
  it('is an Error that keeps its message and is identified by type', () => {
    const error = new NotFoundError('Pantalla no encontrada');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(NotFoundError);
    expect(error.name).toBe('NotFoundError');
    expect(error.message).toBe('Pantalla no encontrada');
  });
});

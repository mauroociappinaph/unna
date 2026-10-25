/** A test double that implements only the port methods the case exercises. */
export const fake = <T>(impl: object): T => impl as T;

/** Encrypts secrets at rest (Mercado Pago tokens, PKCE verifiers). Decrypting tampered values throws. */
export interface SecretCipherPort {
  encrypt(plaintext: string): string;
  decrypt(ciphertext: string): string;
}

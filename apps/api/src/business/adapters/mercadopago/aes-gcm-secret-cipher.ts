import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import type { SecretCipherPort } from '@unna/domain';

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const VERSION = 'v1';
const DECRYPT_FAILED = 'No se pudo descifrar el secreto';

/**
 * DEVELOPMENT ONLY. Used when MP_TOKEN_ENCRYPTION_KEY is unset outside production, so local and
 * simulator setups work without configuration. It is public (it is in the repository), so anything
 * encrypted with it is not protected; production refuses to start without its own key.
 */
export const DEV_TOKEN_ENCRYPTION_KEY = Buffer.from('unna-dev-only-mp-token-key-32byt', 'utf8');

/**
 * AES-256-GCM with a random 96-bit IV per value. Output: `v1.<iv>.<tag>.<ciphertext>` (base64url).
 * Tampered values, other keys and malformed input fail with the same message, never with the value.
 */
export class AesGcmSecretCipher implements SecretCipherPort {
  constructor(private readonly key: Buffer) {
    if (key.length !== KEY_BYTES) throw new Error('La clave de cifrado debe tener 32 bytes');
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return [VERSION, iv, cipher.getAuthTag(), data].map((part) => (typeof part === 'string' ? part : part.toString('base64url'))).join('.');
  }

  decrypt(ciphertext: string): string {
    const parts = ciphertext.split('.');
    if (parts.length !== 4 || parts[0] !== VERSION) throw new Error(DECRYPT_FAILED);
    const [iv, tag, data] = parts.slice(1).map((part) => Buffer.from(part, 'base64url'));
    if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) throw new Error(DECRYPT_FAILED);
    try {
      const decipher = createDecipheriv(ALGORITHM, this.key, iv, { authTagLength: TAG_BYTES });
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
    } catch {
      throw new Error(DECRYPT_FAILED);
    }
  }
}

/** MP_TOKEN_ENCRYPTION_KEY (32 bytes, base64). Required in production; the dev key otherwise. */
export function loadTokenEncryptionKey(env: NodeJS.ProcessEnv = process.env): Buffer {
  const encoded = env.MP_TOKEN_ENCRYPTION_KEY?.trim();
  if (!encoded) {
    if (env.NODE_ENV === 'production') throw new Error('MP_TOKEN_ENCRYPTION_KEY es obligatoria en producción');
    return DEV_TOKEN_ENCRYPTION_KEY;
  }
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== KEY_BYTES) throw new Error('MP_TOKEN_ENCRYPTION_KEY inválida: debe ser 32 bytes en base64');
  return key;
}

export function secretCipherFactory(env: NodeJS.ProcessEnv = process.env): SecretCipherPort {
  return new AesGcmSecretCipher(loadTokenEncryptionKey(env));
}

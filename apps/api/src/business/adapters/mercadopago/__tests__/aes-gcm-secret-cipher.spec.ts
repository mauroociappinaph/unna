import { randomBytes } from 'crypto';
import { AesGcmSecretCipher, DEV_TOKEN_ENCRYPTION_KEY, loadTokenEncryptionKey, secretCipherFactory } from '../aes-gcm-secret-cipher';

const key = randomBytes(32);

describe('AesGcmSecretCipher (S15: tokens encrypted at rest)', () => {
  it('round-trips a secret and never stores it in clear', () => {
    const cipher = new AesGcmSecretCipher(key);
    const encrypted = cipher.encrypt('APP_USR-secret-token');
    expect(encrypted).not.toContain('APP_USR-secret-token');
    expect(encrypted).toMatch(/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(cipher.decrypt(encrypted)).toBe('APP_USR-secret-token');
  });

  it('uses a random IV per value, so the same secret encrypts differently each time', () => {
    const cipher = new AesGcmSecretCipher(key);
    const a = cipher.encrypt('same');
    const b = cipher.encrypt('same');
    expect(a).not.toBe(b);
    expect(a.split('.')[1]).not.toBe(b.split('.')[1]);
  });

  it('detects tampering of the ciphertext, the tag or the IV', () => {
    const cipher = new AesGcmSecretCipher(key);
    const [version, iv, tag, data] = cipher.encrypt('APP_USR-secret-token').split('.');
    const flip = (part: string) => {
      const bytes = Buffer.from(part, 'base64url');
      bytes[0] ^= 1;
      return bytes.toString('base64url');
    };
    for (const tampered of [
      [version, iv, tag, flip(data)],
      [version, iv, flip(tag), data],
      [version, flip(iv), tag, data],
    ]) {
      expect(() => cipher.decrypt(tampered.join('.'))).toThrow('No se pudo descifrar el secreto');
    }
    expect(() => cipher.decrypt('garbage')).toThrow('No se pudo descifrar el secreto');
  });

  it('fails with another key, without revealing the value', () => {
    const encrypted = new AesGcmSecretCipher(key).encrypt('APP_USR-secret-token');
    expect(() => new AesGcmSecretCipher(randomBytes(32)).decrypt(encrypted)).toThrow('No se pudo descifrar el secreto');
  });

  it('rejects keys that are not 32 bytes', () => {
    expect(() => new AesGcmSecretCipher(randomBytes(16))).toThrow('La clave de cifrado debe tener 32 bytes');
  });
});

describe('loadTokenEncryptionKey', () => {
  it('decodes a 32-byte base64 MP_TOKEN_ENCRYPTION_KEY', () => {
    expect(loadTokenEncryptionKey({ MP_TOKEN_ENCRYPTION_KEY: key.toString('base64'), NODE_ENV: 'production' }).equals(key)).toBe(true);
  });

  it('rejects a key of the wrong length, naming the variable but not the value', () => {
    const short = randomBytes(16).toString('base64');
    expect(() => loadTokenEncryptionKey({ MP_TOKEN_ENCRYPTION_KEY: short })).toThrow('MP_TOKEN_ENCRYPTION_KEY inválida: debe ser 32 bytes en base64');
    try {
      loadTokenEncryptionKey({ MP_TOKEN_ENCRYPTION_KEY: short });
    } catch (error) {
      expect((error as Error).message).not.toContain(short);
    }
  });

  it('is required in production (fail fast)', () => {
    expect(() => loadTokenEncryptionKey({ NODE_ENV: 'production' })).toThrow('MP_TOKEN_ENCRYPTION_KEY es obligatoria en producción');
    expect(() => secretCipherFactory({ NODE_ENV: 'production', MP_TOKEN_ENCRYPTION_KEY: '' })).toThrow(
      'MP_TOKEN_ENCRYPTION_KEY es obligatoria en producción',
    );
  });

  it.each(['development', 'test', undefined])('falls back to the fixed development key when NODE_ENV is %p', (nodeEnv) => {
    expect(loadTokenEncryptionKey({ NODE_ENV: nodeEnv }).equals(DEV_TOKEN_ENCRYPTION_KEY)).toBe(true);
    expect(secretCipherFactory({ NODE_ENV: nodeEnv })).toBeInstanceOf(AesGcmSecretCipher);
  });
});

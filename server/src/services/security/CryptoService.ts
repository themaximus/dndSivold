import crypto from 'crypto';
import { config } from '../../config';

const ALGORITHM = 'aes-256-gcm';
const PREFIX = 'enc:aes256gcm:';

export class CryptoService {
  private key: Buffer;

  constructor() {
    // Derive a fixed 32-byte (256-bit) encryption key from the server secret
    const secret = process.env.ENCRYPTION_SECRET || config.jwtSecret || 'dnd-sivold-strong-secret-key-2026';
    this.key = crypto.createHash('sha256').update(secret).digest();
  }

  /**
   * Encrypts a sensitive string (e.g. API key) using AES-256-GCM.
   * Format: enc:aes256gcm:<iv_base64>:<tag_base64>:<ciphertext_base64>
   */
  public encrypt(plainText: string): string {
    if (!plainText) return '';
    if (plainText.startsWith(PREFIX)) {
      return plainText; // Already encrypted
    }

    try {
      const iv = crypto.randomBytes(12); // Standard 96-bit IV for GCM
      const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);

      let encrypted = cipher.update(plainText, 'utf8', 'base64');
      encrypted += cipher.final('base64');

      const authTag = cipher.getAuthTag().toString('base64');

      return `${PREFIX}${iv.toString('base64')}:${authTag}:${encrypted}`;
    } catch (err) {
      console.error('CryptoService: Encryption error:', err);
      return plainText;
    }
  }

  /**
   * Decrypts an encrypted string. If not encrypted, returns as-is.
   */
  public decrypt(cipherText: string): string {
    if (!cipherText) return '';
    if (!cipherText.startsWith(PREFIX)) {
      return cipherText; // Plain text or unencrypted
    }

    try {
      const parts = cipherText.slice(PREFIX.length).split(':');
      if (parts.length !== 3) {
        return cipherText;
      }

      const [ivBase64, tagBase64, encBase64] = parts;
      const iv = Buffer.from(ivBase64, 'base64');
      const authTag = Buffer.from(tagBase64, 'base64');

      const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encBase64, 'base64', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (err) {
      console.error('CryptoService: Decryption error:', err);
      return '';
    }
  }

  /**
   * Masks an API key for safe UI feedback (e.g. "sk-••••••••1234")
   */
  public maskKey(apiKey?: string): string {
    if (!apiKey) return '';
    const decrypted = this.decrypt(apiKey);
    if (decrypted.length <= 8) return '••••••••';
    const prefix = decrypted.slice(0, 3);
    const suffix = decrypted.slice(-4);
    return `${prefix}••••••••${suffix}`;
  }
}

export const cryptoService = new CryptoService();

/**
 * Strips sensitive keys and adds boolean hasDeepSeekKey flag for safe frontend usage
 */
export function sanitizeRoom(room: any): any {
  if (!room) return null;
  return {
    ...room,
    hasDeepSeekKey: !!(room.deepseekApiKey || config.deepseekApiKey),
    // NEVER leak plain or encrypted API key to client / browser
    deepseekApiKey: undefined,
  };
}

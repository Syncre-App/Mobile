import { CryptoService } from './CryptoService';

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

export interface EncryptionKey {
  keyId: string;
  key: CryptoKey;
}

export interface EncryptedFrame {
  keyId: string;
  iv: Uint8Array;
  ciphertext: Uint8Array;
}

class E2EEncryptionService {
  private keys: Map<string, EncryptionKey> = new Map();
  private currentKeyId: string | null = null;

  async generateKey(): Promise<string> {
    const keyId = `key_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const key = await crypto.subtle.generateKey(
      {
        name: ALGORITHM,
        length: KEY_LENGTH * 8,
      },
      true,
      ['encrypt', 'decrypt']
    );
    this.keys.set(keyId, { keyId, key });
    this.currentKeyId = keyId;
    return keyId;
  }

  async generateKeyFromSeed(seed: Uint8Array): Promise<string> {
    const keyId = `key_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const key = await crypto.subtle.importKey(
      'raw',
      seed.buffer as ArrayBuffer,
      {
        name: ALGORITHM,
        length: KEY_LENGTH * 8,
      },
      true,
      ['encrypt', 'decrypt']
    );

    this.keys.set(keyId, { keyId, key });
    this.currentKeyId = keyId;
    return keyId;
  }

  setCurrentKey(keyId: string): void {
    if (this.keys.has(keyId)) {
      this.currentKeyId = keyId;
    }
  }

  getCurrentKeyId(): string | null {
    return this.currentKeyId;
  }

  async encryptFrame(frameData: Uint8Array): Promise<EncryptedFrame | null> {
    if (!this.currentKeyId) {
      console.error('[E2EE] No current key set');
      return null;
    }

    const keyEntry = this.keys.get(this.currentKeyId);
    if (!keyEntry) {
      console.error('[E2EE] Key not found:', this.currentKeyId);
      return null;
    }

    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

    try {
      const ciphertext = await crypto.subtle.encrypt(
        {
          name: ALGORITHM,
          iv: iv,
          tagLength: TAG_LENGTH * 8,
        },
        keyEntry.key,
        frameData as BufferSource
      );

      return {
        keyId: this.currentKeyId,
        iv: iv,
        ciphertext: new Uint8Array(ciphertext as ArrayBuffer),
      };
    } catch (error) {
      console.error('[E2EE] Encryption error:', error);
      return null;
    }
  }

  async decryptFrame(encryptedFrame: EncryptedFrame): Promise<Uint8Array | null> {
    const keyEntry = this.keys.get(encryptedFrame.keyId);
    if (!keyEntry) {
      console.error('[E2EE] Key not found for decryption:', encryptedFrame.keyId);
      return null;
    }

    try {
      const decrypted = await crypto.subtle.decrypt(
        {
          name: ALGORITHM,
          iv: encryptedFrame.iv as BufferSource,
          tagLength: TAG_LENGTH * 8,
        },
        keyEntry.key,
        encryptedFrame.ciphertext as BufferSource
      );

      return new Uint8Array(decrypted as ArrayBuffer);
    } catch (error) {
      console.error('[E2EE] Decryption error:', error);
      return null;
    }
  }

  async exportKey(keyId: string): Promise<ArrayBuffer | null> {
    const keyEntry = this.keys.get(keyId);
    if (!keyEntry) return null;

    try {
      return await crypto.subtle.exportKey('raw', keyEntry.key);
    } catch (error) {
      console.error('[E2EE] Export key error:', error);
      return null;
    }
  }

  async importKey(keyId: string, keyData: ArrayBuffer): Promise<boolean> {
    try {
      const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        {
          name: ALGORITHM,
          length: KEY_LENGTH * 8,
        },
        true,
        ['encrypt', 'decrypt']
      );

      this.keys.set(keyId, { keyId, key });
      return true;
    } catch (error) {
      console.error('[E2EE] Import key error:', error);
      return false;
    }
  }

  removeKey(keyId: string): void {
    this.keys.delete(keyId);
    if (this.currentKeyId === keyId) {
      const keys = Array.from(this.keys.keys());
      this.currentKeyId = keys.length > 0 ? keys[0] : null;
    }
  }

  clearKeys(): void {
    this.keys.clear();
    this.currentKeyId = null;
  }

  getKeyCount(): number {
    return this.keys.size;
  }
}

export const e2eEncryptionService = new E2EEncryptionService();
export default e2eEncryptionService;

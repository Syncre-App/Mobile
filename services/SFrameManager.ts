import { e2eEncryptionService, type EncryptedFrame } from './E2EEncryptionService';

export interface SFramePacket {
  keyId: number;
  frameIndex: number;
  ciphertext: Uint8Array;
}

export interface SFrameEncryptorOptions {
  senderId: string;
  ssrc: number;
}

class SFrameEncryptor {
  private senderId: string;
  private ssrc: number;
  private frameIndex: number = 0;
  private keyIdMap: Map<string, number> = new Map();
  private nextKeyId: number = 1;

  constructor(options: SFrameEncryptorOptions) {
    this.senderId = options.senderId;
    this.ssrc = options.ssrc;
  }

  async setKey(keyId: string): Promise<void> {
    if (!this.keyIdMap.has(keyId)) {
      this.keyIdMap.set(keyId, this.nextKeyId++);
    }
  }

  async encryptFrame(frameData: ArrayBuffer): Promise<ArrayBuffer | null> {
    try {
      const keyId = e2eEncryptionService.getCurrentKeyId();
      if (!keyId) {
        console.error('[SFrame] No encryption key available');
        return null;
      }

      await this.setKey(keyId);
      const keyIdNum = this.keyIdMap.get(keyId)!;

      const frameDataUint8 = new Uint8Array(frameData);
      const encrypted = await e2eEncryptionService.encryptFrame(frameDataUint8);

      if (!encrypted) {
        return null;
      }

      const frameIndex = this.frameIndex++;

      const result = this.packPacket(keyIdNum, frameIndex, encrypted.ciphertext, encrypted.iv);
      return result;
    } catch (error) {
      console.error('[SFrame] Encryption error:', error);
      return null;
    }
  }

  private packPacket(keyId: number, frameIndex: number, ciphertext: Uint8Array, iv: Uint8Array): ArrayBuffer {
    const headerSize = 4 + 4 + 12 + 2;
    const totalSize = headerSize + ciphertext.length;
    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);

    view.setUint32(0, keyId);
    view.setUint32(4, frameIndex);

    for (let i = 0; i < 12; i++) {
      view.setUint8(8 + i, iv[i]);
    }

    view.setUint16(20, ciphertext.length);

    const ciphertextView = new Uint8Array(buffer, 22);
    ciphertextView.set(ciphertext);

    return buffer;
  }

  reset(): void {
    this.frameIndex = 0;
  }

  getSSRC(): number {
    return this.ssrc;
  }
}

class SFrameDecryptor {
  private keyIdMap: Map<number, string> = new Map();
  private frameCounters: Map<string, number> = new Map();

  async setKey(keyIdNum: number, keyId: string): Promise<void> {
    this.keyIdMap.set(keyIdNum, keyId);
  }

  async decryptFrame(packetData: ArrayBuffer): Promise<ArrayBuffer | null> {
    try {
      const view = new DataView(packetData);
      const keyIdNum = view.getUint32(0);
      const frameIndex = view.getUint32(4);

      const iv = new Uint8Array(12);
      for (let i = 0; i < 12; i++) {
        iv[i] = view.getUint8(8 + i);
      }

      const ciphertextLength = view.getUint16(20);
      const ciphertext = new Uint8Array(packetData, 22, ciphertextLength);

      const keyId = this.keyIdMap.get(keyIdNum);
      if (!keyId) {
        console.error('[SFrame] Unknown key ID:', keyIdNum);
        return null;
      }

      const frameKey = `${this.keyIdMap.get(keyIdNum)}-${frameIndex}`;
      if ((this.frameCounters.get(frameKey) || 0) >= frameIndex) {
        console.warn('[SFrame] Replay attack detected, skipping frame');
        return null;
      }
      this.frameCounters.set(frameKey, frameIndex);

      e2eEncryptionService.setCurrentKey(keyId);

      const encrypted: EncryptedFrame = {
        keyId,
        iv,
        ciphertext,
      };

      const decrypted = await e2eEncryptionService.decryptFrame(encrypted);
      if (!decrypted) {
        return null;
      }

      return decrypted.buffer;
    } catch (error) {
      console.error('[SFrame] Decryption error:', error);
      return null;
    }
  }

  reset(): void {
    this.frameCounters.clear();
  }
}

export class SFrameManager {
  private encryptors: Map<string, SFrameEncryptor> = new Map();
  private decryptor: SFrameDecryptor;

  constructor() {
    this.decryptor = new SFrameDecryptor();
  }

  getOrCreateEncryptor(senderId: string, ssrc: number): SFrameEncryptor {
    const key = `${senderId}-${ssrc}`;
    if (!this.encryptors.has(key)) {
      this.encryptors.set(key, new SFrameEncryptor({ senderId, ssrc }));
    }
    return this.encryptors.get(key)!;
  }

  getDecryptor(): SFrameDecryptor {
    return this.decryptor;
  }

  removeEncryptor(senderId: string, ssrc: number): void {
    const key = `${senderId}-${ssrc}`;
    this.encryptors.delete(key);
  }

  reset(): void {
    this.encryptors.forEach((enc) => enc.reset());
    this.decryptor.reset();
  }
}

export const sframeManager = new SFrameManager();
export default sframeManager;

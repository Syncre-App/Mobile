import * as Linking from 'expo-linking';
import { Buffer } from 'buffer';

export type ShareAttachmentKind = 'text' | 'url' | 'file';

export interface ShareAttachment {
  id: string;
  kind: ShareAttachmentKind;
  value: string;
  mimeType?: string;
  filename?: string;
  size?: number;
  thumbnail?: string;
  uti?: string;
  extra?: Record<string, any>;
}

export interface ShareIntentPayload {
  id: string;
  attachments: ShareAttachment[];
  message?: string;
  title?: string;
  origin?: string;
  receivedAt: number;
  extra?: Record<string, any>;
}

type ShareIntentListener = (payload: ShareIntentPayload | null) => void;

const SHARE_ROUTE_KEYWORDS = ['share', 'share-intent', 'share-intents'];

class ShareIntentManager {
  private payload: ShareIntentPayload | null = null;
  private listeners: Set<ShareIntentListener> = new Set();
  private initialized = false;

  init() {
    if (this.initialized) {
      return;
    }
    this.initialized = true;
  }

  subscribe(listener: ShareIntentListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getPayload(): ShareIntentPayload | null {
    return this.payload;
  }

  clearPayload() {
    if (this.payload) {
      this.payload = null;
      this.notify();
    }
  }

  injectPayload(raw: any) {
    const normalized = this.normalizePayload(raw);
    if (normalized) {
      this.payload = normalized;
      this.notify();
    }
  }

  handleIncomingUrl(url?: string | null): boolean {
    if (!url) {
      return false;
    }
    try {
      const parsed = Linking.parse(url);
      const path = typeof parsed.path === 'string' ? parsed.path : '';
      const hostname = typeof parsed.hostname === 'string' ? parsed.hostname : '';
      const routeToken = (path || hostname || '').replace(/^\//, '').toLowerCase();
      if (!SHARE_ROUTE_KEYWORDS.includes(routeToken)) {
        return false;
      }

      const encodedPayload = parsed.queryParams?.payload;
      if (typeof encodedPayload === 'string' && encodedPayload.length) {
        const payload = this.parsePayloadFromEncodedString(encodedPayload);
        if (payload) {
          this.payload = payload;
          this.notify();
          return true;
        }
      }

      const fallbackPayload = this.normalizePayload(parsed.queryParams);
      if (fallbackPayload) {
        this.payload = fallbackPayload;
        this.notify();
        return true;
      }
    } catch (error) {
      console.warn('[ShareIntentService] Failed to handle deep link payload', error);
    }
    return false;
  }

  private notify() {
    this.listeners.forEach((listener) => {
      try {
        listener(this.payload);
      } catch (error) {
        console.warn('[ShareIntentService] Listener failed', error);
      }
    });
  }

  private parsePayloadFromEncodedString(encoded: string): ShareIntentPayload | null {
    const candidates = new Set<string>();
    candidates.add(encoded);
    try {
      candidates.add(decodeURIComponent(encoded));
    } catch {
      // ignore URI decoding errors
    }
    try {
      const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
      if (decoded && decoded !== encoded) {
        candidates.add(decoded);
      }
    } catch {
      // ignore base64 decoding errors
    }

    for (const candidate of candidates) {
      const parsed = this.safeParse(candidate);
      const normalized = this.normalizePayload(parsed);
      if (normalized) {
        return normalized;
      }
    }
    return null;
  }

  private safeParse(raw?: string | null): any {
    if (!raw || typeof raw !== 'string') {
      return null;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  private normalizePayload(raw: any): ShareIntentPayload | null {
    if (!raw) {
      return null;
    }

    const attachmentsSource =
      Array.isArray(raw.attachments) && raw.attachments.length
        ? raw.attachments
        : Array.isArray(raw.items) && raw.items.length
          ? raw.items
          : [];

    const attachments = attachmentsSource
      .map((item: any, index: number) => this.normalizeAttachment(item, index))
      .filter(Boolean) as ShareAttachment[];

    const message = this.extractTextMessage(raw);

    if (!attachments.length && !message) {
      return null;
    }

    const payload: ShareIntentPayload = {
      id: raw.id?.toString?.() ?? `share-${Date.now()}`,
      attachments,
      message: message || undefined,
      title: this.extractTitle(raw),
      origin: this.extractOrigin(raw),
      receivedAt:
        typeof raw.receivedAt === 'number' && Number.isFinite(raw.receivedAt)
          ? raw.receivedAt
          : Date.now(),
      extra:
        typeof raw.extra === 'object' && raw.extra !== null
          ? raw.extra
          : typeof raw.extraData === 'object' && raw.extraData !== null
            ? raw.extraData
            : undefined,
    };

    return payload;
  }

  private extractTextMessage(raw: any): string | null {
    const candidates = [raw.message, raw.text, raw.caption, raw.body];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim().length) {
        return candidate.trim();
      }
    }
    return null;
  }

  private extractTitle(raw: any): string | undefined {
    const candidates = [raw.title, raw.subject, raw.heading];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim().length) {
        return candidate.trim();
      }
    }
    return undefined;
  }

  private extractOrigin(raw: any): string | undefined {
    const candidates = [raw.originApp, raw.origin, raw.sourceApp];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim().length) {
        return candidate.trim();
      }
    }
    return undefined;
  }

  private normalizeAttachment(raw: any, index: number): ShareAttachment | null {
    if (!raw) {
      return null;
    }

    const value = this.resolveAttachmentValue(raw);
    if (typeof value !== 'string' || value.length === 0) {
      return null;
    }

    const mimeType = this.resolveMimeType(raw);
    const explicitKind = this.resolveExplicitKind(raw);
    const kind = this.resolveAttachmentKind(explicitKind, mimeType, value);

    const attachment: ShareAttachment = {
      id: raw.id?.toString?.() ?? raw.identifier?.toString?.() ?? `att-${Date.now()}-${index}`,
      kind,
      value,
      mimeType,
      filename: this.resolveFilename(raw),
      size: this.resolveFileSize(raw),
      thumbnail: typeof raw.thumbnail === 'string' ? raw.thumbnail : undefined,
      uti: typeof raw.uti === 'string' ? raw.uti : undefined,
      extra:
        typeof raw.extra === 'object' && raw.extra !== null
          ? raw.extra
          : typeof raw.metadata === 'object' && raw.metadata !== null
            ? raw.metadata
            : undefined,
    };

    return attachment;
  }

  private resolveAttachmentValue(raw: any): string | null {
    if (!raw) {
      return null;
    }
    if (typeof raw.value === 'string') {
      return raw.value;
    }
    if (typeof raw.uri === 'string') {
      return raw.uri;
    }
    if (typeof raw.url === 'string') {
      return raw.url;
    }
    if (typeof raw.data === 'string') {
      return raw.data;
    }
    if (typeof raw.text === 'string') {
      return raw.text;
    }
    return null;
  }

  private resolveMimeType(raw: any): string | undefined {
    const candidate = raw?.mimeType || raw?.mimetype || raw?.type;
    if (typeof candidate === 'string' && candidate.includes('/')) {
      return candidate;
    }
    return undefined;
  }

  private resolveExplicitKind(raw: any): string | undefined {
    const candidate = raw?.kind || raw?.type;
    if (typeof candidate === 'string' && !candidate.includes('/')) {
      return candidate.toLowerCase();
    }
    return undefined;
  }

  private resolveFilename(raw: any): string | undefined {
    const candidate = raw?.filename || raw?.name || raw?.fileName;
    if (typeof candidate === 'string' && candidate.trim().length) {
      return candidate.trim();
    }
    return undefined;
  }

  private resolveFileSize(raw: any): number | undefined {
    const candidate = raw?.size ?? raw?.fileSize;
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate;
    }
    return undefined;
  }

  private resolveAttachmentKind(
    explicitKind: string | undefined,
    mimeType: string | undefined,
    value: string
  ): ShareAttachmentKind {
    if (explicitKind === 'file' || explicitKind === 'binary') {
      return 'file';
    }
    if (explicitKind === 'url' || explicitKind === 'link') {
      return 'url';
    }
    if (explicitKind === 'text' || explicitKind === 'string') {
      return 'text';
    }

    if (mimeType) {
      if (
        mimeType.startsWith('text/') ||
        mimeType === 'application/json' ||
        mimeType === 'application/xml'
      ) {
        return 'text';
      }
      if (mimeType.startsWith('message/')) {
        return 'text';
      }
      if (mimeType.startsWith('http')) {
        return 'url';
      }
      return 'file';
    }

    if (/^https?:\/\//i.test(value)) {
      return 'url';
    }
    if (value.startsWith('file://') || value.startsWith('/') || value.startsWith('content://')) {
      return 'file';
    }
    return 'text';
  }
}

export const ShareIntentService = new ShareIntentManager();

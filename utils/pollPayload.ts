import { Buffer } from 'buffer';

export interface PollPayload {
  question: string;
  options: string[];
}

export const encodePollPayload = (payload: PollPayload): string => {
  const json = JSON.stringify(payload);
  return Buffer.from(json, 'utf8').toString('base64');
};

export const decodePollPayload = (encoded: string): PollPayload | null => {
  if (!encoded) return null;
  try {
    const json = Buffer.from(encoded, 'base64').toString('utf8');
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed.question !== 'string' || !Array.isArray(parsed.options)) {
      return null;
    }
    return {
      question: parsed.question,
      options: parsed.options.map((opt: any) => String(opt)),
    };
  } catch (error) {
    return null;
  }
};

export const decodePollPayloadFromJson = (raw: string): PollPayload | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.question !== 'string' || !Array.isArray(parsed.options)) {
      return null;
    }
    return {
      question: parsed.question,
      options: parsed.options.map((opt: any) => String(opt)),
    };
  } catch (error) {
    return null;
  }
};

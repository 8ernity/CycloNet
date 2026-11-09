export interface ChatReply {
  response: string;
  category?: string;
  sources?: string[];
  timestamp?: string;
}

/** Reject malformed server output before it reaches React rendering. */
export function parseChatReply(value: unknown): ChatReply {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid chat response');
  const data = value as Record<string, unknown>;
  if (typeof data.response !== 'string' || !data.response.trim() || data.response.length > 12000) {
    throw new Error('Invalid chat text');
  }
  for (const [key, limit] of [['category', 80], ['timestamp', 128]] as const) {
    if (data[key] !== undefined && (typeof data[key] !== 'string' || data[key].length > limit)) {
      throw new Error('Invalid chat metadata');
    }
  }
  if (data.sources !== undefined && (!Array.isArray(data.sources) || data.sources.length > 8 ||
      data.sources.some(source => typeof source !== 'string' || source.length > 300))) {
    throw new Error('Invalid chat sources');
  }
  return {response:data.response, category:data.category as string | undefined,
    timestamp:data.timestamp as string | undefined, sources:data.sources as string[] | undefined};
}

/** Cap bytes before JSON parsing, including chunked responses without a length header. */
export async function readChatReply(response: Response): Promise<ChatReply> {
  if (!response.ok || !response.body) throw new Error('Chat unavailable');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 65536) throw new Error('Chat response exceeds byte limit');
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {bytes.set(chunk, offset); offset += chunk.byteLength;}
    return parseChatReply(JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(bytes)));
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

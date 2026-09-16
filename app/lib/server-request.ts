export class RequestBodyTooLargeError extends Error {}

// Content-Length is optional and caller-controlled, so also bound actual bytes.
export async function readSmallJson(request: Request, maxBytes = 1_024): Promise<unknown> {
  if (!request.body) return null;
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        void reader.cancel().catch(() => {});
        throw new RequestBodyTooLargeError();
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    try { return JSON.parse(text); } catch { return null; }
  } finally {
    reader.releaseLock();
  }
}

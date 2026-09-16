export class UpstreamTimeoutError extends Error {
  constructor() {
    super("Upstream request timed out");
    this.name = "UpstreamTimeoutError";
  }
}

// Keep the deadline active while reading the response body, not just headers.
export async function withUpstreamTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs = 8_000,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new UpstreamTimeoutError());
      controller.abort();
    }, timeoutMs);
  });
  try {
    return await Promise.race([operation(controller.signal), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

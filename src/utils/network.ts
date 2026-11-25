export const NETWORK_TIMEOUT_MS = 12000;

export const NETWORK_ERROR_MESSAGE =
  'تعذر الاتصال بقاعدة البيانات أو الإنترنت ضعيف جداً. لم يتم تسجيل العملية، يرجى التحقق من الشبكة والمحاولة مرة أخرى.';

export class NetworkDbError extends Error {
  constructor(message = NETWORK_ERROR_MESSAGE) {
    super(message);
    this.name = 'NetworkDbError';
  }
}

/**
 * Enforces online check and a 12-second timeout on all Supabase operations.
 */
export async function withDbTimeout<T>(
  promiseOrFn: PromiseLike<T> | (() => PromiseLike<T>),
  timeoutMs = NETWORK_TIMEOUT_MS
): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new NetworkDbError(NETWORK_ERROR_MESSAGE);
  }

  const targetPromise = typeof promiseOrFn === 'function' ? promiseOrFn() : promiseOrFn;

  let timerId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timerId = setTimeout(() => {
      reject(new NetworkDbError(NETWORK_ERROR_MESSAGE));
    }, timeoutMs);
  });

  try {
    return await Promise.race([Promise.resolve(targetPromise), timeoutPromise]);
  } catch (err) {
    if (err instanceof NetworkDbError) throw err;
    throw new NetworkDbError(NETWORK_ERROR_MESSAGE);
  } finally {
    if (timerId !== undefined) clearTimeout(timerId);
  }
}

export function assertDbOk(ok: boolean): void {
  if (!ok) {
    throw new NetworkDbError(NETWORK_ERROR_MESSAGE);
  }
}

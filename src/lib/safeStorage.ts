/**
 * Safe localStorage/sessionStorage wrappers that handle quota errors and exceptions gracefully
 */

export function safeGetItem(key: string, storage: Storage = localStorage): string | null {
  try {
    return storage.getItem(key);
  } catch (e) {
    console.warn(`Storage read failed for ${key}:`, e);
    return null;
  }
}

export function safeSetItem(key: string, value: string, storage: Storage = localStorage): boolean {
  try {
    storage.setItem(key, value);
    return true;
  } catch (e) {
    console.warn(`Storage write failed for ${key}:`, e);
    // Try to clear old data if quota exceeded
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      try {
        storage.clear();
        storage.setItem(key, value);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}

export function safeRemoveItem(key: string, storage: Storage = localStorage): boolean {
  try {
    storage.removeItem(key);
    return true;
  } catch (e) {
    console.warn(`Storage remove failed for ${key}:`, e);
    return false;
  }
}

export function safeParseJSON<T>(key: string, defaultValue: T, storage: Storage = localStorage): T {
  try {
    const stored = storage.getItem(key);
    if (stored) {
      return JSON.parse(stored) as T;
    }
  } catch (e) {
    console.warn(`Failed to parse JSON for ${key}:`, e);
  }
  return defaultValue;
}

export function safeStringifyJSON(key: string, value: unknown, storage: Storage = localStorage): boolean {
  try {
    const json = JSON.stringify(value);
    return safeSetItem(key, json, storage);
  } catch (e) {
    console.warn(`Failed to stringify JSON for ${key}:`, e);
    return false;
  }
}

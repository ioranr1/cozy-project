type StorageArea = 'local' | 'session';

const memoryStores: Record<StorageArea, Map<string, string>> = {
  local: new Map<string, string>(),
  session: new Map<string, string>(),
};

const getBrowserStorage = (area: StorageArea): Storage | null => {
  if (typeof window === 'undefined') return null;

  try {
    const storage = area === 'local' ? window.localStorage : window.sessionStorage;
    const testKey = `__aiguard_storage_test_${area}__`;
    storage.setItem(testKey, testKey);
    storage.removeItem(testKey);
    return storage;
  } catch {
    return null;
  }
};

export const safeStorage = {
  getItem(area: StorageArea, key: string): string | null {
    const storage = getBrowserStorage(area);
    if (storage) {
      try {
        return storage.getItem(key);
      } catch {
        return null;
      }
    }

    return memoryStores[area].get(key) ?? null;
  },

  setItem(area: StorageArea, key: string, value: string): void {
    const storage = getBrowserStorage(area);
    if (storage) {
      try {
        storage.setItem(key, value);
        return;
      } catch {
        // Fall through to in-memory storage.
      }
    }

    memoryStores[area].set(key, value);
  },

  removeItem(area: StorageArea, key: string): void {
    const storage = getBrowserStorage(area);
    if (storage) {
      try {
        storage.removeItem(key);
        return;
      } catch {
        // Fall through to in-memory storage.
      }
    }

    memoryStores[area].delete(key);
  },

  localStorageAdapter(): Storage {
    const storage = getBrowserStorage('local');
    if (storage) return storage;

    return {
      get length() {
        return memoryStores.local.size;
      },
      clear() {
        memoryStores.local.clear();
      },
      getItem(key: string) {
        return memoryStores.local.get(key) ?? null;
      },
      key(index: number) {
        return Array.from(memoryStores.local.keys())[index] ?? null;
      },
      removeItem(key: string) {
        memoryStores.local.delete(key);
      },
      setItem(key: string, value: string) {
        memoryStores.local.set(key, value);
      },
    };
  },
};
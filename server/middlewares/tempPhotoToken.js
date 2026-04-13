const tokens = new Map(); // token → { filePath, expiresAt }

const TTL_MS = 5 * 60 * 1000; // 5 минут

export const createTempToken = (filePath) => {
  const token = crypto.randomUUID();
  tokens.set(token, {
    filePath,
    expiresAt: Date.now() + TTL_MS,
  });

  // Автоматическая очистка через 5 минут
  setTimeout(() => tokens.delete(token), TTL_MS);

  return token;
};

export const resolveTempToken = (token) => {
  const entry = tokens.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    tokens.delete(token);
    return null;
  }
  return entry.filePath;
};

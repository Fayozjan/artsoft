const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function retry(fn, { retries = 3, delay = 2000, onError } = {}) {
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (onError) {
        onError(err, attempt);
      }

      if (attempt < retries) {
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

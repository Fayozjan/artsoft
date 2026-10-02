import { AsyncLocalStorage } from "node:async_hooks";

const requestStorage = new AsyncLocalStorage();

export const requestContext = {
  run(data, callback) {
    return requestStorage.run(data, callback);
  },

  get() {
    return requestStorage.getStore() ?? {};
  },
};

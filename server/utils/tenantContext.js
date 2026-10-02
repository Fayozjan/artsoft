import { AsyncLocalStorage } from "node:async_hooks";

const tenantStorage = new AsyncLocalStorage();

export const tenantContext = {
  run(tenant, callback) {
    return tenantStorage.run(tenant, callback);
  },

  get() {
    return tenantStorage.getStore() ?? null;
  },
};

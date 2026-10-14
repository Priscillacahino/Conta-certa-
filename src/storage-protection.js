export async function storageProtection({ request=false, storage=globalThis.navigator?.storage } = {}) {
  if (!storage?.persisted) return { supported:false, persistent:false };
  try {
    let persistent = await storage.persisted();
    if (!persistent && request && storage.persist) persistent = await storage.persist();
    return { supported:true, persistent:Boolean(persistent) };
  } catch {
    return { supported:true, persistent:false };
  }
}

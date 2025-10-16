export const PetsBus = (() => {
  const map = new Map();
  return {
    on(type, fn){ (map.get(type) ?? map.set(type, new Set()).get(type)).add(fn); },
    off(type, fn){ map.get(type)?.delete(fn); },
    emit(type, detail){ map.get(type)?.forEach(fn => { try{ fn(detail);}catch(e){ console.error('[PetsBus]', e); } }); }
  };
})();
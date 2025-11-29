// store.local.js
;(function (global) {
  const DEFAULT_KEY = 'deskday.entries.v1';

  function rid(){ return (crypto?.randomUUID?.() || Math.random().toString(36).slice(2)) }

  class DeskdayStore {
    constructor(key = DEFAULT_KEY){
      this.key = key;
      this.subs = new Set();
      this.data = this._load();
    }
    _load(){
      try { return JSON.parse(localStorage.getItem(this.key)) || {}; }
      catch { return {}; }
    }
    _save(){ localStorage.setItem(this.key, JSON.stringify(this.data)); }
    _emit(){ this.subs.forEach(fn => fn(this)); }

    subscribe(fn){ this.subs.add(fn); return () => this.subs.delete(fn); }
    snapshot(){ return JSON.parse(JSON.stringify(this.data)); }

    _hk(h){ return String(h).padStart(2,'0'); }
    getHour(h){ return this.data[this._hk(h)] || []; }
    setHour(h, arr){
      const k = this._hk(h);
      if (!arr || !arr.length) delete this.data[k];
      else this.data[k] = arr;
      this._save(); this._emit();
    }

    add(h, text, index = null, max = 3){
      const arr = this.getHour(h).slice(0, max);
      const newItem = { id: rid(), text: String(text).trim() };
      if (index == null || index < 0 || index > arr.length) arr.push(newItem);
      else arr.splice(index, 0, newItem);
      this.setHour(h, arr.slice(0, max));
      return newItem.id;
    }
    update(h, id, text){
      const arr = this.getHour(h).map(x => x.id === id ? {...x, text: String(text).trim()} : x);
      this.setHour(h, arr);
    }
    remove(h, id){
      const arr = this.getHour(h).filter(x => x.id !== id);
      this.setHour(h, arr);
    }
  }

  global.DeskdayStore = DeskdayStore;
})(window);

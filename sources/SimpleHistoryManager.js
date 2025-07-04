export class HistoryEntry {
  valid() {}
  reveal() {}
}
export class SimpleHistoryManager {
  constructor(t) {
    (this._entries = []),
      (this._activeEntryIndex = -1),
      (this._coalescingReadonly = 0),
      (this._historyDepth = t);
  }
  readOnlyLock() {
    ++this._coalescingReadonly;
  }
  releaseReadOnlyLock() {
    --this._coalescingReadonly;
  }
  readOnly() {
    return !!this._coalescingReadonly;
  }
  filterOut(t) {
    if (this.readOnly()) return;
    const e = [];
    let i = 0;
    for (let s = 0; s < this._entries.length; ++s)
      t(this._entries[s])
        ? s <= this._activeEntryIndex && ++i
        : e.push(this._entries[s]);
    (this._entries = e),
      (this._activeEntryIndex = Math.max(0, this._activeEntryIndex - i));
  }
  empty() {
    return !this._entries.length;
  }
  active() {
    return this.empty() ? null : this._entries[this._activeEntryIndex];
  }
  push(t) {
    this.readOnly() ||
      (this.empty() || this._entries.splice(this._activeEntryIndex + 1),
      this._entries.push(t),
      this._entries.length > this._historyDepth && this._entries.shift(),
      (this._activeEntryIndex = this._entries.length - 1));
  }
  rollback() {
    if (this.empty()) return !1;
    let t = this._activeEntryIndex - 1;
    for (; t >= 0 && !this._entries[t].valid(); ) --t;
    return (
      !(t < 0) &&
      (this.readOnlyLock(),
      this._entries[t].reveal(),
      this.releaseReadOnlyLock(),
      (this._activeEntryIndex = t),
      !0)
    );
  }
  rollover() {
    let t = this._activeEntryIndex + 1;
    for (; t < this._entries.length && !this._entries[t].valid(); ) ++t;
    return (
      !(t >= this._entries.length) &&
      (this.readOnlyLock(),
      this._entries[t].reveal(),
      this.releaseReadOnlyLock(),
      (this._activeEntryIndex = t),
      !0)
    );
  }
}

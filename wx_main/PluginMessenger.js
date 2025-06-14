import Messenger from "./Messenger.js";
import { uniqId, isFn } from "../third_party/licia.js";
export default class PluginMessenger {
  constructor(s) {
    this._messenger = new Messenger(s);
    this._callbacks = {};
    this._onEvents = {};

    this._messenger.registerCallback((s) => {
      const { command: e, data: n } = s;
      if (e === "INVOKE_CALLBACK") {
        const { callbackID: s, res: e } = n;
        const t = this._callbacks[s];

        if (t) {
          t.resolve(e);
          delete this._callbacks[s];
        }
      } else {
        if (e === "ON_EVENT") {
          this.triggerOnEvent(n);
        }
      }
    });
  }
  triggerOnEvent(s) {
    const { eventName: e, res: n } = s;
    const t = this._onEvents[e] || [];
    for (let s = 0, e = t.length; s < e; s++) {
      const e = t[s];

      if (isFn(e)) {
        e(n);
      }
    }
  }
  on(s, e) {
    const n = this._onEvents[s] || [];
    n.push(e);
    this._onEvents[s] = n;
  }
  off(s, e) {
    const n = this._onEvents[s] || [];
    const t = n.indexOf(e);

    if (-1 !== t) {
      n.splice(t, 1);
    }
  }
  send(s, e = {}) {
    return new Promise((n) => {
      const t = uniqId();
      this._callbacks[t] = { resolve: n };
      this._messenger.send({ command: s, data: e, callbackID: t });
    });
  }
}

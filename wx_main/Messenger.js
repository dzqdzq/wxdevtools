import { getPort, getMessageToken } from "./util.js";
const port = getPort();
const _url = `ws://127.0.0.1:${port}`;
const MAX_CONNECT_TRY_TIME = 100;
export default class Messenger {
  constructor(t, s = true) {
    this._protocol = t;
    this._needToken = s;
    this._ws = null;
    this._msgQueue = [];
    this._callback = [];
    this.tryTime = 0;

    if (document.readyState === "complete") {
      setTimeout(() => {
        this.connect();
      });
    } else {
      window.addEventListener("load", () => {
        this.connect();
      });
    }
  }
  connect() {
    if (!port) {
      return;
    }
    let t = this._protocol;
    if (this._needToken) {
      t = `${t}#${getMessageToken()}#`;
    }
    this._ws = new WebSocket(_url, t);

    this._ws.onopen = (t) => {
      const s = [].concat(this._msgQueue);
      this._msgQueue = [];

      s.forEach((t) => {
        this.send(t);
      });
    };

    this._ws.onclose = (t) => {
      this._ws = null;

      setTimeout(() => {
        if (this.tryTime < 100) {
          this.tryTime++;
          this.connect();
        }
      }, 150);
    };

    this._ws.onmessage = (t) => {
      try {
        const s = JSON.parse(t.data);
        this._callback.forEach((t) => {
          try {
            t.call(this, s);
          } catch (t) {}
        });
      } catch (t) {}
    };
  }
  send(t) {
    if (this._ws && this._ws.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify(t));
    } else {
      this._msgQueue.push(t);
    }
  }
  registerCallback(t) {
    if (typeof t == "function") {
      this._callback.push(t);
    }
  }
}

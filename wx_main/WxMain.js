import "./NetworkManager.js";
import "../third_party/sentry.js";
import {
  contain,
  pairs,
  waitUntil,
  Emitter,
  arrToMap,
  mapObj,
} from "../third_party/licia.js";
import { EnabledFeatures } from "./Config.js";
import Messenger from "./Messenger.js";
import { isWebWorker } from "./util.js";
const Events = mapObj(
  arrToMap([
    "setDevice",
    "clearDevice",
    "showView",
    "mainLoaded",
    "appUICreated",
    "tabAdded",
    "enableTouchEmulation",
    "lockTouchEmulation",
    "showContextMenu",
    "dispatchMessage",
    "loadPanel",
    "showAllRequests",
    "showElements",
    "autoRevealInstanceFrame",
    "requestRemoved",
  ]),
  (e, t) => t
);
export class WxMainImpl extends Emitter {
  constructor() {
    super();
    this.type = this._getType();
    this._globals = {};
    this._isMainLoaded = false;
    this._isAppUICreated = false;
  }
  setGlobal(e, t) {
    this._globals[e] = t;
  }
  getGlobal(e) {
    return this._globals[e];
  }
  runOnMainLoaded(e) {
    if (this._isMainLoaded) {
      e();
    }

    this.on(Events.mainLoaded, () => e());
  }
  runOnAppUICreated(e) {
    if (this._isAppUICreated) {
      e();
    }

    this.on(Events.appUICreated, () => e());
  }
  isFeatureEnabled(e) {
    return !!EnabledFeatures[this.type][e];
  }
  enableFeature(e, t = {}) {
    EnabledFeatures[this.type][e] = t;
  }
  disableFeature(e) {
    delete EnabledFeatures[this.type][e];
  }
  getFeatureOptions(e) {
    return EnabledFeatures[this.type][e];
  }
  getMessenger() {
    if (this._messenger) {
      return this._messenger;
    }
    let e = "";
    switch (this.type) {
      case "WebDebugger": {
        e = "HTMLWEBVIEWDEVTOOLS";
        break;
      }
      case "RemoteDebug": {
        e = "REMOTEDEBUGDEVTOOLS";
        break;
      }
      case "CloudFunctionsDebug": {
        const t = navigator.userAgent.match(/fid\/([^\s]+)/);
        e = `CLOUDFUNCTIONDEVTOOLS_${t ? t[1] : undefined}`;
        break;
      }
      case "LanDebug": {
        const s = navigator.userAgent.match(/landebugClientId\/([^\s]+)/);
        e = `LANDEBUGDEVTOOLS_${s ? s[1] : undefined}`;
        break;
      }
      default: {
        e = "APPSERVICEDEVTOOLS";
      }
    }
    const t = new Messenger(e);
    this._messenger = t;
    self.$messager = t;
    return t;
  }
  applyFeatures() {
    if (this.isFeatureEnabled("showView")) {
      this._showView();
    }

    if (this.isFeatureEnabled("loadPanel")) {
      this._loadPanel();
    }

    if (this.isFeatureEnabled("monitorMainLoaded")) {
      this._monitorMainLoaded();
    }

    if (this.isFeatureEnabled("monitorAppUICreated")) {
      this._monitorAppUICreated();
    }

    if (this.isFeatureEnabled("interceptDevToolsAPI")) {
      this._interceptDevToolsAPI();
    }

    if (this.isFeatureEnabled("dispatchMessage")) {
      this._dispatchMessage();
    }

    if (this.isFeatureEnabled("pure")) {
      this._pure();
    }

    if (this.isFeatureEnabled("sentry")) {
      this._initSentry();
    }
  }
  _pure() {
    this.getFeatureOptions("pure").handler();
  }
  async _dispatchMessage() {
    this.getMessenger().registerCallback((e) => {
      if (e.command === "DISPATCH_MESSAGE") {
        const t = e.data.method || "";
        if (
          this.isFeatureEnabled("restoreMissingLog") &&
          t.startsWith("Log.entryAdded")
        ) {
          const t = this.getGlobal("missingLog") || [];
          t.push(e.data.params.entry);
          this.setGlobal("missingLog", t);
        }
        this.emit(WxMain.Events.dispatchMessage, JSON.stringify(e.data));
      }
    });
  }
  async _interceptDevToolsAPI() {
    const e = await this._getDevToolsAPI();
    const t = this.getFeatureOptions("interceptDevToolsAPI");
    if (t.sendMessageToEmbedder) {
      const s = e.sendMessageToEmbedder.bind(e);
      e.sendMessageToEmbedder = (e, a, i) => {
        t.sendMessageToEmbedder(s, e, a, i);
      };
    }
    if (t.dispatchMessage) {
      const s = e.dispatchMessage.bind(e);
      e.dispatchMessage = (e) => {
        t.dispatchMessage(s, e);
      };
    }
  }
  _monitorMainLoaded() {
    this.on(Events.mainLoaded, () => {
      this._isMainLoaded = true;
    });
  }
  _monitorAppUICreated() {
    this.on(Events.appUICreated, () => {
      this._isAppUICreated = true;
    });
  }
  _showView() {
    this.getMessenger().registerCallback((e) => {
      if (e.command === "SHOW_PANNEL") {
        this.emit(Events.showView, e.data.name);
      }
    });
  }
  _loadPanel() {
    this.getMessenger().registerCallback((e) => {
      if (e.command === "LOAD_PANEL") {
        this.emit(Events.loadPanel, e.data.name);
      }
    });
  }
  async _getDevToolsAPI() {
    if (!self.DevToolsAPI) {
      await waitUntil(() => !!self.DevToolsAPI, 0, 50);
    }

    return self.DevToolsAPI;
  }
  async _initSentry() {
    const e = this.getMessenger();

    e.registerCallback((e) => {
      const { command, data } = e;

      if (command === "SET_SENTRY_REPORT_INFO") {
        Sentry.init({
          dsn: "https://0a9c075cc1b74198a0491ede5e225856@report.url.cn/sentry/2968",
          release: "inspector@0.11.27",
        });

        Sentry.setUser({
          id: data.openid,
          appid: data.appid,
          project: data.project,
        });
        Sentry.setTag("clientVersion", data.clientVersion);
      }
    });

    e.send({ command: "GET_SENTRY_REPORT_INFO" });
  }
  _getType() {
    if (isWebWorker()) {
      return "Unknown";
    }
    const navigator_userAgent = navigator.userAgent;

    const t = pairs({
      AppService: "appservicedevtools",
      Game: "gameservicedevtools",
      WebDebugger: "devtoolsview",
      RemoteDebug: "remotedebugdevtools",
      LanDebug: "landebugdevtools",
      CloudFunctionsDebug: "cloudfunctionsdebugdevtools",
    });

    for (let s = 0, a = t.length; s < a; s++) {
      const [a, i] = t[s];
      if (contain(navigator_userAgent, i)) {
        return a;
      }
    }
    return "Unknown";
  }
}
self.WxMain = self.WxMain || {};
self.wxMain = new WxMainImpl();
WxMain = WxMain || {};
WxMain.Events = Events;
WxMain.WxMain = WxMainImpl;
self.wxMain.applyFeatures();

import {
  contain,
  nextTick,
  waitUntil,
  find,
  bytesToStr,
  convertBin,
  startWith,
} from "../third_party/licia.js";
import { getProxyPort } from "./util.js";
const networkManager = WxMain.networkManager;
let first = true;
export function whenUrlChanged(e) {
  if (e === "inspectedURLChanged") {
    wxMain.emit(WxMain.Events.clearDevice);
    wxMain.emit(WxMain.Events.setDevice);
    first || wxMain.emit(WxMain.Events.enableTouchEmulation, true);
    first = false;
  }
}
export function setCloudRequestData(e) {
  if (e.method === "Network.requestWillBeSent") {
    e.base64body &&
      nextTick(() => {
        const t = getRequest(e.params.requestId);
        if (!t) {
          return;
        }
        const n = base64ToUtf8(e.base64body);
        t.setRequestFormData(true, n);
      });

    e.ext &&
      nextTick(() => {
        getRequest(e.params.requestId)._ext = e.ext;
      });
  } else if (e.method === "Network.loadingFinished" && e.base64body) {
    nextTick(() => {
      const t = getRequest(e.params.requestId);
      if (!t) {
        return;
      }
      const n = { error: null, content: base64ToUtf8(e.base64body) };

      if (t._contentData) {
        t._contentData = n;
      } else {
        t.setContentDataProvider(async () => n);
      }
    });
  }
}
function base64ToUtf8(e) {
  return bytesToStr(convertBin(e, "Uint8Array"), "utf8");
}
function getRequest(e) {
  const t = wxMain.getGlobal("SDK").NetworkLog.NetworkLog.instance().requests();
  return find(t, (t) => t._requestId === e);
}
const stackTraceCallbacks = {};
export function getStackTraceById() {
  wxMain.getMessenger().registerCallback((e) => {
    const { command: t, data: n } = e;

    if (t === "GET_STACK_TRACE_CALLBACK" && stackTraceCallbacks[n.id]) {
      stackTraceCallbacks[n.id](n.stackTrace);
      delete stackTraceCallbacks[n.id];
    }
  });
}
export function getStackTrace(e) {
  const { method: t, params: n } = e;
  if (
    t === "Runtime.consoleAPICalled" &&
    n.type === "debug" &&
    n.args.length === 1
  ) {
    const e = n.args[0];
    if (e.type === "string" && startWith(e.value, "~DP_DEBUG_")) {
      const t = JSON.parse(e.value.slice("~DP_DEBUG_".length));
      if (t.type === "NetworkStackTrace") {
        if (t.ignoreDepth) {
          n.stackTrace.callFrames = n.stackTrace.callFrames.slice(
            t.ignoreDepth
          );
        }

        const e = n.stackTrace.parentId;

        if (e) {
          wxMain
            .getMessenger()
            .send({ command: "GET_STACK_TRACE", data: { id: e.id } });

          stackTraceCallbacks[e.id] = (e) => {
            getRequest(t.requestId)._initiator.stack.parent = e;
          };
        }

        nextTick(async () => {
          await waitUntil(() => getRequest(t.requestId), 1000 /* 1e3 */, 20);
          getRequest(t.requestId)._initiator = {
            type: "script",
            stack: n.stackTrace,
          };
        });
      }
      return true;
    }
  }
}
const networkLogPattern = `http://127.0.0.1:${getProxyPort()}/networklog/`;
export function handleNetworkLog(e) {
  const { method: t, params: n } = e;
  if (/^Network\./.test(t) && t === "Network.requestWillBeSent") {
    const t = n.request.url || "";
    if (contain(t, networkLogPattern)) {
      const e = t.match(/\/([^\/]+)$/)[1];
      if (t.includes("requestWillBeSent")) {
        const t = getRequest(e);
        if (t) {
          const a = networkManager.getNetworkLogRequestCallFramesInfo(e);
          const o = (a && a.ignoreLength) || 0;
          t._initiator = {
            type: "script",
            stack: {
              callFrames: n.initiator.stack.callFrames.slice(1 + o),
              parent: n.initiator.stack.parent,
            },
          };
        } else {
          networkManager.addNetworkLogRequestCallFramesInfo(
            e,
            n.initiator.stack.callFrames
          );
        }
      }
      return true;
    }
    if (e.networkLog) {
      const t = e.networkLog.reqId;
      const n = networkManager.getNetworkLogRequestCallFramesInfo(t);
      const a = e.networkLog.callFramesIgnoreLength || 0;
      if (n && n.callFrames) {
        const e = n.callFrames.slice(1 + a);
        nextTick(() => {
          getRequest(t)._initiator = {
            type: "script",
            stack: { callFrames: e },
          };
        });
      }
    }
  }
}
export const consoleLink = {
  name: "consoleLink",
  options: {
    links: {
      openApplyPlugin: "devtools://openapplyplugin",
      enableEngineNative: "devtools://enableEngineNative",
      donotShowSwitchRenderModeAnymore:
        "devtools://donotShowSwitchRenderModeAnymore",
      switchRenderMode: "devtools://switchRenderMode",
      autoCheckMiniAppExModule: "devtools://autoCheckMiniAppExModule",
    },
  },
};
export const addQuickOpen = {
  name: "addQuickOpen",
  options: {
    commands: [
      {
        title: "Show AppService Elements",
        category: "Debug",
        handler() {
          wxMain.emit(WxMain.Events.showElements);
        },
      },
      {
        title: "Show all requests",
        category: "Debug",
        handler() {
          wxMain.emit(WxMain.Events.showAllRequests);
        },
      },
      {
        title: "Inspect DevTools",
        category: "Debug",
        handler() {
          wxMain.getMessenger().send({ command: "INSPECT_DEVTOOLS" });
        },
      },
      {
        title: "Enable AppService debug mode",
        category: "Debug",
        handler() {
          wxMain.setGlobal("appserviceDebug", true);
          wxMain.emit(WxMain.Events.showElements);
          wxMain.emit(WxMain.Events.showAllRequests);
        },
      },
      {
        title: "Enable Wxml debug mode",
        category: "Debug",
        handler() {
          wxMain.enableFeature("logWxmlConnection");
          wxMain.enableFeature("logWxmlPluginMessage");
        },
      },
    ],
  },
};
export const ensureDevtoolsSetting = {
  name: "ensureDevtoolsSetting",
  options: { data: { selectedContextFilterEnabled: false } },
};

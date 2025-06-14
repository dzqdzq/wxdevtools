import { contain, nextTick, startWith } from "../third_party/licia.js";
import { getProxyPort, getPort, isRemoteDebugGame } from "./util.js";
const shadowRootParentIdSet = new Set();
const pageFrameIdSet = new Set();
export function setTimestampOffset(e) {
  const { method, params } = e;
  if (
    method === "Network.requestWillBeSent" &&
    contain(
      params.request.url,
      `http://127.0.0.1:${getProxyPort()}/calibration`
    )
  ) {
    WxMain.networkManager.setTimestampOffset(
      params.wallTime - params.timestamp
    );
    return true;
  }
}
export function monitorDebugger(e) {
  if (e.method === "Debugger.paused") {
    alert("debugger:paused");
  } else if (e.method === "Debugger.resumed") {
    alert("debugger:resumed");
  }
}
let showAllRequests = false;
nextTick(() => {
  wxMain.on(WxMain.Events.showAllRequests, () => {
    showAllRequests = true;
  });
});
export function hideWebdebuggerRequest(e) {
  const { method, params } = e;
  if (
    method === "Network.requestWillBeSent" &&
    contain(
      params.request.url,
      `http://127.0.0.1:${getProxyPort()}/__webdebugger__`
    )
  ) {
    return true;
  }
}
export function hideOpenTagResources(e, t) {
  const a = `http://127.0.0.1:${getProxyPort()}/__webdebugger__`;
  const { method, params } = e;
  if (typeof method == "string" && method.startsWith("Page")) {
    switch (method) {
      case "Page.frameAttached": {
        if (
          params &&
          params.stack &&
          params.stack.callFrames &&
          Array.isArray(params.stack.callFrames) &&
          params.stack.callFrames.some((e) => e && e.url.includes(a))
        ) {
          pageFrameIdSet.add(params.frameId);
          return true;
        }
        break;
      }
      case "Page.frameStartedLoading": {
        if (params && params.frameId && pageFrameIdSet.has(params.frameId)) {
          return true;
        }
        break;
      }
      case "Page.frameNavigated": {
        if (
          params &&
          params.frame &&
          params.frame.id &&
          pageFrameIdSet.has(params.frame.id)
        ) {
          return true;
        }
      }
    }
  }
  if (
    typeof method == "string" &&
    method.startsWith("Runtime") &&
    method === "Runtime.executionContextCreated" &&
    params &&
    params.context &&
    params.context.auxData &&
    params.context.auxData.frameId &&
    pageFrameIdSet.has(params.context.auxData.frameId)
  ) {
    return true;
  }
  if (
    typeof method == "string" &&
    method.startsWith("Debugger") &&
    method === "Debugger.scriptParsed" &&
    params &&
    params.url &&
    params.url.includes(a)
  ) {
    return true;
  }
  if (typeof method == "string" && method.startsWith("DOM")) {
    let o = false;
    let n = false;
    let i = undefined;
    switch (method) {
      case "DOM.childNodeInserted": {
        if (
          params &&
          params.node &&
          params.node.attributes &&
          params.node.nodeName === "SCRIPT"
        ) {
          for (const e of params.node.attributes) {
            if (e.includes(a)) {
              o = true;
            }
          }
        }
        break;
      }
      case "DOM.documentUpdated": {
        shadowRootParentIdSet.clear();
        pageFrameIdSet.clear();
        break;
      }
      case "DOM.shadowRootPushed": {
        if (params && params.root && shadowRootParentIdSet.has(params.hostId)) {
          o = true;
        }

        break;
      }
      case "DOM.setChildNodes": {
        if (params && params.nodes) {
          params.nodes.forEach((e, t) => {
            if (e.nodeName.startsWith("WX-OPEN-")) {
              shadowRootParentIdSet.add(e.nodeId);

              if (e.shadowRoots) {
                delete e.shadowRoots;
                n = true;
              }
            } else if (e.nodeName === "SCRIPT" && e.attributes) {
              for (const r of e.attributes) {
                if (r.includes(a)) {
                  i = t;
                  n = true;
                }
              }
            }
          });
        }

        if (i !== undefined) {
          params.nodes.splice(i, 1);
        }
      }
    }
    if (o) {
      return o;
    }
    if (n) {
      t(e);
      return true;
    }
  }
}
export function hideRemoteDebugResources(e) {
  if (isRemoteDebugGame) {
    return;
  }
  const { method, params } = e;
  const r = ["WAServiceMainContext.js", "https://lib/", "wasm://"];
  if (
    typeof method == "string" &&
    method.startsWith("Debugger") &&
    method === "Debugger.scriptParsed" &&
    params &&
    params.url
  ) {
    const a_url = params.url;
    if (
      r.some((t) => a_url.startsWith(t)) ||
      !/^(http|https|weapp)/.test(a_url)
    ) {
      return true;
    }
  }
}
export function hideWebSocket(e) {
  if (!showAllRequests && e.method === "Network.webSocketCreated") {
    const t = e.params.url || "";
    if (contain(t, `ws://127.0.0.1:${getPort()}`)) {
      return true;
    }
  }
}
export function addDebuggee(e) {
  if (e.method === "Network.requestWillBeSent") {
    const e_params = e.params;

    if (!!e_params.frompageframe) {
      WxMain.networkManager.addDebuggee(e_params.requestId, e_params.debuggee);
    }
  }
}
export function addCustomRequest(e, t = false) {
  const { method, params } = e;
  if (/^Network\./.test(method)) {
    let a = t || params.frompageframe;

    if (!a) {
      if (e.custom && e.timestampOffsetRequired) {
        a = true;
      }
    }

    if (a) {
      WxMain.networkManager.addCustomRequest(params.requestId);
    }
  }
}
export function transTimestamp(e, t) {
  const { method, params } = e;
  if (e.custom && e.timestampOffsetRequired) {
    switch (method) {
      case "Network.requestWillBeSent":
      case "Network.dataReceived":
      case "Network.loadingFailed":
      case "Network.loadingFinished": {
        params.wallTime = params.timestamp;
        params.timestamp -= WxMain.networkManager.getTimestampOffset();
        t(JSON.stringify(e));
        return true;
      }
      case "Network.responseReceived": {
        params.timestamp -= WxMain.networkManager.getTimestampOffset();

        if (params.response.timing) {
          params.response.timing.requestTime -=
            WxMain.networkManager.getTimestampOffset();
        }

        t(JSON.stringify(e));
        return true;
      }
    }
  }
}
export function getResponseBody(e) {
  const { method, params } = e;
  if (method === "Network.getResponseBody") {
    const a_requestId = params.requestId;
    if (WxMain.networkManager.isCustomRequest(a_requestId)) {
      const r = WxMain.networkManager.getDebuggee(a_requestId);

      if (r) {
        params.debuggee = r;
      }

      wxMain
        .getMessenger()
        .send({ command: "Network.getResponseBody", data: e });

      return true;
    }
  }
}
export function disableTouchWhenInspect(e) {
  if (e.method === "Overlay.setInspectMode") {
    if (e.params.mode === "searchForNode") {
      wxMain.emit(WxMain.Events.enableTouchEmulation, false);
      wxMain.emit(WxMain.Events.lockTouchEmulation, true);
    } else {
      wxMain.emit(WxMain.Events.lockTouchEmulation, false);
      wxMain.emit(WxMain.Events.enableTouchEmulation, true);
    }
  }
}
export function correctLogStack(e, t) {
  if (e.method === "Runtime.consoleAPICalled") {
    const { type, stackTrace } = e.params;
    if (type !== "error" && type !== "warning") {
      return;
    }
    const { callFrames } = stackTrace;
    if (startWith(callFrames[0].functionName, "console.")) {
      callFrames.shift();
      t(JSON.stringify(e));
      return true;
    }
  }
}
export const disableMsgToCrashedWebView = {
  disable: false,
  send() {
    if (this.disable) {
      return true;
    }
  },
  on(e) {
    if (e.method === "Inspector.targetCrashed") {
      this.disable = true;
    } else if (e.medthod === "Inspector.targetReloadedAfterCrash") {
      this.disable = false;
    }
  },
};

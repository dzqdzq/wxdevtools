import * as Bindings from "../bindings/bindings.js";
import * as Common from "../common/common.js";
import * as SDK from "../sdk/sdk.js";
import * as UI from "../ui/ui.js";
export class DebuggerPausedMessage {
  constructor() {
    this._element = document.createElement("div");
    this._element.classList.add("paused-message");
    this._element.classList.add("flex-none");
    const e = UI.Utils.createShadowRootWithCoreStyles(
      this._element,
      "sources/debuggerPausedMessage.css"
    );
    this._contentElement = e.createChild("div");
    UI.ARIAUtils.markAsPoliteLiveRegion(this._element, false);
  }
  element() {
    return this._element;
  }
  static _descriptionWithoutStack(e) {
    const t = /^\s+at\s/m.exec(e);
    return t
      ? e.substring(0, t.index - 1)
      : e.substring(0, e.lastIndexOf("\n"));
  }
  static async _createDOMBreakpointHitMessage(e) {
    const t = createElement("span");
    const n = e.debuggerModel
      .target()
      .model(SDK.DOMDebuggerModel.DOMDebuggerModel);
    if (!e.auxData || !n) {
      return t;
    }
    const o = n.resolveDOMBreakpointData(e.auxData);
    if (!o) {
      return t;
    }
    const a = t.createChild("div", "status-main");
    a.appendChild(UI.Icon.Icon.create("smallicon-info", "status-icon"));
    const s = BreakpointTypeNouns.get(o.type);
    a.appendChild(createTextNode(ls`Paused on ${s}`));
    const i = t.createChild("div", "status-sub monospace");
    const r = await Common.Linkifier.Linkifier.linkify(o.node);
    i.appendChild(r);

    if (o.targetNode) {
      const e = await Common.Linkifier.Linkifier.linkify(o.targetNode);
      let t;

      t = o.insertion
        ? o.targetNode === o.node
          ? UI.UIUtils.formatLocalized("Child %s added", [e])
          : UI.UIUtils.formatLocalized("Descendant %s added", [e])
        : UI.UIUtils.formatLocalized("Descendant %s removed", [e]);

      i.appendChild(createElement("br"));
      i.appendChild(t);
    }

    return t;
  }
  async render(e, t, n) {
    this._contentElement.removeChildren();
    this._contentElement.hidden = !e;

    if (!e) {
      return;
    }

    const o = this._contentElement.createChild("div", "paused-status");

    const a =
      e.reason === SDK.DebuggerModel.BreakReason.Exception ||
      e.reason === SDK.DebuggerModel.BreakReason.PromiseRejection ||
      e.reason === SDK.DebuggerModel.BreakReason.PromiseRejection ||
      e.reason === SDK.DebuggerModel.BreakReason.Assert ||
      e.reason === SDK.DebuggerModel.BreakReason.PromiseRejection ||
      e.reason === SDK.DebuggerModel.BreakReason.Assert ||
      e.reason === SDK.DebuggerModel.BreakReason.OOM;

    let s;
    if (e.reason === SDK.DebuggerModel.BreakReason.DOM) {
      s = await DebuggerPausedMessage._createDOMBreakpointHitMessage(e);
    } else if (e.reason === SDK.DebuggerModel.BreakReason.EventListener) {
      let t = "";

      if (e.auxData) {
        t = self.SDK.domDebuggerManager.resolveEventListenerBreakpointTitle(
          e.auxData
        );
      }

      s = i(Common.UIString.UIString("Paused on event listener"), t);
    } else if (e.reason === SDK.DebuggerModel.BreakReason.XHR) {
      s = i(
        Common.UIString.UIString("Paused on XHR or fetch"),
        e.auxData.url || ""
      );
    } else if (e.reason === SDK.DebuggerModel.BreakReason.Exception) {
      const t =
        e.auxData.description || e.auxData.value || e.auxData.value || "";
      const n = DebuggerPausedMessage._descriptionWithoutStack(t);
      s = i(Common.UIString.UIString("Paused on exception"), n, t);
    } else if (e.reason === SDK.DebuggerModel.BreakReason.PromiseRejection) {
      const t =
        e.auxData.description || e.auxData.value || e.auxData.value || "";
      const n = DebuggerPausedMessage._descriptionWithoutStack(t);
      s = i(Common.UIString.UIString("Paused on promise rejection"), n, t);
    } else if (e.reason === SDK.DebuggerModel.BreakReason.Assert) {
      s = i(Common.UIString.UIString("Paused on assertion"));
    } else if (e.reason === SDK.DebuggerModel.BreakReason.DebugCommand) {
      s = i(Common.UIString.UIString("Paused on debugged function"));
    } else if (e.reason === SDK.DebuggerModel.BreakReason.OOM) {
      s = i(
        Common.UIString.UIString("Paused before potential out-of-memory crash")
      );
    } else if (e.callFrames.length) {
      const o = await t.rawLocationToUILocation(e.callFrames[0].location());
      s = i(
        (o ? n.findBreakpoint(o) : null)
          ? Common.UIString.UIString("Paused on breakpoint")
          : Common.UIString.UIString("Debugger paused")
      );
    } else {
      console.warn("ScriptsPanel paused, but callFrames.length is zero.");
    }
    function i(e, t, n) {
      const o = createElement("span");
      const s = o.createChild("div", "status-main");

      const i = UI.Icon.Icon.create(
        a ? "smallicon-error" : "smallicon-info",
        "status-icon"
      );

      s.appendChild(i);
      s.appendChild(createTextNode(e));

      if (t) {
        const e = o.createChild("div", "status-sub monospace");
        e.textContent = t;
        e.title = n || t;
      }

      return o;
    }
    o.classList.toggle("error-reason", a);

    if (s) {
      o.appendChild(s);
    }
  }
}
export const BreakpointTypeNouns = new Map([
  [
    Protocol.DOMDebugger.DOMBreakpointType.SubtreeModified,
    Common.UIString.UIString("subtree modifications"),
  ],
  [
    Protocol.DOMDebugger.DOMBreakpointType.AttributeModified,
    Common.UIString.UIString("attribute modifications"),
  ],
  [
    Protocol.DOMDebugger.DOMBreakpointType.NodeRemoved,
    Common.UIString.UIString("node removal"),
  ],
]);

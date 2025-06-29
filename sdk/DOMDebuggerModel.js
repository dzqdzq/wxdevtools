import * as Common from "../common/common.js";
import { Location } from "./DebuggerModel.js";
import { DOMModel, DOMNode, Events as DOMModelEvents } from "./DOMModel.js";
import { RemoteObject } from "./RemoteObject.js";
import { RuntimeModel } from "./RuntimeModel.js";
import {
  Capability,
  SDKModel,
  SDKModelObserver,
  Target,
  TargetManager,
} from "./SDKModel.js";
export class DOMDebuggerModel extends SDKModel {
  constructor(e) {
    super(e),
      (this._agent = e.domdebuggerAgent()),
      (this._runtimeModel = e.model(RuntimeModel)),
      (this._domModel = e.model(DOMModel)),
      this._domModel.addEventListener(
        DOMModelEvents.DocumentUpdated,
        this._documentUpdated,
        this
      ),
      this._domModel.addEventListener(
        DOMModelEvents.NodeRemoved,
        this._nodeRemoved,
        this
      ),
      (this._domBreakpoints = []),
      (this._domBreakpointsSetting =
        Common.Settings.Settings.instance().createLocalSetting(
          "domBreakpoints",
          []
        )),
      this._domModel.existingDocument() && this._documentUpdated();
  }
  runtimeModel() {
    return this._runtimeModel;
  }
  async eventListeners(e) {
    if ((console.assert(e.runtimeModel() === this._runtimeModel), !e.objectId))
      return [];
    const t = await this._agent.invoke_getEventListeners({
        objectId: e.objectId,
      }),
      n = [];
    for (const i of t.listeners || []) {
      const t = this._runtimeModel
        .debuggerModel()
        .createRawLocationByScriptId(i.scriptId, i.lineNumber, i.columnNumber);
      t &&
        n.push(
          new EventListener(
            this,
            e,
            i.type,
            i.useCapture,
            i.passive,
            i.once,
            i.handler ? this._runtimeModel.createRemoteObject(i.handler) : null,
            i.originalHandler
              ? this._runtimeModel.createRemoteObject(i.originalHandler)
              : null,
            t,
            null
          )
        );
    }
    return n;
  }
  retrieveDOMBreakpoints() {
    this._domModel.requestDocument();
  }
  domBreakpoints() {
    return this._domBreakpoints.slice();
  }
  hasDOMBreakpoint(e, t) {
    return this._domBreakpoints.some((n) => n.node === e && n.type === t);
  }
  setDOMBreakpoint(e, t) {
    for (const n of this._domBreakpoints)
      if (n.node === e && n.type === t)
        return this.toggleDOMBreakpoint(n, !0), n;
    const n = new DOMBreakpoint(this, e, t, !0);
    return (
      this._domBreakpoints.push(n),
      this._saveDOMBreakpoints(),
      this._enableDOMBreakpoint(n),
      this.dispatchEventToListeners(Events.DOMBreakpointAdded, n),
      n
    );
  }
  removeDOMBreakpoint(e, t) {
    this._removeDOMBreakpoints((n) => n.node === e && n.type === t);
  }
  removeAllDOMBreakpoints() {
    this._removeDOMBreakpoints((e) => !0);
  }
  toggleDOMBreakpoint(e, t) {
    t !== e.enabled &&
      ((e.enabled = t),
      t ? this._enableDOMBreakpoint(e) : this._disableDOMBreakpoint(e),
      this.dispatchEventToListeners(Events.DOMBreakpointToggled, e));
  }
  _enableDOMBreakpoint(e) {
    e.node.id &&
      (this._agent.invoke_setDOMBreakpoint({ nodeId: e.node.id, type: e.type }),
      e.node.setMarker(Marker, !0));
  }
  _disableDOMBreakpoint(e) {
    e.node.id &&
      (this._agent.invoke_removeDOMBreakpoint({
        nodeId: e.node.id,
        type: e.type,
      }),
      e.node.setMarker(Marker, !!this._nodeHasBreakpoints(e.node) || null));
  }
  _nodeHasBreakpoints(e) {
    for (const t of this._domBreakpoints)
      if (t.node === e && t.enabled) return !0;
    return !1;
  }
  resolveDOMBreakpointData(e) {
    const t = e.type,
      n = this._domModel.nodeForId(e.nodeId);
    if (!t || !n) return null;
    let i = null,
      r = !1;
    return (
      t === Protocol.DOMDebugger.DOMBreakpointType.SubtreeModified &&
        ((r = e.insertion || !1),
        (i = this._domModel.nodeForId(e.targetNodeId))),
      { type: t, node: n, targetNode: i, insertion: r }
    );
  }
  _currentURL() {
    const e = this._domModel.existingDocument();
    return e ? e.documentURL : "";
  }
  _documentUpdated() {
    const e = this._domBreakpoints;
    (this._domBreakpoints = []),
      this.dispatchEventToListeners(Events.DOMBreakpointsRemoved, e);
    const t = this._currentURL();
    for (const e of this._domBreakpointsSetting.get())
      e.url === t &&
        this._domModel.pushNodeByPathToFrontend(e.path).then(n.bind(this, e));
    function n(e, t) {
      const n = t ? this._domModel.nodeForId(t) : null;
      if (!n) return;
      const i = new DOMBreakpoint(this, n, e.type, e.enabled);
      this._domBreakpoints.push(i),
        e.enabled && this._enableDOMBreakpoint(i),
        this.dispatchEventToListeners(Events.DOMBreakpointAdded, i);
    }
  }
  _removeDOMBreakpoints(e) {
    const t = [],
      n = [];
    for (const i of this._domBreakpoints)
      e(i)
        ? (t.push(i),
          i.enabled && ((i.enabled = !1), this._disableDOMBreakpoint(i)))
        : n.push(i);
    t.length &&
      ((this._domBreakpoints = n),
      this._saveDOMBreakpoints(),
      this.dispatchEventToListeners(Events.DOMBreakpointsRemoved, t));
  }
  _nodeRemoved(e) {
    const t = e.data.node,
      n = t.children() || [];
    this._removeDOMBreakpoints((e) => e.node === t || -1 !== n.indexOf(e.node));
  }
  _saveDOMBreakpoints() {
    const e = this._currentURL(),
      t = this._domBreakpointsSetting.get().filter((t) => t.url !== e);
    for (const n of this._domBreakpoints)
      t.push({ url: e, path: n.node.path(), type: n.type, enabled: n.enabled });
    this._domBreakpointsSetting.set(t);
  }
}
export const Events = {
  DOMBreakpointAdded: Symbol("DOMBreakpointAdded"),
  DOMBreakpointToggled: Symbol("DOMBreakpointToggled"),
  DOMBreakpointsRemoved: Symbol("DOMBreakpointsRemoved"),
};
const Marker = "breakpoint-marker";
export class DOMBreakpoint {
  constructor(e, t, n, i) {
    (this.domDebuggerModel = e),
      (this.node = t),
      (this.type = n),
      (this.enabled = i);
  }
}
export class EventListener {
  constructor(e, t, n, i, r, o, s, a, m, d, l) {
    (this._domDebuggerModel = e),
      (this._eventTarget = t),
      (this._type = n),
      (this._useCapture = i),
      (this._passive = r),
      (this._once = o),
      (this._handler = s),
      (this._originalHandler = a || s),
      (this._location = m);
    const u = m.script();
    (this._sourceURL = u ? u.contentURL() : ""),
      (this._customRemoveFunction = d),
      (this._origin = l || EventListener.Origin.Raw);
  }
  domDebuggerModel() {
    return this._domDebuggerModel;
  }
  type() {
    return this._type;
  }
  useCapture() {
    return this._useCapture;
  }
  passive() {
    return this._passive;
  }
  once() {
    return this._once;
  }
  handler() {
    return this._handler;
  }
  location() {
    return this._location;
  }
  sourceURL() {
    return this._sourceURL;
  }
  originalHandler() {
    return this._originalHandler;
  }
  canRemove() {
    return (
      !!this._customRemoveFunction ||
      this._origin !== EventListener.Origin.FrameworkUser
    );
  }
  remove() {
    if (!this.canRemove()) return Promise.resolve(void 0);
    if (this._origin !== EventListener.Origin.FrameworkUser) {
      return this._eventTarget
        .callFunction(
          function (e, t, n) {
            this.removeEventListener(e, t, n),
              this["on" + e] && (this["on" + e] = void 0);
          },
          [
            RemoteObject.toCallArgument(this._type),
            RemoteObject.toCallArgument(this._originalHandler),
            RemoteObject.toCallArgument(this._useCapture),
          ]
        )
        .then(() => {});
    }
    if (this._customRemoveFunction) {
      return this._customRemoveFunction
        .callFunction(
          function (e, t, n, i) {
            this.call(null, e, t, n, i);
          },
          [
            RemoteObject.toCallArgument(this._type),
            RemoteObject.toCallArgument(this._originalHandler),
            RemoteObject.toCallArgument(this._useCapture),
            RemoteObject.toCallArgument(this._passive),
          ]
        )
        .then(() => {});
    }
    return Promise.resolve(void 0);
  }
  canTogglePassive() {
    return this._origin !== EventListener.Origin.FrameworkUser;
  }
  togglePassive() {
    return this._eventTarget
      .callFunction(
        function (e, t, n, i) {
          this.removeEventListener(e, t, { capture: n }),
            this.addEventListener(e, t, { capture: n, passive: !i });
        },
        [
          RemoteObject.toCallArgument(this._type),
          RemoteObject.toCallArgument(this._originalHandler),
          RemoteObject.toCallArgument(this._useCapture),
          RemoteObject.toCallArgument(this._passive),
        ]
      )
      .then(() => {});
  }
  origin() {
    return this._origin;
  }
  markAsFramework() {
    this._origin = EventListener.Origin.Framework;
  }
  isScrollBlockingType() {
    return (
      "touchstart" === this._type ||
      "touchmove" === this._type ||
      "mousewheel" === this._type ||
      "wheel" === this._type
    );
  }
}
EventListener.Origin = {
  Raw: "Raw",
  Framework: "Framework",
  FrameworkUser: "FrameworkUser",
};
export class EventListenerBreakpoint {
  constructor(e, t, n, i, r) {
    (this._instrumentationName = e),
      (this._eventName = t),
      (this._eventTargetNames = n),
      (this._category = i),
      (this._title = r),
      (this._enabled = !1);
  }
  category() {
    return this._category;
  }
  enabled() {
    return this._enabled;
  }
  setEnabled(e) {
    if (this._enabled !== e) {
      this._enabled = e;
      for (const e of TargetManager.instance().models(DOMDebuggerModel))
        this._updateOnModel(e);
    }
  }
  _updateOnModel(e) {
    if (this._instrumentationName)
      this._enabled
        ? e._agent.invoke_setInstrumentationBreakpoint({
            eventName: this._instrumentationName,
          })
        : e._agent.invoke_removeInstrumentationBreakpoint({
            eventName: this._instrumentationName,
          });
    else
      for (const t of this._eventTargetNames)
        this._enabled
          ? e._agent.invoke_setEventListenerBreakpoint({
              eventName: this._eventName,
              targetName: t,
            })
          : e._agent.invoke_removeEventListenerBreakpoint({
              eventName: this._eventName,
              targetName: t,
            });
  }
  title() {
    return this._title;
  }
}
(EventListenerBreakpoint._listener = "listener:"),
  (EventListenerBreakpoint._instrumentation = "instrumentation:");
export class DOMDebuggerManager {
  constructor() {
    (this._xhrBreakpointsSetting =
      Common.Settings.Settings.instance().createLocalSetting(
        "xhrBreakpoints",
        []
      )),
      (this._xhrBreakpoints = new Map());
    for (const e of this._xhrBreakpointsSetting.get())
      this._xhrBreakpoints.set(e.url, e.enabled);
    let e;
    (this._eventListenerBreakpoints = []),
      this._createInstrumentationBreakpoints(
        Common.UIString.UIString("Animation"),
        [
          "requestAnimationFrame",
          "cancelAnimationFrame",
          "requestAnimationFrame.callback",
        ]
      ),
      this._createInstrumentationBreakpoints(
        Common.UIString.UIString("Canvas"),
        ["canvasContextCreated", "webglErrorFired", "webglWarningFired"]
      ),
      this._createInstrumentationBreakpoints(
        Common.UIString.UIString("Geolocation"),
        ["Geolocation.getCurrentPosition", "Geolocation.watchPosition"]
      ),
      this._createInstrumentationBreakpoints(
        Common.UIString.UIString("Notification"),
        ["Notification.requestPermission"]
      ),
      this._createInstrumentationBreakpoints(
        Common.UIString.UIString("Parse"),
        ["Element.setInnerHTML", "Document.write"]
      ),
      this._createInstrumentationBreakpoints(
        Common.UIString.UIString("Script"),
        ["scriptFirstStatement", "scriptBlockedByCSP"]
      ),
      this._createInstrumentationBreakpoints(
        Common.UIString.UIString("Timer"),
        [
          "setTimeout",
          "clearTimeout",
          "setInterval",
          "clearInterval",
          "setTimeout.callback",
          "setInterval.callback",
        ]
      ),
      this._createInstrumentationBreakpoints(
        Common.UIString.UIString("Window"),
        ["DOMWindow.close"]
      ),
      this._createInstrumentationBreakpoints(
        Common.UIString.UIString("WebAudio"),
        [
          "audioContextCreated",
          "audioContextClosed",
          "audioContextResumed",
          "audioContextSuspended",
        ]
      ),
      this._createEventListenerBreakpoints(
        Common.UIString.UIString("Media"),
        [
          "play",
          "pause",
          "playing",
          "canplay",
          "canplaythrough",
          "seeking",
          "seeked",
          "timeupdate",
          "ended",
          "ratechange",
          "durationchange",
          "volumechange",
          "loadstart",
          "progress",
          "suspend",
          "abort",
          "error",
          "emptied",
          "stalled",
          "loadedmetadata",
          "loadeddata",
          "waiting",
        ],
        ["audio", "video"]
      ),
      this._createEventListenerBreakpoints(
        Common.UIString.UIString("Picture-in-Picture"),
        ["enterpictureinpicture", "leavepictureinpicture"],
        ["video"]
      ),
      this._createEventListenerBreakpoints(
        Common.UIString.UIString("Picture-in-Picture"),
        ["resize"],
        ["PictureInPictureWindow"]
      ),
      this._createEventListenerBreakpoints(
        Common.UIString.UIString("Clipboard"),
        ["copy", "cut", "paste", "beforecopy", "beforecut", "beforepaste"],
        ["*"]
      ),
      this._createEventListenerBreakpoints(
        Common.UIString.UIString("Control"),
        [
          "resize",
          "scroll",
          "zoom",
          "focus",
          "blur",
          "select",
          "change",
          "submit",
          "reset",
        ],
        ["*"]
      ),
      this._createEventListenerBreakpoints(
        Common.UIString.UIString("Device"),
        ["deviceorientation", "devicemotion"],
        ["*"]
      ),
      this._createEventListenerBreakpoints(
        Common.UIString.UIString("DOM Mutation"),
        [
          "DOMActivate",
          "DOMFocusIn",
          "DOMFocusOut",
          "DOMAttrModified",
          "DOMCharacterDataModified",
          "DOMNodeInserted",
          "DOMNodeInsertedIntoDocument",
          "DOMNodeRemoved",
          "DOMNodeRemovedFromDocument",
          "DOMSubtreeModified",
          "DOMContentLoaded",
        ],
        ["*"]
      ),
      this._createEventListenerBreakpoints(
        Common.UIString.UIString("Drag / drop"),
        [
          "drag",
          "dragstart",
          "dragend",
          "dragenter",
          "dragover",
          "dragleave",
          "drop",
        ],
        ["*"]
      ),
      this._createEventListenerBreakpoints(
        Common.UIString.UIString("Keyboard"),
        ["keydown", "keyup", "keypress", "input"],
        ["*"]
      ),
      this._createEventListenerBreakpoints(
        Common.UIString.UIString("Load"),
        [
          "load",
          "beforeunload",
          "unload",
          "abort",
          "error",
          "hashchange",
          "popstate",
        ],
        ["*"]
      ),
      this._createEventListenerBreakpoints(
        Common.UIString.UIString("Mouse"),
        [
          "auxclick",
          "click",
          "dblclick",
          "mousedown",
          "mouseup",
          "mouseover",
          "mousemove",
          "mouseout",
          "mouseenter",
          "mouseleave",
          "mousewheel",
          "wheel",
          "contextmenu",
        ],
        ["*"]
      ),
      this._createEventListenerBreakpoints(
        Common.UIString.UIString("Pointer"),
        [
          "pointerover",
          "pointerout",
          "pointerenter",
          "pointerleave",
          "pointerdown",
          "pointerup",
          "pointermove",
          "pointercancel",
          "gotpointercapture",
          "lostpointercapture",
          "pointerrawupdate",
        ],
        ["*"]
      ),
      this._createEventListenerBreakpoints(
        Common.UIString.UIString("Touch"),
        ["touchstart", "touchmove", "touchend", "touchcancel"],
        ["*"]
      ),
      this._createEventListenerBreakpoints(
        Common.UIString.UIString("Worker"),
        ["message", "messageerror"],
        ["*"]
      ),
      this._createEventListenerBreakpoints(
        Common.UIString.UIString("XHR"),
        [
          "readystatechange",
          "load",
          "loadstart",
          "loadend",
          "abort",
          "error",
          "progress",
          "timeout",
        ],
        ["xmlhttprequest", "xmlhttprequestupload"]
      ),
      (e = this._resolveEventListenerBreakpoint(
        "instrumentation:setTimeout.callback"
      )),
      e && (e._title = Common.UIString.UIString("setTimeout fired")),
      (e = this._resolveEventListenerBreakpoint(
        "instrumentation:setInterval.callback"
      )),
      e && (e._title = Common.UIString.UIString("setInterval fired")),
      (e = this._resolveEventListenerBreakpoint(
        "instrumentation:scriptFirstStatement"
      )),
      e && (e._title = Common.UIString.UIString("Script First Statement")),
      (e = this._resolveEventListenerBreakpoint(
        "instrumentation:scriptBlockedByCSP"
      )),
      e &&
        (e._title = Common.UIString.UIString(
          "Script Blocked by Content Security Policy"
        )),
      (e = this._resolveEventListenerBreakpoint(
        "instrumentation:requestAnimationFrame"
      )),
      e && (e._title = Common.UIString.UIString("Request Animation Frame")),
      (e = this._resolveEventListenerBreakpoint(
        "instrumentation:cancelAnimationFrame"
      )),
      e && (e._title = Common.UIString.UIString("Cancel Animation Frame")),
      (e = this._resolveEventListenerBreakpoint(
        "instrumentation:requestAnimationFrame.callback"
      )),
      e && (e._title = Common.UIString.UIString("Animation Frame Fired")),
      (e = this._resolveEventListenerBreakpoint(
        "instrumentation:webglErrorFired"
      )),
      e && (e._title = Common.UIString.UIString("WebGL Error Fired")),
      (e = this._resolveEventListenerBreakpoint(
        "instrumentation:webglWarningFired"
      )),
      e && (e._title = Common.UIString.UIString("WebGL Warning Fired")),
      (e = this._resolveEventListenerBreakpoint(
        "instrumentation:Element.setInnerHTML"
      )),
      e && (e._title = Common.UIString.UIString("Set innerHTML")),
      (e = this._resolveEventListenerBreakpoint(
        "instrumentation:canvasContextCreated"
      )),
      e && (e._title = Common.UIString.UIString("Create canvas context")),
      (e = this._resolveEventListenerBreakpoint(
        "instrumentation:Geolocation.getCurrentPosition"
      )),
      e && (e._title = "getCurrentPosition"),
      (e = this._resolveEventListenerBreakpoint(
        "instrumentation:Geolocation.watchPosition"
      )),
      e && (e._title = "watchPosition"),
      (e = this._resolveEventListenerBreakpoint(
        "instrumentation:Notification.requestPermission"
      )),
      e && (e._title = "requestPermission"),
      (e = this._resolveEventListenerBreakpoint(
        "instrumentation:DOMWindow.close"
      )),
      e && (e._title = "window.close"),
      (e = this._resolveEventListenerBreakpoint(
        "instrumentation:Document.write"
      )),
      e && (e._title = "document.write"),
      (e = this._resolveEventListenerBreakpoint(
        "instrumentation:audioContextCreated"
      )),
      e && (e._title = Common.UIString.UIString("Create AudioContext")),
      (e = this._resolveEventListenerBreakpoint(
        "instrumentation:audioContextClosed"
      )),
      e && (e._title = Common.UIString.UIString("Close AudioContext")),
      (e = this._resolveEventListenerBreakpoint(
        "instrumentation:audioContextResumed"
      )),
      e && (e._title = Common.UIString.UIString("Resume AudioContext")),
      (e = this._resolveEventListenerBreakpoint(
        "instrumentation:audioContextSuspended"
      )),
      e && (e._title = Common.UIString.UIString("Suspend AudioContext")),
      TargetManager.instance().observeModels(DOMDebuggerModel, this);
  }
  _createInstrumentationBreakpoints(e, t) {
    for (const n of t)
      this._eventListenerBreakpoints.push(
        new EventListenerBreakpoint(n, "", [], e, n)
      );
  }
  _createEventListenerBreakpoints(e, t, n) {
    for (const i of t)
      this._eventListenerBreakpoints.push(
        new EventListenerBreakpoint("", i, n, e, i)
      );
  }
  _resolveEventListenerBreakpoint(e, t) {
    let n = "";
    if (e.startsWith("instrumentation:"))
      (n = e.substring("instrumentation:".length)), (e = "");
    else {
      if (!e.startsWith("listener:")) return null;
      e = e.substring("listener:".length);
    }
    t = (t || "*").toLowerCase();
    let i = null;
    for (const r of this._eventListenerBreakpoints)
      n && r._instrumentationName === n && (i = r),
        e &&
          r._eventName === e &&
          -1 !== r._eventTargetNames.indexOf(t) &&
          (i = r),
        !i &&
          e &&
          r._eventName === e &&
          -1 !== r._eventTargetNames.indexOf("*") &&
          (i = r);
    return i;
  }
  eventListenerBreakpoints() {
    return this._eventListenerBreakpoints.slice();
  }
  resolveEventListenerBreakpointTitle(e) {
    const t = e.eventName;
    if ("instrumentation:webglErrorFired" === t && e.webglErrorName) {
      let t = e.webglErrorName;
      return (
        (t = t.replace(/^.*(0x[0-9a-f]+).*$/i, "$1")),
        Common.UIString.UIString("WebGL Error Fired (%s)", t)
      );
    }
    if ("instrumentation:scriptBlockedByCSP" === t && e.directiveText)
      return Common.UIString.UIString(
        "Script blocked due to Content Security Policy directive: %s",
        e.directiveText
      );
    const n = this._resolveEventListenerBreakpoint(t, e.targetName);
    return n ? (e.targetName ? e.targetName + "." + n._title : n._title) : "";
  }
  resolveEventListenerBreakpoint(e) {
    return this._resolveEventListenerBreakpoint(e.eventName, e.targetName);
  }
  xhrBreakpoints() {
    return this._xhrBreakpoints;
  }
  _saveXHRBreakpoints() {
    const e = [];
    for (const t of this._xhrBreakpoints.keys())
      e.push({ url: t, enabled: this._xhrBreakpoints.get(t) });
    this._xhrBreakpointsSetting.set(e);
  }
  addXHRBreakpoint(e, t) {
    if ((this._xhrBreakpoints.set(e, t), t))
      for (const t of TargetManager.instance().models(DOMDebuggerModel))
        t._agent.setXHRBreakpoint(e);
    this._saveXHRBreakpoints();
  }
  removeXHRBreakpoint(e) {
    const t = this._xhrBreakpoints.get(e);
    if ((this._xhrBreakpoints.delete(e), t))
      for (const t of TargetManager.instance().models(DOMDebuggerModel))
        t._agent.removeXHRBreakpoint(e);
    this._saveXHRBreakpoints();
  }
  toggleXHRBreakpoint(e, t) {
    this._xhrBreakpoints.set(e, t);
    for (const n of TargetManager.instance().models(DOMDebuggerModel))
      t ? n._agent.setXHRBreakpoint(e) : n._agent.removeXHRBreakpoint(e);
    this._saveXHRBreakpoints();
  }
  modelAdded(e) {
    for (const t of this._xhrBreakpoints.keys())
      this._xhrBreakpoints.get(t) &&
        e._agent.invoke_setXHRBreakpoint({ url: t });
    for (const t of this._eventListenerBreakpoints)
      t._enabled && t._updateOnModel(e);
  }
  modelRemoved(e) {}
}
SDKModel.register(DOMDebuggerModel, Capability.DOM, !1);

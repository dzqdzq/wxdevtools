import * as Bindings from "../bindings/bindings.js";
import * as Common from "../common/common.js";
import * as Host from "../host/host.js";
import * as SDK from "../sdk/sdk.js";
import * as UI from "../ui/ui.js";
import * as Workspace from "../workspace/workspace.js";
export class CallStackSidebarPane extends UI.View.SimpleView {
  constructor() {
    super(Common.UIString.UIString("Call Stack"), true);
    this.registerRequiredCSS("sources/callStackSidebarPane.css");
    this._blackboxedMessageElement = this._createBlackboxedMessageElement();
    this.contentElement.appendChild(this._blackboxedMessageElement);

    this._notPausedMessageElement = this.contentElement.createChild(
      "div",
      "gray-info-message"
    );

    this._notPausedMessageElement.textContent =
      Common.UIString.UIString("Not paused");
    this._notPausedMessageElement.tabIndex = -1;
    this._items = new UI.ListModel.ListModel();

    this._list = new UI.ListControl.ListControl(
      this._items,
      this,
      UI.ListControl.ListMode.NonViewport
    );

    this.contentElement.appendChild(this._list.element);

    this._list.element.addEventListener(
      "contextmenu",
      this._onContextMenu.bind(this),
      false
    );

    self.onInvokeElement(this._list.element, (e) => {
      const t = this._list.itemForNode(e.target);

      if (t) {
        this._activateItem(t);
        e.consume(true);
      }
    });

    this._showMoreMessageElement = this._createShowMoreMessageElement();
    this._showMoreMessageElement.classList.add("hidden");
    this.contentElement.appendChild(this._showMoreMessageElement);
    this._showBlackboxed = false;
    this._locationPool = new Bindings.LiveLocation.LiveLocationPool();
    this._updateThrottler = new Common.Throttler.Throttler(100);
    this._maxAsyncStackChainDepth = defaultMaxAsyncStackChainDepth;
    this._update();
    this._updateItemThrottler = new Common.Throttler.Throttler(100);
    this._scheduledForUpdateItems = new Set();
  }
  flavorChanged(e) {
    this._showBlackboxed = false;
    this._maxAsyncStackChainDepth = defaultMaxAsyncStackChainDepth;
    this._update();
  }
  _update() {
    this._updateThrottler.schedule(() => this._doUpdate());
  }
  async _doUpdate() {
    this._locationPool.disposeAll();
    const e = UI.Context.Context.instance().flavor(
      SDK.DebuggerModel.DebuggerPausedDetails
    );
    if (!e) {
      this.setDefaultFocusedElement(this._notPausedMessageElement);
      this._notPausedMessageElement.classList.remove("hidden");
      this._blackboxedMessageElement.classList.add("hidden");
      this._showMoreMessageElement.classList.add("hidden");
      this._items.replaceAll([]);

      return void UI.Context.Context.instance().setFlavor(
        SDK.DebuggerModel.CallFrame,
        null
      );
    }

    let { debuggerModel, asyncStackTrace, callFrames } = e;

    this._notPausedMessageElement.classList.add("hidden");
    const s = [];
    for (const t of e.callFrames) {
      const e = Item.createForDebuggerCallFrame(
        t,
        this._locationPool,
        this._refreshItem.bind(this)
      ).then((e) => {
        e[debuggerCallFrameSymbol] = t;
        return e;
      });
      s.push(e);
    }
    const a = await Promise.all(s);

    if (!asyncStackTrace && e.asyncStackTraceId) {
      e.asyncStackTraceId.debuggerId &&
        (debuggerModel = SDK.DebuggerModel.DebuggerModel.modelForDebuggerId(
          e.asyncStackTraceId.debuggerId
        ));

      asyncStackTrace = debuggerModel
        ? await debuggerModel.fetchAsyncStackTrace(e.asyncStackTraceId)
        : null;
    }

    let o = this._maxAsyncStackChainDepth;

    while (asyncStackTrace && o > 0) {
      let e = "";
      if (
        asyncStackTrace.description === "async function" &&
        callFrames.length &&
        asyncStackTrace.callFrames.length
      ) {
        const t = callFrames[callFrames.length - 1];
        const s = UI.UIUtils.beautifyFunctionName(t.functionName);
        e = UI.UIUtils.asyncStackTraceLabel(`await in ${s}`);
      } else {
        e = UI.UIUtils.asyncStackTraceLabel(asyncStackTrace.description);
      }

      a.push(
        ...(await Item.createItemsForAsyncStack(
          e,
          debuggerModel,
          asyncStackTrace.callFrames,
          this._locationPool,
          this._refreshItem.bind(this)
        ))
      );

      --o;
      callFrames = asyncStackTrace.callFrames;

      if (asyncStackTrace.parent) {
        asyncStackTrace = asyncStackTrace.parent;
      } else if (asyncStackTrace.parentId) {
        asyncStackTrace.parentId.debuggerId &&
          (debuggerModel = SDK.DebuggerModel.DebuggerModel.modelForDebuggerId(
            asyncStackTrace.parentId.debuggerId
          ));

        asyncStackTrace = debuggerModel
          ? await debuggerModel.fetchAsyncStackTrace(asyncStackTrace.parentId)
          : null;
      } else {
        asyncStackTrace = null;
      }
    }

    this._showMoreMessageElement.classList.toggle("hidden", !asyncStackTrace);
    this._items.replaceAll(a);

    if (this._maxAsyncStackChainDepth === defaultMaxAsyncStackChainDepth) {
      this._list.selectNextItem(true, false);
      const e = this._list.selectedItem();

      if (e) {
        this._activateItem(e);
      }
    }

    this._updatedForTest();
  }
  _updatedForTest() {}
  _refreshItem(e) {
    this._scheduledForUpdateItems.add(e);

    this._updateItemThrottler.schedule(() => {
      const e = Array.from(this._scheduledForUpdateItems);
      this._scheduledForUpdateItems.clear();
      this._muteActivateItem = true;

      if (!this._showBlackboxed && this._items.every((e) => e.isBlackboxed)) {
        this._showBlackboxed = true;
        for (let e = 0; e < this._items.length; ++e) {
          this._list.refreshItemByIndex(e);
        }
        this._blackboxedMessageElement.classList.toggle("hidden", true);
      } else {
        const t = new Set(e);
        let s = false;
        for (let e = 0; e < this._items.length; ++e) {
          const a = this._items.at(e);

          if (t.has(a)) {
            this._list.refreshItemByIndex(e);
          }

          s = s || a.isBlackboxed;
        }
        this._blackboxedMessageElement.classList.toggle(
          "hidden",
          this._showBlackboxed || !s
        );
      }

      delete this._muteActivateItem;
      return Promise.resolve();
    });
  }
  createElementForItem(e) {
    const t = document.createElement("div");
    t.classList.add("call-frame-item");

    t
      .createChild("div", "call-frame-item-title")
      .createChild("div", "call-frame-title-text").textContent = e.title;

    if (e.isAsyncHeader) {
      t.classList.add("async-header");
    } else {
      const s = t.createChild("div", "call-frame-location");
      s.textContent = e.linkText.trimMiddle(30);
      s.title = e.linkText;
      t.classList.toggle("blackboxed-call-frame", e.isBlackboxed);

      if (e.isBlackboxed) {
        UI.ARIAUtils.setDescription(t, ls`blackboxed`);
      }

      if (!e[debuggerCallFrameSymbol]) {
        UI.ARIAUtils.setDisabled(t, true);
      }
    }

    const s =
      e[debuggerCallFrameSymbol] ===
      UI.Context.Context.instance().flavor(SDK.DebuggerModel.CallFrame);
    t.classList.toggle("selected", s);
    UI.ARIAUtils.setSelected(t, s);
    t.classList.toggle("hidden", !this._showBlackboxed && e.isBlackboxed);

    t.appendChild(
      UI.Icon.Icon.create(
        "smallicon-thick-right-arrow",
        "selected-call-frame-icon"
      )
    );

    t.tabIndex = e === this._list.selectedItem() ? 0 : -1;
    return t;
  }
  heightForItem(e) {
    console.assert(false);
    return 0;
  }
  isItemSelectable(e) {
    return true;
  }
  selectedItemChanged(e, t, s, a) {
    if (s) {
      s.tabIndex = -1;
    }

    if (a) {
      this.setDefaultFocusedElement(a);
      a.tabIndex = 0;
      this.hasFocus() && a.focus();
    }
  }
  updateSelectedItemARIA(e, t) {
    return true;
  }
  _createBlackboxedMessageElement() {
    const e = document.createElement("div");
    e.classList.add("blackboxed-message");
    e.createChild("span");
    const t = e.createChild("span", "link");
    t.textContent = Common.UIString.UIString("Show blackboxed frames");
    UI.ARIAUtils.markAsLink(t);
    t.tabIndex = 0;
    const s = () => {
      this._showBlackboxed = true;
      for (const e of this._items) {
        this._refreshItem(e);
      }
      this._blackboxedMessageElement.classList.toggle("hidden", true);
    };
    t.addEventListener("click", s);

    t.addEventListener("keydown", (e) => isEnterKey(e) && s());

    return e;
  }
  _createShowMoreMessageElement() {
    const e = document.createElement("div");
    e.classList.add("show-more-message");
    e.createChild("span");
    const t = e.createChild("span", "link");
    t.textContent = Common.UIString.UIString("Show more");

    t.addEventListener(
      "click",
      () => {
        this._maxAsyncStackChainDepth += defaultMaxAsyncStackChainDepth;
        this._update();
      },
      false
    );

    return e;
  }
  _onContextMenu(e) {
    const t = this._list.itemForNode(e.target);
    if (!t) {
      return;
    }
    const s = new UI.ContextMenu.ContextMenu(e);
    const t_debuggerCallFrameSymbol = t[debuggerCallFrameSymbol];

    if (t_debuggerCallFrameSymbol) {
      s.defaultSection().appendItem(
        Common.UIString.UIString("Restart frame"),
        () => t_debuggerCallFrameSymbol.restart()
      );
    }

    s.defaultSection().appendItem(
      Common.UIString.UIString("Copy stack trace"),
      this._copyStackTrace.bind(this)
    );

    if (t.uiLocation) {
      this.appendBlackboxURLContextMenuItems(s, t.uiLocation.uiSourceCode);
    }

    s.show();
  }
  _onClick(e) {
    const t = this._list.itemForNode(e.target);

    if (t) {
      this._activateItem(t);
    }
  }
  _activateItem(e) {
    const { uiLocation } = e;

    if (this._muteActivateItem || !uiLocation) {
      return;
    }
    this._list.selectItem(e);
    const s = e[debuggerCallFrameSymbol];
    const a = this.activeCallFrameItem();

    if (s && a !== e) {
      s.debuggerModel.setSelectedCallFrame(s);
      UI.Context.Context.instance().setFlavor(SDK.DebuggerModel.CallFrame, s);
      a && this._refreshItem(a);
      this._refreshItem(e);
    } else {
      Common.Revealer.reveal(uiLocation);
    }
  }
  activeCallFrameItem() {
    const e = UI.Context.Context.instance().flavor(SDK.DebuggerModel.CallFrame);
    return (
      (e && this._items.find((t) => t[debuggerCallFrameSymbol] === e)) || null
    );
  }
  appendBlackboxURLContextMenuItems(e, t) {
    const s = self.Persistence.persistence.binding(t);

    if (s) {
      t = s.network;
    }

    if (t.project().type() === Workspace.Workspace.projectTypes.FileSystem) {
      return;
    }

    const a =
      Bindings.BlackboxManager.BlackboxManager.instance().canBlackboxUISourceCode(
        t
      );

    const n =
      Bindings.BlackboxManager.BlackboxManager.instance().isBlackboxedUISourceCode(
        t
      );

    const i =
      t.project().type() === Workspace.Workspace.projectTypes.ContentScripts;

    const o = Bindings.BlackboxManager.BlackboxManager.instance();

    if (a) {
      if (n) {
        e.defaultSection().appendItem(
          Common.UIString.UIString("Stop blackboxing"),
          o.unblackboxUISourceCode.bind(o, t)
        );
      } else {
        e.defaultSection().appendItem(
          Common.UIString.UIString("Blackbox script"),
          o.blackboxUISourceCode.bind(o, t)
        );
      }
    }

    if (i) {
      if (n) {
        e.defaultSection().appendItem(
          Common.UIString.UIString("Stop blackboxing all content scripts"),
          o.blackboxContentScripts.bind(o)
        );
      } else {
        e.defaultSection().appendItem(
          Common.UIString.UIString("Blackbox all content scripts"),
          o.unblackboxContentScripts.bind(o)
        );
      }
    }
  }
  _selectNextCallFrameOnStack() {
    const e = this.activeCallFrameItem();
    for (
      let t = e ? this._items.indexOf(e) + 1 : 0;
      t < this._items.length;
      t++
    ) {
      const e = this._items.at(t);
      if (e[debuggerCallFrameSymbol]) {
        this._activateItem(e);
        break;
      }
    }
  }
  _selectPreviousCallFrameOnStack() {
    const e = this.activeCallFrameItem();
    for (
      let t = e ? this._items.indexOf(e) - 1 : this._items.length - 1;
      t >= 0;
      t--
    ) {
      const e = this._items.at(t);
      if (e[debuggerCallFrameSymbol]) {
        this._activateItem(e);
        break;
      }
    }
  }
  _copyStackTrace() {
    const e = [];
    for (const t of this._items) {
      let t_title = t.title;

      if (t.uiLocation) {
        t_title += ` (${t.uiLocation.linkText(true)})`;
      }

      e.push(t_title);
    }
    Host.InspectorFrontendHost.InspectorFrontendHostInstance.copyText(
      e.join("\n")
    );
  }
}
export const debuggerCallFrameSymbol = Symbol("debuggerCallFrame");
export const elementSymbol = Symbol("element");
export const defaultMaxAsyncStackChainDepth = 32;
export class ActionDelegate {
  handleAction(e, t) {
    const s = self.runtime.sharedInstance(CallStackSidebarPane);
    switch (t) {
      case "debugger.next-call-frame": {
        s._selectNextCallFrameOnStack();
        return true;
      }
      case "debugger.previous-call-frame": {
        s._selectPreviousCallFrameOnStack();
        return true;
      }
    }
    return false;
  }
}
export class Item {
  static async createForDebuggerCallFrame(e, t, s) {
    const a = new Item(UI.UIUtils.beautifyFunctionName(e.functionName), s);

    await Bindings.DebuggerWorkspaceBinding.DebuggerWorkspaceBinding.instance().createCallFrameLiveLocation(
      e.location(),
      a._update.bind(a),
      t
    );

    return a;
  }
  static async createItemsForAsyncStack(e, t, s, a, n) {
    const i = Symbol("whiteboxedItems");
    const o = new Item(e, n);
    o[i] = new Set();
    o.isAsyncHeader = true;
    const l = [];
    const c = [];
    for (const e of s) {
      const s = new Item(UI.UIUtils.beautifyFunctionName(e.functionName), r);

      const n = t
        ? t.createRawLocationByScriptId(
            e.scriptId,
            e.lineNumber,
            e.columnNumber
          )
        : null;

      if (n) {
        c.push(
          Bindings.DebuggerWorkspaceBinding.DebuggerWorkspaceBinding.instance().createCallFrameLiveLocation(
            n,
            s._update.bind(s),
            a
          )
        );
      } else {
        s.linkText = `${e.url || "<unknown>"}:${e.lineNumber + 1}`;
        s.updateDelegate(s);
      }

      l.push(s);
    }
    await Promise.all(c);
    n(o);
    return [o, ...l];
    function r(e) {
      n(e);
      let t = false;
      const o_i = o[i];

      if (e.isBlackboxed) {
        o_i.delete(e);
        t = o_i.size === 0;
      } else {
        t = o_i.size === 0;
        o_i.add(e);
      }

      o.isBlackboxed = o[i].size === 0;

      if (t) {
        n(o);
      }
    }
  }
  constructor(e, t) {
    this.isBlackboxed = false;
    this.title = e;
    this.linkText = "";
    this.uiLocation = null;
    this.isAsyncHeader = false;
    this.updateDelegate = t;
  }
  async _update(e) {
    const t = await e.uiLocation();
    this.isBlackboxed = await e.isBlackboxed();
    this.linkText = t ? t.linkText() : "";
    this.uiLocation = t;
    this.updateDelegate(this);
  }
}

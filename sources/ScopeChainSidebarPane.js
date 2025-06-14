import * as Common from "../common/common.js";
import * as Components from "../components/components.js";
import * as ObjectUI from "../object_ui/object_ui.js";
import * as SDK from "../sdk/sdk.js";
import * as UI from "../ui/ui.js";
import {
  resolveScopeInObject,
  resolveThisObject,
} from "./SourceMapNamesResolver.js";
export class ScopeChainSidebarPane extends UI.Widget.VBox {
  constructor() {
    super(true);
    this.registerRequiredCSS("sources/scopeChainSidebarPane.css");
    this._treeOutline =
      new ObjectUI.ObjectPropertiesSection.ObjectPropertiesSectionsTreeOutline();

    this._treeOutline.registerRequiredCSS("sources/scopeChainSidebarPane.css");

    this._treeOutline.setShowSelectionOnKeyboardFocus(true);

    this._expandController =
      new ObjectUI.ObjectPropertiesSection.ObjectPropertiesSectionsTreeExpandController(
        this._treeOutline
      );

    this._linkifier = new Components.Linkifier.Linkifier();
    this._infoElement = createElement("div");
    this._infoElement.className = "gray-info-message";
    this._infoElement.textContent = ls`Not paused`;
    this._infoElement.tabIndex = -1;
    this._update();
  }
  flavorChanged(e) {
    this._update();
  }
  focus() {
    if (!this.hasFocus()) {
      if (
        UI.Context.Context.instance().flavor(
          SDK.DebuggerModel.DebuggerPausedDetails
        )
      ) {
        this._treeOutline.forceSelect();
      }
    }
  }
  _getScopeChain(e) {
    return e.sourceScopeChain || e.scopeChain();
  }
  _update() {
    const e = UI.Context.Context.instance().flavor(SDK.DebuggerModel.CallFrame);

    const t = UI.Context.Context.instance().flavor(
      SDK.DebuggerModel.DebuggerPausedDetails
    );

    this._linkifier.reset();
    resolveThisObject(e).then(this._innerUpdate.bind(this, t, e));
  }
  _innerUpdate(e, t, o) {
    this._treeOutline.removeChildren();
    this.contentElement.removeChildren();

    if (!e || !t) {
      return void this.contentElement.appendChild(this._infoElement);
    }

    this.contentElement.appendChild(this._treeOutline.element);
    let i = false;
    const n = this._getScopeChain(t);

    n.forEach((r, s) => {
      const c = this._extraPropertiesForScope(r, e, t, o, s === 0);

      if (r.type() === Protocol.Debugger.ScopeType.Local) {
        i = true;
      }

      const l = this._createScopeSectionTreeElement(r, c);

      if (r.type() === Protocol.Debugger.ScopeType.Global) {
        l.collapse();
      } else if (!i || r.type() === Protocol.Debugger.ScopeType.Local) {
        l.expand();
      }

      this._treeOutline.appendChild(l);

      if (s === 0) {
        l.select(true);
      }
    });

    this._sidebarPaneUpdatedForTest();
  }
  _createScopeSectionTreeElement(e, t) {
    let o = null;

    if (
      e.type() === Protocol.Debugger.ScopeType.Local ||
      Protocol.Debugger.ScopeType.Closure
    ) {
      o = ls`No variables`;
    }

    let i = e.typeName();
    if (e.type() === Protocol.Debugger.ScopeType.Closure) {
      const t = e.name();
      i = t ? ls`Closure (${UI.UIUtils.beautifyFunctionName(t)})` : ls`Closure`;
    }
    let n = e.description();

    if (!i || i === n) {
      n = undefined;
    }

    const s = document.createElement("div");
    s.classList.add("scope-chain-sidebar-pane-section-header");
    s.classList.add("tree-element-title");

    s.createChild(
      "div",
      "scope-chain-sidebar-pane-section-subtitle"
    ).textContent = n;

    s.createChild("div", "scope-chain-sidebar-pane-section-title").textContent =
      i;

    const r = new ObjectUI.ObjectPropertiesSection.RootElement(
      resolveScopeInObject(e),
      this._linkifier,
      o,
      true,
      t
    );
    r.title = s;
    r.listItemElement.classList.add("scope-chain-sidebar-pane-section");
    r.listItemElement.setAttribute("aria-label", i);
    this._expandController.watchSection(i + (n ? `:${n}` : ""), r);
    return r;
  }
  _extraPropertiesForScope(e, t, o, i, n) {
    if (e.type() !== Protocol.Debugger.ScopeType.Local || o.script.isWasm()) {
      return [];
    }
    const s = [];

    if (i) {
      s.push(new SDK.RemoteObject.RemoteObjectProperty("this", i));
    }

    if (n) {
      const e = t.exception();

      if (e) {
        s.push(
          new SDK.RemoteObject.RemoteObjectProperty(
            Common.UIString.UIString("Exception"),
            e,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            true
          )
        );
      }

      const i = o.returnValue();

      if (i) {
        s.push(
          new SDK.RemoteObject.RemoteObjectProperty(
            Common.UIString.UIString("Return value"),
            i,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            true,
            o.setReturnValue.bind(o)
          )
        );
      }
    }

    return s;
  }
  _sidebarPaneUpdatedForTest() {}
}
export const pathSymbol = Symbol("path");

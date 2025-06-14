import * as Common from "../common/common.js";
import * as SDK from "../sdk/sdk.js";
import * as UI from "../ui/ui.js";
export class ThreadsSidebarPane extends UI.Widget.VBox {
  constructor() {
    super(true);
    this.registerRequiredCSS("sources/threadsSidebarPane.css");
    this._items = new UI.ListModel.ListModel();

    this._list = new UI.ListControl.ListControl(
      this._items,
      this,
      UI.ListControl.ListMode.NonViewport
    );

    const e = UI.Context.Context.instance().flavor(SDK.SDKModel.Target);
    this._selectedModel = e ? e.model(SDK.DebuggerModel.DebuggerModel) : null;
    this.contentElement.appendChild(this._list.element);

    UI.Context.Context.instance().addFlavorChangeListener(
      SDK.SDKModel.Target,
      this._targetFlavorChanged,
      this
    );

    SDK.SDKModel.TargetManager.instance().observeModels(
      SDK.DebuggerModel.DebuggerModel,
      this
    );
  }
  static shouldBeShown() {
    return (
      SDK.SDKModel.TargetManager.instance().models(
        SDK.DebuggerModel.DebuggerModel
      ).length >= 2
    );
  }
  createElementForItem(e) {
    const t = document.createElement("div");
    t.classList.add("thread-item");
    const s = t.createChild("div", "thread-item-title");
    const n = t.createChild("div", "thread-item-paused-state");

    t.appendChild(
      UI.Icon.Icon.create("smallicon-thick-right-arrow", "selected-thread-icon")
    );

    t.tabIndex = -1;

    self.onInvokeElement(t, (t) => {
      UI.Context.Context.instance().setFlavor(SDK.SDKModel.Target, e.target());

      t.consume(true);
    });

    const o =
      UI.Context.Context.instance().flavor(SDK.SDKModel.Target) === e.target();
    function d() {
      const t = e.runtimeModel().defaultExecutionContext();
      s.textContent = t && t.label() ? t.label() : e.target().name();
    }
    function i() {
      n.textContent = e.isPaused() ? ls`paused` : "";
    }
    t.classList.toggle("selected", o);
    UI.ARIAUtils.setSelected(t, o);
    e.addEventListener(SDK.DebuggerModel.Events.DebuggerPaused, i);
    e.addEventListener(SDK.DebuggerModel.Events.DebuggerResumed, i);

    e.runtimeModel().addEventListener(
      SDK.RuntimeModel.Events.ExecutionContextChanged,
      d
    );

    SDK.SDKModel.TargetManager.instance().addEventListener(
      SDK.SDKModel.Events.NameChanged,
      (t) => {
        if (t.data === e.target()) {
          d();
        }
      }
    );

    i();
    d();
    return t;
  }
  heightForItem(e) {
    console.assert(false);
    return 0;
  }
  isItemSelectable(e) {
    return true;
  }
  selectedItemChanged(e, t, s, n) {
    if (s) {
      s.tabIndex = -1;
    }

    if (n) {
      this.setDefaultFocusedElement(n);
      n.tabIndex = 0;
      this.hasFocus() && n.focus();
    }
  }
  updateSelectedItemARIA(e, t) {
    return false;
  }
  modelAdded(e) {
    this._items.insert(this._items.length, e);

    if (
      UI.Context.Context.instance().flavor(SDK.SDKModel.Target) === e.target()
    ) {
      this._list.selectItem(e);
    }
  }
  modelRemoved(e) {
    this._items.remove(this._items.indexOf(e));
  }
  _targetFlavorChanged(e) {
    const t = this.hasFocus();
    const s = e.data.model(SDK.DebuggerModel.DebuggerModel);

    if (s) {
      this._list.refreshItem(s);
    }

    if (this._selectedModel) {
      this._list.refreshItem(this._selectedModel);
    }

    this._selectedModel = s;

    if (t) {
      this.focus();
    }
  }
}

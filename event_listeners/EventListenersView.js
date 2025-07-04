import * as Common from "../common/common.js";
import * as Components from "../components/components.js";
import * as ObjectUI from "../object_ui/object_ui.js";
import * as SDK from "../sdk/sdk.js";
import * as UI from "../ui/ui.js";
import {
  frameworkEventListeners,
  FrameworkEventListenersObject,
} from "./EventListenersUtils.js";
export class EventListenersView extends UI.Widget.VBox {
  constructor(e, t = !1) {
    super(),
      (this._changeCallback = e),
      (this._enableDefaultTreeFocus = t),
      (this._treeOutline = new UI.TreeOutline.TreeOutlineInShadow()),
      this._treeOutline.hideOverflow(),
      this._treeOutline.registerRequiredCSS("object_ui/objectValue.css"),
      this._treeOutline.registerRequiredCSS(
        "event_listeners/eventListenersView.css"
      ),
      this._treeOutline.setComparator(EventListenersTreeElement.comparator),
      this._treeOutline.element.classList.add("monospace"),
      this._treeOutline.setShowSelectionOnKeyboardFocus(!0),
      this._treeOutline.setFocusable(!0),
      this.element.appendChild(this._treeOutline.element),
      (this._emptyHolder = document.createElement("div")),
      this._emptyHolder.classList.add("gray-info-message"),
      (this._emptyHolder.textContent =
        Common.UIString.UIString("No event listeners")),
      (this._emptyHolder.tabIndex = -1),
      (this._linkifier = new Components.Linkifier.Linkifier()),
      (this._treeItemMap = new Map());
  }
  focus() {
    this._enableDefaultTreeFocus &&
      (this._emptyHolder.parentNode
        ? this._emptyHolder.focus()
        : this._treeOutline.forceSelect());
  }
  async addObjects(e) {
    this.reset(),
      await Promise.all(
        e.map((e) => (e ? this._addObject(e) : Promise.resolve()))
      ),
      this.addEmptyHolderIfNeeded(),
      this._eventListenersArrivedForTest();
  }
  _addObject(e) {
    let t,
      n = null;
    const i = [],
      s = e
        .runtimeModel()
        .target()
        .model(SDK.DOMDebuggerModel.DOMDebuggerModel);
    return (
      s &&
        i.push(
          s.eventListeners(e).then(function (e) {
            t = e;
          })
        ),
      i.push(
        frameworkEventListeners(e).then(function (e) {
          n = e;
        })
      ),
      Promise.all(i)
        .then(function () {
          if (!n.internalHandlers) return Promise.resolve(void 0);
          return n.internalHandlers
            .object()
            .callFunctionJSON(
              function () {
                const e = [],
                  t = new Set(this);
                for (const n of arguments) e.push(t.has(n));
                return e;
              },
              t.map(function (e) {
                return SDK.RemoteObject.RemoteObject.toCallArgument(
                  e.handler()
                );
              })
            )
            .then(function (e) {
              for (let n = 0; n < t.length; ++n) e[n] && t[n].markAsFramework();
            });
        })
        .then(
          function () {
            this._addObjectEventListeners(e, t),
              this._addObjectEventListeners(e, n.eventListeners);
          }.bind(this)
        )
    );
  }
  _addObjectEventListeners(e, t) {
    if (t)
      for (const n of t) {
        this._getOrCreateTreeElementForType(n.type()).addObjectEventListener(
          n,
          e
        );
      }
  }
  showFrameworkListeners(e, t, n) {
    const i = this._treeOutline.rootElement().children();
    for (const s of i) {
      let i = !0;
      for (const r of s.children()) {
        const s = r.eventListener().origin();
        let o = !1;
        s !== SDK.DOMDebuggerModel.EventListener.Origin.FrameworkUser ||
          e ||
          (o = !0),
          s === SDK.DOMDebuggerModel.EventListener.Origin.Framework &&
            e &&
            (o = !0),
          !t && r.eventListener().passive() && (o = !0),
          n || r.eventListener().passive() || (o = !0),
          (r.hidden = o),
          (i = i && o);
      }
      s.hidden = i;
    }
  }
  _getOrCreateTreeElementForType(e) {
    let t = this._treeItemMap.get(e);
    return (
      t ||
        ((t = new EventListenersTreeElement(
          e,
          this._linkifier,
          this._changeCallback
        )),
        this._treeItemMap.set(e, t),
        (t.hidden = !0),
        this._treeOutline.appendChild(t)),
      this._emptyHolder.remove(),
      t
    );
  }
  addEmptyHolderIfNeeded() {
    let e = !0,
      t = null;
    for (const n of this._treeOutline.rootElement().children())
      (n.hidden = !n.firstChild()),
        (e = e && n.hidden),
        t || n.hidden || (t = n);
    e &&
      !this._emptyHolder.parentNode &&
      this.element.appendChild(this._emptyHolder),
      t && t.select(!0);
  }
  reset() {
    const e = this._treeOutline.rootElement().children();
    for (const t of e) t.removeChildren();
    this._linkifier.reset();
  }
  _eventListenersArrivedForTest() {}
}
export class EventListenersTreeElement extends UI.TreeOutline.TreeElement {
  constructor(e, t, n) {
    super(e),
      (this.toggleOnClick = !0),
      (this._linkifier = t),
      (this._changeCallback = n),
      UI.ARIAUtils.setAccessibleName(
        this.listItemElement,
        e + ", event listener"
      );
  }
  static comparator(e, t) {
    return e.title === t.title ? 0 : e.title > t.title ? 1 : -1;
  }
  addObjectEventListener(e, t) {
    const n = new ObjectEventListenerBar(
      e,
      t,
      this._linkifier,
      this._changeCallback
    );
    this.appendChild(n);
  }
}
export class ObjectEventListenerBar extends UI.TreeOutline.TreeElement {
  constructor(e, t, n, i) {
    super("", !0),
      (this._eventListener = e),
      (this.editable = !1),
      this._setTitle(t, n),
      (this._changeCallback = i);
  }
  async onpopulate() {
    const e = [],
      t = this._eventListener,
      n = t.domDebuggerModel().runtimeModel();
    e.push(
      n.createRemotePropertyFromPrimitiveValue("useCapture", t.useCapture())
    ),
      e.push(n.createRemotePropertyFromPrimitiveValue("passive", t.passive())),
      e.push(n.createRemotePropertyFromPrimitiveValue("once", t.once())),
      void 0 !== t.handler() &&
        e.push(
          new SDK.RemoteObject.RemoteObjectProperty("handler", t.handler())
        ),
      ObjectUI.ObjectPropertiesSection.ObjectPropertyTreeElement.populateWithProperties(
        this,
        e,
        [],
        !0,
        null
      );
  }
  _setTitle(e, t) {
    const n = this.listItemElement.createChild(
        "span",
        "event-listener-details"
      ),
      i = this.listItemElement.createChild(
        "span",
        "event-listener-tree-subtitle"
      ),
      s = t.linkifyRawLocation(
        this._eventListener.location(),
        this._eventListener.sourceURL()
      );
    i.appendChild(s);
    const r =
      ObjectUI.ObjectPropertiesSection.ObjectPropertiesSection.createPropertyValue(
        e,
        !1,
        !1
      );
    if (
      ((this._valueTitle = r.element),
      n.appendChild(this._valueTitle),
      this._eventListener.canRemove())
    ) {
      const e = n.createChild("span", "event-listener-button");
      (e.textContent = Common.UIString.UIString("Remove")),
        (e.title = Common.UIString.UIString("Delete event listener")),
        e.addEventListener(
          "click",
          (e) => {
            this._removeListener(), e.consume();
          },
          !1
        ),
        n.appendChild(e);
    }
    if (
      this._eventListener.isScrollBlockingType() &&
      this._eventListener.canTogglePassive()
    ) {
      const e = n.createChild("span", "event-listener-button");
      (e.textContent = Common.UIString.UIString("Toggle Passive")),
        (e.title = Common.UIString.UIString(
          "Toggle whether event listener is passive or blocking"
        )),
        e.addEventListener(
          "click",
          (e) => {
            this._togglePassiveListener(), e.consume();
          },
          !1
        ),
        n.appendChild(e);
    }
    this.listItemElement.addEventListener("contextmenu", (t) => {
      const n = new UI.ContextMenu.ContextMenu(t);
      t.target !== s && n.appendApplicableItems(s),
        "node" === e.subtype &&
          n
            .defaultSection()
            .appendItem(ls`Reveal in Elements panel`, () =>
              Common.Revealer.reveal(e)
            ),
        n
          .defaultSection()
          .appendItem(
            ls`Delete event listener`,
            this._removeListener.bind(this),
            !this._eventListener.canRemove()
          ),
        n
          .defaultSection()
          .appendCheckboxItem(
            ls`Passive`,
            this._togglePassiveListener.bind(this),
            this._eventListener.passive(),
            !this._eventListener.canTogglePassive()
          ),
        n.show();
    });
  }
  _removeListener() {
    this._removeListenerBar(), this._eventListener.remove();
  }
  _togglePassiveListener() {
    this._eventListener.togglePassive().then(this._changeCallback());
  }
  _removeListenerBar() {
    const e = this.parent;
    e.removeChild(this), e.childCount() || e.collapse();
    let t = !0;
    for (let n = 0; n < e.childCount(); ++n) e.childAt(n).hidden || (t = !1);
    e.hidden = t;
  }
  eventListener() {
    return this._eventListener;
  }
  onenter() {
    return !!this._valueTitle && (this._valueTitle.click(), !0);
  }
}

import * as Bindings from "../bindings/bindings.js";
import * as Common from "../common/common.js";
import * as SDK from "../sdk/sdk.js";
import * as TextUtils from "../text_utils/text_utils.js";
import * as UI from "../ui/ui.js";
import * as Workspace from "../workspace/workspace.js";
export class JavaScriptBreakpointsSidebarPane extends UI.ThrottledWidget
  .ThrottledWidget {
  constructor() {
    super(true);
    this.registerRequiredCSS("sources/javaScriptBreakpointsSidebarPane.css");
    this._breakpointManager =
      Bindings.BreakpointManager.BreakpointManager.instance();

    this._breakpointManager.addEventListener(
      Bindings.BreakpointManager.Events.BreakpointAdded,
      this.update,
      this
    );

    this._breakpointManager.addEventListener(
      Bindings.BreakpointManager.Events.BreakpointRemoved,
      this.update,
      this
    );

    Common.Settings.Settings.instance()
      .moduleSetting("breakpointsActive")
      .addChangeListener(this.update, this);

    this._breakpoints = new UI.ListModel.ListModel();

    this._list = new UI.ListControl.ListControl(
      this._breakpoints,
      this,
      UI.ListControl.ListMode.NonViewport
    );

    UI.ARIAUtils.markAsList(this._list.element);
    this.contentElement.appendChild(this._list.element);

    this._emptyElement = this.contentElement.createChild(
      "div",
      "gray-info-message"
    );

    this._emptyElement.textContent = ls`No breakpoints`;
    this._emptyElement.tabIndex = -1;
    this.update();
  }
  _getBreakpointLocations() {
    const t = this._breakpointManager
      .allBreakpointLocations()
      .filter(
        (t) =>
          t.uiLocation.uiSourceCode.project().type() !==
          Workspace.Workspace.projectTypes.Debugger
      );
    t.sort((t, e) => t.uiLocation.compareTo(e.uiLocation));
    const e = [];
    let n = null;
    let i = null;
    for (const o of t) {
      if (o.breakpoint !== n || (i && o.uiLocation.compareTo(i))) {
        e.push(o);
        n = o.breakpoint;
        i = o.uiLocation;
      }
    }
    return e;
  }
  _hideList() {
    this._list.element.classList.add("hidden");
    this._emptyElement.classList.remove("hidden");
  }
  _ensureListShown() {
    this._list.element.classList.remove("hidden");
    this._emptyElement.classList.add("hidden");
  }
  _groupBreakpointLocationsById(t) {
    const e = new Platform.Multimap();
    for (const n of t) {
      const n_uiLocation = n.uiLocation;
      e.set(n_uiLocation.id(), n);
    }
    const n = [];
    for (const t of e.keysArray()) {
      const i = Array.from(e.get(t));

      if (i.length) {
        n.push(i);
      }
    }
    return n;
  }
  _getLocationIdsByLineId(t) {
    const e = new Platform.Multimap();
    for (const n of t) {
      const n_uiLocation = n.uiLocation;
      e.set(n_uiLocation.lineId(), n_uiLocation.id());
    }
    return e;
  }
  async _getSelectedUILocation() {
    const t = UI.Context.Context.instance().flavor(
      SDK.DebuggerModel.DebuggerPausedDetails
    );
    return t && t.callFrames.length
      ? await Bindings.DebuggerWorkspaceBinding.DebuggerWorkspaceBinding.instance().rawLocationToUILocation(
          t.callFrames[0].location()
        )
      : null;
  }
  _getContent(t) {
    const e = new Map();
    return Promise.all(
      t.map(
        async ([
          {
            uiLocation: { uiSourceCode: t },
          },
        ]) => {
          if (t.mimeType() === "application/wasm") {
            return new TextUtils.Text.Text("");
          }
          const { content } = await t.requestContent();
          const i = content || "";
          if (e.has(i)) {
            return e.get(i);
          }
          const o = new TextUtils.Text.Text(i);
          e.set(i, o);
          return o;
        }
      )
    );
  }
  async doUpdate() {
    const t = this.hasFocus();
    const e = this._getBreakpointLocations();
    if (!e.length) {
      this._hideList();
      this._setBreakpointItems([]);
      return this._didUpdateForTest();
    }
    this._ensureListShown();
    const n = this._groupBreakpointLocationsById(e);
    const i = this._getLocationIdsByLineId(e);
    const o = await this._getContent(n);
    const s = await this._getSelectedUILocation();
    const a = [];

    n.forEach((e, t) => {
      const r = e[0].uiLocation;

      const l = !!s && e.some((t) => t.uiLocation.id() === s.id());

      const c = i.get(r.lineId()).size > 1;
      const o_t = o[t];
      a.push(new BreakpointItem(e, o_t, l, c));
    });

    if (a.some((t) => t.isSelected)) {
      UI.ViewManager.ViewManager.instance().showView("sources.jsBreakpoints");
    }

    this._list.element.classList.toggle(
      "breakpoints-list-deactivated",
      !Common.Settings.Settings.instance()
        .moduleSetting("breakpointsActive")
        .get()
    );

    this._setBreakpointItems(a);

    if (t) {
      this.focus();
    }

    return this._didUpdateForTest();
  }
  _setBreakpointItems(t) {
    if (this._breakpoints.length === t.length) {
      for (let e = 0; e < this._breakpoints.length; e++) {
        if (!this._breakpoints.at(e).isSimilar(t[e])) {
          this._breakpoints.replace(e, t[e]);
        }
      }
    } else {
      this._breakpoints.replaceAll(t);
    }
  }
  createElementForItem(t) {
    const e = document.createElement("div");
    e.classList.add("breakpoint-entry");
    UI.ARIAUtils.markAsListitem(e);
    e.tabIndex = this._list.selectedItem() === t ? 0 : -1;

    e.addEventListener(
      "contextmenu",
      this._breakpointContextMenu.bind(this),
      true
    );

    e.addEventListener("click", this._revealLocation.bind(this, e), false);
    const n = UI.UIUtils.CheckboxLabel.create("");
    const i = t.locations[0].uiLocation;

    const o = t.locations.some((t) => t.breakpoint.enabled());

    const s = t.locations.some((t) => !t.breakpoint.enabled());

    n.textElement.textContent =
      i.linkText() + (t.showColumn ? `:${i.columnNumber + 1}` : "");
    n.checkboxElement.checked = o;
    n.checkboxElement.indeterminate = o && s;
    n.checkboxElement.tabIndex = -1;

    n.addEventListener(
      "click",
      this._breakpointCheckboxClicked.bind(this),
      false
    );

    e.appendChild(n);
    let a = o ? ls`checked` : ls`unchecked`;

    if (o && s) {
      a = ls`mixed`;
    }

    if (t.isSelected) {
      UI.ARIAUtils.setDescription(e, ls`${a} breakpoint hit`);
      e.classList.add("breakpoint-hit");
      this.setDefaultFocusedElement(e);
    } else {
      UI.ARIAUtils.setDescription(e, a);
    }

    e.addEventListener("keydown", (t) => {
      if (t.key === " ") {
        n.checkboxElement.click();
        t.consume(true);
      }
    });

    const r = e.createChild("div", "source-text monospace");
    const i_lineNumber = i.lineNumber;
    if (t.text && i_lineNumber < t.text.lineCount()) {
      const e = t.text.lineAt(i_lineNumber);
      const n = 200;
      r.textContent = e
        .substring(t.showColumn ? i.columnNumber : 0)
        .trimEndWithMaxLength(n);
    }
    e[breakpointLocationsSymbol] = t.locations;
    e[locationSymbol] = i;
    return e;
  }
  heightForItem(t) {
    return 0;
  }
  isItemSelectable(t) {
    return true;
  }
  selectedItemChanged(t, e, n, i) {
    if (n) {
      n.tabIndex = -1;
    }

    if (i) {
      i.tabIndex = 0;
      this.setDefaultFocusedElement(i);
      this.hasFocus() && i.focus();
    }
  }
  updateSelectedItemARIA(t, e) {
    return true;
  }
  _breakpointLocations(t) {
    return t.target instanceof Element
      ? this._breakpointLocationsForElement(t.target)
      : [];
  }
  _breakpointLocationsForElement(t) {
    const e = t.enclosingNodeOrSelfWithClass("breakpoint-entry");
    return (e && e[breakpointLocationsSymbol]) || [];
  }
  _breakpointCheckboxClicked(t) {
    const e = this.hasFocus();

    const n = this._breakpointLocations(t).map((t) => t.breakpoint);

    const i = t.target.checkboxElement.checked;
    for (const t of n) {
      t.setEnabled(i);
      const e = this._breakpoints.find((e) =>
        e.locations.some((e) => e.breakpoint === t)
      );

      if (e) {
        this._list.refreshItem(e);
      }
    }

    if (e) {
      this.focus();
    }

    t.consume();
  }
  _revealLocation(t) {
    const e = this._breakpointLocationsForElement(t).map((t) => t.uiLocation);
    let n = null;
    for (const t of e) {
      if (!n || t.columnNumber < n.columnNumber) {
        n = t;
      }
    }

    if (n) {
      Common.Revealer.reveal(n);
    }
  }
  _breakpointContextMenu(t) {
    const e = this._breakpointLocations(t).map((t) => t.breakpoint);

    const n = new UI.ContextMenu.ContextMenu(t);

    const i =
      e.length > 1
        ? Common.UIString.UIString("Remove all breakpoints in line")
        : Common.UIString.UIString("Remove breakpoint");

    n.defaultSection().appendItem(i, () => e.map((t) => t.remove(false)));

    if (t.target instanceof Element) {
      n.defaultSection().appendItem(
        ls`Reveal location`,
        this._revealLocation.bind(this, t.target)
      );
    }

    const o = Common.Settings.Settings.instance()
      .moduleSetting("breakpointsActive")
      .get();

    const s = o
      ? Common.UIString.UIString("Deactivate breakpoints")
      : Common.UIString.UIString("Activate breakpoints");

    n.defaultSection().appendItem(s, () =>
      Common.Settings.Settings.instance()
        .moduleSetting("breakpointsActive")
        .set(!o)
    );

    if (e.some((t) => !t.enabled())) {
      const e = Common.UIString.UIString("Enable all breakpoints");

      n.defaultSection().appendItem(
        e,
        this._toggleAllBreakpoints.bind(this, true)
      );

      if (t.target instanceof Element) {
        const e = Common.UIString.UIString("Enable breakpoints in file");
        n.defaultSection().appendItem(
          e,
          this._toggleAllBreakpointsInFile.bind(this, t.target, true)
        );
      }
    }

    if (e.some((t) => t.enabled())) {
      const e = Common.UIString.UIString("Disable all breakpoints");

      n.defaultSection().appendItem(
        e,
        this._toggleAllBreakpoints.bind(this, false)
      );

      if (t.target instanceof Element) {
        const e = Common.UIString.UIString("Disable breakpoints in file");
        n.defaultSection().appendItem(
          e,
          this._toggleAllBreakpointsInFile.bind(this, t.target, false)
        );
      }
    }
    const a = Common.UIString.UIString("Remove all breakpoints");
    n.defaultSection().appendItem(a, this._removeAllBreakpoints.bind(this));
    const r = Common.UIString.UIString("Remove other breakpoints");

    n.defaultSection().appendItem(
      r,
      this._removeOtherBreakpoints.bind(this, new Set(e))
    );

    n.show();
  }
  _toggleAllBreakpointsInFile(t, e) {
    const n = this._getBreakpointLocations();
    const i = this._breakpointLocationsForElement(t);
    n.forEach((t) => {
      if (i.some((e) => e.breakpoint.url() === t.breakpoint.url())) {
        t.breakpoint.setEnabled(e);
      }
    });
  }
  _toggleAllBreakpoints(t) {
    for (const e of this._breakpointManager.allBreakpointLocations()) {
      e.breakpoint.setEnabled(t);
    }
  }
  _removeAllBreakpoints() {
    for (const t of this._breakpointManager.allBreakpointLocations()) {
      t.breakpoint.remove(false);
    }
  }
  _removeOtherBreakpoints(t) {
    for (const e of this._breakpointManager.allBreakpointLocations()) {
      if (!t.has(e.breakpoint)) {
        e.breakpoint.remove(false);
      }
    }
  }
  flavorChanged(t) {
    this.update();
  }
  _didUpdateForTest() {}
}
class BreakpointItem {
  constructor(t, e, n, i) {
    this.locations = t;
    this.text = e;
    this.isSelected = n;
    this.showColumn = i;
  }
  isSimilar(t) {
    return (
      this.locations.length === t.locations.length &&
      this.locations.every(
        (e, n) => e.uiLocation === t.locations[n].uiLocation
      ) &&
      this.locations.every(
        (e, n) => e.breakpoint === t.locations[n].breakpoint
      ) &&
      (this.text === t.text ||
        (this.text && t.text && this.text.value() === t.text.value())) &&
      this.isSelected === t.isSelected &&
      this.showColumn === t.showColumn
    );
  }
}
export const locationSymbol = Symbol("location");
export const checkboxLabelSymbol = Symbol("checkbox-label");
export const snippetElementSymbol = Symbol("snippet-element");
export const breakpointLocationsSymbol = Symbol("locations");
export let BreakpointLocation;

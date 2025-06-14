import * as Common from "../common/common.js";
import * as Persistence from "../persistence/persistence.js";
import * as Platform from "../platform/platform.js";
import * as QuickOpen from "../quick_open/quick_open.js";
import * as SourceFrame from "../source_frame/source_frame.js";
import * as UI from "../ui/ui.js";
import * as Workspace from "../workspace/workspace.js";
import { EditingLocationHistoryManager } from "./EditingLocationHistoryManager.js";
import {
  Events as Events_1,
  TabbedEditorContainer,
  TabbedEditorContainerDelegate,
} from "./TabbedEditorContainer.js";
import { Events as Events_2, UISourceCodeFrame } from "./UISourceCodeFrame.js";
export class SourcesView extends UI.Widget.VBox {
  constructor() {
    super();
    this.registerRequiredCSS("sources/sourcesView.css");
    this.element.id = "sources-panel-sources-view";
    this.setMinimumAndPreferredSizes(88, 52, 150, 100);
    const e = Workspace.Workspace.WorkspaceImpl.instance();

    this._searchableView = new UI.SearchableView.SearchableView(
      this,
      "sourcesViewSearchConfig"
    );

    this._searchableView.setMinimalSearchQuerySize(0);
    this._searchableView.show(this.element);
    this._sourceViewByUISourceCode = new Map();

    this._editorContainer = new TabbedEditorContainer(
      this,
      Common.Settings.Settings.instance().createLocalSetting(
        "previouslyViewedFiles",
        []
      ),
      this._placeholderElement(),
      this._focusedPlaceholderElement
    );

    this._editorContainer.show(this._searchableView.element);

    this._editorContainer.addEventListener(
      Events_1.EditorSelected,
      this._editorSelected,
      this
    );

    this._editorContainer.addEventListener(
      Events_1.EditorClosed,
      this._editorClosed,
      this
    );

    this._historyManager = new EditingLocationHistoryManager(
      this,
      this.currentSourceFrame.bind(this)
    );

    this._toolbarContainerElement = this.element.createChild(
      "div",
      "sources-toolbar"
    );

    if (!Root.Runtime.experiments.isEnabled("sourcesPrettyPrint")) {
      this._toolbarEditorActions = new UI.Toolbar.Toolbar(
        "",
        this._toolbarContainerElement
      );

      self.runtime.allInstances(EditorAction).then((e) => {
        for (let t = 0; t < e.length; ++t) {
          this._toolbarEditorActions.appendToolbarItem(e[t].button(this));
        }
      });
    }

    this._scriptViewToolbar = new UI.Toolbar.Toolbar(
      "",
      this._toolbarContainerElement
    );

    this._scriptViewToolbar.element.style.flex = "auto";

    this._bottomToolbar = new UI.Toolbar.Toolbar(
      "",
      this._toolbarContainerElement
    );

    this._toolbarChangedListener = null;
    UI.UIUtils.startBatchUpdate();
    e.uiSourceCodes().forEach(this._addUISourceCode.bind(this));
    UI.UIUtils.endBatchUpdate();

    e.addEventListener(
      Workspace.Workspace.Events.UISourceCodeAdded,
      this._uiSourceCodeAdded,
      this
    );

    e.addEventListener(
      Workspace.Workspace.Events.UISourceCodeRemoved,
      this._uiSourceCodeRemoved,
      this
    );

    e.addEventListener(
      Workspace.Workspace.Events.ProjectRemoved,
      this._projectRemoved.bind(this),
      this
    );

    if (!window.opener) {
      window.addEventListener(
        "beforeunload",
        (e) => {
          if (e.returnValue) {
            return;
          }
          let t = [];
          const o =
            Workspace.Workspace.WorkspaceImpl.instance().projectsForType(
              Workspace.Workspace.projectTypes.FileSystem
            );
          for (let e = 0; e < o.length; ++e) {
            t = t.concat(o[e].uiSourceCodes().filter((e) => e.isDirty()));
          }
          if (t.length) {
            e.returnValue = Common.UIString.UIString(
              "DevTools have unsaved changes that will be permanently lost."
            );

            UI.ViewManager.ViewManager.instance().showView("sources");
            for (let e = 0; e < t.length; ++e) {
              Common.Revealer.reveal(t[e]);
            }
          }
        },
        true
      );
    }

    this._shortcuts = {};

    this.element.addEventListener(
      "keydown",
      this._handleKeyDown.bind(this),
      false
    );
  }
  _placeholderElement() {
    this._placeholderOptionArray = [];

    const e = [
      { actionId: "quickOpen.show", description: ls`Open file` },
      { actionId: "commandMenu.show", description: ls`Run command` },
      {
        actionId: "sources.add-folder-to-workspace",
        description: ls`Drop in a folder to add to workspace`,
      },
    ];

    const t = document.createElement("div");
    const o = t.createChild("div", "tabbed-pane-placeholder");
    o.addEventListener("keydown", this._placeholderOnKeyDown.bind(this), false);
    UI.ARIAUtils.markAsList(o);
    UI.ARIAUtils.setAccessibleName(o, ls`Source View Actions`);

    for (const r of e) {
      const i = self.UI.shortcutRegistry.shortcutTitleForAction(r.actionId);
      const s = o.createChild("div");
      UI.ARIAUtils.markAsListitem(s);
      const n = s.createChild("div", "tabbed-pane-placeholder-row");
      n.tabIndex = -1;
      UI.ARIAUtils.markAsButton(n);

      if (i) {
        n.createChild("div", "tabbed-pane-placeholder-key").textContent = i;
        n.createChild("div", "tabbed-pane-placeholder-value").textContent =
          r.description;
      } else {
        n.createChild("div", "tabbed-pane-no-shortcut").textContent =
          r.description;
      }

      const a = UI.ActionRegistry.ActionRegistry.instance().action(r.actionId);
      const c = a.execute.bind(a);
      this._placeholderOptionArray.push({ element: n, handler: c });
    }

    const r = this._placeholderOptionArray[0].element;
    r.tabIndex = 0;
    this._focusedPlaceholderElement = r;
    this._selectedIndex = 0;

    t.appendChild(
      UI.XLink.XLink.create(
        "https://developers.google.com/web/tools/chrome-devtools/sources?utm_source=devtools&utm_campaign=2018Q1",
        "Learn more"
      )
    );

    return t;
  }
  _placeholderOnKeyDown(e) {
    if (isEnterOrSpaceKey(e)) {
      return void this._placeholderOptionArray[
        this._selectedIndex
      ].handler.call();
    }
    let t = 0;

    if (e.key === "ArrowDown") {
      t = 1;
    } else if (e.key === "ArrowUp") {
      t = -1;
    }

    const o = Math.max(
      Math.min(
        this._placeholderOptionArray.length - 1,
        this._selectedIndex + t
      ),
      0
    );

    const r = this._placeholderOptionArray[o].element;
    const i = this._placeholderOptionArray[this._selectedIndex].element;

    if (r !== i) {
      i.tabIndex = -1;
      r.tabIndex = 0;
      UI.ARIAUtils.setSelected(i, false);
      UI.ARIAUtils.setSelected(r, true);
      this._selectedIndex = o;
      r.focus();
    }
  }
  _resetPlaceholderState() {
    this._placeholderOptionArray[this._selectedIndex].element.tabIndex = -1;
    this._placeholderOptionArray[0].element.tabIndex = 0;
    this._selectedIndex = 0;
  }
  static defaultUISourceCodeScores() {
    const e = new Map();
    const t = UI.Context.Context.instance().flavor(SourcesView);
    if (t) {
      const o = t._editorContainer.historyUISourceCodes();
      for (let t = 1; t < o.length; ++t) {
        e.set(o[t], o.length - t);
      }
    }
    return e;
  }
  leftToolbar() {
    return this._editorContainer.leftToolbar();
  }
  rightToolbar() {
    return this._editorContainer.rightToolbar();
  }
  bottomToolbar() {
    return this._bottomToolbar;
  }
  _registerShortcuts(e, t) {
    for (let o = 0; o < e.length; ++o) {
      this._shortcuts[e[o].key] = t;
    }
  }
  _handleKeyDown(e) {
    const t = UI.KeyboardShortcut.KeyboardShortcut.makeKeyFromEvent(e);
    const o = this._shortcuts[t];

    if (o && o()) {
      e.consume(true);
    }
  }
  wasShown() {
    super.wasShown();
    UI.Context.Context.instance().setFlavor(SourcesView, this);
  }
  willHide() {
    UI.Context.Context.instance().setFlavor(SourcesView, null);
    this._resetPlaceholderState();
    super.willHide();
  }
  toolbarContainerElement() {
    return this._toolbarContainerElement;
  }
  searchableView() {
    return this._searchableView;
  }
  visibleView() {
    return this._editorContainer.visibleView;
  }
  currentSourceFrame() {
    const e = this.visibleView();
    return e instanceof UISourceCodeFrame ? e : null;
  }
  currentUISourceCode() {
    return this._editorContainer.currentFile();
  }
  _onCloseEditorTab() {
    const e = this._editorContainer.currentFile();
    return !!e && (this._editorContainer.closeFile(e), true);
  }
  _onJumpToPreviousLocation() {
    this._historyManager.rollback();
  }
  _onJumpToNextLocation() {
    this._historyManager.rollover();
  }
  _uiSourceCodeAdded(e) {
    const t = e.data;
    this._addUISourceCode(t);
  }
  _addUISourceCode(e) {
    if (
      !e.project().isServiceProject() &&
      (e.project().type() !== Workspace.Workspace.projectTypes.FileSystem ||
        Persistence.FileSystemWorkspaceBinding.FileSystemWorkspaceBinding.fileSystemType(
          e.project()
        ) !== "overrides")
    ) {
      this._editorContainer.addUISourceCode(e);
    }
  }
  _uiSourceCodeRemoved(e) {
    const t = e.data;
    this._removeUISourceCodes([t]);
  }
  _removeUISourceCodes(e) {
    this._editorContainer.removeUISourceCodes(e);
    for (let t = 0; t < e.length; ++t) {
      this._removeSourceFrame(e[t]);
      this._historyManager.removeHistoryForSourceCode(e[t]);
    }
  }
  _projectRemoved(e) {
    const t = e.data.uiSourceCodes();
    this._removeUISourceCodes(t);
  }
  _updateScriptViewToolbarItems() {
    const e = this.visibleView();

    if (e instanceof UI.View.SimpleView) {
      e.toolbarItems().then((e) => {
        this._scriptViewToolbar.removeToolbarItems();

        e.map((e) => this._scriptViewToolbar.appendToolbarItem(e));
      });
    }
  }
  showSourceLocation(e, t, o, r, i) {
    this._historyManager.updateCurrentState();
    this._editorContainer.showFile(e);
    const s = this.currentSourceFrame();

    if (s && typeof t == "number") {
      s.revealPosition(t, o, !i);
    }

    this._historyManager.pushNewState();

    if (!r) {
      this.visibleView().focus();
    }
  }
  _createSourceView(e) {
    let t;
    let o;
    const r = e.contentType();

    if (r === Common.ResourceType.resourceTypes.Image) {
      o = new SourceFrame.ImageView.ImageView(e.mimeType(), e);
    } else if (r === Common.ResourceType.resourceTypes.Font) {
      o = new SourceFrame.FontView.FontView(e.mimeType(), e);
    } else {
      t = new UISourceCodeFrame(e);
    }

    if (t) {
      this._historyManager.trackSourceFrameCursorJumps(t);
    }

    const i = t || o;
    this._sourceViewByUISourceCode.set(e, i);
    return i;
  }
  _getOrCreateSourceView(e) {
    return this._sourceViewByUISourceCode.get(e) || this._createSourceView(e);
  }
  recycleUISourceCodeFrame(e, t) {
    this._sourceViewByUISourceCode.delete(e.uiSourceCode());
    e.setUISourceCode(t);
    this._sourceViewByUISourceCode.set(t, e);
  }
  viewForFile(e) {
    return this._getOrCreateSourceView(e);
  }
  _removeSourceFrame(e) {
    const t = this._sourceViewByUISourceCode.get(e);
    this._sourceViewByUISourceCode.delete(e);

    if (t && t instanceof UISourceCodeFrame) {
      t.dispose();
    }
  }
  _editorClosed(e) {
    const t = e.data;
    this._historyManager.removeHistoryForSourceCode(t);
    let o = false;

    if (!this._editorContainer.currentFile()) {
      o = true;
    }

    this._removeToolbarChangedListener();
    this._updateScriptViewToolbarItems();
    this._searchableView.resetSearch();
    const r = {};
    r.uiSourceCode = t;
    r.wasSelected = o;
    this.dispatchEventToListeners(Events.EditorClosed, r);
  }
  _editorSelected(e) {
    const t =
      e.data.previousView instanceof UISourceCodeFrame
        ? e.data.previousView
        : null;

    if (t) {
      t.setSearchableView(null);
    }

    const o =
      e.data.currentView instanceof UISourceCodeFrame
        ? e.data.currentView
        : null;

    if (o) {
      o.setSearchableView(this._searchableView);
    }

    this._searchableView.setReplaceable(!!o && o.canEditSource());
    this._searchableView.refreshSearch();
    this._updateToolbarChangedListener();
    this._updateScriptViewToolbarItems();

    this.dispatchEventToListeners(
      Events.EditorSelected,
      this._editorContainer.currentFile()
    );
  }
  _removeToolbarChangedListener() {
    if (this._toolbarChangedListener) {
      Common.EventTarget.EventTarget.removeEventListeners([
        this._toolbarChangedListener,
      ]);
    }

    this._toolbarChangedListener = null;
  }
  _updateToolbarChangedListener() {
    this._removeToolbarChangedListener();
    const e = this.currentSourceFrame();

    if (e) {
      this._toolbarChangedListener = e.addEventListener(
        Events_2.ToolbarItemsChanged,
        this._updateScriptViewToolbarItems,
        this
      );
    }
  }
  searchCanceled() {
    if (this._searchView) {
      this._searchView.searchCanceled();
    }

    delete this._searchView;
    delete this._searchConfig;
  }
  performSearch(e, t, o) {
    const r = this.currentSourceFrame();

    if (r) {
      this._searchView = r;
      this._searchConfig = e;
      this._searchView.performSearch(this._searchConfig, t, o);
    }
  }
  jumpToNextSearchResult() {
    if (this._searchView) {
      if (this._searchView === this.currentSourceFrame()) {
        this._searchView.jumpToNextSearchResult();
      } else {
        this.performSearch(this._searchConfig, true);
      }
    }
  }
  jumpToPreviousSearchResult() {
    if (this._searchView) {
      return this._searchView !== this.currentSourceFrame()
        ? (this.performSearch(this._searchConfig, true),
          void (this._searchView && this._searchView.jumpToLastSearchResult()))
        : void this._searchView.jumpToPreviousSearchResult();
    }
  }
  supportsCaseSensitiveSearch() {
    return true;
  }
  supportsRegexSearch() {
    return true;
  }
  replaceSelectionWith(e, t) {
    const o = this.currentSourceFrame();

    if (o) {
      o.replaceSelectionWith(e, t);
    } else {
      console.assert(o);
    }
  }
  replaceAllWith(e, t) {
    const o = this.currentSourceFrame();

    if (o) {
      o.replaceAllWith(e, t);
    } else {
      console.assert(o);
    }
  }
  _showOutlineQuickOpen() {
    QuickOpen.QuickOpen.QuickOpenImpl.show("@");
  }
  _showGoToLineQuickOpen() {
    if (this._editorContainer.currentFile()) {
      QuickOpen.QuickOpen.QuickOpenImpl.show(":");
    }
  }
  _save() {
    this._saveSourceFrame(this.currentSourceFrame());
  }
  _saveAll() {
    this._editorContainer.fileViews().forEach(this._saveSourceFrame.bind(this));
  }
  _saveSourceFrame(e) {
    if (!(e instanceof UISourceCodeFrame)) {
      return;
    }
    e.commitEditing();
  }
  toggleBreakpointsActiveState(e) {
    this._editorContainer.view.element.classList.toggle(
      "breakpoints-deactivated",
      !e
    );
  }
}
export const Events = {
  EditorClosed: Symbol("EditorClosed"),
  EditorSelected: Symbol("EditorSelected"),
};
export class EditorAction {
  button(e) {}
}
export class SwitchFileActionDelegate {
  static _nextFile(e) {
    function t(e) {
      const t = e.lastIndexOf(".");
      return e.substr(0, -1 !== t ? t : e.length).toLowerCase();
    }
    const o = e.project().uiSourceCodes();
    const r = [];
    const i = e.parentURL();
    const s = e.name();
    const n = t(s);

    for (const s of o) {
      if (i === s.parentURL() && t(s.name()) === n) {
        r.push(s.name());
      }
    }

    r.sort(String.naturalOrderComparator);
    const a = Platform.NumberUtilities.mod(r.indexOf(s) + 1, r.length);
    const c = (i ? `${i}/` : "") + r[a];
    const l = e.project().uiSourceCodeForURL(c);
    return l !== e ? l : null;
  }
  handleAction(e, t) {
    const o = UI.Context.Context.instance().flavor(SourcesView);
    const r = o.currentUISourceCode();
    if (!r) {
      return false;
    }
    const i = SwitchFileActionDelegate._nextFile(r);
    return !!i && (o.showSourceLocation(i), true);
  }
}
export class ActionDelegate {
  handleAction(e, t) {
    const o = UI.Context.Context.instance().flavor(SourcesView);
    if (!o) {
      return false;
    }
    switch (t) {
      case "sources.close-all": {
        o._editorContainer.closeAllFiles();
        return true;
      }
      case "sources.jump-to-previous-location": {
        o._onJumpToPreviousLocation();
        return true;
      }
      case "sources.jump-to-next-location": {
        o._onJumpToNextLocation();
        return true;
      }
      case "sources.close-editor-tab": {
        return o._onCloseEditorTab();
      }
      case "sources.go-to-line": {
        o._showGoToLineQuickOpen();
        return true;
      }
      case "sources.go-to-member": {
        o._showOutlineQuickOpen();
        return true;
      }
      case "sources.save": {
        o._save();
        return true;
      }
      case "sources.save-all": {
        o._saveAll();
        return true;
      }
    }
    return false;
  }
}

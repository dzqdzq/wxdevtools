import * as Common from "../common/common.js";
import * as Persistence from "../persistence/persistence.js";
import * as Snippets from "../snippets/snippets.js";
import * as SourceFrame from "../source_frame/source_frame.js";
import * as TextUtils from "../text_utils/text_utils.js";
import * as UI from "../ui/ui.js";
import * as Workspace from "../workspace/workspace.js";
import { UISourceCodeFrame } from "./UISourceCodeFrame.js";
export class TabbedEditorContainerDelegate {
  viewForFile(e) {}
  recycleUISourceCodeFrame(e, t) {}
}
export class TabbedEditorContainer extends Common.ObjectWrapper.ObjectWrapper {
  constructor(e, t, i, s) {
    super();
    this._delegate = e;
    this._tabbedPane = new UI.TabbedPane.TabbedPane();
    this._tabbedPane.setPlaceholderElement(i, s);
    this._tabbedPane.setTabDelegate(new EditorContainerTabDelegate(this));
    this._tabbedPane.setCloseableTabs(true);
    this._tabbedPane.setAllowTabReorder(true, true);

    this._tabbedPane.addEventListener(
      UI.TabbedPane.Events.TabClosed,
      this._tabClosed,
      this
    );

    this._tabbedPane.addEventListener(
      UI.TabbedPane.Events.TabSelected,
      this._tabSelected,
      this
    );

    self.Persistence.persistence.addEventListener(
      Persistence.Persistence.Events.BindingCreated,
      this._onBindingCreated,
      this
    );

    self.Persistence.persistence.addEventListener(
      Persistence.Persistence.Events.BindingRemoved,
      this._onBindingRemoved,
      this
    );

    this._tabIds = new Map();
    this._files = {};
    this._previouslyViewedFilesSetting = t;

    this._history = History.fromObject(
      this._previouslyViewedFilesSetting.get()
    );

    this._uriToUISourceCode = new Map();
  }
  _onBindingCreated(e) {
    const e_data = e.data;
    this._updateFileTitle(e_data.fileSystem);
    const i = this._tabIds.get(e_data.network);
    let s = this._tabIds.get(e_data.fileSystem);
    const r = this._currentFile === e_data.network;
    const o = this._history.selectionRange(e_data.network.url());
    const n = this._history.scrollLineNumber(e_data.network.url());
    this._history.remove(e_data.network.url());

    if (i) {
      if (!s) {
        const e = this._tabbedPane.tabView(i);
        const r = this._tabbedPane.tabIndex(i);
        if (e instanceof UISourceCodeFrame) {
          this._delegate.recycleUISourceCodeFrame(e, e_data.fileSystem);
          s = this._appendFileTab(e_data.fileSystem, false, r, e);
        } else {
          s = this._appendFileTab(e_data.fileSystem, false, r);
          const e = this._tabbedPane.tabView(s);
          this._restoreEditorProperties(e, o, n);
        }
      }
      this._closeTabs([i], true);

      if (r) {
        this._tabbedPane.selectTab(s, false);
      }

      this._updateHistory();
    }
  }
  _onBindingRemoved(e) {
    const e_data = e.data;
    this._updateFileTitle(e_data.fileSystem);
  }
  get view() {
    return this._tabbedPane;
  }
  get visibleView() {
    return this._tabbedPane.visibleView;
  }
  fileViews() {
    return this._tabbedPane.tabViews();
  }
  leftToolbar() {
    return this._tabbedPane.leftToolbar();
  }
  rightToolbar() {
    return this._tabbedPane.rightToolbar();
  }
  show(e) {
    this._tabbedPane.show(e);
  }
  showFile(e) {
    this._innerShowFile(this._canonicalUISourceCode(e), true);
  }
  closeFile(e) {
    const t = this._tabIds.get(e);

    if (t) {
      this._closeTabs([t]);
    }
  }
  closeAllFiles() {
    this._closeTabs(this._tabbedPane.tabIds());
  }
  historyUISourceCodes() {
    const e = [];
    const t = this._history._urls();
    for (const i of t) {
      const t = this._uriToUISourceCode.get(i);

      if (t) {
        e.push(t);
      }
    }
    return e;
  }
  _addViewListeners() {
    if (this._currentView && this._currentView.textEditor) {
      this._currentView.textEditor.addEventListener(
        SourceFrame.SourcesTextEditor.Events.ScrollChanged,
        this._scrollChanged,
        this
      );

      this._currentView.textEditor.addEventListener(
        SourceFrame.SourcesTextEditor.Events.SelectionChanged,
        this._selectionChanged,
        this
      );
    }
  }
  _removeViewListeners() {
    if (this._currentView && this._currentView.textEditor) {
      this._currentView.textEditor.removeEventListener(
        SourceFrame.SourcesTextEditor.Events.ScrollChanged,
        this._scrollChanged,
        this
      );

      this._currentView.textEditor.removeEventListener(
        SourceFrame.SourcesTextEditor.Events.SelectionChanged,
        this._selectionChanged,
        this
      );
    }
  }
  _scrollChanged(e) {
    if (this._scrollTimer) {
      clearTimeout(this._scrollTimer);
    }

    const e_data = e.data;

    this._scrollTimer = setTimeout(() => {
      this._history.save(this._previouslyViewedFilesSetting);
    }, 100);

    this._history.updateScrollLineNumber(this._currentFile.url(), e_data);
  }
  _selectionChanged(e) {
    const e_data = e.data;
    this._history.updateSelectionRange(this._currentFile.url(), e_data);
    this._history.save(this._previouslyViewedFilesSetting);

    self.Extensions.extensionServer.sourceSelectionChanged(
      this._currentFile.url(),
      e_data
    );
  }
  _innerShowFile(e, t) {
    const i = self.Persistence.persistence.binding(e);
    e = i ? i.fileSystem : e;

    if (this._currentFile === e) {
      return;
    }

    this._removeViewListeners();
    this._currentFile = e;
    const s = this._tabIds.get(e) || this._appendFileTab(e, t);
    this._tabbedPane.selectTab(s, t);

    if (t) {
      this._editorSelectedByUserAction();
    }

    const r = this._currentView;
    this._currentView = this.visibleView;
    this._addViewListeners();
    const o = {
      currentFile: this._currentFile,
      currentView: this._currentView,
      previousView: r,
      userGesture: t,
    };
    this.dispatchEventToListeners(Events.EditorSelected, o);
  }
  _titleForFile(e) {
    let t = e.displayName(true).trimMiddle(30);

    if (e.isDirty()) {
      t += "*";
    }

    return t;
  }
  _maybeCloseTab(e, t) {
    const i = this._files[e];
    return (
      !(
        i.isDirty() &&
        i.project().canSetFileContent() &&
        !confirm(
          Common.UIString.UIString(
            "Are you sure you want to close unsaved file: %s?",
            i.name()
          )
        )
      ) &&
      (i.resetWorkingCopy(),
      t && this._tabbedPane.selectTab(t, true),
      this._tabbedPane.closeTab(e, true),
      true)
    );
  }
  _closeTabs(e, t) {
    const i = [];
    const s = [];

    for (const o of e) {
      const n = this._files[o];

      if (!t && n.isDirty()) {
        i.push(o);
      } else {
        s.push(o);
      }
    }

    if (i.length) {
      this._tabbedPane.selectTab(i[0], true);
    }

    this._tabbedPane.closeTabs(s, true);
    for (let e = 0; e < i.length; ++e) {
      const t = e + 1 < i.length ? i[e + 1] : null;
      if (!this._maybeCloseTab(i[e], t)) {
        break;
      }
    }
  }
  _onContextMenu(e, t) {
    const i = this._files[e];

    if (i) {
      t.appendApplicableItems(i);
    }
  }
  _canonicalUISourceCode(e) {
    return this._uriToUISourceCode.has(e.url())
      ? this._uriToUISourceCode.get(e.url())
      : (this._uriToUISourceCode.set(e.url(), e), e);
  }
  addUISourceCode(e) {
    const t = this._canonicalUISourceCode(e);
    const i = t !== e;
    const s = self.Persistence.persistence.binding(t);
    e = s ? s.fileSystem : t;

    if (
      i &&
      e.project().type() !== Workspace.Workspace.projectTypes.FileSystem
    ) {
      e.disableEdit();
    }

    if (this._currentFile === e) {
      return;
    }

    const r = e.url();
    const o = this._history.index(r);
    if (-1 === o) {
      return;
    }

    if (!this._tabIds.has(e)) {
      this._appendFileTab(e, false);
    }

    if (!o) {
      return void this._innerShowFile(e, false);
    }

    if (!this._currentFile) {
      return;
    }

    const n = Snippets.ScriptSnippetFileSystem.isSnippetsUISourceCode(
      this._currentFile
    );

    const a = Snippets.ScriptSnippetFileSystem.isSnippetsUISourceCode(e);

    if (this._history.index(this._currentFile.url()) && n && !a) {
      this._innerShowFile(e, false);
    }
  }
  removeUISourceCode(e) {
    this.removeUISourceCodes([e]);
  }
  removeUISourceCodes(e) {
    const t = [];
    for (const i of e) {
      const e = this._tabIds.get(i);

      if (e) {
        t.push(e);
      }

      if (this._uriToUISourceCode.get(i.url()) === i) {
        this._uriToUISourceCode.delete(i.url());
      }
    }
    this._tabbedPane.closeTabs(t);
  }
  _editorClosedByUserAction(e) {
    this._history.remove(e.url());
    this._updateHistory();
  }
  _editorSelectedByUserAction() {
    this._updateHistory();
  }
  _updateHistory() {
    const e = this._tabbedPane.lastOpenedTabIds(
      maximalPreviouslyViewedFilesCount
    );

    this._history.update(e.map((e) => this._files[e].url()));

    this._history.save(this._previouslyViewedFilesSetting);
  }
  _tooltipForFile(e) {
    return (e = self.Persistence.persistence.network(e) || e).url();
  }
  _appendFileTab(e, t, i, s) {
    const r = s || this._delegate.viewForFile(e);
    const o = this._titleForFile(e);
    const n = this._tooltipForFile(e);
    const a = this._generateTabId();
    this._tabIds.set(e, a);
    this._files[a] = e;

    if (!s) {
      const t = this._history.selectionRange(e.url());
      const i = this._history.scrollLineNumber(e.url());
      this._restoreEditorProperties(r, t, i);
    }

    this._tabbedPane.appendTab(a, o, r, n, t, undefined, i);
    this._updateFileTitle(e);
    this._addUISourceCodeListeners(e);

    if (e.loadError()) {
      this._addLoadErrorIcon(a);
    } else if (!e.contentLoaded()) {
      e.requestContent().then((t) => {
        if (e.loadError()) {
          this._addLoadErrorIcon(a);
        }
      });
    }

    return a;
  }
  _addLoadErrorIcon(e) {
    const t = UI.Icon.Icon.create("smallicon-error");
    t.title = ls`Unable to load this content.`;

    if (this._tabbedPane.tabView(e)) {
      this._tabbedPane.setTabIcon(e, t);
    }
  }
  _restoreEditorProperties(e, t, i) {
    const s = e instanceof SourceFrame.SourceFrame.SourceFrameImpl ? e : null;

    if (s) {
      t && s.setSelection(t);
      typeof i == "number" && s.scrollToLine(i);
    }
  }
  _tabClosed(e) {
    const t = e.data.tabId;
    const i = e.data.isUserGesture;
    const s = this._files[t];

    if (this._currentFile === s) {
      this._removeViewListeners();
      delete this._currentView;
      delete this._currentFile;
    }

    this._tabIds.delete(s);
    delete this._files[t];
    this._removeUISourceCodeListeners(s);
    this.dispatchEventToListeners(Events.EditorClosed, s);

    if (i) {
      this._editorClosedByUserAction(s);
    }
  }
  _tabSelected(e) {
    const t = e.data.tabId;
    const i = e.data.isUserGesture;
    const s = this._files[t];
    this._innerShowFile(s, i);
  }
  _addUISourceCodeListeners(e) {
    e.addEventListener(
      Workspace.UISourceCode.Events.TitleChanged,
      this._uiSourceCodeTitleChanged,
      this
    );

    e.addEventListener(
      Workspace.UISourceCode.Events.WorkingCopyChanged,
      this._uiSourceCodeWorkingCopyChanged,
      this
    );

    e.addEventListener(
      Workspace.UISourceCode.Events.WorkingCopyCommitted,
      this._uiSourceCodeWorkingCopyCommitted,
      this
    );
  }
  _removeUISourceCodeListeners(e) {
    e.removeEventListener(
      Workspace.UISourceCode.Events.TitleChanged,
      this._uiSourceCodeTitleChanged,
      this
    );

    e.removeEventListener(
      Workspace.UISourceCode.Events.WorkingCopyChanged,
      this._uiSourceCodeWorkingCopyChanged,
      this
    );

    e.removeEventListener(
      Workspace.UISourceCode.Events.WorkingCopyCommitted,
      this._uiSourceCodeWorkingCopyCommitted,
      this
    );
  }
  _updateFileTitle(e) {
    const t = this._tabIds.get(e);
    if (t) {
      const i = this._titleForFile(e);
      const s = this._tooltipForFile(e);
      this._tabbedPane.changeTabTitle(t, i, s);
      let r = null;

      if (e.loadError()) {
        r = UI.Icon.Icon.create("smallicon-error");
        r.title = ls`Unable to load this content.`;
      } else if (self.Persistence.persistence.hasUnsavedCommittedChanges(e)) {
        r = UI.Icon.Icon.create("smallicon-warning");

        r.title = Common.UIString.UIString(
          "Changes to this file were not saved to file system."
        );
      } else {
        r =
          Persistence.PersistenceUtils.PersistenceUtils.iconForUISourceCode(e);
      }

      this._tabbedPane.setTabIcon(t, r);
    }
  }
  _uiSourceCodeTitleChanged(e) {
    const e_data = e.data;
    this._updateFileTitle(e_data);
    this._updateHistory();
  }
  _uiSourceCodeWorkingCopyChanged(e) {
    const e_data = e.data;
    this._updateFileTitle(e_data);
  }
  _uiSourceCodeWorkingCopyCommitted(e) {
    const t = e.data.uiSourceCode;
    this._updateFileTitle(t);
  }
  _generateTabId() {
    return `tab_${tabId++}`;
  }
  currentFile() {
    return this._currentFile || null;
  }
}
export const Events = {
  EditorSelected: Symbol("EditorSelected"),
  EditorClosed: Symbol("EditorClosed"),
};
export let tabId = 0;
export const maximalPreviouslyViewedFilesCount = 30;
export class HistoryItem {
  constructor(e, t, i) {
    this.url = e;
    this._isSerializable = e.length < HistoryItem.serializableUrlLengthLimit;
    this.selectionRange = t;
    this.scrollLineNumber = i;
  }
  static fromObject(e) {
    const t = e.selectionRange
      ? TextUtils.TextRange.TextRange.fromObject(e.selectionRange)
      : undefined;
    return new HistoryItem(e.url, t, e.scrollLineNumber);
  }
  serializeToObject() {
    if (!this._isSerializable) {
      return null;
    }
    const e = {};
    e.url = this.url;
    e.selectionRange = this.selectionRange;
    e.scrollLineNumber = this.scrollLineNumber;
    return e;
  }
}
HistoryItem.serializableUrlLengthLimit = 4096;
export class History {
  constructor(e) {
    this._items = e;
    this._rebuildItemIndex();
  }
  static fromObject(e) {
    const t = [];
    for (let i = 0; i < e.length; ++i) {
      if (e[i].url) {
        t.push(HistoryItem.fromObject(e[i]));
      }
    }
    return new History(t);
  }
  index(e) {
    return this._itemsIndex.has(e) ? this._itemsIndex.get(e) : -1;
  }
  _rebuildItemIndex() {
    this._itemsIndex = new Map();
    for (let e = 0; e < this._items.length; ++e) {
      console.assert(!this._itemsIndex.has(this._items[e].url));
      this._itemsIndex.set(this._items[e].url, e);
    }
  }
  selectionRange(e) {
    const t = this.index(e);
    return -1 !== t ? this._items[t].selectionRange : undefined;
  }
  updateSelectionRange(e, t) {
    if (!t) {
      return;
    }
    const i = this.index(e);

    if (-1 !== i) {
      this._items[i].selectionRange = t;
    }
  }
  scrollLineNumber(e) {
    const t = this.index(e);
    return -1 !== t ? this._items[t].scrollLineNumber : undefined;
  }
  updateScrollLineNumber(e, t) {
    const i = this.index(e);

    if (-1 !== i) {
      this._items[i].scrollLineNumber = t;
    }
  }
  update(e) {
    for (let t = e.length - 1; t >= 0; --t) {
      const i = this.index(e[t]);
      let s;

      if (-1 !== i) {
        s = this._items[i];
        this._items.splice(i, 1);
      } else {
        s = new HistoryItem(e[t]);
      }

      this._items.unshift(s);
      this._rebuildItemIndex();
    }
  }
  remove(e) {
    const t = this.index(e);

    if (-1 !== t) {
      this._items.splice(t, 1);
      this._rebuildItemIndex();
    }
  }
  save(e) {
    e.set(this._serializeToObject());
  }
  _serializeToObject() {
    const e = [];
    for (let t = 0; t < this._items.length; ++t) {
      const i = this._items[t].serializeToObject();

      if (i) {
        e.push(i);
      }

      if (e.length === maximalPreviouslyViewedFilesCount) {
        break;
      }
    }
    return e;
  }
  _urls() {
    const e = [];
    for (let t = 0; t < this._items.length; ++t) {
      e.push(this._items[t].url);
    }
    return e;
  }
}
export class EditorContainerTabDelegate {
  constructor(e) {
    this._editorContainer = e;
  }
  closeTabs(e, t) {
    this._editorContainer._closeTabs(t);
  }
  onContextMenu(e, t) {
    this._editorContainer._onContextMenu(e, t);
  }
}

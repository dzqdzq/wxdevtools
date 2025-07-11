import * as Bindings from "../bindings/bindings.js";
import * as Common from "../common/common.js";
import * as Host from "../host/host.js";
import * as Persistence from "../persistence/persistence.js";
import * as Platform from "../platform/platform.js";
import * as SDK from "../sdk/sdk.js";
import * as Snippets from "../snippets/snippets.js";
import * as UI from "../ui/ui.js";
import * as Workspace from "../workspace/workspace.js";
import { SearchSourcesView } from "./SearchSourcesView.js";
export class NavigatorView extends UI.Widget.VBox {
  constructor() {
    super(!0),
      this.registerRequiredCSS("sources/navigatorView.css"),
      (this._placeholder = null),
      (this._scriptsTree = new UI.TreeOutline.TreeOutlineInShadow()),
      this._scriptsTree.registerRequiredCSS("sources/navigatorTree.css"),
      this._scriptsTree.setComparator(NavigatorView._treeElementsCompare),
      this._scriptsTree.setFocusable(!1),
      this.contentElement.appendChild(this._scriptsTree.element),
      this.setDefaultFocusedElement(this._scriptsTree.element),
      (this._uiSourceCodeNodes = new Platform.Multimap()),
      (this._subfolderNodes = new Map()),
      (this._rootNode = new NavigatorRootTreeNode(this)),
      this._rootNode.populate(),
      (this._frameNodes = new Map()),
      this.contentElement.addEventListener(
        "contextmenu",
        this.handleContextMenu.bind(this),
        !1
      ),
      self.UI.shortcutRegistry.addShortcutListener(this.contentElement, {
        "sources.rename": this._renameShortcut.bind(this),
      }),
      (this._navigatorGroupByFolderSetting =
        Common.Settings.Settings.instance().moduleSetting(
          "navigatorGroupByFolder"
        )),
      this._navigatorGroupByFolderSetting.addChangeListener(
        this._groupingChanged.bind(this)
      ),
      this._initGrouping(),
      self.Persistence.persistence.addEventListener(
        Persistence.Persistence.Events.BindingCreated,
        this._onBindingChanged,
        this
      ),
      self.Persistence.persistence.addEventListener(
        Persistence.Persistence.Events.BindingRemoved,
        this._onBindingChanged,
        this
      ),
      SDK.SDKModel.TargetManager.instance().addEventListener(
        SDK.SDKModel.Events.NameChanged,
        this._targetNameChanged,
        this
      ),
      SDK.SDKModel.TargetManager.instance().observeTargets(this),
      this._resetWorkspace(Workspace.Workspace.WorkspaceImpl.instance()),
      this._workspace.uiSourceCodes().forEach(this._addUISourceCode.bind(this)),
      Bindings.NetworkProject.NetworkProjectManager.instance().addEventListener(
        Bindings.NetworkProject.Events.FrameAttributionAdded,
        this._frameAttributionAdded,
        this
      ),
      Bindings.NetworkProject.NetworkProjectManager.instance().addEventListener(
        Bindings.NetworkProject.Events.FrameAttributionRemoved,
        this._frameAttributionRemoved,
        this
      );
  }
  static _treeElementOrder(e) {
    if (e._boostOrder) return 0;
    if (!NavigatorView._typeOrders) {
      const e = {},
        t = Types;
      (e[t.Root] = 1),
        (e[t.Domain] = 10),
        (e[t.FileSystemFolder] = 1),
        (e[t.NetworkFolder] = 1),
        (e[t.SourceMapFolder] = 2),
        (e[t.File] = 10),
        (e[t.Frame] = 70),
        (e[t.Worker] = 90),
        (e[t.FileSystem] = 100),
        (NavigatorView._typeOrders = e);
    }
    let t = NavigatorView._typeOrders[e._nodeType];
    if (e._uiSourceCode) {
      const i = e._uiSourceCode.contentType();
      i.isDocument()
        ? (t += 3)
        : i.isScript()
        ? (t += 5)
        : i.isStyleSheet()
        ? (t += 10)
        : (t += 15);
    }
    return t;
  }
  static appendSearchItem(e, t) {
    let i = Common.UIString.UIString("Search in folder");
    (t && t.trim()) ||
      ((t = "*"), (i = Common.UIString.UIString("Search in all files"))),
      e.viewSection().appendItem(i, function () {
        SearchSourcesView.openSearch("file:" + t.trim());
      });
  }
  static _treeElementsCompare(e, t) {
    const i = NavigatorView._treeElementOrder(e),
      r = NavigatorView._treeElementOrder(t);
    return i > r ? 1 : i < r ? -1 : e.titleAsText().compareTo(t.titleAsText());
  }
  setPlaceholder(e) {
    function t() {
      const t = this._scriptsTree.firstChild();
      t ? e.hideWidget() : e.showWidget(),
        this._scriptsTree.element.classList.toggle("hidden", !t);
    }
    console.assert(!this._placeholder, "A placeholder widget was already set"),
      (this._placeholder = e),
      e.show(this.contentElement, this.contentElement.firstChild),
      t.call(this),
      this._scriptsTree.addEventListener(
        UI.TreeOutline.Events.ElementAttached,
        t.bind(this)
      ),
      this._scriptsTree.addEventListener(
        UI.TreeOutline.Events.ElementsDetached,
        t.bind(this)
      );
  }
  _onBindingChanged(e) {
    const t = e.data,
      i = this._uiSourceCodeNodes.get(t.network);
    for (const e of i) e.updateTitle();
    const r = this._uiSourceCodeNodes.get(t.fileSystem);
    for (const e of r) e.updateTitle();
    const o =
      Persistence.FileSystemWorkspaceBinding.FileSystemWorkspaceBinding.relativePath(
        t.fileSystem
      );
    let s = "";
    for (let e = 0; e < o.length - 1; ++e) {
      s += o[e];
      const i = this._folderNodeId(
          t.fileSystem.project(),
          null,
          null,
          t.fileSystem.origin(),
          s
        ),
        r = this._subfolderNodes.get(i);
      r && r.updateTitle(), (s += "/");
    }
    const n = this._rootNode.child(t.fileSystem.project().id());
    n && n.updateTitle();
  }
  focus() {
    this._scriptsTree.focus();
  }
  appendChild(e, t) {
    this._scriptsTree.setFocusable(!0), e.appendChild(t);
  }
  removeChild(e, t) {
    e.removeChild(t),
      0 === this._scriptsTree.rootElement().childCount() &&
        this._scriptsTree.setFocusable(!1);
  }
  _resetWorkspace(e) {
    (this._workspace = e),
      this._workspace.addEventListener(
        Workspace.Workspace.Events.UISourceCodeAdded,
        this._uiSourceCodeAdded,
        this
      ),
      this._workspace.addEventListener(
        Workspace.Workspace.Events.UISourceCodeRemoved,
        this._uiSourceCodeRemoved,
        this
      ),
      this._workspace.addEventListener(
        Workspace.Workspace.Events.ProjectAdded,
        (e) => {
          const t = e.data;
          this._projectAdded(t),
            t.type() === Workspace.Workspace.projectTypes.FileSystem &&
              this._computeUniqueFileSystemProjectNames();
        }
      ),
      this._workspace.addEventListener(
        Workspace.Workspace.Events.ProjectRemoved,
        (e) => {
          const t = e.data;
          this._removeProject(t),
            t.type() === Workspace.Workspace.projectTypes.FileSystem &&
              this._computeUniqueFileSystemProjectNames();
        }
      ),
      this._workspace.projects().forEach(this._projectAdded.bind(this)),
      this._computeUniqueFileSystemProjectNames();
  }
  workspace() {
    return this._workspace;
  }
  acceptProject(e) {
    return !e.isServiceProject();
  }
  _frameAttributionAdded(e) {
    const t = e.data.uiSourceCode;
    if (!this._acceptsUISourceCode(t)) return;
    const i = e.data.frame;
    this._addUISourceCodeNode(t, i);
  }
  _frameAttributionRemoved(e) {
    const t = e.data.uiSourceCode;
    if (!this._acceptsUISourceCode(t)) return;
    const i = e.data.frame,
      r = Array.from(this._uiSourceCodeNodes.get(t)).find(
        (e) => e.frame() === i
      );
    this._removeUISourceCodeNode(r);
  }
  _acceptsUISourceCode(e) {
    return this.acceptProject(e.project());
  }
  _addUISourceCode(e) {
    if (!this._acceptsUISourceCode(e)) return;
    const t = Bindings.NetworkProject.NetworkProject.framesForUISourceCode(e);
    if (t.length) for (const i of t) this._addUISourceCodeNode(e, i);
    else this._addUISourceCodeNode(e, null);
    this.uiSourceCodeAdded(e);
  }
  _addUISourceCodeNode(e, t) {
    const i = e.contentType().isFromSourceMap();
    let r;
    r =
      e.project().type() === Workspace.Workspace.projectTypes.FileSystem
        ? Persistence.FileSystemWorkspaceBinding.FileSystemWorkspaceBinding.relativePath(
            e
          ).slice(0, -1)
        : Common.ParsedURL.ParsedURL.extractPath(e.url())
            .split("/")
            .slice(1, -1);
    const o = e.project(),
      s = Bindings.NetworkProject.NetworkProject.targetForUISourceCode(e),
      n = this._folderNode(e, o, s, t, e.origin(), r, i),
      d = new NavigatorUISourceCodeTreeNode(this, e, t);
    n.appendChild(d),
      this._uiSourceCodeNodes.set(e, d),
      this._selectDefaultTreeNode();
  }
  uiSourceCodeAdded(e) {}
  _uiSourceCodeAdded(e) {
    const t = e.data;
    this._addUISourceCode(t);
  }
  _uiSourceCodeRemoved(e) {
    const t = e.data;
    this._removeUISourceCode(t);
  }
  tryAddProject(e) {
    this._projectAdded(e),
      e.uiSourceCodes().forEach(this._addUISourceCode.bind(this));
  }
  _projectAdded(e) {
    !this.acceptProject(e) ||
      e.type() !== Workspace.Workspace.projectTypes.FileSystem ||
      Snippets.ScriptSnippetFileSystem.isSnippetsProject(e) ||
      this._rootNode.child(e.id()) ||
      (this._rootNode.appendChild(
        new NavigatorGroupTreeNode(
          this,
          e,
          e.id(),
          Types.FileSystem,
          e.displayName()
        )
      ),
      this._selectDefaultTreeNode());
  }
  _selectDefaultTreeNode() {
    const e = this._rootNode.children();
    e.length &&
      !this._scriptsTree.selectedTreeElement &&
      e[0].treeNode().select(!0, !1);
  }
  _computeUniqueFileSystemProjectNames() {
    const e = this._workspace.projectsForType(
      Workspace.Workspace.projectTypes.FileSystem
    );
    if (!e.length) return;
    const t = new Persistence.Persistence.PathEncoder(),
      i = e.map((e) => {
        const i = e;
        return Platform.StringUtilities.reverse(t.encode(i.fileSystemPath()));
      }),
      r = new Common.Trie.Trie();
    for (const e of i) r.add(e);
    for (let o = 0; o < e.length; ++o) {
      const s = i[o],
        n = e[o];
      r.remove(s);
      const d = r.longestPrefix(s, !1);
      r.add(s);
      const a = s.substring(0, d.length + 1),
        l = t.decode(Platform.StringUtilities.reverse(a)),
        c = this._rootNode.child(n.id());
      c && c.setTitle(l);
    }
  }
  _removeProject(e) {
    const t = e.uiSourceCodes();
    for (let e = 0; e < t.length; ++e) this._removeUISourceCode(t[e]);
    if (e.type() !== Workspace.Workspace.projectTypes.FileSystem) return;
    const i = this._rootNode.child(e.id());
    i && this._rootNode.removeChild(i);
  }
  _folderNodeId(e, t, i, r, o) {
    return (
      (t ? t.id() : "") +
      ":" +
      (e.type() === Workspace.Workspace.projectTypes.FileSystem ? e.id() : "") +
      ":" +
      (this._groupByFrame && i ? i.id : "") +
      ":" +
      r +
      ":" +
      o
    );
  }
  _folderNode(e, t, i, r, o, s, n) {
    if (Snippets.ScriptSnippetFileSystem.isSnippetsUISourceCode(e))
      return this._rootNode;
    if (i && !this._groupByFolder && !n) return this._domainNode(e, t, i, r, o);
    const d = s.join("/"),
      a = this._folderNodeId(t, i, r, o, d);
    let l = this._subfolderNodes.get(a);
    if (l) return l;
    if (!s.length)
      return i ? this._domainNode(e, t, i, r, o) : this._rootNode.child(t.id());
    const c = this._folderNode(e, t, i, r, o, s.slice(0, -1), n);
    let h = n ? Types.SourceMapFolder : Types.NetworkFolder;
    t.type() === Workspace.Workspace.projectTypes.FileSystem &&
      (h = Types.FileSystemFolder);
    const p = s[s.length - 1];
    return (
      (l = new NavigatorFolderTreeNode(this, t, a, h, d, p)),
      this._subfolderNodes.set(a, l),
      c.appendChild(l),
      l
    );
  }
  _domainNode(e, t, i, r, o) {
    const s = this._frameNode(t, i, r);
    if (!this._groupByDomain) return s;
    let n = s.child(o);
    return (
      n ||
      ((n = new NavigatorGroupTreeNode(
        this,
        t,
        o,
        Types.Domain,
        this._computeProjectDisplayName(i, o)
      )),
      r &&
        o === Common.ParsedURL.ParsedURL.extractOrigin(r.url) &&
        (n.treeNode()._boostOrder = !0),
      s.appendChild(n),
      n)
    );
  }
  _frameNode(e, t, i) {
    if (!this._groupByFrame || !i) return this._targetNode(e, t);
    let r = this._frameNodes.get(i);
    if (r) return r;
    (r = new NavigatorGroupTreeNode(
      this,
      e,
      t.id() + ":" + i.id,
      Types.Frame,
      i.displayName()
    )),
      r.setHoverCallback(function (e) {
        if (e) {
          const e = t.model(SDK.OverlayModel.OverlayModel);
          e && e.highlightFrame(i.id);
        } else SDK.OverlayModel.OverlayModel.hideDOMNodeHighlight();
      }),
      this._frameNodes.set(i, r);
    const o = i.parentFrame();
    return (
      this._frameNode(e, o ? o.resourceTreeModel().target() : t, o).appendChild(
        r
      ),
      o || ((r.treeNode()._boostOrder = !0), r.treeNode().expand()),
      r
    );
  }
  _targetNode(e, t) {
    if (t === SDK.SDKModel.TargetManager.instance().mainTarget())
      return this._rootNode;
    let i = this._rootNode.child("target:" + t.id());
    return (
      i ||
        ((i = new NavigatorGroupTreeNode(
          this,
          e,
          "target:" + t.id(),
          t.type() === SDK.SDKModel.Type.Frame ? Types.Frame : Types.Worker,
          t.name()
        )),
        this._rootNode.appendChild(i)),
      i
    );
  }
  _computeProjectDisplayName(e, t) {
    const i = e.model(SDK.RuntimeModel.RuntimeModel),
      r = i ? i.executionContexts() : [];
    for (const e of r)
      if (e.name && e.origin && t.startsWith(e.origin)) return e.name;
    if (!t) return Common.UIString.UIString("(no domain)");
    const o = new Common.ParsedURL.ParsedURL(t);
    return (o.isValid ? o.host + (o.port ? ":" + o.port : "") : "") || t;
  }
  revealUISourceCode(e, t) {
    const i = this._uiSourceCodeNodes.get(e).firstValue();
    return i
      ? (this._scriptsTree.selectedTreeElement &&
          this._scriptsTree.selectedTreeElement.deselect(),
        (this._lastSelectedUISourceCode = e),
        i.reveal(t),
        i)
      : null;
  }
  _sourceSelected(e, t) {
    (this._lastSelectedUISourceCode = e), Common.Revealer.reveal(e, !t);
  }
  _removeUISourceCode(e) {
    const t = this._uiSourceCodeNodes.get(e);
    for (const e of t) this._removeUISourceCodeNode(e);
  }
  _removeUISourceCodeNode(e) {
    const t = e.uiSourceCode();
    this._uiSourceCodeNodes.delete(t, e);
    const i = t.project(),
      r = Bindings.NetworkProject.NetworkProject.targetForUISourceCode(t),
      o = e.frame();
    let s = e.parent;
    for (
      s.removeChild(e), e = s;
      e &&
      ((s = e.parent), s && e.isEmpty()) &&
      (s !== this._rootNode ||
        i.type() !== Workspace.Workspace.projectTypes.FileSystem) &&
      (e instanceof NavigatorGroupTreeNode ||
        e instanceof NavigatorFolderTreeNode);

    ) {
      if (e._type === Types.Frame) {
        this._discardFrame(o);
        break;
      }
      const n = this._folderNodeId(i, r, o, t.origin(), e._folderPath);
      this._subfolderNodes.delete(n), s.removeChild(e), (e = s);
    }
  }
  reset() {
    for (const e of this._uiSourceCodeNodes.valuesArray()) e.dispose();
    this._scriptsTree.removeChildren(),
      this._scriptsTree.setFocusable(!1),
      this._uiSourceCodeNodes.clear(),
      this._subfolderNodes.clear(),
      this._frameNodes.clear(),
      this._rootNode.reset(),
      this._resetWorkspace(Workspace.Workspace.WorkspaceImpl.instance());
  }
  handleContextMenu(e) {}
  _renameShortcut() {
    const e =
      this._scriptsTree.selectedTreeElement &&
      this._scriptsTree.selectedTreeElement._node;
    return (
      !!(e && e._uiSourceCode && e._uiSourceCode.canRename()) &&
      (this.rename(e, !1), !0)
    );
  }
  _handleContextMenuCreate(e, t, i) {
    if (i) {
      const e =
        Persistence.FileSystemWorkspaceBinding.FileSystemWorkspaceBinding.relativePath(
          i
        );
      e.pop(), (t = e.join("/"));
    }
    this.create(e, t, i);
  }
  _handleContextMenuRename(e) {
    this.rename(e, !1);
  }
  _handleContextMenuExclude(e, t) {
    window.confirm(
      Common.UIString.UIString("Are you sure you want to exclude this folder?")
    ) &&
      (UI.UIUtils.startBatchUpdate(),
      e.excludeFolder(
        Persistence.FileSystemWorkspaceBinding.FileSystemWorkspaceBinding.completeURL(
          e,
          t
        )
      ),
      UI.UIUtils.endBatchUpdate());
  }
  _handleContextMenuDelete(e) {
    window.confirm(
      Common.UIString.UIString("Are you sure you want to delete this file?")
    ) && e.project().deleteFile(e);
  }
  handleFileContextMenu(e, t) {
    const i = t.uiSourceCode(),
      r = new UI.ContextMenu.ContextMenu(e);
    r.appendApplicableItems(i);
    const o = i.project();
    o.type() === Workspace.Workspace.projectTypes.FileSystem &&
      (r
        .editSection()
        .appendItem(
          Common.UIString.UIString("Rename…"),
          this._handleContextMenuRename.bind(this, t)
        ),
      r
        .editSection()
        .appendItem(
          Common.UIString.UIString("Make a copy…"),
          this._handleContextMenuCreate.bind(this, o, "", i)
        ),
      r
        .editSection()
        .appendItem(
          Common.UIString.UIString("Delete"),
          this._handleContextMenuDelete.bind(this, i)
        )),
      r.show();
  }
  _handleDeleteOverrides(e) {
    window.confirm(
      ls`Are you sure you want to delete all overrides contained in this folder?`
    ) && this._handleDeleteOverridesHelper(e);
  }
  _handleDeleteOverridesHelper(e) {
    e._children.forEach((e) => {
      this._handleDeleteOverridesHelper(e);
    }),
      e instanceof NavigatorUISourceCodeTreeNode &&
        e.uiSourceCode().project().deleteFile(e.uiSourceCode());
  }
  handleFolderContextMenu(e, t) {
    const i = t._folderPath || "",
      r = t._project,
      o = new UI.ContextMenu.ContextMenu(e);
    if (
      (NavigatorView.appendSearchItem(o, i),
      r.type() === Workspace.Workspace.projectTypes.FileSystem)
    ) {
      const e = Common.ParsedURL.ParsedURL.urlToPlatformPath(
        Persistence.FileSystemWorkspaceBinding.FileSystemWorkspaceBinding.completeURL(
          r,
          i
        ),
        Host.Platform.isWin()
      );
      o
        .revealSection()
        .appendItem(Common.UIString.UIString("Open folder"), () =>
          Host.InspectorFrontendHost.InspectorFrontendHostInstance.showItemInFolder(
            e
          )
        ),
        r.canCreateFile() &&
          o
            .defaultSection()
            .appendItem(
              Common.UIString.UIString("New file"),
              this._handleContextMenuCreate.bind(this, r, i)
            );
    }
    r.canExcludeFolder(i) &&
      o
        .defaultSection()
        .appendItem(
          Common.UIString.UIString("Exclude folder"),
          this._handleContextMenuExclude.bind(this, r, i)
        ),
      r.type() === Workspace.Workspace.projectTypes.FileSystem &&
        (o
          .defaultSection()
          .appendAction("sources.add-folder-to-workspace", void 0, !0),
        t instanceof NavigatorGroupTreeNode &&
          o
            .defaultSection()
            .appendItem(
              Common.UIString.UIString("Remove folder from workspace"),
              function () {
                window.confirm(
                  Common.UIString.UIString(
                    "Are you sure you want to remove this folder?"
                  )
                ) && r.remove();
              }
            ),
        "overrides" === r._fileSystem._type &&
          o
            .defaultSection()
            .appendItem(
              ls`Delete all overrides`,
              this._handleDeleteOverrides.bind(this, t)
            )),
      o.show();
  }
  rename(e, t) {
    const i = e.uiSourceCode();
    e.rename(
      function (r) {
        if (!t) return;
        r
          ? e._treeElement.listItemElement.hasFocus() &&
            this._sourceSelected(i, !0)
          : i.remove();
      }.bind(this)
    );
  }
  async create(e, t, i) {
    let r = "";
    i && (r = (await i.requestContent()).content || "");
    const o = await e.createFile(t, null, r);
    if (!o) return;
    this._sourceSelected(o, !1);
    const s = this.revealUISourceCode(o, !0);
    s && this.rename(s, !0);
  }
  _groupingChanged() {
    this.reset(),
      this._initGrouping(),
      this._workspace.uiSourceCodes().forEach(this._addUISourceCode.bind(this));
  }
  _initGrouping() {
    (this._groupByFrame = !0),
      (this._groupByDomain = this._navigatorGroupByFolderSetting.get()),
      (this._groupByFolder = this._groupByDomain);
  }
  _resetForTest() {
    this.reset(),
      this._workspace.uiSourceCodes().forEach(this._addUISourceCode.bind(this));
  }
  _discardFrame(e) {
    const t = this._frameNodes.get(e);
    if (t) {
      t.parent && t.parent.removeChild(t), this._frameNodes.delete(e);
      for (const t of e.childFrames) this._discardFrame(t);
    }
  }
  targetAdded(e) {}
  targetRemoved(e) {
    const t = this._rootNode.child("target:" + e.id());
    t && this._rootNode.removeChild(t);
  }
  _targetNameChanged(e) {
    const t = e.data,
      i = this._rootNode.child("target:" + t.id());
    i && i.setTitle(t.name());
  }
}
export const Types = {
  Domain: "domain",
  File: "file",
  FileSystem: "fs",
  FileSystemFolder: "fs-folder",
  Frame: "frame",
  NetworkFolder: "nw-folder",
  Root: "root",
  SourceMapFolder: "sm-folder",
  Worker: "worker",
};
export class NavigatorFolderTreeElement extends UI.TreeOutline.TreeElement {
  constructor(e, t, i, r) {
    super("", !0),
      this.listItemElement.classList.add(
        "navigator-" + t + "-tree-item",
        "navigator-folder-tree-item"
      ),
      UI.ARIAUtils.setAccessibleName(this.listItemElement, `${i}, ${t}`),
      (this._nodeType = t),
      (this.title = i),
      (this.tooltip = i),
      (this._navigatorView = e),
      (this._hoverCallback = r);
    let o = "largeicon-navigator-folder";
    t === Types.Domain
      ? (o = "largeicon-navigator-domain")
      : t === Types.Frame
      ? (o = "largeicon-navigator-frame")
      : t === Types.Worker && (o = "largeicon-navigator-worker"),
      this.setLeadingIcons([UI.Icon.Icon.create(o, "icon")]);
  }
  async onpopulate() {
    this._node.populate();
  }
  onattach() {
    this.collapse(),
      this._node.onattach(),
      this.listItemElement.addEventListener(
        "contextmenu",
        this._handleContextMenuEvent.bind(this),
        !1
      ),
      this.listItemElement.addEventListener(
        "mousemove",
        this._mouseMove.bind(this),
        !1
      ),
      this.listItemElement.addEventListener(
        "mouseleave",
        this._mouseLeave.bind(this),
        !1
      );
  }
  setNode(e) {
    this._node = e;
    const t = [];
    for (; e && !e.isRoot(); ) t.push(e._title), (e = e.parent);
    t.reverse(),
      (this.tooltip = t.join("/")),
      UI.ARIAUtils.setAccessibleName(
        this.listItemElement,
        `${this.title}, ${this._nodeType}`
      );
  }
  _handleContextMenuEvent(e) {
    this._node &&
      (this.select(),
      this._navigatorView.handleFolderContextMenu(e, this._node));
  }
  _mouseMove(e) {
    !this._hovered &&
      this._hoverCallback &&
      ((this._hovered = !0), this._hoverCallback(!0));
  }
  _mouseLeave(e) {
    this._hoverCallback && ((this._hovered = !1), this._hoverCallback(!1));
  }
}
export class NavigatorSourceTreeElement extends UI.TreeOutline.TreeElement {
  constructor(e, t, i, r) {
    super("", !1),
      (this._nodeType = Types.File),
      (this._node = r),
      (this.title = i),
      this.listItemElement.classList.add(
        "navigator-" + t.contentType().name() + "-tree-item",
        "navigator-file-tree-item"
      ),
      (this.tooltip = t.url()),
      UI.ARIAUtils.setAccessibleName(
        this.listItemElement,
        `${t.name()}, ${this._nodeType}`
      ),
      Common.EventTarget.fireEvent(
        "source-tree-file-added",
        t.fullDisplayName()
      ),
      (this._navigatorView = e),
      (this._uiSourceCode = t),
      this.updateIcon();
  }
  updateIcon() {
    const e = self.Persistence.persistence.binding(this._uiSourceCode);
    if (e) {
      const t = document.createElement("span");
      t.classList.add("icon-stack");
      let i = "largeicon-navigator-file-sync";
      Snippets.ScriptSnippetFileSystem.isSnippetsUISourceCode(e.fileSystem) &&
        (i = "largeicon-navigator-snippet");
      const r = UI.Icon.Icon.create(i, "icon"),
        o = UI.Icon.Icon.create("badge-navigator-file-sync", "icon-badge");
      self.Persistence.networkPersistenceManager.project() ===
        e.fileSystem.project() && (o.style.filter = "hue-rotate(160deg)"),
        t.appendChild(r),
        t.appendChild(o),
        (t.title =
          Persistence.PersistenceUtils.PersistenceUtils.tooltipForUISourceCode(
            this._uiSourceCode
          )),
        this.setLeadingIcons([t]);
    } else {
      let e = "largeicon-navigator-file";
      Snippets.ScriptSnippetFileSystem.isSnippetsUISourceCode(
        this._uiSourceCode
      ) && (e = "largeicon-navigator-snippet");
      const t = UI.Icon.Icon.create(e, "icon");
      this.setLeadingIcons([t]);
    }
  }
  get uiSourceCode() {
    return this._uiSourceCode;
  }
  onattach() {
    (this.listItemElement.draggable = !0),
      this.listItemElement.addEventListener(
        "click",
        this._onclick.bind(this),
        !1
      ),
      this.listItemElement.addEventListener(
        "contextmenu",
        this._handleContextMenuEvent.bind(this),
        !1
      ),
      this.listItemElement.addEventListener(
        "dragstart",
        this._ondragstart.bind(this),
        !1
      );
  }
  _shouldRenameOnMouseDown() {
    if (!this._uiSourceCode.canRename()) return !1;
    return (
      this === this.treeOutline.selectedTreeElement &&
      this.treeOutline.element.hasFocus() &&
      !UI.UIUtils.isBeingEdited(this.treeOutline.element)
    );
  }
  selectOnMouseDown(e) {
    1 === e.which && this._shouldRenameOnMouseDown()
      ? setTimeout(
          function () {
            this._shouldRenameOnMouseDown() &&
              this._navigatorView.rename(this._node, !1);
          }.bind(this),
          300
        )
      : super.selectOnMouseDown(e);
  }
  _ondragstart(e) {
    e.dataTransfer.setData("text/plain", this._uiSourceCode.url()),
      (e.dataTransfer.effectAllowed = "copy");
  }
  onspace() {
    return this._navigatorView._sourceSelected(this.uiSourceCode, !0), !0;
  }
  _onclick(e) {
    this._navigatorView._sourceSelected(this.uiSourceCode, !1);
  }
  ondblclick(e) {
    const t = 1 === e.button;
    return this._navigatorView._sourceSelected(this.uiSourceCode, !t), !1;
  }
  onenter() {
    return this._navigatorView._sourceSelected(this.uiSourceCode, !0), !0;
  }
  ondelete() {
    return !0;
  }
  _handleContextMenuEvent(e) {
    this.select(), this._navigatorView.handleFileContextMenu(e, this._node);
  }
}
export class NavigatorTreeNode {
  constructor(e, t, i) {
    (this.id = t),
      (this._navigatorView = e),
      (this._type = i),
      (this._children = new Map());
  }
  treeNode() {
    throw "Not implemented";
  }
  dispose() {}
  isRoot() {
    return !1;
  }
  hasChildren() {
    return !0;
  }
  onattach() {}
  setTitle(e) {
    throw "Not implemented";
  }
  populate() {
    this.isPopulated() ||
      (this.parent && this.parent.populate(),
      (this._populated = !0),
      this.wasPopulated());
  }
  wasPopulated() {
    const e = this.children();
    for (let t = 0; t < e.length; ++t)
      this._navigatorView.appendChild(this.treeNode(), e[t].treeNode());
  }
  didAddChild(e) {
    this.isPopulated() &&
      this._navigatorView.appendChild(this.treeNode(), e.treeNode());
  }
  willRemoveChild(e) {
    this.isPopulated() &&
      this._navigatorView.removeChild(this.treeNode(), e.treeNode());
  }
  isPopulated() {
    return this._populated;
  }
  isEmpty() {
    return !this._children.size;
  }
  children() {
    return [...this._children.values()];
  }
  child(e) {
    return this._children.get(e) || null;
  }
  appendChild(e) {
    this._children.set(e.id, e), (e.parent = this), this.didAddChild(e);
  }
  removeChild(e) {
    this.willRemoveChild(e),
      this._children.delete(e.id),
      delete e.parent,
      e.dispose();
  }
  reset() {
    this._children.clear();
  }
}
export class NavigatorRootTreeNode extends NavigatorTreeNode {
  constructor(e) {
    super(e, "", Types.Root);
  }
  isRoot() {
    return !0;
  }
  treeNode() {
    return this._navigatorView._scriptsTree.rootElement();
  }
}
export class NavigatorUISourceCodeTreeNode extends NavigatorTreeNode {
  constructor(e, t, i) {
    super(e, t.project().id() + ":" + t.url(), Types.File),
      (this._uiSourceCode = t),
      (this._treeElement = null),
      (this._eventListeners = []),
      (this._frame = i);
  }
  frame() {
    return this._frame;
  }
  uiSourceCode() {
    return this._uiSourceCode;
  }
  treeNode() {
    if (this._treeElement) return this._treeElement;
    (this._treeElement = new NavigatorSourceTreeElement(
      this._navigatorView,
      this._uiSourceCode,
      "",
      this
    )),
      this.updateTitle();
    const e = this.updateTitle.bind(this, void 0);
    return (
      (this._eventListeners = [
        this._uiSourceCode.addEventListener(
          Workspace.UISourceCode.Events.TitleChanged,
          e
        ),
        this._uiSourceCode.addEventListener(
          Workspace.UISourceCode.Events.WorkingCopyChanged,
          e
        ),
        this._uiSourceCode.addEventListener(
          Workspace.UISourceCode.Events.WorkingCopyCommitted,
          e
        ),
      ]),
      this._treeElement
    );
  }
  updateTitle(e) {
    if (!this._treeElement) return;
    let t = this._uiSourceCode.displayName();
    !e && this._uiSourceCode.isDirty() && (t = "*" + t),
      (this._treeElement.title = t),
      this._treeElement.updateIcon();
    let i = this._uiSourceCode.url();
    this._uiSourceCode.contentType().isFromSourceMap() &&
      (i = Common.UIString.UIString(
        "%s (from source map)",
        this._uiSourceCode.displayName()
      )),
      (this._treeElement.tooltip = i);
  }
  hasChildren() {
    return !1;
  }
  dispose() {
    Common.EventTarget.EventTarget.removeEventListeners(this._eventListeners);
  }
  reveal(e) {
    this.parent.populate(),
      this.parent.treeNode().expand(),
      this._treeElement.reveal(!0),
      e && this._treeElement.select(!0);
  }
  rename(e) {
    if (!this._treeElement) return;
    this._treeElement.listItemElement.focus();
    const t = this._treeElement.treeOutline.element;
    function i(i) {
      if (!i)
        return (
          UI.UIUtils.markBeingEdited(t, !1),
          this.updateTitle(),
          void this.rename(e)
        );
      r.call(this, !0);
    }
    function r(i) {
      UI.UIUtils.markBeingEdited(t, !1), this.updateTitle(), e && e(i);
    }
    UI.UIUtils.markBeingEdited(t, !0),
      this.updateTitle(!0),
      this._treeElement.startEditingTitle(
        new UI.InplaceEditor.Config(
          function (e, t, o) {
            if (t !== o)
              return (
                (this._treeElement.title = t),
                void this._uiSourceCode.rename(t).then(i.bind(this))
              );
            r.call(this, !0);
          }.bind(this),
          r.bind(this, !1)
        )
      );
  }
}
export class NavigatorFolderTreeNode extends NavigatorTreeNode {
  constructor(e, t, i, r, o, s) {
    super(e, i, r),
      (this._project = t),
      (this._folderPath = o),
      (this._title = s);
  }
  treeNode() {
    return (
      this._treeElement ||
        ((this._treeElement = this._createTreeElement(this._title, this)),
        this.updateTitle()),
      this._treeElement
    );
  }
  updateTitle() {
    if (
      !this._treeElement ||
      this._project.type() !== Workspace.Workspace.projectTypes.FileSystem
    )
      return;
    const e =
        Persistence.FileSystemWorkspaceBinding.FileSystemWorkspaceBinding.fileSystemPath(
          this._project.id()
        ) +
        "/" +
        this._folderPath,
      t = self.Persistence.persistence.filePathHasBindings(e);
    this._treeElement.listItemElement.classList.toggle("has-mapped-files", t);
  }
  _createTreeElement(e, t) {
    if (this._project.type() !== Workspace.Workspace.projectTypes.FileSystem)
      try {
        e = decodeURI(e);
      } catch (e) {}
    const i = new NavigatorFolderTreeElement(
      this._navigatorView,
      this._type,
      e
    );
    return i.setNode(t), i;
  }
  wasPopulated() {
    this._treeElement &&
      this._treeElement._node === this &&
      this._addChildrenRecursive();
  }
  _addChildrenRecursive() {
    const e = this.children();
    for (let t = 0; t < e.length; ++t) {
      const i = e[t];
      this.didAddChild(i),
        i instanceof NavigatorFolderTreeNode && i._addChildrenRecursive();
    }
  }
  _shouldMerge(e) {
    return this._type !== Types.Domain && e instanceof NavigatorFolderTreeNode;
  }
  didAddChild(e) {
    function t(e) {
      return e._title;
    }
    if (!this._treeElement) return;
    let i,
      r = this.children();
    if (1 === r.length && this._shouldMerge(e))
      return (
        (e._isMerged = !0),
        (this._treeElement.title = this._treeElement.title + "/" + e._title),
        (e._treeElement = this._treeElement),
        void this._treeElement.setNode(e)
      );
    if ((2 === r.length && (i = r[0] !== e ? r[0] : r[1]), i && i._isMerged)) {
      delete i._isMerged;
      const e = [];
      e.push(this);
      let o = this;
      for (; o._isMerged; ) (o = o.parent), e.push(o);
      e.reverse();
      const s = e.map(t).join("/"),
        n = [];
      o = i;
      do {
        n.push(o), (r = o.children()), (o = 1 === r.length ? r[0] : null);
      } while (o && o._isMerged);
      if (!this.isPopulated()) {
        (this._treeElement.title = s), this._treeElement.setNode(this);
        for (let e = 0; e < n.length; ++e)
          delete n[e]._treeElement, delete n[e]._isMerged;
        return;
      }
      const d = this._treeElement,
        a = this._createTreeElement(s, this);
      for (let t = 0; t < e.length; ++t) e[t]._treeElement = a;
      this._navigatorView.appendChild(d.parent, a),
        d.setNode(n[n.length - 1]),
        (d.title = n.map(t).join("/")),
        this._navigatorView.removeChild(d.parent, d),
        this._navigatorView.appendChild(this._treeElement, d),
        d.expanded && a.expand();
    }
    this.isPopulated() &&
      this._navigatorView.appendChild(this._treeElement, e.treeNode());
  }
  willRemoveChild(e) {
    !e._isMerged &&
      this.isPopulated() &&
      this._navigatorView.removeChild(this._treeElement, e._treeElement);
  }
}
export class NavigatorGroupTreeNode extends NavigatorTreeNode {
  constructor(e, t, i, r, o) {
    super(e, i, r), (this._project = t), (this._title = o), this.populate();
  }
  setHoverCallback(e) {
    this._hoverCallback = e;
  }
  treeNode() {
    return (
      this._treeElement ||
        ((this._treeElement = new NavigatorFolderTreeElement(
          this._navigatorView,
          this._type,
          this._title,
          this._hoverCallback
        )),
        this._treeElement.setNode(this)),
      this._treeElement
    );
  }
  onattach() {
    this.updateTitle();
  }
  updateTitle() {
    if (
      !this._treeElement ||
      this._project.type() !== Workspace.Workspace.projectTypes.FileSystem
    )
      return;
    const e =
        Persistence.FileSystemWorkspaceBinding.FileSystemWorkspaceBinding.fileSystemPath(
          this._project.id()
        ),
      t =
        this._treeElement.listItemElement.classList.contains(
          "has-mapped-files"
        ),
      i = self.Persistence.persistence.filePathHasBindings(e);
    t !== i &&
      (this._treeElement.listItemElement.classList.toggle(
        "has-mapped-files",
        i
      ),
      this._treeElement.childrenListElement.hasFocus() ||
        (i ? this._treeElement.expand() : this._treeElement.collapse()));
  }
  setTitle(e) {
    (this._title = e),
      this._treeElement && (this._treeElement.title = this._title);
  }
}

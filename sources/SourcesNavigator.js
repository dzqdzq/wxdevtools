import * as Common from "../common/common.js";
import * as Host from "../host/host.js";
import * as Persistence from "../persistence/persistence.js";
import * as SDK from "../sdk/sdk.js";
import * as Snippets from "../snippets/snippets.js";
import * as UI from "../ui/ui.js";
import * as Workspace from "../workspace/workspace.js";
import {
  NavigatorUISourceCodeTreeNode,
  NavigatorView,
} from "./NavigatorView.js";
export class NetworkNavigatorView extends NavigatorView {
  constructor() {
    super();

    SDK.SDKModel.TargetManager.instance().addEventListener(
      SDK.SDKModel.Events.InspectedURLChanged,
      this._inspectedURLChanged,
      this
    );

    Host.userMetrics.panelLoaded("sources", "DevTools.Launch.Sources");
  }
  acceptProject(e) {
    return e.type() === Workspace.Workspace.projectTypes.Network;
  }
  _inspectedURLChanged(e) {
    const t = SDK.SDKModel.TargetManager.instance().mainTarget();
    if (e.data !== t) {
      return;
    }
    const o = t && t.inspectedURL();
    if (o) {
      for (const e of this.workspace().uiSourceCodes()) {
        if (this.acceptProject(e.project()) && e.url() === o) {
          this.revealUISourceCode(e, true);
        }
      }
    }
  }
  uiSourceCodeAdded(e) {
    const t = SDK.SDKModel.TargetManager.instance().mainTarget();
    const o = t && t.inspectedURL();

    if (o && e.url() === o) {
      this.revealUISourceCode(e, true);
    }
  }
}
export class FilesNavigatorView extends NavigatorView {
  constructor() {
    super();
    const e = new UI.EmptyWidget.EmptyWidget("");
    this.setPlaceholder(e);

    e.appendParagraph().appendChild(UI.Fragment.html`
    <div>${ls`Sync changes in DevTools with the local filesystem`}</div><br />
    ${UI.XLink.XLink.create(
      "https://developers.google.com/web/tools/chrome-devtools/workspaces/",
      ls`Learn more about Workspaces`
    )}
  `);

    const t = new UI.Toolbar.Toolbar("navigator-toolbar");
    t.appendItemsAtLocation("files-navigator-toolbar").then(() => {
      if (!t.empty()) {
        this.contentElement.insertBefore(
          t.element,
          this.contentElement.firstChild
        );
      }
    });
  }
  acceptProject(e) {
    return (
      e.type() === Workspace.Workspace.projectTypes.FileSystem &&
      Persistence.FileSystemWorkspaceBinding.FileSystemWorkspaceBinding.fileSystemType(
        e
      ) !== "overrides" &&
      !Snippets.ScriptSnippetFileSystem.isSnippetsProject(e)
    );
  }
  handleContextMenu(e) {
    const t = new UI.ContextMenu.ContextMenu(e);

    t.defaultSection().appendAction(
      "sources.add-folder-to-workspace",
      undefined,
      true
    );

    t.show();
  }
}
export class OverridesNavigatorView extends NavigatorView {
  constructor() {
    super();
    const e = new UI.EmptyWidget.EmptyWidget("");
    this.setPlaceholder(e);

    e.appendParagraph().appendChild(UI.Fragment.html`
    <div>${ls`Override page assets with files from a local folder`}</div><br />
    ${UI.XLink.XLink.create(
      "https://developers.google.com/web/updates/2018/01/devtools#overrides",
      ls`Learn more`
    )}
  `);

    this._toolbar = new UI.Toolbar.Toolbar("navigator-toolbar");

    this.contentElement.insertBefore(
      this._toolbar.element,
      this.contentElement.firstChild
    );

    self.Persistence.networkPersistenceManager.addEventListener(
      Persistence.NetworkPersistenceManager.Events.ProjectChanged,
      this._updateProjectAndUI,
      this
    );

    this.workspace().addEventListener(
      Workspace.Workspace.Events.ProjectAdded,
      this._onProjectAddOrRemoved,
      this
    );

    this.workspace().addEventListener(
      Workspace.Workspace.Events.ProjectRemoved,
      this._onProjectAddOrRemoved,
      this
    );

    this._updateProjectAndUI();
  }
  _onProjectAddOrRemoved(e) {
    const e_data = e.data;

    if (
      !e_data ||
      e_data.type() !== Workspace.Workspace.projectTypes.FileSystem ||
      Persistence.FileSystemWorkspaceBinding.FileSystemWorkspaceBinding.fileSystemType(
        e_data
      ) === "overrides"
    ) {
      this._updateUI();
    }
  }
  _updateProjectAndUI() {
    this.reset();
    const e = self.Persistence.networkPersistenceManager.project();

    if (e) {
      this.tryAddProject(e);
    }

    this._updateUI();
  }
  _updateUI() {
    this._toolbar.removeToolbarItems();
    const e = self.Persistence.networkPersistenceManager.project();
    if (e) {
      const t = new UI.Toolbar.ToolbarSettingCheckbox(
        Common.Settings.Settings.instance().moduleSetting(
          "persistenceNetworkOverridesEnabled"
        )
      );
      this._toolbar.appendToolbarItem(t);
      this._toolbar.appendToolbarItem(new UI.Toolbar.ToolbarSeparator(true));
      const o = new UI.Toolbar.ToolbarButton(
        Common.UIString.UIString("Clear configuration"),
        "largeicon-clear"
      );

      o.addEventListener(UI.Toolbar.ToolbarButton.Events.Click, () => {
        e.remove();
      });

      return void this._toolbar.appendToolbarItem(o);
    }
    const t = Common.UIString.UIString("Select folder for overrides");
    const o = new UI.Toolbar.ToolbarButton(t, "largeicon-add", t);

    o.addEventListener(
      UI.Toolbar.ToolbarButton.Events.Click,
      (e) => {
        this._setupNewWorkspace();
      },
      this
    );

    this._toolbar.appendToolbarItem(o);
  }
  async _setupNewWorkspace() {
    if (
      await Persistence.IsolatedFileSystemManager.IsolatedFileSystemManager.instance().addFileSystem(
        "overrides"
      )
    ) {
      Common.Settings.Settings.instance()
        .moduleSetting("persistenceNetworkOverridesEnabled")
        .set(true);
    }
  }
  acceptProject(e) {
    return e === self.Persistence.networkPersistenceManager.project();
  }
}
export class ContentScriptsNavigatorView extends NavigatorView {
  constructor() {
    super();
    const e = new UI.EmptyWidget.EmptyWidget("");
    this.setPlaceholder(e);

    e.appendParagraph().appendChild(UI.Fragment.html`
    <div>${ls`Content scripts served by extensions appear here`}</div><br />
    ${UI.XLink.XLink.create(
      "https://developer.chrome.com/extensions/content_scripts",
      ls`Learn more`
    )}
  `);
  }
  acceptProject(e) {
    return e.type() === Workspace.Workspace.projectTypes.ContentScripts;
  }
}
export class SnippetsNavigatorView extends NavigatorView {
  constructor() {
    super();
    const e = new UI.EmptyWidget.EmptyWidget("");
    this.setPlaceholder(e);

    e.appendParagraph().appendChild(UI.Fragment.html`
    <div>${ls`Create and save code snippets for later reuse`}</div><br />
    ${UI.XLink.XLink.create(
      "https://developers.google.com/web/tools/chrome-devtools/javascript/snippets",
      ls`Learn more`
    )}
  `);

    const t = new UI.Toolbar.Toolbar("navigator-toolbar");

    const o = new UI.Toolbar.ToolbarButton(
      ls`New snippet`,
      "largeicon-add",
      Common.UIString.UIString("New snippet")
    );

    o.addEventListener(UI.Toolbar.ToolbarButton.Events.Click, (e) => {
      this.create(self.Snippets.project, "");
    });

    t.appendToolbarItem(o);

    this.contentElement.insertBefore(t.element, this.contentElement.firstChild);
  }
  acceptProject(e) {
    return Snippets.ScriptSnippetFileSystem.isSnippetsProject(e);
  }
  handleContextMenu(e) {
    const t = new UI.ContextMenu.ContextMenu(e);

    t.headerSection().appendItem(ls`Create new snippet`, () =>
      this.create(self.Snippets.project, "")
    );

    t.show();
  }
  handleFileContextMenu(e, t) {
    const o = t.uiSourceCode();
    const r = new UI.ContextMenu.ContextMenu(e);

    r.headerSection().appendItem(Common.UIString.UIString("Run"), () =>
      Snippets.ScriptSnippetFileSystem.evaluateScriptSnippet(o)
    );

    r.editSection().appendItem(Common.UIString.UIString("Rename…"), () =>
      this.rename(t, false)
    );

    r.editSection().appendItem(Common.UIString.UIString("Remove"), () =>
      o.project().deleteFile(o)
    );

    r.saveSection().appendItem(
      Common.UIString.UIString("Save as..."),
      this._handleSaveAs.bind(this, o)
    );

    r.show();
  }
  async _handleSaveAs(e) {
    e.commitWorkingCopy();
    const { content } = await e.requestContent();
    self.Workspace.fileManager.save(e.url(), content || "", true);
    self.Workspace.fileManager.close(e.url());
  }
}
export class ActionDelegate {
  handleAction(e, t) {
    switch (t) {
      case "sources.create-snippet": {
        self.Snippets.project
          .createFile("", null, "")
          .then((e) => Common.Revealer.reveal(e));

        return true;
      }
      case "sources.add-folder-to-workspace": {
        Persistence.IsolatedFileSystemManager.IsolatedFileSystemManager.instance().addFileSystem();
        return true;
      }
    }
    return false;
  }
}

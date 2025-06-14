import * as Bindings from "../bindings/bindings.js";
import * as Common from "../common/common.js";
import * as Extensions from "../extensions/extensions.js";
import * as Host from "../host/host.js";
import * as ObjectUI from "../object_ui/object_ui.js";
import * as SDK from "../sdk/sdk.js";
import * as Snippets from "../snippets/snippets.js";
import * as UI from "../ui/ui.js";
import * as Workspace from "../workspace/workspace.js";
import { CallStackSidebarPane } from "./CallStackSidebarPane.js";
import { DebuggerPausedMessage } from "./DebuggerPausedMessage.js";
import { NavigatorView } from "./NavigatorView.js";
import { Events, SourcesView } from "./SourcesView.js";
import { ThreadsSidebarPane } from "./ThreadsSidebarPane.js";
import { UISourceCodeFrame } from "./UISourceCodeFrame.js";
export class SourcesPanel extends UI.Panel.Panel {
  constructor() {
    super("sources");
    SourcesPanel._instance = this;
    this.registerRequiredCSS("sources/sourcesPanel.css");

    new UI.DropTarget.DropTarget(
      this.element,
      [UI.DropTarget.Type.Folder],
      Common.UIString.UIString("Drop workspace folder here"),
      this._handleDrop.bind(this)
    );

    this._workspace = Workspace.Workspace.WorkspaceImpl.instance();

    this._togglePauseAction =
      UI.ActionRegistry.ActionRegistry.instance().action(
        "debugger.toggle-pause"
      );

    this._stepOverAction =
      UI.ActionRegistry.ActionRegistry.instance().action("debugger.step-over");

    this._stepIntoAction =
      UI.ActionRegistry.ActionRegistry.instance().action("debugger.step-into");

    this._stepOutAction =
      UI.ActionRegistry.ActionRegistry.instance().action("debugger.step-out");

    this._stepAction =
      UI.ActionRegistry.ActionRegistry.instance().action("debugger.step");

    this._toggleBreakpointsActiveAction =
      UI.ActionRegistry.ActionRegistry.instance().action(
        "debugger.toggle-breakpoints-active"
      );

    this._debugToolbar = this._createDebugToolbar();
    this._debugToolbarDrawer = this._createDebugToolbarDrawer();
    this._debuggerPausedMessage = new DebuggerPausedMessage();

    this._splitWidget = new UI.SplitWidget.SplitWidget(
      true,
      true,
      "sourcesPanelSplitViewState",
      225
    );

    this._splitWidget.enableShowModeSaving();
    this._splitWidget.show(this.element);

    this.editorView = new UI.SplitWidget.SplitWidget(
      true,
      false,
      "sourcesPanelNavigatorSplitViewState",
      225
    );

    this.editorView.enableShowModeSaving();
    this._splitWidget.setMainWidget(this.editorView);

    this._navigatorTabbedLocation =
      UI.ViewManager.ViewManager.instance().createTabbedLocation(
        this._revealNavigatorSidebar.bind(this),
        "navigator-view",
        true
      );

    const e = this._navigatorTabbedLocation.tabbedPane();
    e.setMinimumSize(100, 25);
    e.element.classList.add("navigator-tabbed-pane");
    const t = new UI.Toolbar.ToolbarMenuButton(
      this._populateNavigatorMenu.bind(this),
      true
    );
    t.setTitle(Common.UIString.UIString("More options"));
    e.rightToolbar().appendToolbarItem(t);

    if (
      UI.ViewManager.ViewManager.instance().hasViewsForLocation(
        "run-view-sidebar"
      )
    ) {
      const t = new UI.SplitWidget.SplitWidget(
        false,
        true,
        "sourcePanelNavigatorSidebarSplitViewState"
      );
      t.setMainWidget(e);
      const i = UI.ViewManager.ViewManager.instance()
        .createTabbedLocation(
          this._revealNavigatorSidebar.bind(this),
          "run-view-sidebar"
        )
        .tabbedPane();
      t.setSidebarWidget(i);
      t.installResizer(i.headerElement());
      this.editorView.setSidebarWidget(t);
    } else {
      this.editorView.setSidebarWidget(e);
    }

    this._sourcesView = new SourcesView();

    this._sourcesView.addEventListener(
      Events.EditorSelected,
      this._editorSelected.bind(this)
    );

    this._toggleNavigatorSidebarButton =
      this.editorView.createShowHideSidebarButton(ls`navigator`);
    this._toggleDebuggerSidebarButton =
      this._splitWidget.createShowHideSidebarButton(ls`debugger`);
    this.editorView.setMainWidget(this._sourcesView);
    this._threadsSidebarPane = null;
    this._watchSidebarPane =
      UI.ViewManager.ViewManager.instance().view("sources.watch");
    this._callstackPane = self.runtime.sharedInstance(CallStackSidebarPane);

    Common.Settings.Settings.instance()
      .moduleSetting("sidebarPosition")
      .addChangeListener(this._updateSidebarPosition.bind(this));

    this._updateSidebarPosition();
    this._updateDebuggerButtonsAndStatus();
    this._pauseOnExceptionEnabledChanged();

    Common.Settings.Settings.instance()
      .moduleSetting("pauseOnExceptionEnabled")
      .addChangeListener(this._pauseOnExceptionEnabledChanged, this);

    this._liveLocationPool = new Bindings.LiveLocation.LiveLocationPool();

    this._setTarget(UI.Context.Context.instance().flavor(SDK.SDKModel.Target));

    Common.Settings.Settings.instance()
      .moduleSetting("breakpointsActive")
      .addChangeListener(this._breakpointsActiveStateChanged, this);

    UI.Context.Context.instance().addFlavorChangeListener(
      SDK.SDKModel.Target,
      this._onCurrentTargetChanged,
      this
    );

    UI.Context.Context.instance().addFlavorChangeListener(
      SDK.DebuggerModel.CallFrame,
      this._callFrameChanged,
      this
    );

    SDK.SDKModel.TargetManager.instance().addModelListener(
      SDK.DebuggerModel.DebuggerModel,
      SDK.DebuggerModel.Events.DebuggerWasEnabled,
      this._debuggerWasEnabled,
      this
    );

    SDK.SDKModel.TargetManager.instance().addModelListener(
      SDK.DebuggerModel.DebuggerModel,
      SDK.DebuggerModel.Events.DebuggerPaused,
      this._debuggerPaused,
      this
    );

    SDK.SDKModel.TargetManager.instance().addModelListener(
      SDK.DebuggerModel.DebuggerModel,
      SDK.DebuggerModel.Events.DebuggerResumed,
      (e) => this._debuggerResumed(e.data)
    );

    SDK.SDKModel.TargetManager.instance().addModelListener(
      SDK.DebuggerModel.DebuggerModel,
      SDK.DebuggerModel.Events.GlobalObjectCleared,
      (e) => this._debuggerResumed(e.data)
    );

    self.Extensions.extensionServer.addEventListener(
      Extensions.ExtensionServer.Events.SidebarPaneAdded,
      this._extensionSidebarPaneAdded,
      this
    );

    SDK.SDKModel.TargetManager.instance().observeTargets(this);
  }
  static instance() {
    return SourcesPanel._instance
      ? SourcesPanel._instance
      : self.runtime.sharedInstance(SourcesPanel);
  }
  static updateResizerAndSidebarButtons(e) {
    e._sourcesView.leftToolbar().removeToolbarItems();
    e._sourcesView.rightToolbar().removeToolbarItems();
    e._sourcesView.bottomToolbar().removeToolbarItems();
    const t =
      WrapperView.isShowing() && !self.UI.inspectorView.isDrawerMinimized();

    if (e._splitWidget.isVertical() || t) {
      e._splitWidget.uninstallResizer(e._sourcesView.toolbarContainerElement());
    } else {
      e._splitWidget.installResizer(e._sourcesView.toolbarContainerElement());
    }

    if (!t) {
      e._sourcesView
        .leftToolbar()
        .appendToolbarItem(e._toggleNavigatorSidebarButton);

      e._splitWidget.isVertical()
        ? e._sourcesView
            .rightToolbar()
            .appendToolbarItem(e._toggleDebuggerSidebarButton)
        : e._sourcesView
            .bottomToolbar()
            .appendToolbarItem(e._toggleDebuggerSidebarButton);
    }
  }
  targetAdded(e) {
    this._showThreadsIfNeeded();
  }
  targetRemoved(e) {}
  _showThreadsIfNeeded() {
    if (ThreadsSidebarPane.shouldBeShown() && !this._threadsSidebarPane) {
      this._threadsSidebarPane =
        UI.ViewManager.ViewManager.instance().view("sources.threads");

      this._sidebarPaneStack &&
        this._threadsSidebarPane &&
        this._sidebarPaneStack.showView(
          this._threadsSidebarPane,
          this._splitWidget.isVertical()
            ? this._watchSidebarPane
            : this._callstackPane
        );
    }
  }
  _setTarget(e) {
    if (!e) {
      return;
    }
    const t = e.model(SDK.DebuggerModel.DebuggerModel);

    if (t) {
      if (t.isPaused()) {
        this._showDebuggerPausedDetails(t.debuggerPausedDetails());
      } else {
        this._paused = false;
        this._clearInterface();
        this._toggleDebuggerSidebarButton.setEnabled(true);
      }
    }
  }
  _onCurrentTargetChanged(e) {
    const e_data = e.data;
    this._setTarget(e_data);
  }
  paused() {
    return this._paused;
  }
  wasShown() {
    UI.Context.Context.instance().setFlavor(SourcesPanel, this);
    super.wasShown();
    const WrapperView_instance = WrapperView._instance;

    if (WrapperView_instance && WrapperView_instance.isShowing()) {
      self.UI.inspectorView.setDrawerMinimized(true);
      SourcesPanel.updateResizerAndSidebarButtons(this);
    }

    this.editorView.setMainWidget(this._sourcesView);
  }
  willHide() {
    super.willHide();
    UI.Context.Context.instance().setFlavor(SourcesPanel, null);

    if (WrapperView.isShowing()) {
      WrapperView._instance._showViewInWrapper();
      self.UI.inspectorView.setDrawerMinimized(false);
      SourcesPanel.updateResizerAndSidebarButtons(this);
    }
  }
  resolveLocation(e) {
    return e === "sources.sidebar-top" ||
      e === "sources.sidebar-bottom" ||
      e === "sources.sidebar-bottom" ||
      e === "sources.sidebar-tabs"
      ? this._sidebarPaneStack
      : this._navigatorTabbedLocation;
  }
  _ensureSourcesViewVisible() {
    return (
      !!WrapperView.isShowing() ||
      (!!self.UI.inspectorView.canSelectPanel("sources") &&
        (UI.ViewManager.ViewManager.instance().showView("sources"), true))
    );
  }
  onResize() {
    if (
      Common.Settings.Settings.instance()
        .moduleSetting("sidebarPosition")
        .get() === "auto"
    ) {
      this.element
        .window()
        .requestAnimationFrame(this._updateSidebarPosition.bind(this));
    }
  }
  searchableView() {
    return this._sourcesView.searchableView();
  }
  _debuggerPaused(e) {
    const e_data = e.data;
    const i = e_data.debuggerPausedDetails();

    if (!this._paused) {
      this._setAsCurrentPanel();
    }

    if (
      UI.Context.Context.instance().flavor(SDK.SDKModel.Target) ===
      e_data.target()
    ) {
      this._showDebuggerPausedDetails(i);
    } else if (!this._paused) {
      UI.Context.Context.instance().setFlavor(
        SDK.SDKModel.Target,
        e_data.target()
      );
    }
  }
  _showDebuggerPausedDetails(e) {
    this._paused = true;
    this._updateDebuggerButtonsAndStatus();

    UI.Context.Context.instance().setFlavor(
      SDK.DebuggerModel.DebuggerPausedDetails,
      e
    );

    this._toggleDebuggerSidebarButton.setEnabled(false);
    this._revealDebuggerSidebar();
    window.focus();
    Host.InspectorFrontendHost.InspectorFrontendHostInstance.bringToFront();
  }
  _debuggerResumed(e) {
    const t = e.target();

    if (UI.Context.Context.instance().flavor(SDK.SDKModel.Target) === t) {
      this._paused = false;
      this._clearInterface();
      this._toggleDebuggerSidebarButton.setEnabled(true);

      this._switchToPausedTargetTimeout = setTimeout(
        this._switchToPausedTarget.bind(this, e),
        500
      );
    }
  }
  _debuggerWasEnabled(e) {
    const e_data = e.data;

    if (
      UI.Context.Context.instance().flavor(SDK.SDKModel.Target) ===
      e_data.target()
    ) {
      this._updateDebuggerButtonsAndStatus();
    }
  }
  get visibleView() {
    return this._sourcesView.visibleView();
  }
  showUISourceCode(e, t, i, s) {
    if (s) {
      const e = WrapperView._instance && WrapperView._instance.isShowing();
      if (!this.isShowing() && !e) {
        return;
      }
    } else {
      this._showEditor();
    }
    this._sourcesView.showSourceLocation(e, t, i, s);
  }
  _showEditor() {
    if (!WrapperView._instance || !WrapperView._instance.isShowing()) {
      this._setAsCurrentPanel();
    }
  }
  showUILocation(e, t) {
    this.showUISourceCode(e.uiSourceCode, e.lineNumber, e.columnNumber, t);
  }
  _revealInNavigator(e, t) {
    const i = self.runtime.extensions(NavigatorView);
    Promise.all(i.map((e) => e.instance())).then((s) => {
      s.forEach((o, n) => {
        const a = i[n].descriptor().viewId;

        if (o.acceptProject(e.project())) {
          o.revealUISourceCode(e, true);

          t
            ? this._navigatorTabbedLocation.tabbedPane().selectTab(a)
            : UI.ViewManager.ViewManager.instance().showView(a);
        }
      });
    });
  }
  _populateNavigatorMenu(e) {
    const t = Common.Settings.Settings.instance().moduleSetting(
      "navigatorGroupByFolder"
    );
    e.appendItemsAtLocation("navigatorMenu");

    e.viewSection().appendCheckboxItem(
      Common.UIString.UIString("Group by folder"),
      () => t.set(!t.get()),
      t.get()
    );
  }
  setIgnoreExecutionLineEvents(e) {
    this._ignoreExecutionLineEvents = e;
  }
  updateLastModificationTime() {
    this._lastModificationTime = window.performance.now();
  }
  async _executionLineChanged(e) {
    const t = await e.uiLocation();

    if (t) {
      if (
        window.performance.now() - this._lastModificationTime >=
        lastModificationTimeout
      ) {
        this._sourcesView.showSourceLocation(
          t.uiSourceCode,
          t.lineNumber,
          t.columnNumber,
          undefined,
          true
        );
      }
    }
  }
  _lastModificationTimeoutPassedForTest() {
    lastModificationTimeout = Number.MIN_VALUE;
  }
  _updateLastModificationTimeForTest() {
    lastModificationTimeout = Number.MAX_VALUE;
  }
  async _callFrameChanged() {
    const e = UI.Context.Context.instance().flavor(SDK.DebuggerModel.CallFrame);

    if (e) {
      this._executionLineLocation && this._executionLineLocation.dispose();

      this._executionLineLocation =
        await Bindings.DebuggerWorkspaceBinding.DebuggerWorkspaceBinding.instance().createCallFrameLiveLocation(
          e.location(),
          this._executionLineChanged.bind(this),
          this._liveLocationPool
        );
    }
  }
  _pauseOnExceptionEnabledChanged() {
    const e = Common.Settings.Settings.instance()
      .moduleSetting("pauseOnExceptionEnabled")
      .get();
    this._pauseOnExceptionButton.setToggled(e);

    this._pauseOnExceptionButton.setTitle(
      e ? ls`Don't pause on exceptions` : ls`Pause on exceptions`
    );

    this._debugToolbarDrawer.classList.toggle("expanded", e);
  }
  async _updateDebuggerButtonsAndStatus() {
    const e = UI.Context.Context.instance().flavor(SDK.SDKModel.Target);
    const t = e ? e.model(SDK.DebuggerModel.DebuggerModel) : null;

    if (t) {
      if (this._paused) {
        this._togglePauseAction.setToggled(true);
        this._togglePauseAction.setEnabled(true);
        this._stepOverAction.setEnabled(true);
        this._stepIntoAction.setEnabled(true);
        this._stepOutAction.setEnabled(true);
        this._stepAction.setEnabled(true);
      } else {
        this._togglePauseAction.setToggled(false);
        this._togglePauseAction.setEnabled(!t.isPausing());
        this._stepOverAction.setEnabled(false);
        this._stepIntoAction.setEnabled(false);
        this._stepOutAction.setEnabled(false);
        this._stepAction.setEnabled(false);
      }
    } else {
      this._togglePauseAction.setEnabled(false);
      this._stepOverAction.setEnabled(false);
      this._stepIntoAction.setEnabled(false);
      this._stepOutAction.setEnabled(false);
      this._stepAction.setEnabled(false);
    }

    const i = t ? t.debuggerPausedDetails() : null;

    await this._debuggerPausedMessage.render(
      i,
      Bindings.DebuggerWorkspaceBinding.DebuggerWorkspaceBinding.instance(),
      Bindings.BreakpointManager.BreakpointManager.instance()
    );

    if (i) {
      this._updateDebuggerButtonsAndStatusForTest();
    }
  }
  _updateDebuggerButtonsAndStatusForTest() {}
  _clearInterface() {
    this._updateDebuggerButtonsAndStatus();

    UI.Context.Context.instance().setFlavor(
      SDK.DebuggerModel.DebuggerPausedDetails,
      null
    );

    if (this._switchToPausedTargetTimeout) {
      clearTimeout(this._switchToPausedTargetTimeout);
    }

    this._liveLocationPool.disposeAll();
  }
  _switchToPausedTarget(e) {
    delete this._switchToPausedTargetTimeout;

    if (!this._paused && !e.isPaused()) {
      for (const e of SDK.SDKModel.TargetManager.instance().models(
        SDK.DebuggerModel.DebuggerModel
      )) {
        if (e.isPaused()) {
          UI.Context.Context.instance().setFlavor(
            SDK.SDKModel.Target,
            e.target()
          );
          break;
        }
      }
    }
  }
  _togglePauseOnExceptions() {
    Common.Settings.Settings.instance()
      .moduleSetting("pauseOnExceptionEnabled")
      .set(!this._pauseOnExceptionButton.toggled());
  }
  _runSnippet() {
    const e = this._sourcesView.currentUISourceCode();

    if (e) {
      Snippets.ScriptSnippetFileSystem.evaluateScriptSnippet(e);
    }
  }
  _editorSelected(e) {
    const e_data = e.data;

    if (
      this.editorView.mainWidget() &&
      Common.Settings.Settings.instance()
        .moduleSetting("autoRevealInNavigator")
        .get()
    ) {
      this._revealInNavigator(e_data, true);
    }
  }
  _togglePause() {
    const e = UI.Context.Context.instance().flavor(SDK.SDKModel.Target);
    if (!e) {
      return true;
    }
    const t = e.model(SDK.DebuggerModel.DebuggerModel);
    return (
      !t ||
      (this._paused ? ((this._paused = false), t.resume()) : t.pause(),
      this._clearInterface(),
      true)
    );
  }
  _prepareToResume() {
    if (!this._paused) {
      return null;
    }
    this._paused = false;
    this._clearInterface();
    const e = UI.Context.Context.instance().flavor(SDK.SDKModel.Target);
    return e ? e.model(SDK.DebuggerModel.DebuggerModel) : null;
  }
  _longResume(e) {
    const t = this._prepareToResume();

    if (t) {
      t.skipAllPausesUntilReloadOrTimeout(500);
      t.resume();
    }
  }
  _terminateExecution(e) {
    const t = this._prepareToResume();

    if (t) {
      t.runtimeModel().terminateExecution();
      t.resume();
    }
  }
  _stepOver() {
    const e = this._prepareToResume();

    if (e) {
      e.stepOver();
    }

    return true;
  }
  _stepInto() {
    const e = this._prepareToResume();

    if (e) {
      e.stepInto();
    }

    return true;
  }
  _stepIntoAsync() {
    const e = this._prepareToResume();

    if (e) {
      e.scheduleStepIntoAsync();
    }

    return true;
  }
  _stepOut() {
    const e = this._prepareToResume();

    if (e) {
      e.stepOut();
    }

    return true;
  }
  async _continueToLocation(e) {
    const t = UI.Context.Context.instance().flavor(
      SDK.RuntimeModel.ExecutionContext
    );
    if (!t) {
      return;
    }
    const i = (
      await Bindings.DebuggerWorkspaceBinding.DebuggerWorkspaceBinding.instance().uiLocationToRawLocations(
        e.uiSourceCode,
        e.lineNumber,
        0
      )
    ).find((e) => e.debuggerModel === t.debuggerModel);

    if (i && this._prepareToResume()) {
      i.continueToLocation();
    }
  }
  _toggleBreakpointsActive() {
    Common.Settings.Settings.instance()
      .moduleSetting("breakpointsActive")
      .set(
        !Common.Settings.Settings.instance()
          .moduleSetting("breakpointsActive")
          .get()
      );
  }
  _breakpointsActiveStateChanged() {
    const e = Common.Settings.Settings.instance()
      .moduleSetting("breakpointsActive")
      .get();
    this._toggleBreakpointsActiveAction.setToggled(!e);
    this._sourcesView.toggleBreakpointsActiveState(e);
  }
  _createDebugToolbar() {
    const e = new UI.Toolbar.Toolbar("scripts-debug-toolbar");

    const t = new UI.Toolbar.ToolbarButton(
      Common.UIString.UIString("Resume with all pauses blocked for 500 ms"),
      "largeicon-play"
    );

    t.addEventListener(
      UI.Toolbar.ToolbarButton.Events.Click,
      this._longResume,
      this
    );
    const i = new UI.Toolbar.ToolbarButton(
      ls`Terminate current JavaScript call`,
      "largeicon-terminate-execution"
    );

    i.addEventListener(
      UI.Toolbar.ToolbarButton.Events.Click,
      this._terminateExecution,
      this
    );

    e.appendToolbarItem(
      UI.Toolbar.Toolbar.createLongPressActionButton(
        this._togglePauseAction,
        [i, t],
        []
      )
    );

    e.appendToolbarItem(
      UI.Toolbar.Toolbar.createActionButton(this._stepOverAction)
    );

    e.appendToolbarItem(
      UI.Toolbar.Toolbar.createActionButton(this._stepIntoAction)
    );

    e.appendToolbarItem(
      UI.Toolbar.Toolbar.createActionButton(this._stepOutAction)
    );

    e.appendToolbarItem(
      UI.Toolbar.Toolbar.createActionButton(this._stepAction)
    );

    e.appendSeparator();

    e.appendToolbarItem(
      UI.Toolbar.Toolbar.createActionButton(this._toggleBreakpointsActiveAction)
    );

    this._pauseOnExceptionButton = new UI.Toolbar.ToolbarToggle(
      "",
      "largeicon-pause-on-exceptions"
    );

    this._pauseOnExceptionButton.addEventListener(
      UI.Toolbar.ToolbarButton.Events.Click,
      this._togglePauseOnExceptions,
      this
    );

    e.appendToolbarItem(this._pauseOnExceptionButton);
    return e;
  }
  _createDebugToolbarDrawer() {
    const e = document.createElement("div");
    e.classList.add("scripts-debug-toolbar-drawer");
    const t = Common.UIString.UIString("Pause on caught exceptions");

    const i = Common.Settings.Settings.instance().moduleSetting(
      "pauseOnCaughtException"
    );

    e.appendChild(UI.SettingsUI.createSettingCheckbox(t, i, true));
    return e;
  }
  appendApplicableItems(e, t, i) {
    this._appendUISourceCodeItems(e, t, i);
    this._appendUISourceCodeFrameItems(e, t, i);
    this.appendUILocationItems(t, i);
    this._appendRemoteObjectItems(t, i);
    this._appendNetworkRequestItems(t, i);
  }
  _appendUISourceCodeItems(e, t, i) {
    if (!(i instanceof Workspace.UISourceCode.UISourceCode)) {
      return;
    }
    const s = i;

    if (
      !s.project().isServiceProject() &&
      !e.target.isSelfOrDescendant(
        this._navigatorTabbedLocation.widget().element
      )
    ) {
      if (
        !e.target.isSelfOrDescendant(
          this._navigatorTabbedLocation.widget().element
        )
      ) {
        t.revealSection().appendItem(
          Common.UIString.UIString("Reveal in sidebar"),
          this._handleContextMenuReveal.bind(this, s)
        );
      }
    }
  }
  _appendUISourceCodeFrameItems(e, t, i) {
    if (i instanceof UISourceCodeFrame) {
      if (
        !i.uiSourceCode().contentType().isFromSourceMap() &&
        !i.textEditor.selection().isEmpty()
      ) {
        if (!i.textEditor.selection().isEmpty()) {
          t.debugSection().appendAction("debugger.evaluate-selection");
        }
      }
    }
  }
  appendUILocationItems(e, t) {
    if (!(t instanceof Workspace.UISourceCode.UILocation)) {
      return;
    }
    const i = t;
    const i_uiSourceCode = i.uiSourceCode;
    if (i_uiSourceCode.contentType().hasScripts()) {
      const t = UI.Context.Context.instance().flavor(SDK.SDKModel.Target);
      const n = t ? t.model(SDK.DebuggerModel.DebuggerModel) : null;

      if (n && n.isPaused()) {
        e.debugSection().appendItem(
          Common.UIString.UIString("Continue to here"),
          this._continueToLocation.bind(this, i)
        );
      }

      this._callstackPane.appendBlackboxURLContextMenuItems(e, i_uiSourceCode);
    }
  }
  _handleContextMenuReveal(e) {
    this.editorView.showBoth();
    this._revealInNavigator(e);
  }
  _appendRemoteObjectItems(e, t) {
    if (!(t instanceof SDK.RemoteObject.RemoteObject)) {
      return;
    }
    const i = t;

    const s = UI.Context.Context.instance().flavor(
      SDK.RuntimeModel.ExecutionContext
    );

    e.debugSection().appendItem(ls`Store as global variable`, () =>
      SDK.ConsoleModel.ConsoleModel.instance().saveToTempVariable(s, i)
    );

    if (i.type === "function") {
      e.debugSection().appendItem(
        ls`Show function definition`,
        this._showFunctionDefinition.bind(this, i)
      );
    }
  }
  _appendNetworkRequestItems(e, t) {
    if (!(t instanceof SDK.NetworkRequest.NetworkRequest)) {
      return;
    }
    const i = t;
    const s = this._workspace.uiSourceCodeForURL(i.url());
    if (!s) {
      return;
    }
    const n = Common.UIString.UIString("Open in Sources panel");
    e.revealSection().appendItem(
      n,
      this.showUILocation.bind(this, s.uiLocation(0, 0))
    );
  }
  _showFunctionDefinition(e) {
    e.debuggerModel()
      .functionDetailsPromise(e)
      .then(this._didGetFunctionDetails.bind(this));
  }
  async _didGetFunctionDetails(e) {
    if (!e || !e.location) {
      return;
    }
    const t =
      await Bindings.DebuggerWorkspaceBinding.DebuggerWorkspaceBinding.instance().rawLocationToUILocation(
        e.location
      );

    if (t) {
      this.showUILocation(t);
    }
  }
  _revealNavigatorSidebar() {
    this._setAsCurrentPanel();
    this.editorView.showBoth(true);
  }
  _revealDebuggerSidebar() {
    this._setAsCurrentPanel();
    this._splitWidget.showBoth(true);
  }
  _updateSidebarPosition() {
    let e;
    const t = Common.Settings.Settings.instance()
      .moduleSetting("sidebarPosition")
      .get();

    e =
      t !== "right" &&
      (t === "bottom" || self.UI.inspectorView.element.offsetWidth < 680);

    if (this.sidebarPaneView && e === !this._splitWidget.isVertical()) {
      return;
    }

    if (this.sidebarPaneView && this.sidebarPaneView.shouldHideOnDetach()) {
      return;
    }

    if (this.sidebarPaneView) {
      this.sidebarPaneView.detach();
    }

    this._splitWidget.setVertical(!e);

    this._splitWidget.element.classList.toggle(
      "sources-split-view-vertical",
      e
    );

    SourcesPanel.updateResizerAndSidebarButtons(this);
    const i = new UI.Widget.VBox();
    i.element.appendChild(this._debugToolbar.element);
    i.element.appendChild(this._debugToolbarDrawer);
    i.setMinimumAndPreferredSizes(minToolbarWidth, 25, minToolbarWidth, 100);

    this._sidebarPaneStack =
      UI.ViewManager.ViewManager.instance().createStackLocation(
        this._revealDebuggerSidebar.bind(this)
      );

    this._sidebarPaneStack.widget().element.classList.add("overflow-auto");
    this._sidebarPaneStack.widget().show(i.element);

    this._sidebarPaneStack
      .widget()
      .element.appendChild(this._debuggerPausedMessage.element());

    this._sidebarPaneStack.appendApplicableItems("sources.sidebar-top");

    if (this._threadsSidebarPane) {
      this._sidebarPaneStack.showView(this._threadsSidebarPane);
    }

    if (!e) {
      this._sidebarPaneStack.appendView(this._watchSidebarPane);
    }

    this._sidebarPaneStack.showView(this._callstackPane);

    const s = UI.ViewManager.ViewManager.instance().view(
      "sources.jsBreakpoints"
    );

    const n = UI.ViewManager.ViewManager.instance().view("sources.scopeChain");

    if (this._tabbedLocationHeader) {
      this._splitWidget.uninstallResizer(this._tabbedLocationHeader);
      this._tabbedLocationHeader = null;
    }

    if (e) {
      const e = new UI.SplitWidget.SplitWidget(
        true,
        true,
        "sourcesPanelDebuggerSidebarSplitViewState",
        0.5
      );
      e.setMainWidget(i);
      this._sidebarPaneStack.showView(s);
      const t = UI.ViewManager.ViewManager.instance().createTabbedLocation(
        this._revealDebuggerSidebar.bind(this)
      );
      e.setSidebarWidget(t.tabbedPane());
      this._tabbedLocationHeader = t.tabbedPane().headerElement();
      this._splitWidget.installResizer(this._tabbedLocationHeader);

      this._splitWidget.installResizer(
        this._debugToolbar.gripElementForResize()
      );

      t.appendView(n);
      t.appendView(this._watchSidebarPane);
      t.appendApplicableItems("sources.sidebar-tabs");
      this._extensionSidebarPanesContainer = t;
      this.sidebarPaneView = e;
    } else {
      this._sidebarPaneStack.showView(n);
      this._sidebarPaneStack.showView(s);
      this._extensionSidebarPanesContainer = this._sidebarPaneStack;
      this.sidebarPaneView = i;

      this._splitWidget.uninstallResizer(
        this._debugToolbar.gripElementForResize()
      );
    }

    this._sidebarPaneStack.appendApplicableItems("sources.sidebar-bottom");
    const o = self.Extensions.extensionServer.sidebarPanes();
    for (let e = 0; e < o.length; ++e) {
      this._addExtensionSidebarPane(o[e]);
    }
    this._splitWidget.setSidebarWidget(this.sidebarPaneView);
  }
  _setAsCurrentPanel() {
    return UI.ViewManager.ViewManager.instance().showView("sources");
  }
  _extensionSidebarPaneAdded(e) {
    const e_data = e.data;
    this._addExtensionSidebarPane(e_data);
  }
  _addExtensionSidebarPane(e) {
    if (e.panelName() === this.name) {
      this._extensionSidebarPanesContainer.appendView(e);
    }
  }
  sourcesView() {
    return this._sourcesView;
  }
  _handleDrop(e) {
    const e_items = e.items;
    if (!e_items.length) {
      return;
    }
    const i = e_items[0].webkitGetAsEntry();

    if (i.isDirectory) {
      Host.InspectorFrontendHost.InspectorFrontendHostInstance.upgradeDraggedFileSystemPermissions(
        i.filesystem
      );
    }
  }
}
export let lastModificationTimeout = 200;
export const minToolbarWidth = 215;
export class UILocationRevealer {
  reveal(e, t) {
    return e instanceof Workspace.UISourceCode.UILocation
      ? (SourcesPanel.instance().showUILocation(e, t), Promise.resolve())
      : Promise.reject(new Error("Internal error: not a ui location"));
  }
}
export class DebuggerLocationRevealer {
  async reveal(e, t) {
    if (!(e instanceof SDK.DebuggerModel.Location)) {
      throw new Error("Internal error: not a debugger location");
    }
    const i =
      await Bindings.DebuggerWorkspaceBinding.DebuggerWorkspaceBinding.instance().rawLocationToUILocation(
        e
      );

    if (i) {
      SourcesPanel.instance().showUILocation(i, t);
    }
  }
}
export class UISourceCodeRevealer {
  reveal(e, t) {
    return e instanceof Workspace.UISourceCode.UISourceCode
      ? (SourcesPanel.instance().showUISourceCode(e, undefined, undefined, t),
        Promise.resolve())
      : Promise.reject(new Error("Internal error: not a ui source code"));
  }
}
export class DebuggerPausedDetailsRevealer {
  reveal(e) {
    return SourcesPanel.instance()._setAsCurrentPanel();
  }
}
export class RevealingActionDelegate {
  handleAction(e, t) {
    const i = SourcesPanel.instance();
    if (!i._ensureSourcesViewVisible()) {
      return false;
    }
    switch (t) {
      case "debugger.toggle-pause": {
        i._togglePause();
        return true;
      }
    }
    return false;
  }
}
export class DebuggingActionDelegate {
  handleAction(e, t) {
    const i = SourcesPanel.instance();
    switch (t) {
      case "debugger.step-over": {
        i._stepOver();
        return true;
      }
      case "debugger.step-into": {
        i._stepIntoAsync();
        return true;
      }
      case "debugger.step": {
        i._stepInto();
        return true;
      }
      case "debugger.step-out": {
        i._stepOut();
        return true;
      }
      case "debugger.run-snippet": {
        i._runSnippet();
        return true;
      }
      case "debugger.toggle-breakpoints-active": {
        i._toggleBreakpointsActive();
        return true;
      }
      case "debugger.evaluate-selection": {
        const e = UI.Context.Context.instance().flavor(UISourceCodeFrame);
        if (e) {
          let t = e.textEditor.text(e.textEditor.selection());
          const i = UI.Context.Context.instance().flavor(
            SDK.RuntimeModel.ExecutionContext
          );
          if (i) {
            const e =
              SDK.ConsoleModel.ConsoleModel.instance().addCommandMessage(i, t);
            t = ObjectUI.JavaScriptREPL.JavaScriptREPL.wrapObjectLiteral(t);

            SDK.ConsoleModel.ConsoleModel.instance().evaluateCommandInConsole(
              i,
              e,
              t,
              true
            );
          }
        }
        return true;
      }
    }
    return false;
  }
}
export class WrapperView extends UI.Widget.VBox {
  constructor() {
    super();
    this.element.classList.add("sources-view-wrapper");
    WrapperView._instance = this;
    this._view = SourcesPanel.instance()._sourcesView;
  }
  static isShowing() {
    return !!WrapperView._instance && WrapperView._instance.isShowing();
  }
  wasShown() {
    if (SourcesPanel.instance().isShowing()) {
      self.UI.inspectorView.setDrawerMinimized(true);
    } else {
      this._showViewInWrapper();
    }

    SourcesPanel.updateResizerAndSidebarButtons(SourcesPanel.instance());
  }
  willHide() {
    self.UI.inspectorView.setDrawerMinimized(false);

    setImmediate(() =>
      SourcesPanel.updateResizerAndSidebarButtons(SourcesPanel.instance())
    );
  }
  _showViewInWrapper() {
    this._view.show(this.element);
  }
}

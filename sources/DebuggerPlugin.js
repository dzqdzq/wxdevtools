import * as Bindings from "../bindings/bindings.js";
import * as Common from "../common/common.js";
import * as Host from "../host/host.js";
import * as ObjectUI from "../object_ui/object_ui.js";
import * as SDK from "../sdk/sdk.js";
import * as SourceFrame from "../source_frame/source_frame.js";
import * as TextEditor from "../text_editor/text_editor.js";
import * as TextUtils from "../text_utils/text_utils.js";
import * as UI from "../ui/ui.js";
import * as Workspace from "../workspace/workspace.js";
import { AddSourceMapURLDialog } from "./AddSourceMapURLDialog.js";
import {
  BreakpointEditDialog,
  LogpointPrefix,
} from "./BreakpointEditDialog.js";
import { Plugin } from "./Plugin.js";
import {
  resolveExpression,
  resolveScopeInObject,
} from "./SourceMapNamesResolver.js";
import { SourcesPanel } from "./SourcesPanel.js";
export class DebuggerPlugin extends Plugin {
  constructor(e, t, i) {
    super();
    this._textEditor = e;
    this._uiSourceCode = t;
    this._transformer = i;
    this._executionLocation = null;
    this._controlDown = false;
    this._asyncStepInHoveredLine = 0;
    this._asyncStepInHovered = false;
    this._clearValueWidgetsTimer = null;
    this._sourceMapInfobar = null;
    this._controlTimeout = null;
    this._scriptsPanel = SourcesPanel.instance();
    this._breakpointManager =
      Bindings.BreakpointManager.BreakpointManager.instance();

    if (t.project().type() === Workspace.Workspace.projectTypes.Debugger) {
      this._textEditor.element.classList.add("source-frame-debugger-script");
    }

    this._popoverHelper = new UI.PopoverHelper.PopoverHelper(
      this._scriptsPanel.element,
      this._getPopoverRequest.bind(this)
    );

    this._popoverHelper.setDisableOnClick(true);
    this._popoverHelper.setTimeout(250, 250);
    this._popoverHelper.setHasPadding(true);

    this._boundPopoverHelperHide = this._popoverHelper.hidePopover.bind(
      this._popoverHelper
    );

    this._scriptsPanel.element.addEventListener(
      "scroll",
      this._boundPopoverHelperHide,
      true
    );

    const o = {
      "debugger.toggle-breakpoint": async () => {
        const e = this._textEditor.selection();
        return !!e && (await this._toggleBreakpoint(e.startLine, false), true);
      },
      "debugger.toggle-breakpoint-enabled": async () => {
        const e = this._textEditor.selection();
        return !!e && (await this._toggleBreakpoint(e.startLine, true), true);
      },
      "debugger.breakpoint-input-window": async () => {
        const e = this._textEditor.selection();
        if (!e) {
          return false;
        }
        const t = this._lineBreakpointDecorations(e.startLine)
          .map((e) => e.breakpoint)
          .filter((e) => !!e);
        let i;

        if (t.length) {
          i = t[0];
        }

        const o = !!i && i.condition().includes(LogpointPrefix);
        this._editBreakpointCondition(e.startLine, i, null, o);
        return true;
      },
    };
    self.UI.shortcutRegistry.addShortcutListener(this._textEditor.element, o);
    this._boundKeyDown = this._onKeyDown.bind(this);

    this._textEditor.element.addEventListener(
      "keydown",
      this._boundKeyDown,
      true
    );

    this._boundKeyUp = this._onKeyUp.bind(this);
    this._textEditor.element.addEventListener("keyup", this._boundKeyUp, true);
    this._boundMouseMove = this._onMouseMove.bind(this);

    this._textEditor.element.addEventListener(
      "mousemove",
      this._boundMouseMove,
      false
    );

    this._boundMouseDown = this._onMouseDown.bind(this);

    this._textEditor.element.addEventListener(
      "mousedown",
      this._boundMouseDown,
      true
    );

    this._boundBlur = this._onBlur.bind(this);

    this._textEditor.element.addEventListener(
      "focusout",
      this._boundBlur,
      false
    );

    this._boundWheel = (e) => {
      if (
        this._executionLocation &&
        UI.KeyboardShortcut.KeyboardShortcut.eventHasCtrlOrMeta(e)
      ) {
        e.preventDefault();
      }
    };

    this._textEditor.element.addEventListener("wheel", this._boundWheel, true);

    this._textEditor.addEventListener(
      SourceFrame.SourcesTextEditor.Events.GutterClick,
      (e) => {
        this._handleGutterClick(e);
      },
      this
    );

    this._breakpointManager.addEventListener(
      Bindings.BreakpointManager.Events.BreakpointAdded,
      this._breakpointAdded,
      this
    );

    this._breakpointManager.addEventListener(
      Bindings.BreakpointManager.Events.BreakpointRemoved,
      this._breakpointRemoved,
      this
    );

    this._uiSourceCode.addEventListener(
      Workspace.UISourceCode.Events.WorkingCopyChanged,
      this._workingCopyChanged,
      this
    );

    this._uiSourceCode.addEventListener(
      Workspace.UISourceCode.Events.WorkingCopyCommitted,
      this._workingCopyCommitted,
      this
    );

    this._breakpointDecorations = new Set();
    this._decorationByBreakpoint = new Map();
    this._possibleBreakpointsRequested = new Set();
    this._scriptFileForDebuggerModel = new Map();

    Common.Settings.Settings.instance()
      .moduleSetting("skipStackFramesPattern")
      .addChangeListener(this._showBlackboxInfobarIfNeeded, this);

    Common.Settings.Settings.instance()
      .moduleSetting("skipContentScripts")
      .addChangeListener(this._showBlackboxInfobarIfNeeded, this);

    this._valueWidgets = new Map();
    this._continueToLocationDecorations = null;

    UI.Context.Context.instance().addFlavorChangeListener(
      SDK.DebuggerModel.CallFrame,
      this._callFrameChanged,
      this
    );

    this._liveLocationPool = new Bindings.LiveLocation.LiveLocationPool();
    this._callFrameChanged();
    this._updateScriptFiles();

    if (this._uiSourceCode.isDirty()) {
      this._muted = true;
      this._mutedFromStart = true;
    } else {
      this._muted = false;
      this._mutedFromStart = false;
      this._initializeBreakpoints();
    }

    this._blackboxInfobar = null;
    this._showBlackboxInfobarIfNeeded();
    for (const e of this._scriptFileForDebuggerModel.values()) {
      e.checkMapping();
    }
    this._hasLineWithoutMapping = false;
    this._updateLinesWithoutMappingHighlight();

    if (!Root.Runtime.experiments.isEnabled("sourcesPrettyPrint")) {
      this._prettyPrintInfobar = null;
      this._detectMinified();
    }
  }
  static accepts(e) {
    return e.contentType().hasScripts();
  }
  _showBlackboxInfobarIfNeeded() {
    const e = this._uiSourceCode;
    if (!e.contentType().hasScripts()) {
      return;
    }
    const t = e.project().type();
    if (
      !Bindings.BlackboxManager.BlackboxManager.instance().isBlackboxedUISourceCode(
        e
      )
    ) {
      return void this._hideBlackboxInfobar();
    }

    if (this._blackboxInfobar) {
      this._blackboxInfobar.dispose();
    }

    const i = new UI.Infobar.Infobar(
      UI.Infobar.Type.Warning,
      Common.UIString.UIString("This script is blackboxed in the debugger"),
      [
        {
          text: ls`Unblackbox`,
          highlight: false,
          delegate() {
            Bindings.BlackboxManager.BlackboxManager.instance().unblackboxUISourceCode(
              e
            );

            if (t === Workspace.Workspace.projectTypes.ContentScripts) {
              Bindings.BlackboxManager.BlackboxManager.instance().unblackboxContentScripts();
            }
          },
          dismiss: true,
        },
        {
          text: ls`Configure`,
          highlight: false,
          delegate: UI.ViewManager.ViewManager.instance().showView.bind(
            UI.ViewManager.ViewManager.instance(),
            "blackbox"
          ),
          dismiss: false,
        },
      ]
    );
    this._blackboxInfobar = i;

    i.createDetailsRowMessage(
      Common.UIString.UIString(
        "The debugger will skip stepping through this script, and will not stop on exceptions."
      )
    );

    const o = this._scriptFileForDebuggerModel.size
      ? this._scriptFileForDebuggerModel.values().next().value
      : null;

    if (o && o.hasSourceMapURL()) {
      i.createDetailsRowMessage(
        Common.UIString.UIString(
          "Source map found, but ignored for blackboxed file."
        )
      );
    }

    this._textEditor.attachInfobar(this._blackboxInfobar);
  }
  _hideBlackboxInfobar() {
    if (this._blackboxInfobar) {
      this._blackboxInfobar.dispose();
      this._blackboxInfobar = null;
    }
  }
  wasShown() {
    if (this._executionLocation) {
      setImmediate(() => {
        this._generateValuesInSource();
      });
    }
  }
  willHide() {
    this._popoverHelper.hidePopover();
  }
  populateLineGutterContextMenu(e, t) {
    return new Promise((i, o) => {
      const n = new Workspace.UISourceCode.UILocation(this._uiSourceCode, t, 0);
      this._scriptsPanel.appendUILocationItems(e, n);
      const r = this._lineBreakpointDecorations(t)
        .map((e) => e.breakpoint)
        .filter((e) => !!e);
      if (r.length) {
        const i = r.length === 1;

        const o = i
          ? Common.UIString.UIString("Remove breakpoint")
          : Common.UIString.UIString("Remove all breakpoints in line");

        e.debugSection().appendItem(o, () => r.map((e) => e.remove()));

        if (i) {
          e.debugSection().appendItem(
            Common.UIString.UIString("Edit breakpoint…"),
            this._editBreakpointCondition.bind(this, t, r[0], null)
          );
        }

        if (r.some((e) => e.enabled())) {
          const t = i
            ? Common.UIString.UIString("Disable breakpoint")
            : Common.UIString.UIString("Disable all breakpoints in line");
          e.debugSection().appendItem(t, () =>
            r.map((e) => e.setEnabled(false))
          );
        }
        if (r.some((e) => !e.enabled())) {
          const t = i
            ? Common.UIString.UIString("Enable breakpoint")
            : Common.UIString.UIString("Enable all breakpoints in line");
          e.debugSection().appendItem(t, () =>
            r.map((e) => e.setEnabled(true))
          );
        }
      } else {
        e.debugSection().appendItem(
          Common.UIString.UIString("Add breakpoint"),
          this._createNewBreakpoint.bind(this, t, "", true)
        );

        e.debugSection().appendItem(
          Common.UIString.UIString("Add conditional breakpoint…"),
          this._editBreakpointCondition.bind(this, t, null, null)
        );

        e.debugSection().appendItem(
          ls`Add logpoint…`,
          this._editBreakpointCondition.bind(this, t, null, null, true)
        );

        e.debugSection().appendItem(
          Common.UIString.UIString("Never pause here"),
          this._createNewBreakpoint.bind(this, t, "false", true)
        );
      }
      i();
    });
  }
  populateTextAreaContextMenu(e, t, i) {
    function o(e) {
      new AddSourceMapURLDialog(n.bind(null, e)).show();
    }
    function n(e, t) {
      if (t) {
        e.addSourceMapURL(t);
      }
    }
    return super.populateTextAreaContextMenu(e, t, i).then(() => {
      if (
        this._uiSourceCode.project().type() ===
          Workspace.Workspace.projectTypes.Network &&
        Common.Settings.Settings.instance()
          .moduleSetting("jsSourceMapsEnabled")
          .get() &&
        !Bindings.BlackboxManager.BlackboxManager.instance().isBlackboxedUISourceCode(
          this._uiSourceCode
        ) &&
        this._scriptFileForDebuggerModel.size
      ) {
        const t = this._scriptFileForDebuggerModel.values().next().value;
        const i = Common.UIString.UIString("Add source map…");
        e.debugSection().appendItem(i, o.bind(null, t));
      }
    });
  }
  _workingCopyChanged() {
    if (!this._scriptFileForDebuggerModel.size) {
      if (this._uiSourceCode.isDirty()) {
        this._muteBreakpointsWhileEditing();
      } else {
        this._restoreBreakpointsAfterEditing();
      }
    }
  }
  _workingCopyCommitted(e) {
    this._scriptsPanel.updateLastModificationTime();

    if (!this._scriptFileForDebuggerModel.size) {
      this._restoreBreakpointsAfterEditing();
    }
  }
  _didMergeToVM() {
    this._restoreBreakpointsIfConsistentScripts();
  }
  _didDivergeFromVM() {
    this._muteBreakpointsWhileEditing();
  }
  _muteBreakpointsWhileEditing() {
    if (!this._muted) {
      for (const e of this._breakpointDecorations) {
        this._updateBreakpointDecoration(e);
      }
      this._muted = true;
    }
  }
  async _restoreBreakpointsIfConsistentScripts() {
    for (const e of this._scriptFileForDebuggerModel.values()) {
      if (e.hasDivergedFromVM() || e.isMergingToVM()) {
        return;
      }
    }
    await this._restoreBreakpointsAfterEditing();
  }
  async _restoreBreakpointsAfterEditing() {
    this._muted = false;

    if (this._mutedFromStart) {
      this._mutedFromStart = false;
      return void this._initializeBreakpoints();
    }

    const e = Array.from(this._breakpointDecorations);
    this._breakpointDecorations.clear();

    this._textEditor.operation(() => e.map((e) => e.hide()));

    for (const t of e) {
      if (!t.breakpoint) {
        continue;
      }
      const e = t.enabled;
      t.breakpoint.remove();
      const i = t.handle.resolve();

      if (i) {
        await this._setBreakpoint(i.lineNumber, i.columnNumber, t.condition, e);
      }
    }
  }
  _isIdentifier(e) {
    return (
      e.startsWith("js-variable") ||
      e.startsWith("js-property") ||
      e.startsWith("js-property") ||
      e === "js-def"
    );
  }
  _getPopoverRequest(e) {
    if (UI.KeyboardShortcut.KeyboardShortcut.eventHasCtrlOrMeta(e)) {
      return null;
    }
    const t = UI.Context.Context.instance().flavor(SDK.SDKModel.Target);
    const i = t ? t.model(SDK.DebuggerModel.DebuggerModel) : null;
    if (!i || !i.isPaused()) {
      return null;
    }
    const o = this._textEditor.coordinatesToCursorPosition(e.x, e.y);
    if (!o) {
      return null;
    }
    const n = o.startLine;
    const r = o.startColumn;
    const s = this._textEditor.selection().normalize();
    let a;
    let c;
    let l;
    let d;
    const u = UI.Context.Context.instance().flavor(SDK.DebuggerModel.CallFrame);
    if (!u) {
      return null;
    }
    if (u.script.isWasm()) {
      return null;
    }
    if (s && !s.isEmpty()) {
      if (
        s.startLine !== s.endLine ||
        s.startLine !== n ||
        s.startLine !== n ||
        r < s.startColumn ||
        s.startLine !== n ||
        r < s.startColumn ||
        r > s.endColumn
      ) {
        return null;
      }

      const e = this._textEditor.cursorPositionToCoordinates(
        s.startLine,
        s.startColumn
      );

      const t = this._textEditor.cursorPositionToCoordinates(
        s.endLine,
        s.endColumn
      );

      a = new AnchorBox(e.x, e.y, t.x - e.x, e.height);
      c = s.startLine;
      l = s.startColumn;
      d = s.endColumn - 1;
    } else {
      const e = this._textEditor.tokenAtTextPosition(
        o.startLine,
        o.startColumn
      );
      if (!e || !e.type) {
        return null;
      }
      c = o.startLine;
      const t = this._textEditor.line(c);
      const i = t.substring(e.startColumn, e.endColumn);
      if (
        !this._isIdentifier(e.type) &&
        (e.type !== "js-keyword" || i !== "this")
      ) {
        return null;
      }
      const n = this._textEditor.cursorPositionToCoordinates(c, e.startColumn);
      const r = this._textEditor.cursorPositionToCoordinates(
        c,
        e.endColumn - 1
      );
      a = new AnchorBox(n.x, n.y, r.x - n.x, n.height);
      l = e.startColumn;

      for (d = e.endColumn - 1; l > 1 && t.charAt(l - 1) === "."; ) {
        const e = this._textEditor.tokenAtTextPosition(c, l - 2);
        if (!e || !e.type) {
          return null;
        }
        if (e.type === "js-meta") {
          break;
        }
        if (e.type === "js-string-2") {
          if (e.endColumn < 2) {
            return null;
          }
          l = t.lastIndexOf("`", e.endColumn - 2);

          if (l < 0) {
            return null;
          }

          break;
        }
        l = e.startColumn;
      }
    }
    let h;
    let p;
    return {
      box: a,
      show: async (e) => {
        const t = this._textEditor.line(c).substring(l, d + 1);
        const o = await resolveExpression(u, t, this._uiSourceCode, c, l, d);

        const n = await u.evaluate({
          expression: o || t,
          objectGroup: "popover",
          includeCommandLineAPI: false,
          silent: true,
          returnByValue: false,
          generatePreview: false,
        });

        if (
          !n.object ||
          (n.object.type === "object" && n.object.subtype === "error")
        ) {
          return false;
        }
        h =
          await ObjectUI.ObjectPopoverHelper.ObjectPopoverHelper.buildObjectPopover(
            n.object,
            e
          );
        const r = UI.Context.Context.instance().flavor(
          SDK.DebuggerModel.CallFrame
        );
        if (!h || u !== r) {
          i.runtimeModel().releaseObjectGroup("popover");

          if (h) {
            h.dispose();
          }

          return false;
        }
        const s = new TextUtils.TextRange.TextRange(c, l, c, d);

        p = this._textEditor.highlightRange(s, "source-frame-eval-expression");

        return true;
      },
      hide: () => {
        h.dispose();
        i.runtimeModel().releaseObjectGroup("popover");
        this._textEditor.removeHighlight(p);
      },
    };
  }
  async _onKeyDown(e) {
    this._clearControlDown();

    if (e.key !== "Escape") {
      if (
        UI.KeyboardShortcut.KeyboardShortcut.eventHasCtrlOrMeta(e) &&
        this._executionLocation
      ) {
        this._controlDown = true;

        e.key === (Host.Platform.isMac() ? "Meta" : "Control") &&
          (this._controlTimeout = setTimeout(() => {
            if (this._executionLocation && this._controlDown) {
              this._showContinueToLocations();
            }
          }, 150));
      }
    } else if (this._popoverHelper.isPopoverVisible()) {
      this._popoverHelper.hidePopover();
      e.consume();
    }
  }
  _onMouseMove(e) {
    if (
      this._executionLocation &&
      this._controlDown &&
      UI.KeyboardShortcut.KeyboardShortcut.eventHasCtrlOrMeta(e)
    ) {
      if (!this._continueToLocationDecorations) {
        this._showContinueToLocations();
      }
    }

    if (this._continueToLocationDecorations) {
      const t = this._textEditor.coordinatesToCursorPosition(e.x, e.y);

      const i = !!e.target.enclosingNodeOrSelfWithClass(
        "source-frame-async-step-in"
      );

      this._setAsyncStepInHoveredLine(t ? t.startLine : null, i);
    }
  }
  _setAsyncStepInHoveredLine(e, t) {
    if (this._asyncStepInHoveredLine !== e || this._asyncStepInHovered !== t) {
      this._asyncStepInHovered &&
        this._asyncStepInHoveredLine &&
        this._textEditor.toggleLineClass(
          this._asyncStepInHoveredLine,
          "source-frame-async-step-in-hovered",
          false
        );

      this._asyncStepInHoveredLine = e;
      this._asyncStepInHovered = t;

      this._asyncStepInHovered &&
        this._asyncStepInHoveredLine &&
        this._textEditor.toggleLineClass(
          this._asyncStepInHoveredLine,
          "source-frame-async-step-in-hovered",
          true
        );
    }
  }
  _onMouseDown(e) {
    if (
      !this._executionLocation ||
      !UI.KeyboardShortcut.KeyboardShortcut.eventHasCtrlOrMeta(e)
    ) {
      return;
    }
    if (!this._continueToLocationDecorations) {
      return;
    }
    e.consume();
    const t = this._textEditor.coordinatesToCursorPosition(e.x, e.y);
    if (t) {
      for (const e of this._continueToLocationDecorations.keys()) {
        const i = e.find();
        if (
          i.from.line === t.startLine &&
          i.to.line === t.startLine &&
          i.from.ch <= t.startColumn &&
          t.startColumn <= i.to.ch
        ) {
          this._continueToLocationDecorations.get(e)();
          break;
        }
      }
    }
  }
  _onBlur(e) {
    if (!this._textEditor.element.isAncestor(e.target)) {
      this._clearControlDown();
    }
  }
  _onKeyUp(e) {
    this._clearControlDown();
  }
  _clearControlDown() {
    this._controlDown = false;
    this._clearContinueToLocations();
    clearTimeout(this._controlTimeout);
  }
  async _editBreakpointCondition(e, t, i, o) {
    const n = t ? t.condition() : "";
    const r = createElement("div");

    const s = new BreakpointEditDialog(e, n, !!o, async (o) => {
      s.detach();
      this._textEditor.removeDecoration(r, e);

      if (o.committed) {
        if (t) {
          t.setCondition(o.condition);
        } else if (i) {
          await this._setBreakpoint(
            i.lineNumber,
            i.columnNumber,
            o.condition,
            true
          );
        } else {
          await this._createNewBreakpoint(e, o.condition, true);
        }
      }
    });

    this._textEditor.addDecoration(r, e);
    s.markAsExternallyManaged();
    s.show(r);
  }
  async _executionLineChanged(e) {
    this._clearExecutionLine();
    const t = await e.uiLocation();
    if (!t || t.uiSourceCode.url() !== this._uiSourceCode.url()) {
      return void (this._executionLocation = null);
    }
    this._executionLocation = t;
    const i = this._transformer.uiLocationToEditorLocation(
      t.lineNumber,
      t.columnNumber
    );
    this._textEditor.setExecutionLocation(i.lineNumber, i.columnNumber);

    if (this._textEditor.isShowing()) {
      setImmediate(() => {
        if (this._controlDown) {
          this._showContinueToLocations();
        } else {
          this._generateValuesInSource();
        }
      });
    }
  }
  _generateValuesInSource() {
    if (
      !Common.Settings.Settings.instance()
        .moduleSetting("inlineVariableValues")
        .get()
    ) {
      return;
    }
    if (
      !UI.Context.Context.instance().flavor(SDK.RuntimeModel.ExecutionContext)
    ) {
      return;
    }
    const e = UI.Context.Context.instance().flavor(SDK.DebuggerModel.CallFrame);
    if (!e) {
      return;
    }
    const t = e.localScope();
    const i = e.functionLocation();

    if (t && i) {
      resolveScopeInObject(t)
        .getAllProperties(false, false)
        .then(this._prepareScopeVariables.bind(this, e));
    }
  }
  _showContinueToLocations() {
    this._popoverHelper.hidePopover();
    if (
      !UI.Context.Context.instance().flavor(SDK.RuntimeModel.ExecutionContext)
    ) {
      return;
    }
    const e = UI.Context.Context.instance().flavor(SDK.DebuggerModel.CallFrame);
    if (!e) {
      return;
    }
    const t = e.functionLocation() || e.location();
    function i(e) {
      this._clearContinueToLocationsNoRestore();
      this._textEditor.hideExecutionLineBackground();
      this._clearValueWidgets();
      this._continueToLocationDecorations = new Map();
      e = e.reverse();
      let t = -1;
      for (const i of e) {
        const e = this._transformer.uiLocationToEditorLocation(
          i.lineNumber,
          i.columnNumber
        );
        let o = this._textEditor.tokenAtTextPosition(
          e.lineNumber,
          e.columnNumber
        );
        if (!o) {
          continue;
        }
        const n = this._textEditor.line(e.lineNumber);
        let r = n.substring(o.startColumn, o.endColumn);

        if (!o.type && r === ".") {
          if (r === ".") {
            o = this._textEditor.tokenAtTextPosition(
              e.lineNumber,
              o.endColumn + 1
            );

            r = n.substring(o.startColumn, o.endColumn);
          }
        }

        if (!o.type) {
          continue;
        }

        if (
          !(
            o.type === "js-keyword" &&
            (r === "this" ||
              r === "return" ||
              r === "return" ||
              r === "new" ||
              r === "return" ||
              r === "new" ||
              r === "continue" ||
              r === "return" ||
              r === "new" ||
              r === "continue" ||
              r === "break")
          ) &&
          !this._isIdentifier(o.type)
        ) {
          continue;
        }
        if (
          t === e.lineNumber &&
          i.type !== Protocol.Debugger.BreakLocationType.Call
        ) {
          continue;
        }

        let s = new TextUtils.TextRange.TextRange(
          e.lineNumber,
          o.startColumn,
          e.lineNumber,
          o.endColumn - 1
        );

        let a = this._textEditor.highlightRange(
          s,
          "source-frame-continue-to-location"
        );

        this._continueToLocationDecorations.set(
          a,
          i.continueToLocation.bind(i)
        );

        if (i.type === Protocol.Debugger.BreakLocationType.Call) {
          t = e.lineNumber;
        }

        let c =
          (n[o.startColumn - 1] === "." && r === "then") ||
          r === "setTimeout" ||
          r === "setInterval" ||
          r === "postMessage";

        if (r === "new") {
          o = this._textEditor.tokenAtTextPosition(
            e.lineNumber,
            o.endColumn + 1
          );

          r = n.substring(o.startColumn, o.endColumn);
          c = r === "Worker";
        }

        const l =
          this._executionLocation &&
          i.lineNumber === this._executionLocation.lineNumber &&
          i.columnNumber === this._executionLocation.columnNumber;
        if (i.type === Protocol.Debugger.BreakLocationType.Call && c) {
          const t = this._findAsyncStepInRange(
            this._textEditor,
            e.lineNumber,
            n,
            o.endColumn
          );

          if (t) {
            s = new TextUtils.TextRange.TextRange(
              e.lineNumber,
              t.from,
              e.lineNumber,
              t.to - 1
            );

            a = this._textEditor.highlightRange(
              s,
              "source-frame-async-step-in"
            );

            this._continueToLocationDecorations.set(
              a,
              this._asyncStepIn.bind(this, i, !!l)
            );
          }
        }
      }
      this._continueToLocationRenderedForTest();
    }
    e.debuggerModel
      .getPossibleBreakpoints(t, null, true)
      .then((e) => this._textEditor.operation(i.bind(this, e)));
  }
  _continueToLocationRenderedForTest() {}
  _findAsyncStepInRange(e, t, i, o) {
    let n;
    let r;
    let s = o;
    let a = i.length;
    let c = i.indexOf("(", o);
    const l = c;
    if (-1 === c) {
      return null;
    }
    c++;
    h();

    if (c >= i.length) {
      return null;
    }

    u();

    if (!n) {
      return null;
    }

    s = n.startColumn;

    if (n.type === "js-keyword" && r === "async") {
      h();

      if (c >= i.length) {
        return { from: s, to: a };
      }

      u();

      if (!n) {
        return { from: s, to: a };
      }
    }

    if (n.type === "js-keyword" && r === "function") {
      return { from: s, to: a };
    }
    if (n.type === "js-string") {
      return { from: l, to: a };
    }
    if (n.type && this._isIdentifier(n.type)) {
      return { from: s, to: a };
    }
    if (r !== "(") {
      return null;
    }
    const d = i.indexOf(")", c);
    return -1 === d || i.substring(c, d).includes("(")
      ? { from: s, to: a }
      : { from: s, to: d + 1 };
    function u() {
      n = e.tokenAtTextPosition(t, c);

      if (n) {
        c = n.endColumn;
        a = n.endColumn;
        r = i.substring(n.startColumn, n.endColumn);
      }
    }
    function h() {
      while (c < i.length) {
        if (i[c] === " ") {
          c++;
          continue;
        }
        const o = e.tokenAtTextPosition(t, c);
        if (o.type !== "js-comment") {
          break;
        }
        c = o.endColumn;
      }
    }
  }
  _asyncStepIn(e, t) {
    function i() {
      e.debuggerModel.scheduleStepIntoAsync();
    }

    if (t) {
      i();
    } else {
      e.continueToLocation(i);
    }
  }
  async _prepareScopeVariables(e, t) {
    const i = t.properties;
    this._clearValueWidgets();

    if (
      !i ||
      !i.length ||
      !i.length ||
      i.length > 500 ||
      !i.length ||
      i.length > 500 ||
      !this._textEditor.isShowing()
    ) {
      return;
    }

    const o =
      Bindings.DebuggerWorkspaceBinding.DebuggerWorkspaceBinding.instance().rawLocationToUILocation(
        e.functionLocation()
      );

    const n =
      Bindings.DebuggerWorkspaceBinding.DebuggerWorkspaceBinding.instance().rawLocationToUILocation(
        e.location()
      );

    const [r, s] = await Promise.all([o, n]);
    if (
      !r ||
      !s ||
      !s ||
      r.uiSourceCode.url() !== this._uiSourceCode.url() ||
      !s ||
      r.uiSourceCode.url() !== this._uiSourceCode.url() ||
      s.uiSourceCode.url() !== this._uiSourceCode.url()
    ) {
      return;
    }

    const a = this._transformer.uiLocationToEditorLocation(
      r.lineNumber,
      r.columnNumber
    );

    const c = this._transformer.uiLocationToEditorLocation(
      s.lineNumber,
      s.columnNumber
    );

    const l = a.lineNumber;
    const d = a.columnNumber;
    const u = c.lineNumber;
    if (
      l >= u ||
      u - l > 500 ||
      u - l > 500 ||
      l < 0 ||
      u - l > 500 ||
      l < 0 ||
      u >= this._textEditor.linesCount
    ) {
      return;
    }
    const h = new Map();
    for (const e of i) {
      h.set(e.name, e.value);
    }
    const p = new Map();
    let m = false;
    const g = new TextEditor.CodeMirrorUtils.TokenizerFactory().createTokenizer(
      "text/javascript"
    );
    g(this._textEditor.line(l).substring(d), b.bind(this, l));
    for (let e = l + 1; e < u; ++e) {
      g(this._textEditor.line(e), b.bind(this, e));
    }
    function b(e, t, i, o, n) {
      if (!m && i && this._isIdentifier(i) && h.get(t)) {
        let i = p.get(e);

        if (!i) {
          i = new Set();
          p.set(e, i);
        }

        i.add(t);
      }
      m = t === ".";
    }
    this._textEditor.operation(this._renderDecorations.bind(this, h, p, l, u));
  }
  _renderDecorations(e, t, i, o) {
    const n =
      new ObjectUI.RemoteObjectPreviewFormatter.RemoteObjectPreviewFormatter();
    for (let r = i; r < o; ++r) {
      const i = t.get(r);
      const o = this._valueWidgets.get(r);
      if (!i) {
        if (o) {
          this._valueWidgets.delete(r);
          this._textEditor.removeDecoration(o, r);
        }

        continue;
      }
      const s = document.createElement("div");
      s.classList.add("text-editor-value-decoration");
      const a = this._textEditor.cursorPositionToCoordinates(r, 0);
      const c = 4;

      const l =
        this._textEditor.cursorPositionToCoordinates(
          r,
          this._textEditor.line(r).length
        ).x -
        a.x +
        c;

      s.style.left = `${l}px`;
      s.__nameToToken = new Map();
      let d = 0;
      for (const o of i) {
        if (d > 10) {
          break;
        }
        if (t.get(r - 1) && t.get(r - 1).has(o)) {
          continue;
        }

        if (d) {
          s.createTextChild(", ");
        }

        const i = s.createChild("span");
        s.__nameToToken.set(o, i);
        i.createTextChild(`${o} = `);
        const a = e.get(o);
        const c = a.preview ? a.preview.properties.length : 0;
        const l = a.preview && a.preview.entries ? a.preview.entries.length : 0;
        if (a.preview && c + l < 10) {
          n.appendObjectPreview(i, a.preview, false);
        } else {
          const e =
            ObjectUI.ObjectPropertiesSection.ObjectPropertiesSection.createPropertyValue(
              a,
              false,
              false
            );
          i.appendChild(e.element);
        }
        ++d;
      }
      let u = true;
      if (o) {
        u = false;
        for (const e of s.__nameToToken.keys()) {
          const t = o.__nameToToken.get(e)
            ? o.__nameToToken.get(e).textContent
            : "";

          if (
            (s.__nameToToken.get(e)
              ? s.__nameToToken.get(e).textContent
              : "") !== t
          ) {
            u = true;

            UI.UIUtils.runCSSAnimationOnce(
              s.__nameToToken.get(e),
              "source-frame-value-update-highlight"
            );
          }
        }

        if (u) {
          this._valueWidgets.delete(r);
          this._textEditor.removeDecoration(o, r);
        }
      }

      if (u) {
        this._valueWidgets.set(r, s);
        this._textEditor.addDecoration(s, r);
      }
    }
  }
  _clearExecutionLine() {
    this._textEditor.operation(() => {
      if (this._executionLocation) {
        this._textEditor.clearExecutionLine();
      }

      this._executionLocation = null;

      if (this._clearValueWidgetsTimer) {
        clearTimeout(this._clearValueWidgetsTimer);
        this._clearValueWidgetsTimer = null;
      }

      this._clearValueWidgetsTimer = setTimeout(
        this._clearValueWidgets.bind(this),
        1000 /* 1e3 */
      );

      this._clearContinueToLocationsNoRestore();
    });
  }
  _clearValueWidgets() {
    clearTimeout(this._clearValueWidgetsTimer);
    this._clearValueWidgetsTimer = null;

    this._textEditor.operation(() => {
      for (const e of this._valueWidgets.keys()) {
        this._textEditor.removeDecoration(this._valueWidgets.get(e), e);
      }
      this._valueWidgets.clear();
    });
  }
  _clearContinueToLocationsNoRestore() {
    if (this._continueToLocationDecorations) {
      this._textEditor.operation(() => {
        for (const e of this._continueToLocationDecorations.keys()) {
          this._textEditor.removeHighlight(e);
        }
        this._continueToLocationDecorations = null;
        this._setAsyncStepInHoveredLine(null, false);
      });
    }
  }
  _clearContinueToLocations() {
    if (this._continueToLocationDecorations) {
      this._textEditor.operation(() => {
        this._textEditor.showExecutionLineBackground();
        this._generateValuesInSource();
        this._clearContinueToLocationsNoRestore();
      });
    }
  }
  _lineBreakpointDecorations(e) {
    return Array.from(this._breakpointDecorations).filter(
      (t) => (t.handle.resolve() || {}).lineNumber === e
    );
  }
  _breakpointDecoration(e, t) {
    for (const i of this._breakpointDecorations) {
      const o = i.handle.resolve();
      if (o && o.lineNumber === e && o.columnNumber === t) {
        return i;
      }
    }
    return null;
  }
  _updateBreakpointDecoration(e) {
    function t() {
      if (!this._scheduledBreakpointDecorationUpdates) {
        return;
      }
      const e = new Set();
      for (const t of this._scheduledBreakpointDecorationUpdates) {
        const i = t.handle.resolve();

        if (i) {
          e.add(i.lineNumber);
        }
      }
      this._scheduledBreakpointDecorationUpdates = null;
      let t = false;
      for (const n of e) {
        const e = this._lineBreakpointDecorations(n);
        i.call(this, n, e);

        if (this._possibleBreakpointsRequested.has(n)) {
          t = true;
        } else {
          o.call(this, n, e);
        }
      }

      if (!t) {
        this._breakpointDecorationsUpdatedForTest();
      }
    }
    function i(e, t) {
      this._textEditor.toggleLineClass(e, "cm-breakpoint", false);
      this._textEditor.toggleLineClass(e, "cm-breakpoint-disabled", false);
      this._textEditor.toggleLineClass(e, "cm-breakpoint-unbound", false);
      this._textEditor.toggleLineClass(e, "cm-breakpoint-conditional", false);
      this._textEditor.toggleLineClass(e, "cm-breakpoint-logpoint", false);

      if (t.length) {
        t.sort(BreakpointDecoration.mostSpecificFirst);
        const i = !t[0].enabled || this._muted;
        const o = t[0].condition.includes(LogpointPrefix);
        const n = !t[0].bound;
        const r = !!t[0].condition && !o;
        this._textEditor.toggleLineClass(e, "cm-breakpoint", true);
        this._textEditor.toggleLineClass(e, "cm-breakpoint-disabled", i);
        this._textEditor.toggleLineClass(e, "cm-breakpoint-unbound", n && !i);
        this._textEditor.toggleLineClass(e, "cm-breakpoint-logpoint", o);
        this._textEditor.toggleLineClass(e, "cm-breakpoint-conditional", r);
      }
    }
    function o(e, t) {
      const i = new Set(t.map((e) => e.bookmark).filter((e) => !!e));

      const o = this._textEditor.line(e).length;

      const n = this._textEditor.bookmarks(
        new TextUtils.TextRange.TextRange(e, 0, e, o),
        BreakpointDecoration.bookmarkSymbol
      );

      for (const e of n) {
        if (!i.has(e)) {
          e.clear();
        }
      }
      if (t.length) {
        if (t.length > 1) {
          for (const e of t) {
            e.update();

            if (this._muted) {
              e.hide();
            } else {
              e.show();
            }
          }
        } else {
          t[0].update();
          t[0].hide();
        }
      }
    }

    if (!this._scheduledBreakpointDecorationUpdates) {
      this._scheduledBreakpointDecorationUpdates = new Set();
      setImmediate(() => this._textEditor.operation(t.bind(this)));
    }

    this._scheduledBreakpointDecorationUpdates.add(e);
  }
  _breakpointDecorationsUpdatedForTest() {}
  async _inlineBreakpointClick(e, t) {
    t.consume(true);

    if (e.breakpoint) {
      if (t.shiftKey) {
        e.breakpoint.setEnabled(!e.breakpoint.enabled());
      } else {
        e.breakpoint.remove();
      }
    } else {
      const t = e.handle.resolve();
      if (!t) {
        return;
      }
      const i = this._transformer.editorLocationToUILocation(
        t.lineNumber,
        t.columnNumber
      );
      await this._setBreakpoint(
        i.lineNumber,
        i.columnNumber,
        e.condition,
        true
      );
    }
  }
  _inlineBreakpointContextMenu(e, t) {
    t.consume(true);
    const i = e.handle.resolve();
    if (!i) {
      return;
    }
    if (this._textEditor.hasLineClass(i.lineNumber, "cm-non-breakable-line")) {
      return;
    }

    const o = this._transformer.editorLocationToUILocation(
      i.lineNumber,
      i.columnNumber
    );

    const n = new UI.ContextMenu.ContextMenu(t);

    if (e.breakpoint) {
      n.debugSection().appendItem(
        Common.UIString.UIString("Edit breakpoint…"),
        this._editBreakpointCondition.bind(
          this,
          i.lineNumber,
          e.breakpoint,
          null
        )
      );
    } else {
      n.debugSection().appendItem(
        Common.UIString.UIString("Add conditional breakpoint…"),
        this._editBreakpointCondition.bind(this, i.lineNumber, null, i)
      );

      n.debugSection().appendItem(
        ls`Add logpoint…`,
        this._editBreakpointCondition.bind(this, i.lineNumber, null, i, true)
      );

      n.debugSection().appendItem(
        Common.UIString.UIString("Never pause here"),
        this._setBreakpoint.bind(
          this,
          o.lineNumber,
          o.columnNumber,
          "false",
          true
        )
      );
    }

    n.show();
  }
  _shouldIgnoreExternalBreakpointEvents(e) {
    if (e.data.uiLocation.uiSourceCode !== this._uiSourceCode) {
      return true;
    }
    if (this._muted) {
      return true;
    }
    for (const e of this._scriptFileForDebuggerModel.values()) {
      if (e.isDivergingFromVM() || e.isMergingToVM()) {
        return true;
      }
    }
    return false;
  }
  _breakpointAdded(e) {
    if (this._shouldIgnoreExternalBreakpointEvents(e)) {
      return;
    }
    const t = e.data.uiLocation;
    const i = e.data.breakpoint;
    this._addBreakpoint(t, i);
  }
  _addBreakpoint(e, t) {
    const i = this._transformer.uiLocationToEditorLocation(
      e.lineNumber,
      e.columnNumber
    );

    const o = this._lineBreakpointDecorations(e.lineNumber);
    let n = this._breakpointDecoration(i.lineNumber, i.columnNumber);
    if (n) {
      n.breakpoint = t;
      n.condition = t.condition();
      n.enabled = t.enabled();
    } else {
      const e = this._textEditor.textEditorPositionHandle(
        i.lineNumber,
        i.columnNumber
      );

      n = new BreakpointDecoration(
        this._textEditor,
        e,
        t.condition(),
        t.enabled(),
        t.bound() || !t.hasBoundScript(),
        t
      );

      n.element.addEventListener(
        "click",
        this._inlineBreakpointClick.bind(this, n),
        true
      );

      n.element.addEventListener(
        "contextmenu",
        this._inlineBreakpointContextMenu.bind(this, n),
        true
      );

      this._breakpointDecorations.add(n);
    }
    this._decorationByBreakpoint.set(t, n);
    this._updateBreakpointDecoration(n);

    if (t.enabled() && !o.length) {
      this._possibleBreakpointsRequested.add(i.lineNumber);
      const e = this._transformer.editorLocationToUILocation(i.lineNumber, 0);
      const t = this._transformer.editorLocationToUILocation(
        i.lineNumber + 1,
        0
      );
      this._breakpointManager
        .possibleBreakpoints(
          this._uiSourceCode,
          new TextUtils.TextRange.TextRange(
            e.lineNumber,
            e.columnNumber,
            t.lineNumber,
            t.columnNumber
          )
        )
        .then(
          function (e, t) {
            this._possibleBreakpointsRequested.delete(e);
            const i = this._lineBreakpointDecorations(e);
            for (const e of i) {
              this._updateBreakpointDecoration(e);
            }
            if (!i.some((e) => !!e.breakpoint)) {
              return;
            }
            const o = new Set();
            for (const e of i) {
              const t = e.handle.resolve();

              if (t) {
                o.add(t.columnNumber);
              }
            }
            for (const i of t.slice(0, 100)) {
              const t = this._transformer.uiLocationToEditorLocation(
                i.lineNumber,
                i.columnNumber
              );
              if (t.lineNumber !== e) {
                continue;
              }
              if (o.has(t.columnNumber)) {
                continue;
              }

              const n = this._textEditor.textEditorPositionHandle(
                t.lineNumber,
                t.columnNumber
              );

              const r = new BreakpointDecoration(
                this._textEditor,
                n,
                "",
                false,
                false,
                null
              );

              r.element.addEventListener(
                "click",
                this._inlineBreakpointClick.bind(this, r),
                true
              );

              r.element.addEventListener(
                "contextmenu",
                this._inlineBreakpointContextMenu.bind(this, r),
                true
              );

              this._breakpointDecorations.add(r);
              this._updateBreakpointDecoration(r);
            }
          }.bind(this, i.lineNumber)
        );
    }
  }
  _breakpointRemoved(e) {
    if (this._shouldIgnoreExternalBreakpointEvents(e)) {
      return;
    }
    const t = e.data.uiLocation;
    const i = e.data.breakpoint;
    const o = this._decorationByBreakpoint.get(i);
    if (!o) {
      return;
    }
    this._decorationByBreakpoint.delete(i);
    const n = this._transformer.uiLocationToEditorLocation(
      t.lineNumber,
      t.columnNumber
    );
    o.breakpoint = null;
    o.enabled = false;
    const r = this._lineBreakpointDecorations(n.lineNumber);
    if (r.some((e) => !!e.breakpoint)) {
      this._updateBreakpointDecoration(o);
    } else {
      for (const e of r) {
        this._breakpointDecorations.delete(e);
        this._updateBreakpointDecoration(e);
      }
    }
  }
  _initializeBreakpoints() {
    const e = this._breakpointManager.breakpointLocationsForUISourceCode(
      this._uiSourceCode
    );
    for (const t of e) {
      this._addBreakpoint(t.uiLocation, t.breakpoint);
    }
  }
  _updateLinesWithoutMappingHighlight() {
    if (
      !!Bindings.CompilerScriptMapping.CompilerScriptMapping.uiSourceCodeOrigin(
        this._uiSourceCode
      )
    ) {
      const e = this._textEditor.linesCount;
      for (let t = 0; t < e; ++t) {
        const e =
          Bindings.CompilerScriptMapping.CompilerScriptMapping.uiLineHasMapping(
            this._uiSourceCode,
            t
          );

        if (!e) {
          this._hasLineWithoutMapping = true;
        }

        if (this._hasLineWithoutMapping) {
          this._textEditor.toggleLineClass(t, "cm-non-breakable-line", !e);
        }
      }
    } else {
    }
  }
  _updateScriptFiles() {
    for (const e of SDK.SDKModel.TargetManager.instance().models(
      SDK.DebuggerModel.DebuggerModel
    )) {
      if (
        Bindings.DebuggerWorkspaceBinding.DebuggerWorkspaceBinding.instance().scriptFile(
          this._uiSourceCode,
          e
        )
      ) {
        this._updateScriptFile(e);
      }
    }
  }
  _updateScriptFile(e) {
    const t = this._scriptFileForDebuggerModel.get(e);

    const i =
      Bindings.DebuggerWorkspaceBinding.DebuggerWorkspaceBinding.instance().scriptFile(
        this._uiSourceCode,
        e
      );

    this._scriptFileForDebuggerModel.delete(e);

    if (t) {
      t.removeEventListener(
        Bindings.ResourceScriptMapping.ResourceScriptFile.Events.DidMergeToVM,
        this._didMergeToVM,
        this
      );

      t.removeEventListener(
        Bindings.ResourceScriptMapping.ResourceScriptFile.Events
          .DidDivergeFromVM,
        this._didDivergeFromVM,
        this
      );

      this._muted &&
        !this._uiSourceCode.isDirty() &&
        this._restoreBreakpointsIfConsistentScripts();
    }

    if (i) {
      this._scriptFileForDebuggerModel.set(e, i);

      i.addEventListener(
        Bindings.ResourceScriptMapping.ResourceScriptFile.Events.DidMergeToVM,
        this._didMergeToVM,
        this
      );

      i.addEventListener(
        Bindings.ResourceScriptMapping.ResourceScriptFile.Events
          .DidDivergeFromVM,
        this._didDivergeFromVM,
        this
      );

      i.checkMapping();
      i.hasSourceMapURL() && this._showSourceMapInfobar();
    }
  }
  _showSourceMapInfobar() {
    if (!this._sourceMapInfobar) {
      this._sourceMapInfobar = UI.Infobar.Infobar.create(
        UI.Infobar.Type.Info,
        Common.UIString.UIString("Source Map detected."),
        [],
        Common.Settings.Settings.instance().createSetting(
          "sourceMapInfobarDisabled",
          false
        )
      );

      this._sourceMapInfobar &&
        (this._sourceMapInfobar.createDetailsRowMessage(
          Common.UIString.UIString(
            "Associated files should be added to the file tree. You can debug these resolved source files as regular JavaScript files."
          )
        ),
        this._sourceMapInfobar.createDetailsRowMessage(
          Common.UIString.UIString(
            "Associated files are available via file tree or %s.",
            self.UI.shortcutRegistry.shortcutTitleForAction("quickOpen.show")
          )
        ),
        this._sourceMapInfobar.setCloseCallback(() => {
          this._sourceMapInfobar = null;
        }),
        this._textEditor.attachInfobar(this._sourceMapInfobar));
    }
  }
  async _detectMinified() {
    const e = this._uiSourceCode.content();
    if (!e || !TextUtils.TextUtils.isMinified(e)) {
      return;
    }
    const t = await self.runtime.allInstances(Sources.SourcesView.EditorAction);
    let i = null;
    for (const e of t) {
      if (e instanceof Sources.ScriptFormatterEditorAction) {
        if (!e.isCurrentUISourceCodeFormatable()) {
          return;
        }
        i = e.toggleFormatScriptSource.bind(e);
        break;
      }
    }

    this._prettyPrintInfobar = UI.Infobar.Infobar.create(
      UI.Infobar.Type.Info,
      Common.UIString.UIString("Pretty-print this minified file?"),
      [{ text: ls`Pretty-print`, delegate: i, highlight: true, dismiss: true }],
      Common.Settings.Settings.instance().createSetting(
        "prettyPrintInfobarDisabled",
        false
      )
    );

    if (!this._prettyPrintInfobar) {
      return;
    }

    this._prettyPrintInfobar.setCloseCallback(() => {
      this._prettyPrintInfobar = null;
    });
    const o = new UI.Toolbar.Toolbar("");
    const n = new UI.Toolbar.ToolbarButton("", "largeicon-pretty-print");
    o.appendToolbarItem(n);
    o.element.style.display = "inline-block";
    o.element.style.verticalAlign = "middle";
    o.element.style.marginBottom = "3px";
    o.element.style.pointerEvents = "none";
    o.element.tabIndex = -1;

    this._prettyPrintInfobar
      .createDetailsRowMessage()
      .appendChild(
        UI.UIUtils.formatLocalized(
          "Pretty-printing will format this file in a new tab where you can continue debugging. You can also pretty-print this file by clicking the %s button on the bottom status bar.",
          [o.element]
        )
      );

    this._textEditor.attachInfobar(this._prettyPrintInfobar);
  }
  async _handleGutterClick(e) {
    if (this._muted) {
      return;
    }
    const t = e.data;
    if (t.gutterType !== SourceFrame.SourcesTextEditor.lineNumbersGutterType) {
      return;
    }
    const i = t.lineNumber;
    const o = t.event;

    if (
      o.button === 0 &&
      !o.altKey &&
      !o.altKey &&
      !o.ctrlKey &&
      !o.altKey &&
      !o.ctrlKey &&
      !o.metaKey
    ) {
      if (!o.altKey) {
        if (!o.ctrlKey) {
          if (!o.metaKey) {
            await this._toggleBreakpoint(i, o.shiftKey);
            o.consume(true);
          }
        }
      }
    }
  }
  async _toggleBreakpoint(e, t) {
    const i = this._lineBreakpointDecorations(e);
    if (!i.length) {
      return void (await this._createNewBreakpoint(e, "", true));
    }
    const o = this._textEditor.hasLineClass(e, "cm-breakpoint-disabled");

    const n = i.map((e) => e.breakpoint).filter((e) => !!e);

    for (const e of n) {
      if (t) {
        e.setEnabled(o);
      } else {
        e.remove();
      }
    }
  }
  async _createNewBreakpoint(e, t, i) {
    if (this._textEditor.hasLineClass(e, "cm-non-breakable-line")) {
      return;
    }
    Host.userMetrics.actionTaken(Host.UserMetrics.Action.ScriptsBreakpointSet);
    const o = this._transformer.editorLocationToUILocation(e, 0);
    await this._setBreakpoint(o.lineNumber, o.columnNumber, t, i);
  }
  async _setBreakpoint(e, t, i, o) {
    Common.Settings.Settings.instance()
      .moduleSetting("breakpointsActive")
      .set(true);

    await this._breakpointManager.setBreakpoint(this._uiSourceCode, e, t, i, o);

    this._breakpointWasSetForTest(e, t, i, o);
  }
  _breakpointWasSetForTest(e, t, i, o) {}
  async _callFrameChanged() {
    this._liveLocationPool.disposeAll();
    const e = UI.Context.Context.instance().flavor(SDK.DebuggerModel.CallFrame);

    if (e) {
      await Bindings.DebuggerWorkspaceBinding.DebuggerWorkspaceBinding.instance().createCallFrameLiveLocation(
        e.location(),
        this._executionLineChanged.bind(this),
        this._liveLocationPool
      );
    } else {
      this._clearExecutionLine();
    }
  }
  dispose() {
    for (const e of this._breakpointDecorations) {
      e.dispose();
    }
    this._breakpointDecorations.clear();

    if (this._scheduledBreakpointDecorationUpdates) {
      for (const e of this._scheduledBreakpointDecorationUpdates) {
        e.dispose();
      }
      this._scheduledBreakpointDecorationUpdates.clear();
    }

    this._hideBlackboxInfobar();

    if (this._sourceMapInfobar) {
      this._sourceMapInfobar.dispose();
    }

    if (this._prettyPrintInfobar) {
      this._prettyPrintInfobar.dispose();
    }

    this._scriptsPanel.element.removeEventListener(
      "scroll",
      this._boundPopoverHelperHide,
      true
    );

    for (const e of this._scriptFileForDebuggerModel.values()) {
      e.removeEventListener(
        Bindings.ResourceScriptMapping.ResourceScriptFile.Events.DidMergeToVM,
        this._didMergeToVM,
        this
      );

      e.removeEventListener(
        Bindings.ResourceScriptMapping.ResourceScriptFile.Events
          .DidDivergeFromVM,
        this._didDivergeFromVM,
        this
      );
    }
    this._scriptFileForDebuggerModel.clear();

    this._textEditor.element.removeEventListener(
      "keydown",
      this._boundKeyDown,
      true
    );

    this._textEditor.element.removeEventListener(
      "keyup",
      this._boundKeyUp,
      true
    );

    this._textEditor.element.removeEventListener(
      "mousemove",
      this._boundMouseMove,
      false
    );

    this._textEditor.element.removeEventListener(
      "mousedown",
      this._boundMouseDown,
      true
    );

    this._textEditor.element.removeEventListener(
      "focusout",
      this._boundBlur,
      false
    );

    this._textEditor.element.removeEventListener(
      "wheel",
      this._boundWheel,
      true
    );

    this._textEditor.removeEventListener(
      SourceFrame.SourcesTextEditor.Events.GutterClick,
      (e) => {
        this._handleGutterClick(e);
      },
      this
    );

    this._popoverHelper.hidePopover();
    this._popoverHelper.dispose();

    this._breakpointManager.removeEventListener(
      Bindings.BreakpointManager.Events.BreakpointAdded,
      this._breakpointAdded,
      this
    );

    this._breakpointManager.removeEventListener(
      Bindings.BreakpointManager.Events.BreakpointRemoved,
      this._breakpointRemoved,
      this
    );

    this._uiSourceCode.removeEventListener(
      Workspace.UISourceCode.Events.WorkingCopyChanged,
      this._workingCopyChanged,
      this
    );

    this._uiSourceCode.removeEventListener(
      Workspace.UISourceCode.Events.WorkingCopyCommitted,
      this._workingCopyCommitted,
      this
    );

    Common.Settings.Settings.instance()
      .moduleSetting("skipStackFramesPattern")
      .removeChangeListener(this._showBlackboxInfobarIfNeeded, this);

    Common.Settings.Settings.instance()
      .moduleSetting("skipContentScripts")
      .removeChangeListener(this._showBlackboxInfobarIfNeeded, this);

    super.dispose();
    this._clearExecutionLine();

    UI.Context.Context.instance().removeFlavorChangeListener(
      SDK.DebuggerModel.CallFrame,
      this._callFrameChanged,
      this
    );

    this._liveLocationPool.disposeAll();
  }
}
export class BreakpointDecoration {
  constructor(e, t, i, o, n, r) {
    this._textEditor = e;
    this.handle = t;
    this.condition = i;
    this.enabled = o;
    this.bound = n;
    this.breakpoint = r;
    this.element = document.createElement("span");
    this.element.classList.toggle("cm-inline-breakpoint", true);
    this.bookmark = null;
  }
  static mostSpecificFirst(e, t) {
    return e.enabled !== t.enabled
      ? e.enabled
        ? -1
        : 1
      : e.bound !== t.bound
      ? e.bound
        ? -1
        : 1
      : !!e.condition != !!t.condition
      ? e.condition
        ? -1
        : 1
      : 0;
  }
  update() {
    const e = !!this.condition && this.condition.includes(LogpointPrefix);
    const t = !!this.condition && !e;
    this.element.classList.toggle("cm-inline-logpoint", e);
    this.element.classList.toggle("cm-inline-breakpoint-conditional", t);
    this.element.classList.toggle("cm-inline-disabled", !this.enabled);
  }
  show() {
    if (this.bookmark) {
      return;
    }
    const e = this.handle.resolve();

    if (e) {
      this.bookmark = this._textEditor.addBookmark(
        e.lineNumber,
        e.columnNumber,
        this.element,
        BreakpointDecoration.bookmarkSymbol
      );

      this.bookmark[BreakpointDecoration._elementSymbolForTest] = this.element;
    }
  }
  hide() {
    if (this.bookmark) {
      this.bookmark.clear();
      this.bookmark = null;
    }
  }
  dispose() {
    const e = this.handle.resolve();

    if (e) {
      this._textEditor.toggleLineClass(e.lineNumber, "cm-breakpoint", false);

      this._textEditor.toggleLineClass(
        e.lineNumber,
        "cm-breakpoint-disabled",
        false
      );

      this._textEditor.toggleLineClass(
        e.lineNumber,
        "cm-breakpoint-unbound",
        false
      );

      this._textEditor.toggleLineClass(
        e.lineNumber,
        "cm-breakpoint-conditional",
        false
      );

      this._textEditor.toggleLineClass(
        e.lineNumber,
        "cm-breakpoint-logpoint",
        false
      );
    }

    this.hide();
  }
}
BreakpointDecoration.bookmarkSymbol = Symbol("bookmark");
BreakpointDecoration._elementSymbolForTest = Symbol("element");
export const continueToLocationDecorationSymbol = Symbol("bookmark");

import * as Bindings from "../bindings/bindings.js";
import * as SDK from "../sdk/sdk.js";
import * as Snippets from "../snippets/snippets.js";
import * as SourceFrame from "../source_frame/source_frame.js";
import * as UI from "../ui/ui.js";
import * as Workspace from "../workspace/workspace.js";
import { Plugin } from "./Plugin.js";
export class JavaScriptCompilerPlugin extends Plugin {
  constructor(e, i) {
    super();
    this._textEditor = e;
    this._uiSourceCode = i;
    this._compiling = false;
    this._recompileScheduled = false;
    this._timeout = null;
    this._message = null;
    this._disposed = false;

    this._textEditor.addEventListener(
      UI.TextEditor.Events.TextChanged,
      this._scheduleCompile,
      this
    );

    if (this._uiSourceCode.hasCommits() || this._uiSourceCode.isDirty()) {
      this._scheduleCompile();
    }
  }
  static accepts(e) {
    if (e.extension() === "js") {
      return true;
    }
    if (Snippets.ScriptSnippetFileSystem.isSnippetsUISourceCode(e)) {
      return true;
    }
    for (const i of SDK.SDKModel.TargetManager.instance().models(
      SDK.DebuggerModel.DebuggerModel
    )) {
      if (
        Bindings.DebuggerWorkspaceBinding.DebuggerWorkspaceBinding.instance().scriptFile(
          e,
          i
        )
      ) {
        return true;
      }
    }
    return false;
  }
  _scheduleCompile() {
    if (this._compiling) {
      this._recompileScheduled = true;
    } else {
      this._timeout && clearTimeout(this._timeout);
      this._timeout = setTimeout(this._compile.bind(this), CompileDelay);
    }
  }
  _findRuntimeModel() {
    const e = SDK.SDKModel.TargetManager.instance().models(
      SDK.DebuggerModel.DebuggerModel
    );
    for (let i = 0; i < e.length; ++i) {
      if (
        Bindings.DebuggerWorkspaceBinding.DebuggerWorkspaceBinding.instance().scriptFile(
          this._uiSourceCode,
          e[i]
        )
      ) {
        return e[i].runtimeModel();
      }
    }
    return SDK.SDKModel.TargetManager.instance().mainTarget()
      ? SDK.SDKModel.TargetManager.instance()
          .mainTarget()
          .model(SDK.RuntimeModel.RuntimeModel)
      : null;
  }
  async _compile() {
    const e = this._findRuntimeModel();
    if (!e) {
      return;
    }
    const i = UI.Context.Context.instance().flavor(
      SDK.RuntimeModel.ExecutionContext
    );
    if (!i) {
      return;
    }
    const t = this._textEditor.text();
    if (t.length > 102400) {
      return;
    }
    this._compiling = true;
    const s = await e.compileScript(t, "", false, i.id);
    this._compiling = false;

    if (this._recompileScheduled) {
      this._recompileScheduled = false;
      return void this._scheduleCompile();
    }

    if (this._message) {
      this._uiSourceCode.removeMessage(this._message);
    }

    if (this._disposed || !s || !s || !s.exceptionDetails) {
      return;
    }

    const o = s.exceptionDetails;
    const r = SDK.RuntimeModel.RuntimeModel.simpleTextFromException(o);

    this._message = this._uiSourceCode.addLineMessage(
      Workspace.UISourceCode.Message.Level.Error,
      r,
      o.lineNumber,
      o.columnNumber
    );

    this._compilationFinishedForTest();
  }
  _compilationFinishedForTest() {}
  dispose() {
    this._textEditor.removeEventListener(
      UI.TextEditor.Events.TextChanged,
      this._scheduleCompile,
      this
    );

    if (this._message) {
      this._uiSourceCode.removeMessage(this._message);
    }

    this._disposed = true;

    if (this._timeout) {
      clearTimeout(this._timeout);
    }
  }
}
export const CompileDelay = 1000; /* 1e3 */

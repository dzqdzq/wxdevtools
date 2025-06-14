import * as Common from "../common/common.js";
import * as Host from "../host/host.js";
import * as ProtocolClient from "../protocol_client/protocol_client.js";
import * as Root from "../root/root.js";
import {
  GetPropertiesResult,
  RemoteObject,
  RemoteObjectImpl,
  ScopeRef,
} from "./RemoteObject.js";
import {
  EvaluationOptions,
  EvaluationResult,
  ExecutionContext,
  RuntimeModel,
} from "./RuntimeModel.js";
import { Script } from "./Script.js";
import { Capability, SDKModel, Target, Type } from "./SDKModel.js";
import { SourceMapManager } from "./SourceMapManager.js";
function contained(e, t) {
  const { start, end } = t;
  return (
    start.scriptId === e.scriptId &&
    !(e.lineNumber < start.lineNumber || e.lineNumber > end.lineNumber) &&
    !(
      e.lineNumber === start.lineNumber && e.columnNumber < start.columnNumber
    ) &&
    !(e.lineNumber === end.lineNumber && e.columnNumber >= end.columnNumber)
  );
}
export class DebuggerModel extends SDKModel {
  constructor(e) {
    super(e);
    e.registerDebuggerDispatcher(new DebuggerDispatcher(this));
    this.flagHideKey = `/${window.wxMain.type.toLowerCase()}/__dev__/`;
    console.log(this.flagHideKey);

    this._agent = e.debuggerAgent();
    this._runtimeModel = e.model(RuntimeModel);
    this._sourceMapManager = new SourceMapManager(e);
    this._sourceMapIdToScript = new Map();
    this._game_dev_script = new Map();
    this._debuggerPausedDetails = null;
    this._scripts = new Map();
    this._scriptsBySourceURL = new Map();
    this._discardableScripts = [];
    this._continueToLocationCallback = null;
    this._selectedCallFrame = null;
    this._debuggerEnabled = false;
    this._debuggerId = null;
    this._skipAllPausesTimeout = 0;
    this._beforePausedCallback = null;
    this._breakpointResolvedEventTarget =
      new Common.ObjectWrapper.ObjectWrapper();
    this._autoStepSkipList = [];
    this._autoStepOver = false;
    this._isPausing = false;

    Common.Settings.Settings.instance()
      .moduleSetting("pauseOnExceptionEnabled")
      .addChangeListener(this._pauseOnExceptionStateChanged, this);

    Common.Settings.Settings.instance()
      .moduleSetting("pauseOnCaughtException")
      .addChangeListener(this._pauseOnExceptionStateChanged, this);

    Common.Settings.Settings.instance()
      .moduleSetting("disableAsyncStackTraces")
      .addChangeListener(this._asyncStackTracesStateChanged, this);

    Common.Settings.Settings.instance()
      .moduleSetting("breakpointsActive")
      .addChangeListener(this._breakpointsActiveChanged, this);

    if (!e.suspended()) {
      this._enableDebugger();
    }

    this._stringMap = new Map();

    this._sourceMapManager.setEnabled(
      Common.Settings.Settings.instance()
        .moduleSetting("jsSourceMapsEnabled")
        .get()
    );

    Common.Settings.Settings.instance()
      .moduleSetting("jsSourceMapsEnabled")
      .addChangeListener((e) => this._sourceMapManager.setEnabled(e.data));
  }
  static _sourceMapId(e, t, s) {
    return s ? `${e}:${t}:${s}` : null;
  }
  sourceMapManager() {
    return this._sourceMapManager;
  }
  runtimeModel() {
    return this._runtimeModel;
  }
  debuggerEnabled() {
    return !!this._debuggerEnabled;
  }
  async _enableDebugger() {
    if (this._debuggerEnabled) {
      return Promise.resolve();
    }
    this._debuggerEnabled = true;

    const e =
      Root.Runtime.Runtime.queryParam("remoteFrontend") ||
      Root.Runtime.Runtime.queryParam("ws")
        ? 10000000 /* 1e7 */
        : 100000000; /* 1e8 */

    const t = this._agent.invoke_enable({ maxScriptsCacheSize: e });
    t.then(this._registerDebugger.bind(this));
    this._pauseOnExceptionStateChanged();
    this._asyncStackTracesStateChanged();

    if (
      !Common.Settings.Settings.instance()
        .moduleSetting("breakpointsActive")
        .get()
    ) {
      this._breakpointsActiveChanged();
    }

    if (_scheduledPauseOnAsyncCall) {
      this._pauseOnAsyncCall(_scheduledPauseOnAsyncCall);
    }

    this.dispatchEventToListeners(Events.DebuggerWasEnabled, this);
    await t;
  }
  _registerDebugger(e) {
    if (e.getError()) {
      return;
    }
    const { debuggerId } = e;
    _debuggerIdToModel.set(debuggerId, this);
    this._debuggerId = debuggerId;
    this.dispatchEventToListeners(Events.DebuggerIsReadyToPause, this);
  }
  isReadyToPause() {
    return !!this._debuggerId;
  }
  static modelForDebuggerId(e) {
    return _debuggerIdToModel.get(e) || null;
  }
  async _disableDebugger() {
    if (!this._debuggerEnabled) {
      return Promise.resolve();
    }
    this._debuggerEnabled = false;
    await this._asyncStackTracesStateChanged();
    await this._agent.invoke_disable();
    this._isPausing = false;
    this.globalObjectCleared();
    this.dispatchEventToListeners(Events.DebuggerWasDisabled);

    if (typeof this._debuggerId == "string") {
      _debuggerIdToModel.delete(this._debuggerId);
    }
  }
  _skipAllPauses(e) {
    if (this._skipAllPausesTimeout) {
      clearTimeout(this._skipAllPausesTimeout),
        (this._skipAllPausesTimeout = 0);
    }

    this._agent.invoke_setSkipAllPauses({ skip: e });
  }
  skipAllPausesUntilReloadOrTimeout(e) {
    if (this._skipAllPausesTimeout) {
      clearTimeout(this._skipAllPausesTimeout);
    }

    this._agent.invoke_setSkipAllPauses({ skip: true });

    this._skipAllPausesTimeout = setTimeout(
      this._skipAllPauses.bind(this, false),
      e
    );
  }
  _pauseOnExceptionStateChanged() {
    let e;

    e = Common.Settings.Settings.instance()
      .moduleSetting("pauseOnExceptionEnabled")
      .get()
      ? Common.Settings.Settings.instance()
          .moduleSetting("pauseOnCaughtException")
          .get()
        ? Protocol.Debugger.SetPauseOnExceptionsRequestState.All
        : Protocol.Debugger.SetPauseOnExceptionsRequestState.Uncaught
      : Protocol.Debugger.SetPauseOnExceptionsRequestState.None;

    this._agent.invoke_setPauseOnExceptions({ state: e });
  }
  _asyncStackTracesStateChanged() {
    const e =
      !Common.Settings.Settings.instance()
        .moduleSetting("disableAsyncStackTraces")
        .get() && this._debuggerEnabled
        ? 32
        : 0;
    return this._agent.invoke_setAsyncCallStackDepth({ maxDepth: e });
  }
  _breakpointsActiveChanged() {
    this._agent.invoke_setBreakpointsActive({
      active: Common.Settings.Settings.instance()
        .moduleSetting("breakpointsActive")
        .get(),
    });
  }
  async _computeAutoStepSkipList() {
    const e =
      Bindings.DebuggerWorkspaceBinding.instance().getLanguagePluginManager(
        this
      );
    if (e) {
      const t = this._debuggerPausedDetails.callFrames[0].location();
      const s = await e.rawLocationToUILocation(t);
      if (s) {
        const i = await e.uiLocationToRawLocationRanges(
          s.uiSourceCode,
          s.lineNumber,
          s.columnNumber
        );
        if (i) {
          return i.filter((e) => contained(t, e));
        }
      }
    }
    return [];
  }
  async stepInto() {
    this._autoStepSkipList = await this._computeAutoStepSkipList();
    this._agent.invoke_stepInto({ breakOnAsyncCall: false });
  }
  async stepOver() {
    this._autoStepOver = true;
    this._autoStepSkipList = await this._computeAutoStepSkipList();
    this._agent.invoke_stepOver({});
  }
  stepOut() {
    this._agent.invoke_stepOut();
  }
  scheduleStepIntoAsync() {
    this._agent.invoke_stepInto({ breakOnAsyncCall: true });
  }
  resume() {
    this._agent.invoke_resume({ terminateOnResume: false });
    this._isPausing = false;
  }
  pause() {
    this._isPausing = true;
    this._skipAllPauses(false);
    this._agent.invoke_pause();
  }
  _pauseOnAsyncCall(e) {
    return this._agent.invoke_pauseOnAsyncCall({ parentStackTraceId: e });
  }
  async setBreakpointByURL(e, t, s, i) {
    let r;
    if (this.target().type() === Type.Node) {
      r = `${Common.ParsedURL.ParsedURL.urlToPlatformPath(
        e,
        Host.Platform.isWin()
      ).escapeForRegExp()}|${e.escapeForRegExp()}`;
    }
    let a = 0;
    const o = this._scriptsBySourceURL.get(e) || [];
    for (let e = 0, s = o.length; e < s; ++e) {
      const o_e = o[e];

      if (t === o_e.lineOffset) {
        a = a ? Math.min(a, o_e.columnOffset) : o_e.columnOffset;
      }
    }
    s = Math.max(s || 0, a);
    const n = await this._agent.invoke_setBreakpointByUrl({
      lineNumber: t,
      url: r ? undefined : e,
      urlRegex: r,
      columnNumber: s,
      condition: i,
    });
    if (n.getError()) {
      return { locations: [], breakpointId: null };
    }
    let c = [];

    if (n.locations) {
      c = n.locations.map((e) => Location.fromPayload(this, e));
    }

    return { locations: c, breakpointId: n.breakpointId };
  }
  async setBreakpointInAnonymousScript(e, t, s, i, r) {
    const a = await this._agent.invoke_setBreakpointByUrl({
      lineNumber: s,
      scriptHash: t,
      columnNumber: i,
      condition: r,
    });

    const o = a.getError();
    if (o) {
      return o !== "Either url or urlRegex must be specified."
        ? { locations: [], breakpointId: null }
        : this._setBreakpointBySourceId(e, s, i, r);
    }
    let n = [];

    if (a.locations) {
      n = a.locations.map((e) => Location.fromPayload(this, e));
    }

    return { locations: n, breakpointId: a.breakpointId };
  }
  async _setBreakpointBySourceId(e, t, s, i) {
    const r = await this._agent.invoke_setBreakpoint({
      location: { scriptId: e, lineNumber: t, columnNumber: s },
      condition: i,
    });
    if (r.getError()) {
      return { breakpointId: null, locations: [] };
    }
    let a = [];

    if (r.actualLocation) {
      a = [Location.fromPayload(this, r.actualLocation)];
    }

    return { locations: a, breakpointId: r.breakpointId };
  }
  async removeBreakpoint(e) {
    const t = await this._agent.invoke_removeBreakpoint({ breakpointId: e });

    if (t.getError()) {
      console.error(`Failed to remove breakpoint: ${t.getError()}`);
    }
  }
  async getPossibleBreakpoints(e, t, s) {
    const i = await this._agent.invoke_getPossibleBreakpoints({
      start: e.payload(),
      end: t ? t.payload() : undefined,
      restrictToFunction: s,
    });
    return i.getError() || !i.locations
      ? []
      : i.locations.map((e) => BreakLocation.fromPayload(this, e));
  }
  async fetchAsyncStackTrace(e) {
    const t = await this._agent.invoke_getStackTrace({ stackTraceId: e });
    return t.getError() ? null : t.stackTrace;
  }
  _breakpointResolved(e, t) {
    this._breakpointResolvedEventTarget.dispatchEventToListeners(
      e,
      Location.fromPayload(this, t)
    );
  }
  globalObjectCleared() {
    this._setDebuggerPausedDetails(null);
    this._reset();
    this.dispatchEventToListeners(Events.GlobalObjectCleared, this);
  }
  _reset() {
    for (const e of this._sourceMapIdToScript.values()) {
      this._sourceMapManager.detachSourceMap(e);
    }
    const e =
      Bindings.DebuggerWorkspaceBinding.instance().getLanguagePluginManager(
        this
      );
    if (e) {
      for (const t of this._scripts.values()) {
        e.removeScript(t);
      }
    }
    this._sourceMapIdToScript.clear();
    this._scripts.clear();
    this._scriptsBySourceURL.clear();
    this._stringMap.clear();
    this._discardableScripts = [];
    this._autoStepOver = false;
    this._autoStepSkipList = [];
  }
  scripts() {
    return Array.from(this._scripts.values());
  }
  scriptForId(e) {
    return this._scripts.get(e) || null;
  }
  scriptsForSourceURL(e) {
    return (e && this._scriptsBySourceURL.get(e)) || [];
  }
  scriptsForExecutionContext(e) {
    const t = [];
    for (const s of this._scripts.values()) {
      if (s.executionContextId === e.id) {
        t.push(s);
      }
    }
    return t;
  }
  setScriptSource(e, t, s) {
    const i = this._scripts.get(e);

    if (i) {
      i.editSource(t, this._didEditScriptSource.bind(this, e, t, s));
    }
  }
  _didEditScriptSource(e, t, s, i, r, a, o, n, c) {
    s(i, r);

    if (c) {
      this.stepInto();
    } else if (!i && a && a.length && this._debuggerPausedDetails) {
      this._pausedScript(
        a,
        this._debuggerPausedDetails.reason,
        this._debuggerPausedDetails.auxData,
        this._debuggerPausedDetails.breakpointIds,
        o,
        n
      );
    }
  }
  get callFrames() {
    return this._debuggerPausedDetails
      ? this._debuggerPausedDetails.callFrames
      : null;
  }
  debuggerPausedDetails() {
    return this._debuggerPausedDetails;
  }
  async _setDebuggerPausedDetails(e) {
    this._isPausing = false;
    this._debuggerPausedDetails = e;

    if (e) {
      const t = e.callFrames[0].location();
      for (const e of this._autoStepSkipList) {
        if (contained(t, e)) {
          return false;
        }
      }
      if (
        this._beforePausedCallback &&
        !this._beforePausedCallback.call(null, e)
      ) {
        return false;
      }
      const s =
        Bindings.DebuggerWorkspaceBinding.instance().getLanguagePluginManager(
          this
        );
      if (s) {
        for (const t of e.callFrames) {
          t.sourceScopeChain = await s.resolveScopeChain(t);
        }
      }
      this._autoStepOver = false;
      this._autoStepSkipList = [];
      this.dispatchEventToListeners(Events.DebuggerPaused, this);
      this.setSelectedCallFrame(e.callFrames[0]);
    } else {
      this.setSelectedCallFrame(null);
    }

    return true;
  }
  setBeforePausedCallback(e) {
    this._beforePausedCallback = e;
  }
  async _pausedScript(e, t, s, i, r, a, o) {
    if (o) {
      _scheduledPauseOnAsyncCall = o;
      const e = [];
      for (const t of _debuggerIdToModel.values()) {
        e.push(t._pauseOnAsyncCall(o));
      }
      await Promise.all(e);
      return void this.resume();
    }
    const n = new DebuggerPausedDetails(this, e, t, s, i, r, a);
    if (this._continueToLocationCallback) {
      const e = this._continueToLocationCallback;
      this._continueToLocationCallback = null;

      if (e(n)) {
        return;
      }
    }

    if (!(await this._setDebuggerPausedDetails(n))) {
      if (this._autoStepOver) {
        this._agent.invoke_stepOver({});
      } else {
        this._agent.invoke_stepInto({ breakOnAsyncCall: false });
      }
    }

    _scheduledPauseOnAsyncCall = null;
  }
  _resumedScript() {
    this._setDebuggerPausedDetails(null);
    this.dispatchEventToListeners(Events.DebuggerResumed, this);
  }
  _parsedScriptSource(e, t, s, i, r, a, o, n, c, l, u, d, p, g, h, m, _, b, S) {
    const y = this._scripts.get(e);
    if (y) {
      return y;
    }
    let k = false;

    if (c && "isDefault" in c) {
      k = !c.isDefault;
    }

    t = this._internString(t);
    const C = new Script(
      this,
      e,
      t,
      s,
      i,
      r,
      a,
      o,
      this._internString(n),
      k,
      l,
      u,
      d,
      g,
      h,
      m,
      _,
      b,
      S
    );
    this._registerScript(C);
    if (t && t.includes(this.flagHideKey)) {
      const originCodeobj = this._game_dev_script.get(t);
      if (originCodeobj) {
        C._originalContentProvider = originCodeobj;
      }
    }
    if (S && S.includes(this.flagHideKey)) {
      this._game_dev_script.set(S, C.originalContentProvider());
    }

    this.dispatchEventToListeners(Events.ParsedScriptSource, C);
    const f =
      Bindings.DebuggerWorkspaceBinding.instance().getLanguagePluginManager(
        this
      );
    if (
      !Root.Runtime.experiments.isEnabled("wasmDWARFDebugging") ||
      !f ||
      !f.hasPluginForScript(C)
    ) {
      const e = DebuggerModel._sourceMapId(
        C.executionContextId,
        C.sourceURL,
        C.sourceMapURL
      );
      if (e && !p) {
        const t = this._sourceMapIdToScript.get(e);

        if (t) {
          this._sourceMapManager.detachSourceMap(t);
        }

        this._sourceMapIdToScript.set(e, C);

        this._sourceMapManager.attachSourceMap(C, C.sourceURL, C.sourceMapURL);
      }
    }

    if (p && C.isAnonymousScript()) {
      this._discardableScripts.push(C);
      this._collectDiscardedScripts();
    }
    return C;
  }
  setSourceMapURL(e, t) {
    let s = DebuggerModel._sourceMapId(
      e.executionContextId,
      e.sourceURL,
      e.sourceMapURL
    );

    if (s && this._sourceMapIdToScript.get(s) === e) {
      this._sourceMapIdToScript.delete(s);
    }

    this._sourceMapManager.detachSourceMap(e);
    e.sourceMapURL = t;

    s = DebuggerModel._sourceMapId(
      e.executionContextId,
      e.sourceURL,
      e.sourceMapURL
    );

    if (s) {
      this._sourceMapIdToScript.set(s, e),
        this._sourceMapManager.attachSourceMap(e, e.sourceURL, e.sourceMapURL);
    }
  }
  executionContextDestroyed(e) {
    const t = Array.from(this._sourceMapIdToScript.keys());
    for (const s of t) {
      const t = this._sourceMapIdToScript.get(s);

      if (t && t.executionContextId === e.id) {
        this._sourceMapIdToScript.delete(s),
          this._sourceMapManager.detachSourceMap(t);
      }
    }
  }
  _registerScript(e) {
    this._scripts.set(e.scriptId, e);
    if (e.isAnonymousScript()) {
      return;
    }
    let t = this._scriptsBySourceURL.get(e.sourceURL);
    if (!t) {
      t = [];
    }
    this._scriptsBySourceURL.set(e.sourceURL, t);
    t.push(e);
  }
  _unregisterScript(e) {
    console.assert(e.isAnonymousScript());
    this._scripts.delete(e.scriptId);
  }
  _collectDiscardedScripts() {
    if (this._discardableScripts.length < 1000 /* 1e3 */) {
      return;
    }
    const e = this._discardableScripts.splice(0, 100);
    for (const t of e) {
      this._unregisterScript(t);
      this.dispatchEventToListeners(Events.DiscardedAnonymousScriptSource, t);
    }
  }
  createRawLocation(e, t, s) {
    return new Location(this, e.scriptId, t, s);
  }
  createRawLocationByURL(e, t, s) {
    let i = null;
    const r = this._scriptsBySourceURL.get(e) || [];
    for (let e = 0, a = r.length; e < a; ++e) {
      const r_e = r[e];

      if (!i) {
        i = r_e;
      }

      if (
        !(
          r_e.lineOffset > t ||
          (r_e.lineOffset === t && r_e.columnOffset > s) ||
          r_e.endLine < t ||
          (r_e.endLine === t && r_e.endColumn <= s)
        )
      ) {
        i = r_e;
        break;
      }
    }
    return i ? new Location(this, i.scriptId, t, s) : null;
  }
  createRawLocationByScriptId(e, t, s) {
    const i = this.scriptForId(e);
    return i ? this.createRawLocation(i, t, s) : null;
  }
  createRawLocationsByStackTrace(e) {
    const t = [];
    let s = e;

    while (s) {
      for (const e of s.callFrames) {
        t.push(e);
      }
      s = s.parent;
    }

    const i = [];
    for (const e of t) {
      const t = this.createRawLocationByScriptId(
        e.scriptId,
        e.lineNumber,
        e.columnNumber
      );

      if (t) {
        i.push(t);
      }
    }
    return i;
  }
  isPaused() {
    return !!this.debuggerPausedDetails();
  }
  isPausing() {
    return this._isPausing;
  }
  setSelectedCallFrame(e) {
    if (this._selectedCallFrame !== e) {
      (this._selectedCallFrame = e),
        this.dispatchEventToListeners(Events.CallFrameSelected, this);
    }
  }
  selectedCallFrame() {
    return this._selectedCallFrame;
  }
  async evaluateOnSelectedCallFrame(e) {
    const t = this.selectedCallFrame();
    if (!t) {
      throw new Error("No call frame selected");
    }
    return t.evaluate(e);
  }
  executeWasmEvaluator(e, t) {
    return this._agent.invoke_executeWasmEvaluator({
      callFrameId: e,
      evaluator: t,
    });
  }
  functionDetailsPromise(e) {
    return e.getAllProperties(false, false).then((e) => {
      if (!e) {
        return null;
      }
      let t = null;
      if (e.internalProperties) {
        for (const s of e.internalProperties) {
          if (s.name === "[[FunctionLocation]]") {
            t = s.value;
          }
        }
      }
      let s = null;
      if (e.properties) {
        for (const t of e.properties) {
          if (t.name === "name" && t.value && t.value.type === "string") {
            s = t.value;
          }

          if (
            t.name === "displayName" &&
            t.value &&
            t.value.type === "string"
          ) {
            s = t.value;
            break;
          }
        }
      }
      let i = null;

      if (t) {
        i = this.createRawLocationByScriptId(
          t.value.scriptId,
          t.value.lineNumber,
          t.value.columnNumber
        );
      }

      return { location: i, functionName: s ? s.value : "" };
    });
  }
  async setVariableValue(e, t, s, i) {
    const r = (
      await this._agent.invoke_setVariableValue({
        scopeNumber: e,
        variableName: t,
        newValue: s,
        callFrameId: i,
      })
    ).getError();

    if (r) {
      console.error(r);
    }

    return r;
  }
  addBreakpointListener(e, t, s) {
    this._breakpointResolvedEventTarget.addEventListener(e, t, s);
  }
  removeBreakpointListener(e, t, s) {
    this._breakpointResolvedEventTarget.removeEventListener(e, t, s);
  }
  async setBlackboxPatterns(e) {
    const t = (
      await this._agent.invoke_setBlackboxPatterns({ patterns: e })
    ).getError();

    if (t) {
      console.error(t);
    }

    return !t;
  }
  dispose() {
    this._sourceMapManager.dispose();

    if (this._debuggerId) {
      _debuggerIdToModel.delete(this._debuggerId);
    }

    Common.Settings.Settings.instance()
      .moduleSetting("pauseOnExceptionEnabled")
      .removeChangeListener(this._pauseOnExceptionStateChanged, this);

    Common.Settings.Settings.instance()
      .moduleSetting("pauseOnCaughtException")
      .removeChangeListener(this._pauseOnExceptionStateChanged, this);

    Common.Settings.Settings.instance()
      .moduleSetting("disableAsyncStackTraces")
      .removeChangeListener(this._asyncStackTracesStateChanged, this);
  }
  async suspendModel() {
    await this._disableDebugger();
  }
  async resumeModel() {
    await this._enableDebugger();
  }
  _internString(e) {
    const t = this._stringMap.get(e);
    return t === undefined ? (this._stringMap.set(e, e), e) : t;
  }
}
export const _debuggerIdToModel = new Map();
export let _scheduledPauseOnAsyncCall = null;
export const PauseOnExceptionsState = {
  DontPauseOnExceptions: "none",
  PauseOnAllExceptions: "all",
  PauseOnUncaughtExceptions: "uncaught",
};
export const Events = {
  DebuggerWasEnabled: Symbol("DebuggerWasEnabled"),
  DebuggerWasDisabled: Symbol("DebuggerWasDisabled"),
  DebuggerPaused: Symbol("DebuggerPaused"),
  DebuggerResumed: Symbol("DebuggerResumed"),
  ParsedScriptSource: Symbol("ParsedScriptSource"),
  FailedToParseScriptSource: Symbol("FailedToParseScriptSource"),
  DiscardedAnonymousScriptSource: Symbol("DiscardedAnonymousScriptSource"),
  GlobalObjectCleared: Symbol("GlobalObjectCleared"),
  CallFrameSelected: Symbol("CallFrameSelected"),
  ConsoleCommandEvaluatedInSelectedCallFrame: Symbol(
    "ConsoleCommandEvaluatedInSelectedCallFrame"
  ),
  DebuggerIsReadyToPause: Symbol("DebuggerIsReadyToPause"),
};
export const BreakReason = {
  DOM: "DOM",
  EventListener: "EventListener",
  XHR: "XHR",
  Exception: "exception",
  PromiseRejection: "promiseRejection",
  Assert: "assert",
  DebugCommand: "debugCommand",
  OOM: "OOM",
  Other: "other",
};
class DebuggerDispatcher {
  constructor(e) {
    this._debuggerModel = e;
  }
  usesObjectNotation() {
    return true;
  }
  paused({
    callFrames,
    reason,
    data,
    hitBreakpoints,
    asyncStackTrace,
    asyncStackTraceId,
    asyncCallStackTraceId,
  }) {
    this._debuggerModel._pausedScript(
      callFrames,
      reason,
      data,
      hitBreakpoints || [],
      asyncStackTrace,
      asyncStackTraceId,
      asyncCallStackTraceId
    );
  }
  resumed() {
    this._debuggerModel._resumedScript();
  }
  scriptParsed({
    scriptId,
    url,
    startLine,
    startColumn,
    endLine,
    endColumn,
    executionContextId,
    hash,
    executionContextAuxData,
    isLiveEdit,
    sourceMapURL,
    hasSourceURL,
    isModule,
    length,
    stackTrace,
    codeOffset,
    scriptLanguage,
    debugSymbols,
    embedderName,
  }) {
    this._debuggerModel._parsedScriptSource(
      scriptId,
      url,
      startLine,
      startColumn,
      endLine,
      endColumn,
      executionContextId,
      hash,
      executionContextAuxData,
      !!isLiveEdit,
      sourceMapURL,
      !!hasSourceURL,
      false,
      length || 0,
      stackTrace || null,
      codeOffset || null,
      scriptLanguage || null,
      debugSymbols || null,
      embedderName || null
    );
  }
  scriptFailedToParse({
    scriptId,
    url,
    startLine,
    startColumn,
    endLine,
    endColumn,
    executionContextId,
    hash,
    executionContextAuxData,
    sourceMapURL,
    hasSourceURL,
    isModule,
    length,
    stackTrace,
    codeOffset,
    scriptLanguage,
    embedderName,
  }) {
    this._debuggerModel._parsedScriptSource(
      scriptId,
      url,
      startLine,
      startColumn,
      endLine,
      endColumn,
      executionContextId,
      hash,
      executionContextAuxData,
      false,
      sourceMapURL,
      !!hasSourceURL,
      true,
      length || 0,
      stackTrace || null,
      codeOffset || null,
      scriptLanguage || null,
      null,
      embedderName || null
    );
  }
  breakpointResolved({ breakpointId, location }) {
    this._debuggerModel._breakpointResolved(breakpointId, location);
  }
}
export class Location {
  constructor(e, t, s, i) {
    this.debuggerModel = e;
    this.scriptId = t;
    this.lineNumber = s;
    this.columnNumber = i || 0;
  }
  static fromPayload(e, t) {
    return new Location(e, t.scriptId, t.lineNumber, t.columnNumber);
  }
  payload() {
    return {
      scriptId: this.scriptId,
      lineNumber: this.lineNumber,
      columnNumber: this.columnNumber,
    };
  }
  script() {
    return this.debuggerModel.scriptForId(this.scriptId);
  }
  continueToLocation(e) {
    if (e) {
      this.debuggerModel._continueToLocationCallback = this._paused.bind(
        this,
        e
      );
    }

    this.debuggerModel._agent.invoke_continueToLocation({
      location: this.payload(),
      targetCallFrames:
        Protocol.Debugger.ContinueToLocationRequestTargetCallFrames.Current,
    });
  }
  _paused(e, t) {
    const s = t.callFrames[0].location();
    return (
      s.scriptId === this.scriptId &&
      s.lineNumber === this.lineNumber &&
      s.columnNumber === this.columnNumber &&
      (e(), true)
    );
  }
  id() {
    return `${this.debuggerModel.target().id()}:${this.scriptId}:${
      this.lineNumber
    }:${this.columnNumber}`;
  }
}
export class BreakLocation extends Location {
  constructor(e, t, s, i, r) {
    super(e, t, s, i);

    if (r) {
      this.type = r;
    }
  }
  static fromPayload(e, t) {
    return new BreakLocation(
      e,
      t.scriptId,
      t.lineNumber,
      t.columnNumber,
      t.type
    );
  }
}
export class CallFrame {
  constructor(e, t, s) {
    this.debuggerModel = e;
    this.sourceScopeChain = null;
    this._script = t;
    this._payload = s;
    this._location = Location.fromPayload(e, s.location);
    this._scopeChain = [];
    this._localScope = null;
    for (let e = 0; e < s.scopeChain.length; ++e) {
      const t = new Scope(this, e);
      this._scopeChain.push(t);

      if (t.type() === Protocol.Debugger.ScopeType.Local) {
        this._localScope = t;
      }
    }

    if (s.functionLocation) {
      this._functionLocation = Location.fromPayload(e, s.functionLocation);
    }

    this._returnValue = s.returnValue
      ? this.debuggerModel._runtimeModel.createRemoteObject(s.returnValue)
      : null;
  }
  static fromPayloadArray(e, t) {
    const s = [];

    for (const r of t) {
      const a = e.scriptForId(r.location.scriptId);

      if (a) {
        s.push(new CallFrame(e, a, r));
      }
    }

    return s;
  }
  get script() {
    return this._script;
  }
  get id() {
    return this._payload.callFrameId;
  }
  scopeChain() {
    return this._scopeChain;
  }
  localScope() {
    return this._localScope;
  }
  thisObject() {
    return this._payload.this
      ? this.debuggerModel._runtimeModel.createRemoteObject(this._payload.this)
      : null;
  }
  returnValue() {
    return this._returnValue;
  }
  async setReturnValue(e) {
    if (!this._returnValue) {
      return null;
    }
    const t = await this.debuggerModel._agent.invoke_evaluateOnCallFrame({
      callFrameId: this.id,
      expression: e,
      silent: true,
      objectGroup: "backtrace",
    });
    if (t.getError() || t.exceptionDetails) {
      return null;
    }
    return (
      await this.debuggerModel._agent.invoke_setReturnValue({
        newValue: t.result,
      })
    ).getError()
      ? null
      : ((this._returnValue =
          this.debuggerModel._runtimeModel.createRemoteObject(t.result)),
        this._returnValue);
  }
  get functionName() {
    return this._payload.functionName;
  }
  location() {
    return this._location;
  }
  functionLocation() {
    return this._functionLocation || null;
  }
  async evaluate(e) {
    const t = this.debuggerModel.runtimeModel();
    if (
      (!!e.throwOnSideEffect || e.timeout !== undefined) &&
      (t.hasSideEffectSupport() === false ||
        (t.hasSideEffectSupport() === null &&
          !(await t.checkSideEffectSupport())))
    ) {
      return { error: "Side-effect checks not supported by backend." };
    }

    const s = await this.debuggerModel._agent.invoke_evaluateOnCallFrame({
      callFrameId: this.id,
      expression: e.expression,
      objectGroup: e.objectGroup,
      includeCommandLineAPI: e.includeCommandLineAPI,
      silent: e.silent,
      returnByValue: e.returnByValue,
      generatePreview: e.generatePreview,
      throwOnSideEffect: e.throwOnSideEffect,
      timeout: e.timeout,
    });

    const i = s.getError();
    return i
      ? (console.error(i), { error: i })
      : {
          object: t.createRemoteObject(s.result),
          exceptionDetails: s.exceptionDetails,
        };
  }
  async restart() {
    if (
      !(
        await this.debuggerModel._agent.invoke_restartFrame({
          callFrameId: this._payload.callFrameId,
        })
      ).getError()
    ) {
      this.debuggerModel.stepInto();
    }
  }
}
export class Scope {
  constructor(e, t) {
    this._callFrame = e;
    this._payload = e._payload.scopeChain[t];
    this._type = this._payload.type;
    this._name = this._payload.name;
    this._ordinal = t;

    this._startLocation = this._payload.startLocation
      ? Location.fromPayload(e.debuggerModel, this._payload.startLocation)
      : null;

    this._endLocation = this._payload.endLocation
      ? Location.fromPayload(e.debuggerModel, this._payload.endLocation)
      : null;

    this._object = null;
  }
  callFrame() {
    return this._callFrame;
  }
  type() {
    return this._type;
  }
  typeName() {
    switch (this._type) {
      case Protocol.Debugger.ScopeType.Local: {
        return Common.UIString.UIString("Local");
      }
      case Protocol.Debugger.ScopeType.Closure: {
        return Common.UIString.UIString("Closure");
      }
      case Protocol.Debugger.ScopeType.Catch: {
        return Common.UIString.UIString("Catch");
      }
      case Protocol.Debugger.ScopeType.Block: {
        return Common.UIString.UIString("Block");
      }
      case Protocol.Debugger.ScopeType.Script: {
        return Common.UIString.UIString("Script");
      }
      case Protocol.Debugger.ScopeType.With: {
        return Common.UIString.UIString("With Block");
      }
      case Protocol.Debugger.ScopeType.Global: {
        return Common.UIString.UIString("Global");
      }
      case Protocol.Debugger.ScopeType.Module: {
        return Common.UIString.UIString("Module");
      }
      case Protocol.Debugger.ScopeType.WasmExpressionStack: {
        return Common.UIString.UIString("Stack");
      }
    }
    return "";
  }
  name() {
    return this._name;
  }
  startLocation() {
    return this._startLocation;
  }
  endLocation() {
    return this._endLocation;
  }
  object() {
    if (this._object) {
      return this._object;
    }
    const e = this._callFrame.debuggerModel._runtimeModel;

    const t =
      this._type !== Protocol.Debugger.ScopeType.With &&
      this._type !== Protocol.Debugger.ScopeType.Global;

    this._object = t
      ? e.createScopeRemoteObject(
          this._payload.object,
          new ScopeRef(this._ordinal, this._callFrame.id)
        )
      : e.createRemoteObject(this._payload.object);

    return this._object;
  }
  description() {
    return this._type !== Protocol.Debugger.ScopeType.With &&
      this._type !== Protocol.Debugger.ScopeType.Global
      ? ""
      : this._payload.object.description || "";
  }
}
export class DebuggerPausedDetails {
  constructor(e, t, s, i, r, a, o) {
    this.debuggerModel = e;
    this.callFrames = CallFrame.fromPayloadArray(e, t);
    this.reason = s;
    this.auxData = i;
    this.breakpointIds = r;

    if (a) {
      this.asyncStackTrace = this._cleanRedundantFrames(a);
    }

    this.asyncStackTraceId = o;
  }
  exception() {
    return this.reason !== BreakReason.Exception &&
      this.reason !== BreakReason.PromiseRejection
      ? null
      : this.debuggerModel._runtimeModel.createRemoteObject(this.auxData);
  }
  _cleanRedundantFrames(e) {
    let t = e;
    let s = null;

    while (t) {
      if (t.description === "async function" && t.callFrames.length) {
        t.callFrames.shift();
      }

      if (s && !t.callFrames.length) {
        s.parent = t.parent;
      } else {
        s = t;
      }

      t = t.parent;
    }

    return e;
  }
}
SDKModel.register(DebuggerModel, Capability.JS, true);
export let FunctionDetails;
export let SetBreakpointResult;

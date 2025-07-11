import * as Common from "../common/common.js";
import * as SDK from "../sdk/sdk.js";
import * as Workspace from "../workspace/workspace.js";
import { DebuggerWorkspaceBinding } from "./DebuggerWorkspaceBinding.js";
let blackboxManagerInstance;
export class BlackboxManager {
  constructor(e) {
    (this._debuggerWorkspaceBinding = e),
      SDK.SDKModel.TargetManager.instance().addModelListener(
        SDK.DebuggerModel.DebuggerModel,
        SDK.DebuggerModel.Events.GlobalObjectCleared,
        this._clearCacheIfNeeded.bind(this),
        this
      ),
      Common.Settings.Settings.instance()
        .moduleSetting("skipStackFramesPattern")
        .addChangeListener(this._patternChanged.bind(this)),
      Common.Settings.Settings.instance()
        .moduleSetting("skipContentScripts")
        .addChangeListener(this._patternChanged.bind(this)),
      (this._listeners = new Set()),
      (this._isBlackboxedURLCache = new Map()),
      SDK.SDKModel.TargetManager.instance().observeModels(
        SDK.DebuggerModel.DebuggerModel,
        this
      );
  }
  static instance(e = { forceNew: null, debuggerWorkspaceBinding: null }) {
    const { forceNew: t, debuggerWorkspaceBinding: n } = e;
    if (!blackboxManagerInstance || t) {
      if (!n)
        throw new Error(
          "Unable to create settings: targetManager, workspace, and debuggerWorkspaceBinding must be provided: " +
            new Error().stack
        );
      blackboxManagerInstance = new BlackboxManager(n);
    }
    return blackboxManagerInstance;
  }
  addChangeListener(e) {
    this._listeners.add(e);
  }
  removeChangeListener(e) {
    this._listeners.delete(e);
  }
  modelAdded(e) {
    this._setBlackboxPatterns(e);
    const t = e.sourceMapManager();
    t.addEventListener(
      SDK.SourceMapManager.Events.SourceMapAttached,
      this._sourceMapAttached,
      this
    ),
      t.addEventListener(
        SDK.SourceMapManager.Events.SourceMapDetached,
        this._sourceMapDetached,
        this
      );
  }
  modelRemoved(e) {
    this._clearCacheIfNeeded();
    const t = e.sourceMapManager();
    t.removeEventListener(
      SDK.SourceMapManager.Events.SourceMapAttached,
      this._sourceMapAttached,
      this
    ),
      t.removeEventListener(
        SDK.SourceMapManager.Events.SourceMapDetached,
        this._sourceMapDetached,
        this
      );
  }
  _clearCacheIfNeeded() {
    this._isBlackboxedURLCache.size > 1024 &&
      this._isBlackboxedURLCache.clear();
  }
  _setBlackboxPatterns(e) {
    const t = Common.Settings.Settings.instance()
        .moduleSetting("skipStackFramesPattern")
        .getAsArray(),
      n = [];
    for (const e of t) !e.disabled && e.pattern && n.push(e.pattern);
    return e.setBlackboxPatterns(n);
  }
  isBlackboxedUISourceCode(e) {
    if (
      e.project().type() === Workspace.Workspace.projectTypes.ContentScripts &&
      Common.Settings.Settings.instance()
        .moduleSetting("skipContentScripts")
        .get()
    )
      return !0;
    const t = this._uiSourceCodeURL(e);
    return !!t && this.isBlackboxedURL(t);
  }
  isBlackboxedURL(e, t) {
    if (this._isBlackboxedURLCache.has(e))
      return !!this._isBlackboxedURLCache.get(e);
    if (
      t &&
      Common.Settings.Settings.instance()
        .moduleSetting("skipContentScripts")
        .get()
    )
      return !0;
    const n = Common.Settings.Settings.instance()
        .moduleSetting("skipStackFramesPattern")
        .asRegExp(),
      s = (n && n.test(e)) || !1;
    return this._isBlackboxedURLCache.set(e, s), s;
  }
  _sourceMapAttached(e) {
    const t = e.data.client,
      n = e.data.sourceMap;
    this._updateScriptRanges(t, n);
  }
  _sourceMapDetached(e) {
    const t = e.data.client;
    this._updateScriptRanges(t, null);
  }
  async _updateScriptRanges(e, t) {
    let n = !1;
    if (
      (BlackboxManager.instance().isBlackboxedURL(
        e.sourceURL,
        e.isContentScript()
      ) || (n = !!t && t.sourceURLs().some((e) => this.isBlackboxedURL(e))),
      !n)
    )
      return (
        e[_blackboxedRanges] &&
          (await e.setBlackboxedRanges([])) &&
          delete e[_blackboxedRanges],
        void (await this._debuggerWorkspaceBinding.updateLocations(e))
      );
    const s = t.mappings(),
      a = [];
    if (s.length > 0) {
      let e = !1;
      (0 === s[0].lineNumber && 0 === s[0].columnNumber) ||
        (a.push({ lineNumber: 0, columnNumber: 0 }), (e = !0));
      for (const t of s)
        t.sourceURL &&
          e !== this.isBlackboxedURL(t.sourceURL) &&
          (a.push({ lineNumber: t.lineNumber, columnNumber: t.columnNumber }),
          (e = !e));
    }
    !(function (e, t) {
      if (e.length !== t.length) return !1;
      for (let n = 0; n < e.length; ++n)
        if (
          e[n].lineNumber !== t[n].lineNumber ||
          e[n].columnNumber !== t[n].columnNumber
        )
          return !1;
      return !0;
    })(e[_blackboxedRanges] || [], a) &&
      (await e.setBlackboxedRanges(a)) &&
      (e[_blackboxedRanges] = a),
      this._debuggerWorkspaceBinding.updateLocations(e);
  }
  _uiSourceCodeURL(e) {
    return e.project().type() === Workspace.Workspace.projectTypes.Debugger
      ? null
      : e.url();
  }
  canBlackboxUISourceCode(e) {
    const t = this._uiSourceCodeURL(e);
    return !!t && !!this._urlToRegExpString(t);
  }
  blackboxUISourceCode(e) {
    const t = this._uiSourceCodeURL(e);
    t && this._blackboxURL(t);
  }
  unblackboxUISourceCode(e) {
    const t = this._uiSourceCodeURL(e);
    t && this._unblackboxURL(t);
  }
  blackboxContentScripts() {
    Common.Settings.Settings.instance()
      .moduleSetting("skipContentScripts")
      .set(!0);
  }
  unblackboxContentScripts() {
    Common.Settings.Settings.instance()
      .moduleSetting("skipContentScripts")
      .set(!1);
  }
  _blackboxURL(e) {
    const t = Common.Settings.Settings.instance()
        .moduleSetting("skipStackFramesPattern")
        .getAsArray(),
      n = this._urlToRegExpString(e);
    if (!n) return;
    let s = !1;
    for (let e = 0; e < t.length; ++e) {
      const a = t[e];
      if (a.pattern === n) {
        (a.disabled = !1), (s = !0);
        break;
      }
    }
    s || t.push({ pattern: n }),
      Common.Settings.Settings.instance()
        .moduleSetting("skipStackFramesPattern")
        .setAsArray(t);
  }
  _unblackboxURL(e) {
    let t = Common.Settings.Settings.instance()
      .moduleSetting("skipStackFramesPattern")
      .getAsArray();
    const n = BlackboxManager.instance()._urlToRegExpString(e);
    if (n) {
      t = t.filter(function (e) {
        return e.pattern !== n;
      });
      for (let n = 0; n < t.length; ++n) {
        const s = t[n];
        if (!s.disabled)
          try {
            new RegExp(s.pattern).test(e) && (s.disabled = !0);
          } catch (e) {}
      }
      Common.Settings.Settings.instance()
        .moduleSetting("skipStackFramesPattern")
        .setAsArray(t);
    }
  }
  async _patternChanged() {
    this._isBlackboxedURLCache.clear();
    const e = [];
    for (const t of SDK.SDKModel.TargetManager.instance().models(
      SDK.DebuggerModel.DebuggerModel
    )) {
      e.push(this._setBlackboxPatterns(t));
      const n = t.sourceMapManager();
      for (const s of t.scripts())
        e.push(this._updateScriptRanges(s, n.sourceMapForClient(s)));
    }
    await Promise.all(e);
    const t = Array.from(this._listeners);
    for (const e of t) e();
    this._patternChangeFinishedForTests();
  }
  _patternChangeFinishedForTests() {}
  _urlToRegExpString(e) {
    const t = new Common.ParsedURL.ParsedURL(e);
    if (t.isAboutBlank() || t.isDataURL()) return "";
    if (!t.isValid) return "^" + e.escapeForRegExp() + "$";
    let n = t.lastPathComponent;
    if (
      (n
        ? (n = "/" + n)
        : t.folderPathComponents && (n = t.folderPathComponents + "/"),
      n || (n = t.host),
      !n)
    )
      return "";
    const s = t.scheme;
    let a = "";
    return (
      s &&
        "http" !== s &&
        "https" !== s &&
        ((a = "^" + s + "://"),
        "chrome-extension" === s && (a += t.host + "\\b"),
        (a += ".*")),
      a + n.escapeForRegExp() + (e.endsWith(n) ? "$" : "\\b")
    );
  }
}
const _blackboxedRanges = Symbol("blackboxedRanged");

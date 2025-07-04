import * as Common from "../common/common.js";
import * as ProtocolClient from "../protocol_client/protocol_client.js";
import * as TextUtils from "../text_utils/text_utils.js";
import { DebuggerModel, Location } from "./DebuggerModel.js";
import { FrameAssociated } from "./FrameAssociated.js";
import { PageResourceLoadInitiator } from "./PageResourceLoader.js";
import { ResourceTreeModel } from "./ResourceTreeModel.js";
import { ExecutionContext } from "./RuntimeModel.js";
import { Target } from "./SDKModel.js";
export class Script {
  constructor(e, t, r, i, o, s, n, c, a, d, u, h, l, m, g, p, f, S, b) {
    (this.debuggerModel = e),
      (this.scriptId = t),
      (this.sourceURL = r),
      (this.lineOffset = i),
      (this.columnOffset = o),
      (this.endLine = s),
      (this.endColumn = n),
      (this.executionContextId = c),
      (this.hash = a),
      (this._isContentScript = d),
      (this._isLiveEdit = u),
      (this.sourceMapURL = h),
      !h &&
        S &&
        "EmbeddedDWARF" === S.type &&
        (this.sourceMapURL = "wasm://dwarf"),
      (this.debugSymbols = S),
      (this.hasSourceURL = l),
      (this.contentLength = m),
      (this._originalContentProvider = null),
      (this.originStackTrace = g),
      (this._codeOffset = p),
      (this._language = f),
      (this._contentPromise = null),
      (this._embedderName = b);
  }
  embedderName() {
    return this._embedderName;
  }
  target() {
    return this.debuggerModel.target();
  }
  static _trimSourceURLComment(e) {
    let t = e.lastIndexOf("//# sourceURL=");
    if (-1 === t && ((t = e.lastIndexOf("//@ sourceURL=")), -1 === t)) return e;
    const r = e.lastIndexOf("\n", t);
    if (-1 === r) return e;
    return e.substr(r + 1).match(sourceURLRegex) ? e.substr(0, r) : e;
  }
  isContentScript() {
    return this._isContentScript;
  }
  codeOffset() {
    return this._codeOffset;
  }
  isWasm() {
    return this._language === Protocol.Debugger.ScriptLanguage.WebAssembly;
  }
  scriptLanguage() {
    return this._language;
  }
  executionContext() {
    return this.debuggerModel
      .runtimeModel()
      .executionContext(this.executionContextId);
  }
  isLiveEdit() {
    return this._isLiveEdit;
  }
  contentURL() {
    return this.sourceURL;
  }
  contentType() {
    return Common.ResourceType.resourceTypes.Script;
  }
  contentEncoded() {
    return Promise.resolve(!1);
  }
  requestContent() {
    return (
      this._contentPromise ||
        (this._contentPromise =
          this.originalContentProvider().requestContent()),
      this._contentPromise
    );
  }
  async getWasmBytecode() {
    const e = await this.debuggerModel
      .target()
      .debuggerAgent()
      .invoke_getWasmBytecode({ scriptId: this.scriptId });
    return (
      await fetch("data:application/wasm;base64," + e.bytecode)
    ).arrayBuffer();
  }
  originalContentProvider() {
    if (!this._originalContentProvider) {
      let e;
      this._originalContentProvider =
        new TextUtils.StaticContentProvider.StaticContentProvider(
          this.contentURL(),
          this.contentType(),
          () => (
            e ||
              (e = (async () => {
                if (!this.scriptId)
                  return {
                    content: null,
                    error: ls`Script removed or deleted.`,
                    isEncoded: !1,
                  };
                try {
                  const e = await this.debuggerModel
                    .target()
                    .debuggerAgent()
                    .invoke_getScriptSource({ scriptId: this.scriptId });
                  if (e.getError()) throw new Error(e.getError());
                  const { scriptSource: t, bytecode: r } = e;
                  if (r) return { content: r, isEncoded: !0 };
                  let i = t || "";
                  return (
                    this.hasSourceURL && (i = Script._trimSourceURLComment(i)),
                    { content: i, isEncoded: !1 }
                  );
                } catch (e) {
                  return {
                    content: null,
                    error: ls`Unable to fetch script source.`,
                    isEncoded: !1,
                  };
                }
              })()),
            e
          )
        );
    }
    return this._originalContentProvider;
  }
  async searchInContent(e, t, r) {
    if (!this.scriptId) return [];
    return (
      (
        await this.debuggerModel
          .target()
          .debuggerAgent()
          .invoke_searchInContent({
            scriptId: this.scriptId,
            query: e,
            caseSensitive: t,
            isRegex: r,
          })
      ).result || []
    ).map(
      (e) =>
        new TextUtils.ContentProvider.SearchMatch(e.lineNumber, e.lineContent)
    );
  }
  _appendSourceURLCommentIfNeeded(e) {
    return this.hasSourceURL ? e + "\n //# sourceURL=" + this.sourceURL : e;
  }
  async editSource(e, t) {
    if (
      ((e = Script._trimSourceURLComment(e)),
      (e = this._appendSourceURLCommentIfNeeded(e)),
      !this.scriptId)
    )
      return void t("Script failed to parse");
    const { content: r } = await this.requestContent();
    if (r === e) return void t(null);
    const i = await this.debuggerModel
      .target()
      .debuggerAgent()
      .invoke_setScriptSource({ scriptId: this.scriptId, scriptSource: e });
    i.getError() ||
      i.exceptionDetails ||
      (this._contentPromise = Promise.resolve({ content: e, isEncoded: !1 }));
    const o = !!i.stackChanged;
    t(
      i.getError() || null,
      i.exceptionDetails,
      i.callFrames,
      i.asyncStackTrace,
      i.asyncStackTraceId,
      o
    );
  }
  rawLocation(e, t) {
    return this.containsLocation(e, t)
      ? new Location(this.debuggerModel, this.scriptId, e, t)
      : null;
  }
  toRelativeLocation(e) {
    console.assert(
      e.scriptId === this.scriptId,
      "`toRelativeLocation` must be used with location of the same script"
    );
    const t = e.lineNumber - this.lineOffset;
    return [t, (e.columnNumber || 0) - (0 === t ? this.columnOffset : 0)];
  }
  isInlineScript() {
    const e = !this.lineOffset && !this.columnOffset;
    return !this.isWasm() && !!this.sourceURL && !e;
  }
  isAnonymousScript() {
    return !this.sourceURL;
  }
  isInlineScriptWithSourceURL() {
    return !!this.hasSourceURL && this.isInlineScript();
  }
  async setBlackboxedRanges(e) {
    return !(
      await this.debuggerModel
        .target()
        .debuggerAgent()
        .invoke_setBlackboxedRanges({ scriptId: this.scriptId, positions: e })
    ).getError();
  }
  containsLocation(e, t) {
    const r =
        (e === this.lineOffset && t >= this.columnOffset) ||
        e > this.lineOffset,
      i = e < this.endLine || (e === this.endLine && t <= this.endColumn);
    return r && i;
  }
  get frameId() {
    return (
      "string" != typeof this[frameIdSymbol] &&
        (this[frameIdSymbol] = frameIdForScript(this)),
      this[frameIdSymbol] || ""
    );
  }
  createPageResourceLoadInitiator() {
    return {
      target: this.target(),
      frameId: this.frameId,
      initiatorUrl: this.embedderName(),
    };
  }
}
const frameIdSymbol = Symbol("frameid");
function frameIdForScript(e) {
  const t = e.executionContext();
  if (t) return t.frameId || "";
  const r = e.debuggerModel.target().model(ResourceTreeModel);
  return r && r.mainFrame ? r.mainFrame.id : "";
}
export const sourceURLRegex = /^[\040\t]*\/\/[@#] sourceURL=\s*(\S*?)\s*$/;

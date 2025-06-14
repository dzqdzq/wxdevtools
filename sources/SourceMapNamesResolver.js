import * as Bindings from "../bindings/bindings.js";
import * as Formatter from "../formatter/formatter.js";
import * as SDK from "../sdk/sdk.js";
import * as TextUtils from "../text_utils/text_utils.js";
import * as Workspace from "../workspace/workspace.js";
export const cachedMapSymbol = Symbol("cache");
export const cachedIdentifiersSymbol = Symbol("cachedIdentifiers");
export class Identifier {
  constructor(e, t, r) {
    this.name = e;
    this.lineNumber = t;
    this.columnNumber = r;
  }
}
export const scopeIdentifiers = (e) => {
  const t = e.startLocation();
  const r = e.endLocation();
  if (
    !(
      e.type() !== Protocol.Debugger.ScopeType.Global &&
      t &&
      r &&
      t.script() &&
      t.script().sourceMapURL &&
      t.script() === r.script()
    )
  ) {
    return Promise.resolve([]);
  }
  return t
    .script()
    .requestContent()
    .then((e) => {
      if (!e.content) {
        return Promise.resolve([]);
      }
      const e_content = e.content;
      const s = new TextUtils.Text.Text(e_content);

      const i = new TextUtils.TextRange.TextRange(
        t.lineNumber,
        t.columnNumber,
        r.lineNumber,
        r.columnNumber
      );

      const c = s.extract(i);
      const u = s.toSourceRange(i).offset;
      return Formatter.FormatterWorkerPool.formatterWorkerPool()
        .javaScriptIdentifiers(`function fui${c}`)
        .then(n.bind(null, s, u, "function fui"));
    });
  function n(e, t, r, n) {
    const o = [];
    const s = new TextUtils.TextCursor.TextCursor(e.lineEndings());

    for (const i of n) {
      if (i.offset < r.length) {
        continue;
      }
      const c = t + i.offset - r.length;
      s.resetTo(c);
      o.push(new Identifier(i.name, s.lineNumber(), s.columnNumber()));
    }

    return o;
  }
};
export const resolveScope = (e) => {
  let e_cachedIdentifiersSymbol = e[cachedIdentifiersSymbol];
  if (e_cachedIdentifiersSymbol) {
    return e_cachedIdentifiersSymbol;
  }
  const r = e.callFrame().script;

  const n =
    Bindings.DebuggerWorkspaceBinding.DebuggerWorkspaceBinding.instance().sourceMapForScript(
      r
    );

  if (!n) {
    return Promise.resolve(new Map());
  }
  const o = new Map();

  e_cachedIdentifiersSymbol = scopeIdentifiers(e).then((e) => {
    const t = new Map();

    for (const o of e) {
      const s = n.findEntry(o.lineNumber, o.columnNumber);

      if (s && s.name) {
        t.set(o.name, s.name);
      }
    }

    const r = [];

    for (const o of e) {
      if (t.has(o.name)) {
        continue;
      }
      const c = i(o).then(s.bind(null, t, o));
      r.push(c);
    }

    return Promise.all(r)
      .then(() => Sources.SourceMapNamesResolver._scopeResolvedForTest())
      .then(() => t);
  });

  e[cachedIdentifiersSymbol] = e_cachedIdentifiersSymbol;
  return e_cachedIdentifiersSymbol;
  function s(e, t, r) {
    if (r) {
      e.set(t.name, r);
    }
  }
  function i(e) {
    const t = n.findEntry(e.lineNumber, e.columnNumber);
    const s = n.findEntry(e.lineNumber, e.columnNumber + e.name.length);
    if (
      !(
        t &&
        s &&
        t.sourceURL &&
        t.sourceURL === s.sourceURL &&
        t.sourceLineNumber &&
        t.sourceColumnNumber &&
        s.sourceLineNumber &&
        s.sourceColumnNumber
      )
    ) {
      return Promise.resolve(null);
    }

    const i = new TextUtils.TextRange.TextRange(
      t.sourceLineNumber,
      t.sourceColumnNumber,
      s.sourceLineNumber,
      s.sourceColumnNumber
    );

    const c =
      Bindings.DebuggerWorkspaceBinding.DebuggerWorkspaceBinding.instance().uiSourceCodeForSourceMapSourceURL(
        r.debuggerModel,
        t.sourceURL,
        r.isContentScript()
      );

    return c
      ? c.requestContent().then((e) => {
          const e_content = e.content;
          return ((e, t) => {
            if (!t) {
              return null;
            }
            let r = o.get(t);

            if (!r) {
              r = new TextUtils.Text.Text(t);
              o.set(t, r);
            }

            const n = r.extract(e).trim();
            return /[a-zA-Z0-9_$]+/.test(n) ? n : null;
          })(i, e_content);
        })
      : Promise.resolve(null);
  }
};
export const allVariablesInCallFrame = (e) => {
  const e_cachedMapSymbol = e[cachedMapSymbol];
  if (e_cachedMapSymbol) {
    return Promise.resolve(e_cachedMapSymbol);
  }
  const r = [];
  const n = e.scopeChain();
  for (let e = 0; e < n.length; ++e) {
    r.push(resolveScope(n[e]));
  }
  return Promise.all(r).then((t) => {
    const r = new Map();
    for (const e of t) {
      for (const t of e.keys()) {
        const n = e.get(t);

        if (!r.has(n)) {
          r.set(n, t);
        }
      }
    }
    e[cachedMapSymbol] = r;
    return r;
  });
};
export const resolveExpression = (e, t, r, n, o, s) =>
  r.contentType().isFromSourceMap()
    ? allVariablesInCallFrame(e).then((i) =>
        ((e, i) => {
          if (i.has(t)) {
            return Promise.resolve(i.get(t) || "");
          }
          return resolveExpressionAsync(e, r, n, o, s);
        })(e.debuggerModel, i)
      )
    : Promise.resolve("");
export const resolveExpressionAsync = async (e, t, r, n, o) => {
  const s = (
    await Bindings.DebuggerWorkspaceBinding.DebuggerWorkspaceBinding.instance().uiLocationToRawLocations(
      t,
      r,
      n
    )
  ).find((t) => t.debuggerModel === e);
  if (!s) {
    return "";
  }
  const i = s.script();
  if (!i) {
    return "";
  }
  const c =
    Bindings.DebuggerWorkspaceBinding.DebuggerWorkspaceBinding.instance().sourceMapForScript(
      i
    );
  return c
    ? i.requestContent().then((e) => {
        const e_content = e.content;
        if (!e_content) {
          return Promise.resolve("");
        }
        const i = new TextUtils.Text.Text(e_content);

        const u = c.reverseMapTextRange(
          t.url(),
          new TextUtils.TextRange.TextRange(r, n, r, o)
        );

        if (!u) {
          return Promise.resolve("");
        }
        const l = i.extract(u);
        if (!l) {
          return Promise.resolve("");
        }
        return Formatter.FormatterWorkerPool.formatterWorkerPool().evaluatableJavaScriptSubstring(
          l
        );
      })
    : "";
};
export const resolveThisObject = (e) => {
  if (e) {
    if (e.scopeChain().length) {
      return resolveScope(e.scopeChain()[0]).then((r) => {
        const n = r.inverse().get("this");
        if (!n || n.size !== 1) {
          return Promise.resolve(e.thisObject());
        }
        const o = n.values().next().value;
        return e
          .evaluate({
            expression: o,
            objectGroup: "backtrace",
            includeCommandLineAPI: false,
            silent: true,
            returnByValue: false,
            generatePreview: true,
          })
          .then(t);
      });
    }

    return Promise.resolve(e.thisObject());
  }

  return Promise.resolve(null);
  function t(t) {
    return !t.exceptionDetails && t.object ? t.object : e.thisObject();
  }
};
export const resolveScopeInObject = (e) => {
  const t = e.startLocation();
  const r = e.endLocation();
  return e.type() !== Protocol.Debugger.ScopeType.Global &&
    t &&
    r &&
    t.script() &&
    t.script().sourceMapURL &&
    t.script() === r.script()
    ? new RemoteObject(e)
    : e.object();
};
export class RemoteObject extends SDK.RemoteObject.RemoteObject {
  constructor(e) {
    super();
    this._scope = e;
    this._object = e.object();
  }
  customPreview() {
    return this._object.customPreview();
  }
  get objectId() {
    return this._object.objectId;
  }
  get type() {
    return this._object.type;
  }
  get subtype() {
    return this._object.subtype;
  }
  get value() {
    return this._object.value;
  }
  get description() {
    return this._object.description;
  }
  get hasChildren() {
    return this._object.hasChildren;
  }
  get preview() {
    return this._object.preview;
  }
  arrayLength() {
    return this._object.arrayLength();
  }
  getOwnProperties(e) {
    return this._object.getOwnProperties(e);
  }
  async getAllProperties(e, t) {
    const r = await this._object.getAllProperties(e, t);
    const n = await resolveScope(this._scope);

    const { properties, internalProperties } = r;

    const i = [];
    if (properties) {
      properties.forEach((t, e) => {
        const r = n.get(t.name) || properties[e].name;
        i.push(
          new SDK.RemoteObject.RemoteObjectProperty(
            r,
            t.value,
            t.enumerable,
            t.writable,
            t.isOwn,
            t.wasThrown,
            t.symbol,
            t.synthetic
          )
        );
      });
    }
    return { properties: i, internalProperties: internalProperties };
  }
  async setPropertyValue(e, t) {
    const r = await resolveScope(this._scope);
    let n;
    n = typeof e == "string" ? e : e.value;
    let o = n;
    for (const e of r.keys()) {
      if (r.get(e) === n) {
        o = e;
        break;
      }
    }
    return this._object.setPropertyValue(o, t);
  }
  async deleteProperty(e) {
    return this._object.deleteProperty(e);
  }
  callFunction(e, t) {
    return this._object.callFunction(e, t);
  }
  callFunctionJSON(e, t) {
    return this._object.callFunctionJSON(e, t);
  }
  release() {
    this._object.release();
  }
  debuggerModel() {
    return this._object.debuggerModel();
  }
  runtimeModel() {
    return this._object.runtimeModel();
  }
  isNode() {
    return this._object.isNode();
  }
}

import * as Common from "../common/common.js";
import * as SDK from "../sdk/sdk.js";
import * as TextUtils from "../text_utils/text_utils.js";
import * as Workspace from "../workspace/workspace.js";
import { BlackboxManager } from "./BlackboxManager.js";
import { ContentProviderBasedProject } from "./ContentProviderBasedProject.js";
import {
  DebuggerSourceMapping,
  DebuggerWorkspaceBinding,
} from "./DebuggerWorkspaceBinding.js";
import { NetworkProject } from "./NetworkProject.js";
export class CompilerScriptMapping {
  constructor(e, t, r) {
    this._debuggerModel = e;
    this._sourceMapManager = this._debuggerModel.sourceMapManager();
    this._workspace = t;
    this._debuggerWorkspaceBinding = r;
    const o = e.target();

    this._regularProject = new ContentProviderBasedProject(
      t,
      `jsSourceMaps::${o.id()}`,
      Workspace.Workspace.projectTypes.Network,
      "",
      false
    );

    this._contentScriptsProject = new ContentProviderBasedProject(
      t,
      `jsSourceMaps:extensions:${o.id()}`,
      Workspace.Workspace.projectTypes.ContentScripts,
      "",
      false
    );

    NetworkProject.setTargetForProject(this._regularProject, o);
    NetworkProject.setTargetForProject(this._contentScriptsProject, o);
    this._regularBindings = new Map();
    this._contentScriptsBindings = new Map();
    this._stubUISourceCodes = new Map();

    this._stubProject = new ContentProviderBasedProject(
      t,
      `jsSourceMaps:stub:${o.id()}`,
      Workspace.Workspace.projectTypes.Service,
      "",
      true
    );

    this._eventListeners = [
      this._sourceMapManager.addEventListener(
        SDK.SourceMapManager.Events.SourceMapWillAttach,
        (e) => {
          this._sourceMapWillAttach(e);
        },
        this
      ),
      this._sourceMapManager.addEventListener(
        SDK.SourceMapManager.Events.SourceMapFailedToAttach,
        (e) => {
          this._sourceMapFailedToAttach(e);
        },
        this
      ),
      this._sourceMapManager.addEventListener(
        SDK.SourceMapManager.Events.SourceMapAttached,
        (e) => {
          this._sourceMapAttached(e);
        },
        this
      ),
      this._sourceMapManager.addEventListener(
        SDK.SourceMapManager.Events.SourceMapDetached,
        (e) => {
          this._sourceMapDetached(e);
        },
        this
      ),
    ];
  }
  _addStubUISourceCode(e) {
    const t = this._stubProject.addContentProvider(
      `${e.sourceURL}:sourcemap`,
      TextUtils.StaticContentProvider.StaticContentProvider.fromString(
        e.sourceURL,
        Common.ResourceType.resourceTypes.Script,
        "\n\n\n\n\n// Please wait a bit.\n// Compiled script is not shown while source map is being loaded!"
      ),
      "text/javascript"
    );
    this._stubUISourceCodes.set(e, t);
  }
  async _removeStubUISourceCode(e) {
    const t = this._stubUISourceCodes.get(e);
    this._stubUISourceCodes.delete(e);

    if (t) {
      this._stubProject.removeFile(t.url());
    }

    await this._debuggerWorkspaceBinding.updateLocations(e);
  }
  static uiSourceCodeOrigin(e) {
    const e_sourceMapSymbol = e[_sourceMapSymbol];
    return e_sourceMapSymbol ? e_sourceMapSymbol.compiledURL() : null;
  }
  mapsToSourceCode(e) {
    const t = e.script();
    const r = t ? this._sourceMapManager.sourceMapForClient(t) : null;
    if (!r) {
      return true;
    }
    const o = r.findEntry(e.lineNumber, e.columnNumber);
    return (
      !!o && o.lineNumber === e.lineNumber && o.columnNumber === e.columnNumber
    );
  }
  uiSourceCodeForURL(e, t) {
    return t
      ? this._contentScriptsProject.uiSourceCodeForURL(e)
      : this._regularProject.uiSourceCodeForURL(e);
  }
  rawLocationToUILocation(e) {
    const t = e.script();
    if (!t) {
      return null;
    }
    const r = e.lineNumber - t.lineOffset;
    let e_columnNumber = e.columnNumber;

    if (!r) {
      e_columnNumber -= t.columnOffset;
    }

    const s = this._stubUISourceCodes.get(t);
    if (s) {
      return new Workspace.UISourceCode.UILocation(s, r, e_columnNumber);
    }
    const c = this._sourceMapManager.sourceMapForClient(t);
    if (!c) {
      return null;
    }
    const i = c.findEntry(r, e_columnNumber);
    if (!i || !i.sourceURL) {
      return null;
    }
    const n = t.isContentScript()
      ? this._contentScriptsProject.uiSourceCodeForURL(i.sourceURL)
      : this._regularProject.uiSourceCodeForURL(i.sourceURL);
    return n ? n.uiLocation(i.sourceLineNumber, i.sourceColumnNumber) : null;
  }
  uiLocationToRawLocations(e, t, r) {
    const e_sourceMapSymbol = e[_sourceMapSymbol];
    if (!e_sourceMapSymbol) {
      return [];
    }
    const s = this._sourceMapManager.clientsForSourceMap(e_sourceMapSymbol);
    if (!s.length) {
      return [];
    }
    const c = e_sourceMapSymbol.sourceLineMapping(e.url(), t, r);
    return c
      ? s.map((e) =>
          this._debuggerModel.createRawLocation(
            e,
            c.lineNumber + e.lineOffset,
            c.lineNumber ? c.columnNumber : c.columnNumber + e.columnOffset
          )
        )
      : [];
  }
  async _sourceMapWillAttach(e) {
    const e_data = e.data;
    this._addStubUISourceCode(e_data);
    await this._debuggerWorkspaceBinding.updateLocations(e_data);
  }
  async _sourceMapFailedToAttach(e) {
    const e_data = e.data;
    await this._removeStubUISourceCode(e_data);
  }
  async _sourceMapAttached(e) {
    const t = e.data.client;
    const r = e.data.sourceMap;
    await this._removeStubUISourceCode(t);

    if (
      !BlackboxManager.instance().isBlackboxedURL(
        t.sourceURL,
        t.isContentScript()
      )
    ) {
      await this._populateSourceMapSources(t, r);
    }

    this._sourceMapAttachedForTest(r);
  }
  async _sourceMapDetached(e) {
    const t = e.data.client;
    const r = e.data.sourceMap;

    const o = t.isContentScript()
      ? this._contentScriptsBindings
      : this._regularBindings;

    for (const e of r.sourceURLs()) {
      const s = o.get(e);

      if (s) {
        s.removeSourceMap(r, t.frameId), s._uiSourceCode || o.delete(e);
      }
    }
    await this._debuggerWorkspaceBinding.updateLocations(t);
  }
  sourceMapForScript(e) {
    return this._sourceMapManager.sourceMapForClient(e);
  }
  _sourceMapAttachedForTest(e) {}
  async _populateSourceMapSources(e, t) {
    const r = e.isContentScript()
      ? this._contentScriptsProject
      : this._regularProject;

    const o = e.isContentScript()
      ? this._contentScriptsBindings
      : this._regularBindings;

    for (const s of t.sourceURLs()) {
      let c = o.get(s);

      if (!c) {
        (c = new Binding(r, s)), o.set(s, c);
      }

      c.addSourceMap(t, e.frameId);
    }
    await this._debuggerWorkspaceBinding.updateLocations(e);
  }
  static uiLineHasMapping(e, t) {
    const e_sourceMapSymbol = e[_sourceMapSymbol];
    return (
      !e_sourceMapSymbol || !!e_sourceMapSymbol.sourceLineMapping(e.url(), t, 0)
    );
  }
  dispose() {
    Common.EventTarget.EventTarget.removeEventListeners(this._eventListeners);
    this._regularProject.dispose();
    this._contentScriptsProject.dispose();
    this._stubProject.dispose();
  }
}
const _sourceMapSymbol = Symbol("_sourceMapSymbol");
class Binding {
  constructor(e, t) {
    this._project = e;
    this._url = t;
    this._referringSourceMaps = [];
    this._activeSourceMap = null;
    this._uiSourceCode = null;
  }
  _recreateUISourceCodeIfNeeded(e) {
    const t = this._referringSourceMaps.peekLast();
    if (this._activeSourceMap === t) {
      return;
    }
    this._activeSourceMap = t;
    const r = this._project.createUISourceCode(
      this._url,
      Common.ResourceType.resourceTypes.SourceMapScript
    );
    r[_sourceMapSymbol] = t;

    const o = t.sourceContentProvider(
      this._url,
      Common.ResourceType.resourceTypes.SourceMapScript
    );

    const s =
      Common.ResourceType.ResourceType.mimeFromURL(this._url) ||
      "text/javascript";

    const c = t.embeddedContentByURL(this._url);

    const i =
      typeof c == "string"
        ? new Workspace.UISourceCode.UISourceCodeMetadata(null, c.length)
        : null;

    if (this._uiSourceCode) {
      NetworkProject.cloneInitialFrameAttribution(this._uiSourceCode, r),
        this._project.removeFile(this._uiSourceCode.url());
    } else {
      NetworkProject.setInitialFrameAttribution(r, e);
    }

    this._uiSourceCode = r;
    this._project.addUISourceCodeWithProvider(this._uiSourceCode, o, i, s);
  }
  addSourceMap(e, t) {
    if (this._uiSourceCode) {
      NetworkProject.addFrameAttribution(this._uiSourceCode, t);
    }

    this._referringSourceMaps.push(e);
    this._recreateUISourceCodeIfNeeded(t);
  }
  removeSourceMap(e, t) {
    NetworkProject.removeFrameAttribution(this._uiSourceCode, t);
    const r = this._referringSourceMaps.lastIndexOf(e);

    if (-1 !== r) {
      this._referringSourceMaps.splice(r, 1);
    }

    if (this._referringSourceMaps.length) {
      this._recreateUISourceCodeIfNeeded(t);
    } else {
      this._project.removeFile(this._uiSourceCode.url()),
        (this._uiSourceCode = null);
    }
  }
}

import * as Bindings from "../bindings/bindings.js";
import * as Components from "../components/components.js";
import * as SDK from "../sdk/sdk.js";
import * as SourceFrame from "../source_frame/source_frame.js";
import * as UI from "../ui/ui.js";
import * as Workspace from "../workspace/workspace.js";
import { Plugin } from "./Plugin.js";
export class ScriptOriginPlugin extends Plugin {
  constructor(i, r) {
    super();
    this._textEditor = i;
    this._uiSourceCode = r;
  }
  static accepts(i) {
    return i.contentType().hasScripts() || !!ScriptOriginPlugin._script(i);
  }
  async rightToolbarItems() {
    const i =
      Bindings.CompilerScriptMapping.CompilerScriptMapping.uiSourceCodeOrigin(
        this._uiSourceCode
      );
    if (i) {
      const r = UI.UIUtils.formatLocalized("(source mapped from %s)", [
        Components.Linkifier.Linkifier.linkifyURL(i),
      ]);
      return [new UI.Toolbar.ToolbarItem(r)];
    }
    const r = await ScriptOriginPlugin._script(this._uiSourceCode);
    if (!r || !r.originStackTrace) {
      return [];
    }
    const o = linkifier.linkifyStackTraceTopFrame(
      r.debuggerModel.target(),
      r.originStackTrace
    );
    return [new UI.Toolbar.ToolbarItem(o)];
  }
  static async _script(i) {
    const r =
      await Bindings.DebuggerWorkspaceBinding.DebuggerWorkspaceBinding.instance().uiLocationToRawLocations(
        i,
        0,
        0
      );
    for (const i of r) {
      const r = i.script();
      if (r && r.originStackTrace) {
        return r;
      }
    }
    return null;
  }
}
export const linkifier = new Components.Linkifier.Linkifier();

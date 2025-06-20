import * as Common from "../common/common.js";
import * as Host from "../host/host.js";
import * as Snippets from "../snippets/snippets.js";
import * as SourceFrame from "../source_frame/source_frame.js";
import * as UI from "../ui/ui.js";
import * as Workspace from "../workspace/workspace.js";
import { Plugin } from "./Plugin.js";
export class SnippetsPlugin extends Plugin {
  constructor(o, t) {
    super();
    this._textEditor = o;
    this._uiSourceCode = t;
  }
  static accepts(o) {
    return Snippets.ScriptSnippetFileSystem.isSnippetsUISourceCode(o);
  }
  async rightToolbarItems() {
    const o = UI.Toolbar.Toolbar.createActionButtonForId(
      "debugger.run-snippet"
    );

    o.setText(
      Host.Platform.isMac()
        ? Common.UIString.UIString("⌘+Enter")
        : Common.UIString.UIString("Ctrl+Enter")
    );

    return [o];
  }
}

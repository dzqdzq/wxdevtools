import * as UI from "../ui/ui.js";
import * as Workspace from "../workspace/workspace.js";
export class Plugin {
  static accepts(e) {
    return false;
  }
  wasShown() {}
  willHide() {}
  async rightToolbarItems() {
    return [];
  }
  leftToolbarItems() {
    return [];
  }
  populateLineGutterContextMenu(e, r) {
    return Promise.resolve();
  }
  populateTextAreaContextMenu(e, r, t) {
    return Promise.resolve();
  }
  dispose() {}
}

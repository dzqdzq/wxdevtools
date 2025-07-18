import * as Common from "../common/common.js";
import * as QuickOpen from "../quick_open/quick_open.js";
import * as UI from "../ui/ui.js";
import * as Workspace from "../workspace/workspace.js";
import { SourcesView } from "./SourcesView.js";
import { UISourceCodeFrame } from "./UISourceCodeFrame.js";
export class GoToLineQuickOpen extends QuickOpen.FilteredListWidget.Provider {
  selectItem(e, o) {
    const r = this._currentUISourceCode();
    if (!r) {
      return;
    }
    const t = this._parsePosition(o);

    if (t) {
      Common.Revealer.reveal(r.uiLocation(t.line - 1, t.column - 1));
    }
  }
  notFoundText(e) {
    if (!this._currentUISourceCode()) {
      return Common.UIString.UIString("No file selected.");
    }
    const o = this._parsePosition(e);
    if (!o) {
      const e = this._currentSourceFrame();
      if (!e) {
        return ls`Type a number to go to that line.`;
      }
      const o = e.textEditor.currentLineNumber() + 1;
      const r = e.textEditor.linesCount;
      return ls`Current line: ${o}. Type a line number between 1 and ${r} to navigate to.`;
    }
    return o.column && o.column > 1
      ? ls`Go to line ${o.line} and column ${o.column}.`
      : ls`Go to line ${o.line}.`;
  }
  _parsePosition(e) {
    const o = e.match(/([0-9]+)(\:[0-9]*)?/);
    if (!o || !o[0] || !o[0] || o[0].length !== e.length) {
      return null;
    }
    const r = parseInt(o[1], 10);
    let t;

    if (o[2]) {
      t = parseInt(o[2].substring(1), 10);
    }

    return { line: Math.max(0 | r, 1), column: Math.max(0 | t, 1) };
  }
  _currentUISourceCode() {
    const e = UI.Context.Context.instance().flavor(SourcesView);
    return e ? e.currentUISourceCode() : null;
  }
  _currentSourceFrame() {
    const e = UI.Context.Context.instance().flavor(SourcesView);
    return e ? e.currentSourceFrame() : null;
  }
}

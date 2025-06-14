import * as Common from "../common/common.js";
import * as Formatter from "../formatter/formatter.js";
import * as QuickOpen from "../quick_open/quick_open.js";
import * as UI from "../ui/ui.js";
import * as Workspace from "../workspace/workspace.js";
import { SourcesView } from "./SourcesView.js";
export class OutlineQuickOpen extends QuickOpen.FilteredListWidget.Provider {
  constructor() {
    super();
    this._items = [];
    this._active = false;
  }
  attach() {
    this._items = [];
    this._active = false;
    const t = this._currentUISourceCode();

    if (t) {
      this._active =
        Formatter.FormatterWorkerPool.formatterWorkerPool().outlineForMimetype(
          t.workingCopy(),
          t.contentType().canonicalMimeType(),
          this._didBuildOutlineChunk.bind(this)
        );
    }
  }
  _didBuildOutlineChunk(t, e) {
    this._items.push(...e);
    this.refresh();
  }
  itemCount() {
    return this._items.length;
  }
  itemKeyAt(t) {
    const e = this._items[t];
    return e.title + (e.subtitle ? e.subtitle : "");
  }
  itemScoreAt(t, e) {
    const i = this._items[t];
    return e.split("(")[0].toLowerCase() === i.title.toLowerCase()
      ? 1 / (1 + i.line)
      : -i.line - 1;
  }
  renderItem(t, e, i, o) {
    const r = this._items[t];
    i.textContent = r.title + (r.subtitle ? r.subtitle : "");
    QuickOpen.FilteredListWidget.FilteredListWidget.highlightRanges(i, e);
    o.textContent = `:${r.line + 1}`;
  }
  selectItem(t, e) {
    if (t === null) {
      return;
    }
    const i = this._currentUISourceCode();
    if (!i) {
      return;
    }
    const o = this._items[t].line;

    if (!isNaN(o) && o >= 0) {
      Common.Revealer.reveal(i.uiLocation(o, this._items[t].column));
    }
  }
  _currentUISourceCode() {
    const t = UI.Context.Context.instance().flavor(SourcesView);
    return t ? t.currentUISourceCode() : null;
  }
  notFoundText() {
    if (this._currentUISourceCode()) {
      if (this._active) {
        return Common.UIString.UIString("No results found");
      }

      return Common.UIString.UIString(
        "Open a JavaScript or CSS file to see symbols"
      );
    }

    return Common.UIString.UIString("No file selected.");
  }
}

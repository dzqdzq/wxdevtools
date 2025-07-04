import * as Common from "../common/common.js";
import * as Formatter from "../formatter/formatter.js";
import * as UI from "../ui/ui.js";
import * as Workspace from "../workspace/workspace.js";
import { EditorAction, Events, SourcesView } from "./SourcesView.js";
export class InplaceFormatterEditorAction {
  _editorSelected(t) {
    const e = t.data;
    this._updateButton(e);
  }
  _editorClosed(t) {
    if (t.data.wasSelected) {
      this._updateButton(null);
    }
  }
  _updateButton(t) {
    const e = this._isFormattable(t);
    this._button.element.classList.toggle("hidden", !e);

    if (e) {
      this._button.setTitle(Common.UIString.UIString(`Format ${t.name()}`));
    }
  }
  button(t) {
    if (!this._button) {
      this._sourcesView = t;

      this._sourcesView.addEventListener(
        Events.EditorSelected,
        this._editorSelected.bind(this)
      );

      this._sourcesView.addEventListener(
        Events.EditorClosed,
        this._editorClosed.bind(this)
      );

      this._button = new UI.Toolbar.ToolbarButton(
        Common.UIString.UIString("Format"),
        "largeicon-pretty-print"
      );

      this._button.addEventListener(
        UI.Toolbar.ToolbarButton.Events.Click,
        this._formatSourceInPlace,
        this
      );

      this._updateButton(t.currentUISourceCode());
    }

    return this._button;
  }
  _isFormattable(t) {
    return (
      !!t &&
      (!!t.project().canSetFileContent() ||
        !!self.Persistence.persistence.binding(t) ||
        !!self.Persistence.persistence.binding(t) ||
        t.contentType().isStyleSheet())
    );
  }
  _formatSourceInPlace(t) {
    const e = this._sourcesView.currentUISourceCode();

    if (this._isFormattable(e)) {
      if (e.isDirty()) {
        this._contentLoaded(e, e.workingCopy());
      } else {
        e.requestContent().then((t) => {
          this._contentLoaded(e, t.content);
        });
      }
    }
  }
  _contentLoaded(t, e) {
    const o = t.mimeType();
    Formatter.ScriptFormatter.FormatterInterface.format(
      t.contentType(),
      o,
      e,
      (e, o) => {
        this._formattingComplete(t, e, o);
      }
    );
  }
  _formattingComplete(t, e, o) {
    if (t.workingCopy() === e) {
      return;
    }
    const r = this._sourcesView.viewForFile(t);
    let i = [0, 0];
    if (r) {
      const t = r.selection();
      i = o.originalToFormatted(t.startLine, t.startColumn);
    }
    t.setWorkingCopy(e);
    this._sourcesView.showSourceLocation(t, i[0], i[1]);
  }
}

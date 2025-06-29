import * as Common from "../common/common.js";
import * as FormatterModule from "../formatter/formatter.js";
import * as UI from "../ui/ui.js";
import * as Workspace from "../workspace/workspace.js";
import { EditorAction, Events, SourcesView } from "./SourcesView.js";
export class ScriptFormatterEditorAction {
  constructor() {
    this._pathsToFormatOnLoad = new Set();
  }
  _editorSelected(t) {
    const o = t.data;
    this._updateButton(o);

    if (
      this._isFormatableScript(o) &&
      this._pathsToFormatOnLoad.has(o.url()) &&
      !FormatterModule.sourceFormatter.hasFormatted(o)
    ) {
      this._showFormatted(o);
    }
  }
  async _editorClosed(t) {
    const o = t.data.uiSourceCode;

    if (t.data.wasSelected) {
      this._updateButton(null);
    }

    const e =
      await FormatterModule.sourceFormatter.discardFormattedUISourceCode(o);

    if (e) {
      this._pathsToFormatOnLoad.delete(e.url());
    }
  }
  _updateButton(t) {
    const o = this._isFormatableScript(t);
    this._button.element.classList.toggle("hidden", !o);

    if (t) {
      this._button.setTitle(
        Common.UIString.UIString(`Pretty print ${t.name()}`)
      );
    }
  }
  button(t) {
    if (!this._button) {
      this._sourcesView = t;

      this._sourcesView.addEventListener(Events.EditorSelected, (t) => {
        this._editorSelected(t);
      });

      this._sourcesView.addEventListener(Events.EditorClosed, (t) => {
        this._editorClosed(t);
      });

      this._button = new UI.Toolbar.ToolbarButton(
        Common.UIString.UIString("Pretty print"),
        "largeicon-pretty-print"
      );

      this._button.addEventListener(
        UI.Toolbar.ToolbarButton.Events.Click,
        this.toggleFormatScriptSource,
        this
      );

      this._updateButton(t.currentUISourceCode());
    }

    return this._button;
  }
  _isFormatableScript(t) {
    return (
      !!t &&
      !t.project().canSetFileContent() &&
      t.project().type() !== Workspace.Workspace.projectTypes.Formatter &&
      !self.Persistence.persistence.binding(t) &&
      t.mimeType() !== "application/wasm" &&
      t.contentType().hasScripts()
    );
  }
  isCurrentUISourceCodeFormatable() {
    const t = this._sourcesView.currentUISourceCode();
    return this._isFormatableScript(t);
  }
  toggleFormatScriptSource(t) {
    const o = this._sourcesView.currentUISourceCode();

    if (this._isFormatableScript(o)) {
      this._pathsToFormatOnLoad.add(o.url());
      this._showFormatted(o);
    }
  }
  async _showFormatted(t) {
    const o = await FormatterModule.sourceFormatter.format(t);
    if (t !== this._sourcesView.currentUISourceCode()) {
      return;
    }
    const e = this._sourcesView.viewForFile(t);
    let r = [0, 0];
    if (e) {
      const t = e.selection();
      r = o.mapping.originalToFormatted(t.startLine, t.startColumn);
    }
    this._sourcesView.showSourceLocation(o.formattedSourceCode, r[0], r[1]);
  }
}

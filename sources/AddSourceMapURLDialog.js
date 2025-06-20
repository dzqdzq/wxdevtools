import * as Common from "../common/common.js";
import * as UI from "../ui/ui.js";
export class AddSourceMapURLDialog extends UI.Widget.HBox {
  constructor(t) {
    super(true);
    this.registerRequiredCSS("sources/dialog.css");
    this.contentElement.createChild("label").textContent =
      Common.UIString.UIString("Source map URL: ");
    this._input = UI.UIUtils.createInput("add-source-map", "text");
    this._input.addEventListener("keydown", this._onKeyDown.bind(this), false);
    this.contentElement.appendChild(this._input);
    const e = UI.UIUtils.createTextButton(ls`Add`, this._apply.bind(this));
    this.contentElement.appendChild(e);
    this._dialog = new UI.Dialog.Dialog();
    this._dialog.setSizeBehavior(UI.GlassPane.SizeBehavior.MeasureContent);
    this._dialog.setDefaultFocusedElement(this._input);

    this._done = function (e) {
      this._dialog.hide();
      t(e);
    };
  }
  show() {
    super.show(this._dialog.contentElement);
    this._dialog.show();
  }
  _apply() {
    this._done(this._input.value);
  }
  _onKeyDown(t) {
    if (isEnterKey(t)) {
      t.consume(true);
      this._apply();
    }
  }
}

import * as Common from "../common/common.js";
import * as Platform from "../platform/platform.js";
import * as TextUtils from "../text_utils/text_utils.js";
import * as UI from "../ui/ui.js";
export class FontView extends UI.View.SimpleView {
  constructor(e, t) {
    super(Common.UIString.UIString("Font"));
    this.registerRequiredCSS("source_frame/fontView.css");
    this.element.classList.add("font-view");
    this._url = t.contentURL();

    UI.ARIAUtils.setAccessibleName(
      this.element,
      ls`Preview of font from ${this._url}`
    );

    this._mimeType = e;
    this._contentProvider = t;
    this._mimeTypeLabel = new UI.Toolbar.ToolbarText(e);
  }
  async toolbarItems() {
    return [this._mimeTypeLabel];
  }
  _onFontContentLoaded(e, t) {
    const { content } = t;

    const n = content
      ? TextUtils.ContentProvider.contentAsDataURL(
          content,
          this._mimeType,
          true
        )
      : this._url;

    this.fontStyleElement.textContent = Platform.StringUtilities.sprintf(
      '@font-face { font-family: "%s"; src: url(%s); }',
      e,
      n
    );

    this.updateFontPreviewSize();
  }
  _createContentIfNeeded() {
    if (this.fontPreviewElement) {
      return;
    }
    const e = `WebInspectorFontPreview${++_fontId}`;
    this.fontStyleElement = createElement("style");

    this._contentProvider.requestContent().then((t) => {
      this._onFontContentLoaded(e, t);
    });

    this.element.appendChild(this.fontStyleElement);
    const t = createElement("div");
    for (let e = 0; e < _fontPreviewLines.length; ++e) {
      if (e > 0) {
        t.createChild("br");
      }

      t.createTextChild(_fontPreviewLines[e]);
    }
    this.fontPreviewElement = t.cloneNode(true);
    UI.ARIAUtils.markAsHidden(this.fontPreviewElement);
    this.fontPreviewElement.style.overflow = "hidden";
    this.fontPreviewElement.style.setProperty("font-family", e);
    this.fontPreviewElement.style.setProperty("visibility", "hidden");
    this._dummyElement = t;
    this._dummyElement.style.visibility = "hidden";
    this._dummyElement.style.zIndex = "-1";
    this._dummyElement.style.display = "inline";
    this._dummyElement.style.position = "absolute";
    this._dummyElement.style.setProperty("font-family", e);

    this._dummyElement.style.setProperty("font-size", `${_measureFontSize}px`);

    this.element.appendChild(this.fontPreviewElement);
  }
  wasShown() {
    this._createContentIfNeeded();
    this.updateFontPreviewSize();
  }
  onResize() {
    if (!this._inResize) {
      this._inResize = true;
      try {
        this.updateFontPreviewSize();
      } finally {
        delete this._inResize;
      }
    }
  }
  _measureElement() {
    this.element.appendChild(this._dummyElement);
    const e = {
      width: this._dummyElement.offsetWidth,
      height: this._dummyElement.offsetHeight,
    };
    this.element.removeChild(this._dummyElement);
    return e;
  }
  updateFontPreviewSize() {
    if (!this.fontPreviewElement || !this.isShowing()) {
      return;
    }
    this.fontPreviewElement.style.removeProperty("visibility");

    const { height, width } = this._measureElement();

    const n = this.element.offsetWidth - 50;
    const s = this.element.offsetHeight - 30;
    if (!(height && width && n && s)) {
      return void this.fontPreviewElement.style.removeProperty("font-size");
    }
    const o = n / width;
    const r = s / height;
    const m = Math.floor(_measureFontSize * Math.min(o, r)) - 2;
    this.fontPreviewElement.style.setProperty("font-size", `${m}px`, null);
  }
}
let _fontId = 0;

const _fontPreviewLines = [
  "ABCDEFGHIJKLM",
  "NOPQRSTUVWXYZ",
  "abcdefghijklm",
  "nopqrstuvwxyz",
  "1234567890",
];

const _measureFontSize = 50;

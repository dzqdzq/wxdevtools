import * as ColorPicker from "../color_picker/color_picker.js";
import * as Common from "../common/common.js";
import * as InlineEditor from "../inline_editor/inline_editor.js";
import * as Platform from "../platform/platform.js";
import * as SDK from "../sdk/sdk.js";
import * as SourceFrame from "../source_frame/source_frame.js";
import * as TextUtils from "../text_utils/text_utils.js";
import * as UI from "../ui/ui.js";
import * as Workspace from "../workspace/workspace.js";
import { Plugin } from "./Plugin.js";
export class CSSPlugin extends Plugin {
  constructor(t) {
    super();
    this._textEditor = t;
    this._swatchPopoverHelper =
      new InlineEditor.SwatchPopoverHelper.SwatchPopoverHelper();
    this._muteSwatchProcessing = false;
    this._hadSwatchChange = false;
    this._bezierEditor = null;
    this._editedSwatchTextRange = null;
    this._spectrum = null;
    this._currentSwatch = null;

    this._textEditor.configureAutocomplete({
      suggestionsCallback: this._cssSuggestions.bind(this),
      isWordChar: this._isWordChar.bind(this),
    });

    this._textEditor.addEventListener(
      SourceFrame.SourcesTextEditor.Events.ScrollChanged,
      this._textEditorScrolled,
      this
    );

    this._textEditor.addEventListener(
      UI.TextEditor.Events.TextChanged,
      this._onTextChanged,
      this
    );

    this._updateSwatches(0, this._textEditor.linesCount - 1);
    this._shortcuts = {};
    this._registerShortcuts();
    this._boundHandleKeyDown = this._handleKeyDown.bind(this);

    this._textEditor.element.addEventListener(
      "keydown",
      this._boundHandleKeyDown,
      false
    );
  }
  static accepts(t) {
    return t.contentType().isStyleSheet();
  }
  _registerShortcuts() {
    const t = UI.ShortcutsScreen.SourcesPanelShortcuts;
    for (const e of t.IncreaseCSSUnitByOne) {
      this._shortcuts[e.key] = this._handleUnitModification.bind(this, 1);
    }
    for (const e of t.DecreaseCSSUnitByOne) {
      this._shortcuts[e.key] = this._handleUnitModification.bind(this, -1);
    }
    for (const e of t.IncreaseCSSUnitByTen) {
      this._shortcuts[e.key] = this._handleUnitModification.bind(this, 10);
    }
    for (const e of t.DecreaseCSSUnitByTen) {
      this._shortcuts[e.key] = this._handleUnitModification.bind(this, -10);
    }
  }
  _handleKeyDown(t) {
    const e = UI.KeyboardShortcut.KeyboardShortcut.makeKeyFromEvent(t);
    const i = this._shortcuts[e];

    if (i && i()) {
      t.consume(true);
    }
  }
  _textEditorScrolled() {
    if (this._swatchPopoverHelper.isShowing()) {
      this._swatchPopoverHelper.hide(true);
    }
  }
  _modifyUnit(t, e) {
    const i = parseInt(t, 10);
    if (isNaN(i)) {
      return null;
    }
    const o = t.substring(i.toString().length);
    return Platform.StringUtilities.sprintf("%d%s", i + e, o);
  }
  _handleUnitModification(t) {
    const e = this._textEditor.selection().normalize();
    let i = this._textEditor.tokenAtTextPosition(e.startLine, e.startColumn);
    if (
      !i &&
      (e.startColumn > 0 &&
        (i = this._textEditor.tokenAtTextPosition(
          e.startLine,
          e.startColumn - 1
        )),
      !i)
    ) {
      return false;
    }
    if (i.type !== "css-number") {
      return false;
    }

    const o = new TextUtils.TextRange.TextRange(
      e.startLine,
      i.startColumn,
      e.startLine,
      i.endColumn
    );

    const r = this._textEditor.text(o);
    const s = this._modifyUnit(r, t);
    return (
      !!s &&
      (this._textEditor.editRange(o, s),
      (e.startColumn = i.startColumn),
      (e.endColumn = e.startColumn + s.length),
      this._textEditor.setSelection(e),
      true)
    );
  }
  _updateSwatches(t, e) {
    const i = [];
    const o = [];

    const r = [
      SDK.CSSMetadata.VariableRegex,
      SDK.CSSMetadata.URLRegex,
      UI.Geometry.CubicBezier.Regex,
      Common.Color.Regex,
    ];

    const s = new Map();
    s.set(Common.Color.Regex, this._createColorSwatch.bind(this));
    s.set(UI.Geometry.CubicBezier.Regex, this._createBezierSwatch.bind(this));
    for (let n = t; n <= e; n++) {
      const t = this._textEditor
        .line(n)
        .substring(0, maxSwatchProcessingLength);

      const e = TextUtils.TextUtils.Utils.splitStringByRegexes(t, r);

      for (const a of e) {
        if (-1 === a.regexIndex || !s.has(r[a.regexIndex])) {
          continue;
        }
        const c = /[\s:;,(){}]/;
        const d = a.position - 1;
        const l = a.position + a.value.length;
        if (
          (d >= 0 && !c.test(t.charAt(d))) ||
          (l < t.length && !c.test(t.charAt(l)))
        ) {
          continue;
        }
        const u = s.get(r[a.regexIndex])(a.value);

        if (u) {
          i.push(u);

          o.push(
            TextUtils.TextRange.TextRange.createFromLocation(n, a.position)
          );
        }
      }
    }
    this._textEditor.operation(() => {
      const r = new TextUtils.TextRange.TextRange(
        t,
        0,
        e,
        this._textEditor.line(e).length
      );
      this._textEditor.bookmarks(r, SwatchBookmark).forEach((t) => t.clear());

      i.forEach((e, t) => {
        const r = o[t];

        const s = this._textEditor.addBookmark(
          r.startLine,
          r.startColumn,
          e,
          SwatchBookmark
        );

        e[SwatchBookmark] = s;
      });
    });
  }
  _createColorSwatch(t) {
    const e = Common.Color.Color.parse(t);
    if (!e) {
      return null;
    }
    const i = InlineEditor.ColorSwatch.ColorSwatch.create();
    i.setColor(e);
    i.iconElement().title = Common.UIString.UIString("Open color picker.");

    i.iconElement().addEventListener(
      "click",
      this._swatchIconClicked.bind(this, i),
      false
    );

    i.hideText(true);
    return i;
  }
  _createBezierSwatch(t) {
    if (!UI.Geometry.CubicBezier.parse(t)) {
      return null;
    }
    const e = InlineEditor.ColorSwatch.BezierSwatch.create();
    e.setBezierText(t);

    e.iconElement().title = Common.UIString.UIString(
      "Open cubic bezier editor."
    );

    e.iconElement().addEventListener(
      "click",
      this._swatchIconClicked.bind(this, e),
      false
    );

    e.hideText(true);
    return e;
  }
  _swatchIconClicked(t, e) {
    e.consume(true);
    this._hadSwatchChange = false;
    this._muteSwatchProcessing = true;
    const i = t[SwatchBookmark].position();
    this._textEditor.setSelection(i);
    this._editedSwatchTextRange = i.clone();
    this._editedSwatchTextRange.endColumn += t.textContent.length;
    this._currentSwatch = t;

    if (t instanceof InlineEditor.ColorSwatch.ColorSwatch) {
      this._showSpectrum(t);
    } else if (t instanceof InlineEditor.ColorSwatch.BezierSwatch) {
      this._showBezierEditor(t);
    }
  }
  _showSpectrum(t) {
    if (!this._spectrum) {
      this._spectrum = new ColorPicker.Spectrum.Spectrum();

      this._spectrum.addEventListener(
        ColorPicker.Spectrum.Events.SizeChanged,
        this._spectrumResized,
        this
      );

      this._spectrum.addEventListener(
        ColorPicker.Spectrum.Events.ColorChanged,
        this._spectrumChanged,
        this
      );
    }

    this._spectrum.setColor(t.color(), t.format());

    this._swatchPopoverHelper.show(
      this._spectrum,
      t.iconElement(),
      this._swatchPopoverHidden.bind(this)
    );
  }
  _spectrumResized(t) {
    this._swatchPopoverHelper.reposition();
  }
  _spectrumChanged(t) {
    const e = t.data;
    const i = Common.Color.Color.parse(e);

    if (i) {
      this._currentSwatch.setColor(i);
      this._changeSwatchText(e);
    }
  }
  _showBezierEditor(t) {
    if (!this._bezierEditor) {
      this._bezierEditor = new InlineEditor.BezierEditor.BezierEditor();

      this._bezierEditor.addEventListener(
        InlineEditor.BezierEditor.Events.BezierChanged,
        this._bezierChanged,
        this
      );
    }

    let e = UI.Geometry.CubicBezier.parse(t.bezierText());

    if (!e) {
      UI.Geometry.CubicBezier.parse("linear");
    }

    this._bezierEditor.setBezier(e);

    this._swatchPopoverHelper.show(
      this._bezierEditor,
      t.iconElement(),
      this._swatchPopoverHidden.bind(this)
    );
  }
  _bezierChanged(t) {
    const e = t.data;
    this._currentSwatch.setBezierText(e);
    this._changeSwatchText(e);
  }
  _changeSwatchText(t) {
    this._hadSwatchChange = true;

    this._textEditor.editRange(
      this._editedSwatchTextRange,
      t,
      "*swatch-text-changed"
    );

    this._editedSwatchTextRange.endColumn =
      this._editedSwatchTextRange.startColumn + t.length;
  }
  _swatchPopoverHidden(t) {
    this._muteSwatchProcessing = false;

    if (!t && this._hadSwatchChange) {
      this._textEditor.undo();
    }
  }
  _onTextChanged(t) {
    if (!this._muteSwatchProcessing) {
      this._updateSwatches(t.data.newRange.startLine, t.data.newRange.endLine);
    }
  }
  _isWordChar(t) {
    return (
      TextUtils.TextUtils.Utils.isWordChar(t) ||
      t === "." ||
      t === "." ||
      t === "-" ||
      t === "." ||
      t === "-" ||
      t === "$"
    );
  }
  _cssSuggestions(t, e) {
    const i = this._textEditor.text(t);
    if (i.startsWith("$")) {
      return null;
    }
    const o = this._backtrackPropertyToken(t.startLine, t.startColumn - 1);
    if (!o) {
      return null;
    }

    const r = this._textEditor
      .line(t.startLine)
      .substring(o.startColumn, o.endColumn);

    const s = SDK.CSSMetadata.cssMetadata().propertyValues(r);
    return Promise.resolve(
      s
        .filter((t) => t.startsWith(i))
        .map((t) => ({
          text: t,
        }))
    );
  }
  _backtrackPropertyToken(t, e) {
    let i = e;
    const o = this._textEditor.line(t);
    let r = false;
    for (let e = 0; e < 10 && i >= 0; ++e) {
      const e = this._textEditor.tokenAtTextPosition(t, i);
      if (!e) {
        return null;
      }
      if (e.type === "css-property") {
        return r ? e : null;
      }
      if (
        e.type &&
        !e.type.includes("whitespace") &&
        !e.type.startsWith("css-comment")
      ) {
        return null;
      }
      if (!e.type && o.substring(e.startColumn, e.endColumn) === ":") {
        if (r) {
          return null;
        }
        r = true;
      }
      i = e.startColumn - 1;
    }
    return null;
  }
  dispose() {
    if (this._swatchPopoverHelper.isShowing()) {
      this._swatchPopoverHelper.hide(true);
    }

    this._textEditor.removeEventListener(
      SourceFrame.SourcesTextEditor.Events.ScrollChanged,
      this._textEditorScrolled,
      this
    );

    this._textEditor.removeEventListener(
      UI.TextEditor.Events.TextChanged,
      this._onTextChanged,
      this
    );

    this._textEditor
      .bookmarks(this._textEditor.fullRange(), SwatchBookmark)
      .forEach((t) => t.clear());

    this._textEditor.element.removeEventListener(
      "keydown",
      this._boundHandleKeyDown,
      false
    );
  }
}
export const maxSwatchProcessingLength = 300;
export const SwatchBookmark = Symbol("swatch");

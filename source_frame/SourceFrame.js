import * as Common from "../common/common.js";
import * as Formatter from "../formatter/formatter.js";
import * as Platform from "../platform/platform.js";
import * as TextEditor from "../text_editor/text_editor.js";
import * as TextUtils from "../text_utils/text_utils.js";
import * as UI from "../ui/ui.js";
import * as Workspace from "../workspace/workspace.js";
import {
  Events,
  SourcesTextEditor,
  SourcesTextEditorDelegate,
} from "./SourcesTextEditor.js";
export class SourceFrameImpl extends UI.View.SimpleView {
  constructor(t, e) {
    super(Common.UIString.UIString("Source"));
    this._lazyContent = t;
    this._pretty = false;
    this._rawContent = null;
    this._formattedContentPromise = null;
    this._formattedMap = null;

    this._prettyToggle = new UI.Toolbar.ToolbarToggle(
      ls`Pretty print`,
      "largeicon-pretty-print"
    );

    this._prettyToggle.addEventListener(
      UI.Toolbar.ToolbarButton.Events.Click,
      () => {
        this._setPretty(!this._prettyToggle.toggled());
      }
    );

    this._shouldAutoPrettyPrint = false;
    this._prettyToggle.setVisible(false);

    this._progressToolbarItem = new UI.Toolbar.ToolbarItem(
      createElement("div")
    );

    this._textEditor = new SourcesTextEditor(this, e);
    this._textEditor.show(this.element);
    this._prettyCleanGeneration = null;
    this._cleanGeneration = 0;
    this._searchConfig = null;
    this._delayedFindSearchMatches = null;
    this._currentSearchResultIndex = -1;
    this._searchResults = [];
    this._searchRegex = null;
    this._loadError = false;

    this._textEditor.addEventListener(
      Events.EditorFocused,
      this._resetCurrentSearchResultIndex,
      this
    );

    this._textEditor.addEventListener(
      Events.SelectionChanged,
      this._updateSourcePosition,
      this
    );

    this._textEditor.addEventListener(UI.TextEditor.Events.TextChanged, (t) => {
      if (!this._muteChangeEventsForSetContent) {
        this.onTextChanged(t.data.oldRange, t.data.newRange);
      }
    });

    this._muteChangeEventsForSetContent = false;
    this._sourcePosition = new UI.Toolbar.ToolbarText();
    this._searchableView = null;
    this._editable = false;
    this._textEditor.setReadOnly(true);
    this._positionToReveal = null;
    this._lineToScrollTo = null;
    this._selectionToSet = null;
    this._loaded = false;
    this._contentRequested = false;
    this._highlighterType = "";
    this._wasmDisassembly = null;
  }
  editorLocationToUILocation(t, e = 0) {
    if (this._wasmDisassembly) {
      e = this._wasmDisassembly.lineNumberToBytecodeOffset(t);
      t = 0;
    } else if (this._pretty) {
      [t, e] = this._prettyToRawLocation(t, e);
    }

    return { lineNumber: t, columnNumber: e };
  }
  uiLocationToEditorLocation(t, e = 0) {
    if (this._wasmDisassembly) {
      t = this._wasmDisassembly.bytecodeOffsetToLineNumber(e);
      e = 0;
    } else if (this._pretty) {
      [t, e] = this._rawToPrettyLocation(t, e);
    }

    return { lineNumber: t, columnNumber: e };
  }
  setCanPrettyPrint(t, e) {
    this._shouldAutoPrettyPrint = t && !!e;
    this._prettyToggle.setVisible(t);
  }
  async _setPretty(t) {
    this._pretty = t;
    this._prettyToggle.setEnabled(false);
    const e = this.loaded;
    const i = this.selection();
    let s;
    if (this._pretty) {
      const t = await this._requestFormattedContent();
      this._formattedMap = t.map;
      this.setContent(t.content, null);
      this._prettyCleanGeneration = this._textEditor.markClean();
      const e = this._rawToPrettyLocation(i.startLine, i.startColumn);
      const r = this._rawToPrettyLocation(i.endLine, i.endColumn);
      s = new TextUtils.TextRange.TextRange(e[0], e[1], r[0], r[1]);
    } else {
      this.setContent(this._rawContent, null);
      this._cleanGeneration = this._textEditor.markClean();
      const t = this._prettyToRawLocation(i.startLine, i.startColumn);
      const e = this._prettyToRawLocation(i.endLine, i.endColumn);
      s = new TextUtils.TextRange.TextRange(t[0], t[1], e[0], e[1]);
    }

    if (e) {
      this.textEditor.revealPosition(s.endLine, s.endColumn, this._editable);
      this.textEditor.setSelection(s);
    }

    this._prettyToggle.setEnabled(true);
    this._updatePrettyPrintState();
  }
  _updateLineNumberFormatter() {
    if (this._wasmDisassembly) {
      const t = this._wasmDisassembly;

      const e =
        t.lineNumberToBytecodeOffset(t.lineNumbers - 1).toString(16).length + 1;

      this._textEditor.setLineNumberFormatter(
        (i) =>
          `0x${t
            .lineNumberToBytecodeOffset(i - 1)
            .toString(16)
            .padStart(e, "0")}`
      );
    } else {
      if (this._pretty) {
        this._textEditor.setLineNumberFormatter((t) => {
          const e = this._prettyToRawLocation(t - 1, 0)[0] + 1;
          return t === 1 || e !== this._prettyToRawLocation(t - 2, 0)[0] + 1
            ? String(e)
            : "-";
        });
      } else {
        this._textEditor.setLineNumberFormatter((t) => String(t));
      }
    }
  }
  _updatePrettyPrintState() {
    this._prettyToggle.setToggled(this._pretty);
    this._textEditor.element.classList.toggle("pretty-printed", this._pretty);
    this._updateLineNumberFormatter();
  }
  _prettyToRawLocation(t, e) {
    return this._formattedMap
      ? this._formattedMap.formattedToOriginal(t, e)
      : [t, e];
  }
  _rawToPrettyLocation(t, e) {
    return this._formattedMap
      ? this._formattedMap.originalToFormatted(t, e)
      : [t, e];
  }
  setEditable(t) {
    this._editable = t;

    if (this._loaded) {
      this._textEditor.setReadOnly(!t);
    }
  }
  hasLoadError() {
    return this._loadError;
  }
  wasShown() {
    this._ensureContentLoaded();
    this._wasShownOrLoaded();
  }
  willHide() {
    super.willHide();
    this._clearPositionToReveal();
  }
  async toolbarItems() {
    return [
      this._prettyToggle,
      this._sourcePosition,
      this._progressToolbarItem,
    ];
  }
  get loaded() {
    return this._loaded;
  }
  get textEditor() {
    return this._textEditor;
  }
  get pretty() {
    return this._pretty;
  }
  async _ensureContentLoaded() {
    if (!this._contentRequested) {
      this._contentRequested = true;
      const t = new UI.ProgressIndicator.ProgressIndicator();
      t.setTitle(Common.UIString.UIString("Loading…"));
      t.setTotalWork(100);
      this._progressToolbarItem.element.appendChild(t.element);
      const { content: e, error: i } = await this._lazyContent();
      this._rawContent = i || e || e || e || e || e || "";
      t.setWorked(1);

      if (!i && this._highlighterType === "application/wasm") {
        const i = new Common.Worker.WorkerWrapper(
          "wasmparser_worker_entrypoint"
        );

        const s = new Promise((e, s) => {
          i.onmessage = ({ data: i }) => {
            if ("event" in i) {
              switch (i.event) {
                case "progress": {
                  t.setWorked(i.params.percentage);
                }
              }
            } else if ("method" in i) {
              switch (i.method) {
                case "disassemble": {
                  e(i.result);
                }
              }
            }
          };

          i.onerror = s;
        });

        i.postMessage({ method: "disassemble", params: { content: e } });
        const { source: r, offsets: o, functionBodyOffsets: n } = await s;
        i.terminate();
        this._rawContent = r;

        this._wasmDisassembly = new Common.WasmDisassembly.WasmDisassembly(
          o,
          n
        );
      }

      t.setWorked(100);
      t.done();
      this._formattedContentPromise = null;
      this._formattedMap = null;
      this._prettyToggle.setEnabled(true);

      if (i) {
        this.setContent(null, i);
        this._prettyToggle.setEnabled(false);
        setTimeout(() => this.setHighlighterType("text/plain"), 50);
      } else if (
        this._shouldAutoPrettyPrint &&
        TextUtils.TextUtils.isMinified(e || "")
      ) {
        await this._setPretty(true);
      } else {
        this.setContent(this._rawContent, null);
      }
    }
  }
  _requestFormattedContent() {
    if (this._formattedContentPromise) {
      return this._formattedContentPromise;
    }
    let t;

    this._formattedContentPromise = new Promise((e) => {
      t = e;
    });

    new Formatter.ScriptFormatter.ScriptFormatter(
      this._highlighterType,
      this._rawContent || "",
      (e, i) => {
        t({ content: e, map: i });
      }
    );

    return this._formattedContentPromise;
  }
  revealPosition(t, e, i) {
    this._lineToScrollTo = null;
    this._selectionToSet = null;
    this._positionToReveal = { line: t, column: e, shouldHighlight: i };
    this._innerRevealPositionIfNeeded();
  }
  _innerRevealPositionIfNeeded() {
    if (!this._positionToReveal) {
      return;
    }
    if (!this.loaded || !this.isShowing()) {
      return;
    }
    const { lineNumber: t, columnNumber: e } = this.uiLocationToEditorLocation(
      this._positionToReveal.line,
      this._positionToReveal.column
    );

    this._textEditor.revealPosition(
      t,
      e,
      this._positionToReveal.shouldHighlight
    );

    this._positionToReveal = null;
  }
  _clearPositionToReveal() {
    this._textEditor.clearPositionHighlight();
    this._positionToReveal = null;
  }
  scrollToLine(t) {
    this._clearPositionToReveal();
    this._lineToScrollTo = t;
    this._innerScrollToLineIfNeeded();
  }
  _innerScrollToLineIfNeeded() {
    if (this._lineToScrollTo !== null && this.loaded && this.isShowing()) {
      this._textEditor.scrollToLine(this._lineToScrollTo);
      this._lineToScrollTo = null;
    }
  }
  selection() {
    return this.textEditor.selection();
  }
  setSelection(t) {
    this._selectionToSet = t;
    this._innerSetSelectionIfNeeded();
  }
  _innerSetSelectionIfNeeded() {
    if (this._selectionToSet && this.loaded && this.isShowing()) {
      this._textEditor.setSelection(this._selectionToSet, true);
      this._selectionToSet = null;
    }
  }
  _wasShownOrLoaded() {
    this._innerRevealPositionIfNeeded();
    this._innerSetSelectionIfNeeded();
    this._innerScrollToLineIfNeeded();
  }
  onTextChanged(t, e) {
    const i = this.pretty;

    this._pretty =
      this._prettyCleanGeneration !== null &&
      this.textEditor.isClean(this._prettyCleanGeneration);

    if (this._pretty !== i) {
      this._updatePrettyPrintState();
    }

    this._prettyToggle.setEnabled(this.isClean());

    if (this._searchConfig && this._searchableView) {
      this.performSearch(this._searchConfig, false, false);
    }
  }
  isClean() {
    return (
      this.textEditor.isClean(this._cleanGeneration) ||
      (this._prettyCleanGeneration !== null &&
        this.textEditor.isClean(this._prettyCleanGeneration))
    );
  }
  contentCommitted() {
    this._cleanGeneration = this._textEditor.markClean();
    this._prettyCleanGeneration = null;
    this._rawContent = this.textEditor.text();
    this._formattedMap = null;
    this._formattedContentPromise = null;

    if (this._pretty) {
      this._pretty = false;
      this._updatePrettyPrintState();
    }

    this._prettyToggle.setEnabled(true);
  }
  _simplifyMimeType(t, e) {
    return e
      ? e.includes("typescript")
        ? "text/typescript-jsx"
        : e.includes("javascript") ||
          e.includes("jscript") ||
          e.includes("jscript") ||
          e.includes("jscript") ||
          e.includes("jscript") ||
          e.includes("jscript") ||
          e.includes("ecmascript")
        ? "text/jsx"
        : e === "text/x-php" && t.match(/\<\?.*\?\>/g)
        ? "application/x-httpd-php"
        : e === "application/wasm"
        ? "text/webassembly"
        : e
      : "";
  }
  setHighlighterType(t) {
    this._highlighterType = t;
    this._updateHighlighterType("");
  }
  highlighterType() {
    return this._highlighterType;
  }
  _updateHighlighterType(t) {
    this._textEditor.setMimeType(
      this._simplifyMimeType(t, this._highlighterType)
    );
  }
  setContent(t, e) {
    this._muteChangeEventsForSetContent = true;

    if (this._loaded) {
      const e = this._textEditor.scrollTop();
      const i = this._textEditor.selection();
      this._textEditor.setText(t || "");
      this._textEditor.setScrollTop(e);
      this._textEditor.setSelection(i);
    } else {
      this._loaded = true;

      if (e) {
        this._textEditor.setText(e || "");
        this._highlighterType = "text/plain";
        this._textEditor.setReadOnly(true);
        this._loadError = true;
      } else {
        this._textEditor.setText(t || "");
        this._cleanGeneration = this._textEditor.markClean();
        this._textEditor.setReadOnly(!this._editable);
        this._loadError = false;
      }
    }

    if (this._wasmDisassembly) {
      for (const t of this._wasmDisassembly.nonBreakableLineNumbers()) {
        this._textEditor.toggleLineClass(t, "cm-non-breakable-line", true);
      }
    }
    this._updateLineNumberFormatter();
    this._updateHighlighterType(t || "");
    this._wasShownOrLoaded();

    if (this._delayedFindSearchMatches) {
      this._delayedFindSearchMatches();
      this._delayedFindSearchMatches = null;
    }

    this._muteChangeEventsForSetContent = false;
  }
  setSearchableView(t) {
    this._searchableView = t;
  }
  _doFindSearchMatches(t, e, i) {
    this._currentSearchResultIndex = -1;
    this._searchResults = [];
    const s = t.toSearchRegex();
    this._searchRegex = s;
    this._searchResults = this._collectRegexMatches(s);

    if (this._searchableView) {
      this._searchableView.updateSearchMatchesCount(this._searchResults.length);
    }

    if (this._searchResults.length) {
      if (e && i) {
        this.jumpToPreviousSearchResult();
      } else if (e) {
        this.jumpToNextSearchResult();
      } else {
        this._textEditor.highlightSearchResults(s, null);
      }
    } else {
      this._textEditor.cancelSearchResultsHighlight();
    }
  }
  performSearch(t, e, i) {
    if (this._searchableView) {
      this._searchableView.updateSearchMatchesCount(0);
    }

    this._resetSearch();
    this._searchConfig = t;

    if (this.loaded) {
      this._doFindSearchMatches(t, e, !!i);
    } else {
      this._delayedFindSearchMatches = this._doFindSearchMatches.bind(
        this,
        t,
        e,
        !!i
      );
    }

    this._ensureContentLoaded();
  }
  _resetCurrentSearchResultIndex() {
    if (this._searchResults.length) {
      this._currentSearchResultIndex = -1;

      if (this._searchableView) {
        this._searchableView.updateCurrentMatchIndex(
          this._currentSearchResultIndex
        );
      }

      this._textEditor.highlightSearchResults(this._searchRegex, null);
    }
  }
  _resetSearch() {
    this._searchConfig = null;
    this._delayedFindSearchMatches = null;
    this._currentSearchResultIndex = -1;
    this._searchResults = [];
    this._searchRegex = null;
  }
  searchCanceled() {
    const t =
      -1 !== this._currentSearchResultIndex
        ? this._searchResults[this._currentSearchResultIndex]
        : null;
    this._resetSearch();

    if (this.loaded) {
      this._textEditor.cancelSearchResultsHighlight();

      if (t) {
        this.setSelection(t);
      }
    }
  }
  jumpToLastSearchResult() {
    this.jumpToSearchResult(this._searchResults.length - 1);
  }
  _searchResultIndexForCurrentSelection() {
    return this._searchResults.lowerBound(
      this._textEditor.selection().collapseToEnd(),
      TextUtils.TextRange.TextRange.comparator
    );
  }
  jumpToNextSearchResult() {
    const t = this._searchResultIndexForCurrentSelection();
    const e = -1 === this._currentSearchResultIndex ? t : t + 1;
    this.jumpToSearchResult(e);
  }
  jumpToPreviousSearchResult() {
    const t = this._searchResultIndexForCurrentSelection();
    this.jumpToSearchResult(t - 1);
  }
  supportsCaseSensitiveSearch() {
    return true;
  }
  supportsRegexSearch() {
    return true;
  }
  jumpToSearchResult(t) {
    if (this.loaded && this._searchResults.length) {
      this._currentSearchResultIndex =
        (t + this._searchResults.length) % this._searchResults.length;

      if (this._searchableView) {
        this._searchableView.updateCurrentMatchIndex(
          this._currentSearchResultIndex
        );
      }

      this._textEditor.highlightSearchResults(
        this._searchRegex,
        this._searchResults[this._currentSearchResultIndex]
      );
    }
  }
  replaceSelectionWith(t, e) {
    const i = this._searchResults[this._currentSearchResultIndex];
    if (!i) {
      return;
    }
    this._textEditor.highlightSearchResults(this._searchRegex, null);
    const s = this._textEditor.text(i);
    const r = t.toSearchRegex();
    let o;
    o = r.__fromRegExpQuery ? s.replace(r, e) : s.replace(r, () => e);
    const n = this._textEditor.editRange(i, o);
    this._textEditor.setSelection(n.collapseToEnd());
  }
  replaceAllWith(t, e) {
    this._resetCurrentSearchResultIndex();
    let i = this._textEditor.text();
    const s = this._textEditor.fullRange();
    const r = t.toSearchRegex(true);
    i = r.__fromRegExpQuery ? i.replace(r, e) : i.replace(r, () => e);
    const o = this._collectRegexMatches(r);
    if (!o.length) {
      return;
    }

    const n = o.lowerBound(
      this._textEditor.selection(),
      TextUtils.TextRange.TextRange.comparator
    );

    const h = o[Platform.NumberUtilities.mod(n - 1, o.length)];
    const a = Platform.StringUtilities.findLineEndingIndexes(e);
    const l = a.length;
    const c = h.startLine + a.length - 1;
    let d = h.startColumn;

    if (a.length > 1) {
      d = a[l - 1] - a[l - 2] - 1;
    }

    this._textEditor.editRange(s, i);
    this._textEditor.revealPosition(c, d);

    this._textEditor.setSelection(
      TextUtils.TextRange.TextRange.createFromLocation(c, d)
    );
  }
  _collectRegexMatches(t) {
    const e = [];
    for (let i = 0; i < this._textEditor.linesCount; ++i) {
      let s;
      let r = this._textEditor.line(i);
      let o = 0;
      do {
        s = t.exec(r);

        if (s) {
          const t = s.index + Math.max(s[0].length, 1);

          if (s[0].length) {
            e.push(new TextUtils.TextRange.TextRange(i, o + s.index, i, o + t));
          }

          o += t;
          r = r.substring(t);
        }
      } while (s && r);
    }
    return e;
  }
  populateLineGutterContextMenu(t, e) {
    return Promise.resolve();
  }
  populateTextAreaContextMenu(t, e, i) {
    return Promise.resolve();
  }
  canEditSource() {
    return this._editable;
  }
  _updateSourcePosition() {
    const t = this._textEditor.selections();
    if (!t.length) {
      return;
    }
    if (t.length > 1) {
      return void this._sourcePosition.setText(
        Common.UIString.UIString("%d selection regions", t.length)
      );
    }
    let e = t[0];
    if (e.isEmpty()) {
      const t = this._prettyToRawLocation(e.endLine, e.endColumn);
      return void this._sourcePosition.setText(
        ls`Line ${t[0] + 1}, Column ${t[1] + 1}`
      );
    }
    e = e.normalize();
    const i = this._textEditor.text(e);

    if (e.startLine === e.endLine) {
      this._sourcePosition.setText(
        Common.UIString.UIString("%d characters selected", i.length)
      );
    } else {
      this._sourcePosition.setText(
        Common.UIString.UIString(
          "%d lines, %d characters selected",
          e.endLine - e.startLine + 1,
          i.length
        )
      );
    }
  }
}
export class LineDecorator {
  decorate(t, e, i) {}
}
export class Transformer {
  editorLocationToUILocation(t, e) {
    throw new Error("Not implemented");
  }
  uiLocationToEditorLocation(t, e) {
    throw new Error("Not implemented");
  }
}

import * as Common from "../common/common.js";
import * as TextEditor from "../text_editor/text_editor.js";
import * as TextUtils from "../text_utils/text_utils.js";
import * as UI from "../ui/ui.js";
export class SourcesTextEditor extends TextEditor.CodeMirrorTextEditor
  .CodeMirrorTextEditor {
  constructor(e, t) {
    const i = {
      lineNumbers: true,
      lineWrapping: false,
      bracketMatchingSetting: Common.Settings.Settings.instance().moduleSetting(
        "textEditorBracketMatching"
      ),
      padBottom: Common.Settings.Settings.instance()
        .moduleSetting("allowScrollPastEof")
        .get(),
      lineWiseCopyCut: true,
    };
    function o(e) {
      this._isHandlingMouseDownEvent = e;
    }

    if (t) {
      Object.assign(i, t);
    }

    super(i);

    this.codeMirror().addKeyMap({
      Enter: "smartNewlineAndIndent",
      Esc: "sourcesDismiss",
    });

    this._delegate = e;
    this.codeMirror().on("cursorActivity", this._cursorActivity.bind(this));
    this.codeMirror().on("gutterClick", this._gutterClick.bind(this));
    this.codeMirror().on("scroll", this._scroll.bind(this));
    this.codeMirror().on("focus", this._focus.bind(this));
    this.codeMirror().on("blur", this._blur.bind(this));

    this.codeMirror().on(
      "beforeSelectionChange",
      this._fireBeforeSelectionChanged.bind(this)
    );

    this.element.addEventListener(
      "contextmenu",
      this._contextMenu.bind(this),
      false
    );

    this._gutterMouseMove = (e) => {
      this.element.classList.toggle(
        "CodeMirror-gutter-hovered",
        e.clientX <
          this.codeMirror().getGutterElement().getBoundingClientRect().right
      );
    };

    this._gutterMouseOut = (e) => {
      this.element.classList.toggle("CodeMirror-gutter-hovered", false);
    };

    this.codeMirror().addKeyMap(_BlockIndentController);
    this._tokenHighlighter = new TokenHighlighter(this, this.codeMirror());
    this._gutters = [lineNumbersGutterType];
    this.codeMirror().setOption("gutters", this._gutters.slice());
    this.codeMirror().setOption("electricChars", false);
    this.codeMirror().setOption("smartIndent", false);
    this.element.addEventListener("mousedown", o.bind(this, true), true);
    this.element.addEventListener("mousedown", o.bind(this, false), false);

    Common.Settings.Settings.instance()
      .moduleSetting("textEditorIndent")
      .addChangeListener(this._onUpdateEditorIndentation, this);

    Common.Settings.Settings.instance()
      .moduleSetting("textEditorAutoDetectIndent")
      .addChangeListener(this._onUpdateEditorIndentation, this);

    Common.Settings.Settings.instance()
      .moduleSetting("showWhitespacesInEditor")
      .addChangeListener(this._updateWhitespace, this);

    Common.Settings.Settings.instance()
      .moduleSetting("textEditorCodeFolding")
      .addChangeListener(this._updateCodeFolding, this);

    Common.Settings.Settings.instance()
      .moduleSetting("allowScrollPastEof")
      .addChangeListener(this._updateScrollPastEof, this);

    this._updateCodeFolding();

    this._autocompleteConfig = {
      isWordChar: TextUtils.TextUtils.Utils.isWordChar,
    };

    Common.Settings.Settings.instance()
      .moduleSetting("textEditorAutocompletion")
      .addChangeListener(this._updateAutocomplete, this);

    this._updateAutocomplete();
    this._onUpdateEditorIndentation();
    this._setupWhitespaceHighlight();
    this._infoBarDiv = null;
  }
  attachInfobar(e) {
    if (!this._infoBarDiv) {
      this._infoBarDiv = document.createElement("div");
      this._infoBarDiv.classList.add("flex-none");
      this.element.insertBefore(this._infoBarDiv, this.element.firstChild);
    }

    this._infoBarDiv.appendChild(e.element);
    e.setParentView(this);
    this.doResize();
  }
  static _guessIndentationLevel(e) {
    const t = /^\t+/;
    let i = 0;
    const o = {};

    for (const r of e) {
      if (r.length === 0 || !TextUtils.TextUtils.Utils.isSpaceChar(r[0])) {
        continue;
      }
      if (t.test(r)) {
        ++i;
        continue;
      }
      let s = 0;

      while (s < r.length && TextUtils.TextUtils.Utils.isSpaceChar(r[s])) {
        ++s;
      }

      if (s % 2 == 0) {
        o[s] = 1 + (o[s] || 0);
      }
    }

    const n = (3 * e.length) / 100;
    if (i && i > n) {
      return "\t";
    }
    let r = Infinity;
    for (const e in o) {
      if (o[e] < n) {
        continue;
      }
      const t = parseInt(e, 10);

      if (r > t) {
        r = t;
      }
    }
    return r === Infinity
      ? Common.Settings.Settings.instance()
          .moduleSetting("textEditorIndent")
          .get()
      : " ".repeat(r);
  }
  _isSearchActive() {
    return !!this._tokenHighlighter.highlightedRegex();
  }
  scrollToLine(e) {
    super.scrollToLine(e);
    this._scroll();
  }
  highlightSearchResults(e, t) {
    if (!this._selectionBeforeSearch) {
      this._selectionBeforeSearch = this.selection();
    }

    this.codeMirror().operation(() => {
      if (t) {
        this.scrollLineIntoView(t.startLine);

        t.endColumn >
        TextEditor.CodeMirrorTextEditor.CodeMirrorTextEditor.maxHighlightLength
          ? this.setSelection(t)
          : this.setSelection(
              TextUtils.TextRange.TextRange.createFromLocation(
                t.startLine,
                t.startColumn
              )
            );
      }

      this._tokenHighlighter.highlightSearchResults(e, t);
    });
  }
  cancelSearchResultsHighlight() {
    this.codeMirror().operation(
      this._tokenHighlighter.highlightSelectedTokens.bind(
        this._tokenHighlighter
      )
    );

    if (this._selectionBeforeSearch) {
      this._reportJump(this._selectionBeforeSearch, this.selection());
      delete this._selectionBeforeSearch;
    }
  }
  removeHighlight(e) {
    e.clear();
  }
  highlightRange(e, t) {
    t = `CodeMirror-persist-highlight ${t}`;
    const i = TextEditor.CodeMirrorUtils.toPos(e);
    ++i.end.ch;

    return this.codeMirror().markText(i.start, i.end, {
      className: t,
      startStyle: `${t}-start`,
      endStyle: `${t}-end`,
    });
  }
  installGutter(e, t) {
    if (!this._gutters.includes(e)) {
      t ? this._gutters.unshift(e) : this._gutters.push(e);
      this.codeMirror().setOption("gutters", this._gutters.slice());
      this.refresh();
    }
  }
  uninstallGutter(e) {
    const t = this._gutters.indexOf(e);

    if (-1 !== t) {
      this.codeMirror().clearGutter(e);
      this._gutters.splice(t, 1);
      this.codeMirror().setOption("gutters", this._gutters.slice());
      this.refresh();
    }
  }
  setGutterDecoration(e, t, i) {
    console.assert(
      this._gutters.includes(t),
      "Cannot decorate unexisting gutter."
    );

    this.codeMirror().setGutterMarker(e, t, i);
  }
  setExecutionLocation(e, t) {
    this.clearPositionHighlight();
    this._executionLine = this.codeMirror().getLineHandle(e);

    if (!this._executionLine) {
      return;
    }

    this.showExecutionLineBackground();

    this.codeMirror().addLineClass(
      this._executionLine,
      "wrap",
      "cm-execution-line-outline"
    );

    let i;
    let o = this.tokenAtTextPosition(e, t);
    if (o && !o.type && o.startColumn + 1 === o.endColumn) {
      const t = this.codeMirror().getLine(e)[o.startColumn];

      if (t === "." || t === "(") {
        o = this.tokenAtTextPosition(e, o.endColumn + 1);
      }
    }
    i = o && o.type ? o.endColumn : this.codeMirror().getLine(e).length;

    this._executionLineTailMarker = this.codeMirror().markText(
      { line: e, ch: t },
      { line: e, ch: i },
      { className: "cm-execution-line-tail" }
    );
  }
  showExecutionLineBackground() {
    if (this._executionLine) {
      this.codeMirror().addLineClass(
        this._executionLine,
        "wrap",
        "cm-execution-line"
      );
    }
  }
  hideExecutionLineBackground() {
    if (this._executionLine) {
      this.codeMirror().removeLineClass(
        this._executionLine,
        "wrap",
        "cm-execution-line"
      );
    }
  }
  clearExecutionLine() {
    this.clearPositionHighlight();

    if (this._executionLine) {
      this.hideExecutionLineBackground();

      this.codeMirror().removeLineClass(
        this._executionLine,
        "wrap",
        "cm-execution-line-outline"
      );
    }

    delete this._executionLine;

    if (this._executionLineTailMarker) {
      this._executionLineTailMarker.clear();
    }

    delete this._executionLineTailMarker;
  }
  toggleLineClass(e, t, i) {
    if (this.hasLineClass(e, t) === i) {
      return;
    }
    const o = this.codeMirror().getLineHandle(e);

    if (o) {
      if (i) {
        this.codeMirror().addLineClass(o, "gutter", t);
        this.codeMirror().addLineClass(o, "wrap", t);
      } else {
        this.codeMirror().removeLineClass(o, "gutter", t);
        this.codeMirror().removeLineClass(o, "wrap", t);
      }
    }
  }
  hasLineClass(e, t) {
    const i = this.codeMirror().lineInfo(e);
    if (!i) {
      return false;
    }
    const i_wrapClass = i.wrapClass;
    if (!i_wrapClass) {
      return false;
    }
    return i_wrapClass.split(" ").includes(t);
  }
  _gutterClick(e, t, i, o) {
    this.dispatchEventToListeners(Events.GutterClick, {
      gutterType: i,
      lineNumber: t,
      event: o,
    });
  }
  _contextMenu(e) {
    const t = new UI.ContextMenu.ContextMenu(e);
    e.consume(true);

    const i = e.target.enclosingNodeOrSelfWithClass(
      "CodeMirror-gutter-wrapper"
    );

    const o = i ? i.querySelector(".CodeMirror-linenumber") : null;
    let n;
    if (o) {
      n = this._delegate.populateLineGutterContextMenu(
        t,
        parseInt(o.textContent, 10) - 1
      );
    } else {
      const e = this.selection();
      n = this._delegate.populateTextAreaContextMenu(
        t,
        e.startLine,
        e.startColumn
      );
    }
    n.then(() => {
      t.appendApplicableItems(this);
      t.show();
    });
  }
  editRange(e, t, i) {
    const o = super.editRange(e, t, i);

    if (
      Common.Settings.Settings.instance()
        .moduleSetting("textEditorAutoDetectIndent")
        .get()
    ) {
      this._onUpdateEditorIndentation();
    }

    return o;
  }
  _onUpdateEditorIndentation() {
    this._setEditorIndentation(
      TextEditor.CodeMirrorUtils.pullLines(
        this.codeMirror(),
        LinesToScanForIndentationGuessing
      )
    );
  }
  _setEditorIndentation(e) {
    const t = {};
    let i = Common.Settings.Settings.instance()
      .moduleSetting("textEditorIndent")
      .get();

    if (
      Common.Settings.Settings.instance()
        .moduleSetting("textEditorAutoDetectIndent")
        .get()
    ) {
      i = SourcesTextEditor._guessIndentationLevel(e);
    }

    if (i === TextUtils.TextUtils.Utils.Indent.TabCharacter) {
      this.codeMirror().setOption("indentWithTabs", true);
      this.codeMirror().setOption("indentUnit", 4);
    } else {
      this.codeMirror().setOption("indentWithTabs", false);
      this.codeMirror().setOption("indentUnit", i.length);

      t.Tab = (e) => {
        if (e.somethingSelected()) {
          return CodeMirror.Pass;
        }
        const t = e.getCursor("head");
        e.replaceRange(i.substring(t.ch % i.length), e.getCursor());
      };
    }

    this.codeMirror().setOption("extraKeys", t);
    this._indentationLevel = i;
  }
  indent() {
    return this._indentationLevel;
  }
  _onAutoAppendedSpaces() {
    this._autoAppendedSpaces = this._autoAppendedSpaces || [];
    for (let e = 0; e < this._autoAppendedSpaces.length; ++e) {
      const t = this._autoAppendedSpaces[e].resolve();
      if (!t) {
        continue;
      }
      const i = this.line(t.lineNumber);

      if (
        i.length === t.columnNumber &&
        TextUtils.TextUtils.Utils.lineIndent(i).length === i.length
      ) {
        this.codeMirror().replaceRange(
          "",
          new CodeMirror.Pos(t.lineNumber, 0),
          new CodeMirror.Pos(t.lineNumber, t.columnNumber)
        );
      }
    }
    this._autoAppendedSpaces = [];
    const e = this.selections();

    for (const i of e) {
      this._autoAppendedSpaces.push(
        this.textEditorPositionHandle(i.startLine, i.startColumn)
      );
    }
  }
  _cursorActivity() {
    if (!this._isSearchActive()) {
      this.codeMirror().operation(
        this._tokenHighlighter.highlightSelectedTokens.bind(
          this._tokenHighlighter
        )
      );
    }

    const e = this.codeMirror().getCursor("anchor");
    const t = this.codeMirror().getCursor("head");
    this.dispatchEventToListeners(
      Events.SelectionChanged,
      TextEditor.CodeMirrorUtils.toRange(e, t)
    );
  }
  _reportJump(e, t) {
    if (!e || !t || !e.equal(t)) {
      this.dispatchEventToListeners(Events.JumpHappened, { from: e, to: t });
    }
  }
  _scroll() {
    const e = this.codeMirror().lineAtHeight(
      this.codeMirror().getScrollInfo().top,
      "local"
    );
    this.dispatchEventToListeners(Events.ScrollChanged, e);
  }
  _focus() {
    this.dispatchEventToListeners(Events.EditorFocused);
  }
  _blur() {
    this.dispatchEventToListeners(Events.EditorBlurred);
  }
  _fireBeforeSelectionChanged(e, t) {
    if (!this._isHandlingMouseDownEvent) {
      return;
    }
    if (!t.ranges.length) {
      return;
    }
    const i = t.ranges[0];
    this._reportJump(
      this.selection(),
      TextEditor.CodeMirrorUtils.toRange(i.anchor, i.head)
    );
  }
  dispose() {
    super.dispose();

    Common.Settings.Settings.instance()
      .moduleSetting("textEditorIndent")
      .removeChangeListener(this._onUpdateEditorIndentation, this);

    Common.Settings.Settings.instance()
      .moduleSetting("textEditorAutoDetectIndent")
      .removeChangeListener(this._onUpdateEditorIndentation, this);

    Common.Settings.Settings.instance()
      .moduleSetting("showWhitespacesInEditor")
      .removeChangeListener(this._updateWhitespace, this);

    Common.Settings.Settings.instance()
      .moduleSetting("textEditorCodeFolding")
      .removeChangeListener(this._updateCodeFolding, this);

    Common.Settings.Settings.instance()
      .moduleSetting("allowScrollPastEof")
      .removeChangeListener(this._updateScrollPastEof, this);
  }
  setText(e) {
    this._setEditorIndentation(
      e.split("\n").slice(0, LinesToScanForIndentationGuessing)
    );

    super.setText(e);
  }
  _updateWhitespace() {
    this.setMimeType(this.mimeType());
  }
  _updateCodeFolding() {
    if (
      Common.Settings.Settings.instance()
        .moduleSetting("textEditorCodeFolding")
        .get()
    ) {
      this.installGutter("CodeMirror-foldgutter", false);
      this.element.addEventListener("mousemove", this._gutterMouseMove);
      this.element.addEventListener("mouseout", this._gutterMouseOut);
      this.codeMirror().setOption("foldGutter", true);
      this.codeMirror().setOption("foldOptions", { minFoldSize: 1 });
    } else {
      this.codeMirror().execCommand("unfoldAll");
      this.element.removeEventListener("mousemove", this._gutterMouseMove);
      this.element.removeEventListener("mouseout", this._gutterMouseOut);
      this.uninstallGutter("CodeMirror-foldgutter");
      this.codeMirror().setOption("foldGutter", false);
    }
  }
  _updateScrollPastEof() {
    this.toggleScrollPastEof(
      Common.Settings.Settings.instance()
        .moduleSetting("allowScrollPastEof")
        .get()
    );
  }
  rewriteMimeType(e) {
    this._setupWhitespaceHighlight();
    const t = Common.Settings.Settings.instance()
      .moduleSetting("showWhitespacesInEditor")
      .get();
    this.element.classList.toggle("show-whitespaces", t === "all");

    return t === "all"
      ? this._allWhitespaceOverlayMode(e)
      : t === "trailing"
      ? this._trailingWhitespaceOverlayMode(e)
      : e;
  }
  _allWhitespaceOverlayMode(e) {
    let t = CodeMirror.mimeModes[e]
      ? CodeMirror.mimeModes[e].name || CodeMirror.mimeModes[e]
      : CodeMirror.mimeModes["text/plain"];
    t += "+all-whitespaces";

    if (CodeMirror.modes[t]) {
      return t;
    }

    CodeMirror.defineMode(t, (t, i) => {
      const o = {
        token(e) {
          if (e.peek() === " ") {
            let t = 0;

            while (
              t < MaximumNumberOfWhitespacesPerSingleSpan &&
              e.peek() === " "
            ) {
              ++t;
              e.next();
            }

            return `whitespace whitespace-${t}`;
          }

          while (!e.eol() && e.peek() !== " ") {
            e.next();
          }

          return null;
        },
      };
      return CodeMirror.overlayMode(CodeMirror.getMode(t, e), o, false);
    });

    return t;
  }
  _trailingWhitespaceOverlayMode(e) {
    let t = CodeMirror.mimeModes[e]
      ? CodeMirror.mimeModes[e].name || CodeMirror.mimeModes[e]
      : CodeMirror.mimeModes["text/plain"];
    t += "+trailing-whitespaces";

    if (CodeMirror.modes[t]) {
      return t;
    }

    CodeMirror.defineMode(t, (t, i) => {
      const o = {
        token(e) {
          if (e.match(/^\s+$/, true)) {
            return "trailing-whitespace";
          }
          do {
            e.next();
          } while (!e.eol() && e.peek() !== " ");
          return null;
        },
      };
      return CodeMirror.overlayMode(CodeMirror.getMode(t, e), o, false);
    });

    return t;
  }
  _setupWhitespaceHighlight() {
    const e = this.element.ownerDocument;
    if (
      e._codeMirrorWhitespaceStyleInjected ||
      !Common.Settings.Settings.instance()
        .moduleSetting("showWhitespacesInEditor")
        .get()
    ) {
      return;
    }
    e._codeMirrorWhitespaceStyleInjected = true;
    let t = "";
    let i = "";
    for (let e = 1; e <= MaximumNumberOfWhitespacesPerSingleSpan; ++e) {
      t += "·";
      i += `.show-whitespaces .CodeMirror .cm-whitespace-${e}::before { content: '${t}';}\n`;
    }
    const o = e.createElement("style");
    o.textContent = i;
    e.head.appendChild(o);
  }
  configureAutocomplete(e) {
    this._autocompleteConfig = e;
    this._updateAutocomplete();
  }
  _updateAutocomplete() {
    super.configureAutocomplete(
      Common.Settings.Settings.instance()
        .moduleSetting("textEditorAutocompletion")
        .get()
        ? this._autocompleteConfig
        : null
    );
  }
}
export const Events = {
  GutterClick: Symbol("GutterClick"),
  SelectionChanged: Symbol("SelectionChanged"),
  ScrollChanged: Symbol("ScrollChanged"),
  EditorFocused: Symbol("EditorFocused"),
  EditorBlurred: Symbol("EditorBlurred"),
  JumpHappened: Symbol("JumpHappened"),
};
export class SourcesTextEditorDelegate {
  populateLineGutterContextMenu(e, t) {}
  populateTextAreaContextMenu(e, t, i) {}
}

CodeMirror.commands.smartNewlineAndIndent = (e) => {
  e.operation(
    ((e) => {
      const t = e.listSelections();
      const i = [];

      for (const n of t) {
        const r = CodeMirror.cmpPos(n.head, n.anchor) < 0 ? n.head : n.anchor;
        const s = e.getLine(r.line);
        const h = TextUtils.TextUtils.Utils.lineIndent(s);
        i.push(`\n${h.substring(0, Math.min(r.ch, h.length))}`);
      }

      e.replaceSelections(i);
      e._codeMirrorTextEditor._onAutoAppendedSpaces();
    }).bind(null, e)
  );
};

CodeMirror.commands.sourcesDismiss = (e) =>
  e.listSelections().length === 1 && e._codeMirrorTextEditor._isSearchActive()
    ? CodeMirror.Pass
    : CodeMirror.commands.dismiss(e);

export const _BlockIndentController = {
  name: "blockIndentKeymap",
  Enter(e) {
    let t = e.listSelections();
    const i = [];
    let o = false;
    for (let n = 0; n < t.length; ++n) {
      const t_n = t[n];
      const s =
        CodeMirror.cmpPos(t_n.head, t_n.anchor) < 0 ? t_n.head : t_n.anchor;
      const h = e.getLine(s.line);
      const l = TextUtils.TextUtils.Utils.lineIndent(h);
      let c = `\n${l}${e._codeMirrorTextEditor.indent()}`;
      let d = false;
      if (t_n.head.ch === 0) {
        return CodeMirror.Pass;
      }
      if (h.substr(t_n.head.ch - 1, 2) === "{}") {
        c += `\n${l}`;
        d = true;
      } else if (h.substr(t_n.head.ch - 1, 1) !== "{") {
        return CodeMirror.Pass;
      }
      if (n > 0 && o !== d) {
        return CodeMirror.Pass;
      }
      i.push(c);
      o = d;
    }
    e.replaceSelections(i);

    if (!o) {
      return void e._codeMirrorTextEditor._onAutoAppendedSpaces();
    }

    t = e.listSelections();
    const n = [];

    for (const o of t) {
      const r = e.getLine(o.head.line - 1);
      const s = new CodeMirror.Pos(o.head.line - 1, r.length);
      n.push({ head: s, anchor: s });
    }

    e.setSelections(n);
    e._codeMirrorTextEditor._onAutoAppendedSpaces();
  },
  "'}'": function (e) {
    if (e.somethingSelected()) {
      return CodeMirror.Pass;
    }
    let t = e.listSelections();
    let i = [];

    for (const n of t) {
      const r = e.getLine(n.head.line);
      if (r !== TextUtils.TextUtils.Utils.lineIndent(r)) {
        return CodeMirror.Pass;
      }
      i.push("}");
    }

    e.replaceSelections(i);
    t = e.listSelections();
    i = [];
    const o = [];

    for (const r of t) {
      const s = e.findMatchingBracket(r.head);
      if (!s || !s.match) {
        return;
      }
      o.push({ head: r.head, anchor: new CodeMirror.Pos(r.head.line, 0) });
      const h = e.getLine(s.to.line);
      const l = TextUtils.TextUtils.Utils.lineIndent(h);
      i.push(`${l}}`);
    }

    e.setSelections(o);
    e.replaceSelections(i);
  },
};
export class TokenHighlighter {
  constructor(e, t) {
    this._textEditor = e;
    this._codeMirror = t;
  }
  highlightSearchResults(e, t) {
    const i = this._highlightRegex;
    this._highlightRegex = e;
    this._highlightRange = t;

    if (this._searchResultMarker) {
      this._searchResultMarker.clear();
      delete this._searchResultMarker;
    }

    if (this._highlightDescriptor && this._highlightDescriptor.selectionStart) {
      this._codeMirror.removeLineClass(
        this._highlightDescriptor.selectionStart.line,
        "wrap",
        "cm-line-with-selection"
      );
    }

    const o = this._highlightRange
      ? new CodeMirror.Pos(
          this._highlightRange.startLine,
          this._highlightRange.startColumn
        )
      : null;

    if (o) {
      this._codeMirror.addLineClass(o.line, "wrap", "cm-line-with-selection");
    }

    if (i && this._highlightRegex.toString() === i.toString()) {
      if (this._highlightDescriptor) {
        this._highlightDescriptor.selectionStart = o;
      }
    } else {
      this._removeHighlight();

      this._setHighlighter(
        this._searchHighlighter.bind(this, this._highlightRegex),
        o
      );
    }

    if (this._highlightRange) {
      const e = TextEditor.CodeMirrorUtils.toPos(this._highlightRange);
      this._searchResultMarker = this._codeMirror.markText(e.start, e.end, {
        className: "cm-column-with-selection",
      });
    }
  }
  highlightedRegex() {
    return this._highlightRegex;
  }
  highlightSelectedTokens() {
    delete this._highlightRegex;
    delete this._highlightRange;

    if (this._highlightDescriptor && this._highlightDescriptor.selectionStart) {
      this._codeMirror.removeLineClass(
        this._highlightDescriptor.selectionStart.line,
        "wrap",
        "cm-line-with-selection"
      );
    }

    this._removeHighlight();
    const e = this._codeMirror.getCursor("start");
    const t = this._codeMirror.getCursor("end");
    if (e.line !== t.line) {
      return;
    }
    if (e.ch === t.ch) {
      return;
    }
    const i = this._codeMirror.getSelections();
    if (i.length > 1) {
      return;
    }
    const [o] = i;

    if (this._isWord(o, e.line, e.ch, t.ch)) {
      e &&
        this._codeMirror.addLineClass(e.line, "wrap", "cm-line-with-selection");

      this._setHighlighter(this._tokenHighlighter.bind(this, o, e), e);
    }
  }
  _isWord(e, t, i, o) {
    const n = this._codeMirror.getLine(t);
    const r = i === 0 || !TextUtils.TextUtils.Utils.isWordChar(n.charAt(i - 1));
    const s =
      o === n.length || !TextUtils.TextUtils.Utils.isWordChar(n.charAt(o));
    return r && s && TextUtils.TextUtils.Utils.isWord(e);
  }
  _removeHighlight() {
    if (this._highlightDescriptor) {
      this._codeMirror.removeOverlay(this._highlightDescriptor.overlay);
      delete this._highlightDescriptor;
    }
  }
  _searchHighlighter(e, t) {
    if (t.column() === 0) {
      delete this._searchMatchLength;
    }

    if (this._searchMatchLength) {
      if (this._searchMatchLength > 2) {
        for (let e = 0; e < this._searchMatchLength - 2; ++e) {
          t.next();
        }
        this._searchMatchLength = 1;
        return "search-highlight";
      }
      t.next();
      delete this._searchMatchLength;
      return "search-highlight search-highlight-end";
    }

    const i = t.match(e, false);
    if (i) {
      t.next();
      const e = i[0].length;
      return e === 1
        ? "search-highlight search-highlight-full"
        : ((this._searchMatchLength = e),
          "search-highlight search-highlight-start");
    }

    while (!t.match(e, false) && t.next()) {}
  }
  _tokenHighlighter(e, t, i) {
    const o = e.charAt(0);
    if (
      i.match(e) &&
      (i.eol() || !TextUtils.TextUtils.Utils.isWordChar(i.peek()))
    ) {
      return i.column() === t.ch
        ? "token-highlight column-with-selection"
        : "token-highlight";
    }
    let n;
    do {
      n = i.next();
    } while (n && (TextUtils.TextUtils.Utils.isWordChar(n) || i.peek() !== o));
  }
  _setHighlighter(e, t) {
    const i = { token: e };
    this._codeMirror.addOverlay(i);
    this._highlightDescriptor = { overlay: i, selectionStart: t };
  }
}
const LinesToScanForIndentationGuessing = 1000; /* 1e3 */
const MaximumNumberOfWhitespacesPerSingleSpan = 16;
export const lineNumbersGutterType = "CodeMirror-linenumbers";
export let GutterClickEventData;

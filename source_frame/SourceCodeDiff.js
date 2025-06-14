import * as Diff from "../diff/diff.js";
import * as TextEditor from "../text_editor/text_editor.js";
export class SourceCodeDiff {
  constructor(t) {
    this._textEditor = t;
    this._animatedLines = [];
    this._animationTimeout = null;
  }
  highlightModifiedLines(t, i) {
    if (typeof t != "string" || typeof i != "string") {
      return;
    }

    const e = SourceCodeDiff.computeDiff(
      Diff.Diff.DiffWrapper.lineDiff(t.split("\n"), i.split("\n"))
    );

    const o = [];

    e.forEach((i, t) => {
      if (i.type !== EditType.Delete) {
        for (let t = i.from; t < i.to; ++t) {
          const i = this._textEditor.textEditorPositionHandle(t, 0);

          if (i) {
            o.push(i);
          }
        }
      }
    });

    this._updateHighlightedLines(o);

    this._animationTimeout = setTimeout(
      this._updateHighlightedLines.bind(this, []),
      400
    );
  }
  _updateHighlightedLines(t) {
    function i(t) {
      for (let i = 0; i < this._animatedLines.length; ++i) {
        const e = this._animatedLines[i].resolve();

        if (e) {
          this._textEditor.toggleLineClass(
            e.lineNumber,
            "highlight-line-modification",
            t
          );
        }
      }
    }

    if (this._animationTimeout) {
      clearTimeout(this._animationTimeout);
    }

    this._animationTimeout = null;

    this._textEditor.operation(() => {
      i.call(this, false);
      this._animatedLines = t;
      i.call(this, true);
    });
  }
  static computeDiff(t) {
    const i = [];
    let e = false;
    let o = false;
    let n = 0;
    let s = 0;
    let f = false;

    for (const r of t) {
      if (r[0] !== Diff.Diff.Operation.Equal) {
        f || ((f = true), (n = s));

        r[0] === Diff.Diff.Operation.Delete
          ? (o = true)
          : ((s += r[1].length), (e = true));
      } else {
        f && l();
        s += r[1].length;
      }
    }

    if (f) {
      l();
    }

    if (i.length > 1 && i[0].from === 0 && i[1].from === 0) {
      const t = { type: EditType.Modify, from: 0, to: i[1].to };
      i.splice(0, 2, t);
    }

    return i;
    function l() {
      let EditType_Insert = EditType.Insert;
      let l = n;
      let r = s;

      if (e && o) {
        EditType_Insert = EditType.Modify;
      } else if (!e && o && l === 0 && r === 0) {
        EditType_Insert = EditType.Modify;
        r = 1;
      } else if (!e && o) {
        EditType_Insert = EditType.Delete;
        l -= 1;
      }

      i.push({ type: EditType_Insert, from: l, to: r });
      f = false;
      e = false;
      o = false;
    }
  }
}
export const EditType = {
  Insert: Symbol("Insert"),
  Delete: Symbol("Delete"),
  Modify: Symbol("Modify"),
};

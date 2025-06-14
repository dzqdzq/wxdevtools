import * as Common from "../common/common.js";
import * as Diff from "../diff/diff.js";
import * as SourceFrame from "../source_frame/source_frame.js";
import * as TextEditor from "../text_editor/text_editor.js";
import * as UI from "../ui/ui.js";
import * as Workspace from "../workspace/workspace.js";
import * as WorkspaceDiff from "../workspace_diff/workspace_diff.js";
import { Plugin } from "./Plugin.js";
export class GutterDiffPlugin extends Plugin {
  constructor(e, t) {
    super();
    this._textEditor = e;
    this._uiSourceCode = t;
    this._decorations = [];
    this._textEditor.installGutter(DiffGutterType, true);
    this._workspaceDiff = WorkspaceDiff.WorkspaceDiff.workspaceDiff();

    this._workspaceDiff.subscribeToDiffChange(
      this._uiSourceCode,
      this._update,
      this
    );

    this._update();
  }
  static accepts(e) {
    return e.project().type() === Workspace.Workspace.projectTypes.Network;
  }
  _updateDecorations(e, t) {
    this._textEditor.operation(() => {
      for (const t of e) {
        t.remove();
      }
      for (const e of t) {
        e.install();
      }
    });
  }
  _update() {
    if (this._uiSourceCode) {
      this._workspaceDiff
        .requestDiff(this._uiSourceCode)
        .then(this._innerUpdate.bind(this));
    } else {
      this._innerUpdate(null);
    }
  }
  _innerUpdate(e) {
    if (!e) {
      this._updateDecorations(this._decorations, []);
      return void (this._decorations = []);
    }
    const t = SourceFrame.SourceCodeDiff.SourceCodeDiff.computeDiff(e);
    const o = new Map();

    t.forEach((i, e) => {
      for (let e = i.from; e < i.to; ++e) {
        o.set(e, { lineNumber: e, type: i.type });
      }
    });

    const i = this._calculateDecorationsDiff(o);

    const s = i.added.map(
      (e) => new GutterDecoration(this._textEditor, e.lineNumber, e.type)
    );

    this._decorations = i.equal.concat(s);
    this._updateDecorations(i.removed, s);
    this._decorationsSetForTest(o);
  }
  _decorationsByLine() {
    const e = new Map();
    for (const t of this._decorations) {
      const o = t.lineNumber();

      if (-1 !== o) {
        e.set(o, t);
      }
    }
    return e;
  }
  _calculateDecorationsDiff(e) {
    const t = this._decorationsByLine();
    const o = [...t.keys()];
    const i = [...e.keys()];

    o.sort((e, t) => e - t);

    i.sort((e, t) => e - t);

    const s = [];
    const r = [];
    const n = [];
    let a = 0;
    let f = 0;

    while (a < o.length && f < i.length) {
      const c = o[a];
      const u = i[f];
      const p = t.get(c);
      const d = e.get(u);

      if (c === u && p.type === d.type) {
        n.push(p);
        ++a;
        ++f;
      } else if (c <= u) {
        s.push(p);
        ++a;
      } else {
        r.push(d);
        ++f;
      }
    }

    while (a < o.length) {
      const e = o[a++];
      s.push(t.get(e));
    }

    while (f < i.length) {
      const t = i[f++];
      r.push(e.get(t));
    }

    return { added: r, removed: s, equal: n };
  }
  _decorationsSetForTest(e) {}
  async populateLineGutterContextMenu(e, t) {
    GutterDiffPlugin._appendRevealDiffContextMenu(e, this._uiSourceCode);
  }
  async populateTextAreaContextMenu(e, t, o) {
    GutterDiffPlugin._appendRevealDiffContextMenu(e, this._uiSourceCode);
  }
  static _appendRevealDiffContextMenu(e, t) {
    if (WorkspaceDiff.WorkspaceDiff.workspaceDiff().isUISourceCodeModified(t)) {
      e.revealSection().appendItem(ls`Local Modifications...`, () => {
        Common.Revealer.reveal(
          new WorkspaceDiff.WorkspaceDiff.DiffUILocation(t)
        );
      });
    }
  }
  dispose() {
    for (const e of this._decorations) {
      e.remove();
    }
    WorkspaceDiff.WorkspaceDiff.workspaceDiff().unsubscribeFromDiffChange(
      this._uiSourceCode,
      this._update,
      this
    );
  }
}
export class GutterDecoration {
  constructor(e, t, o) {
    this._textEditor = e;
    this._position = this._textEditor.textEditorPositionHandle(t, 0);
    this._className = "";

    switch (o) {
      case SourceFrame.SourceCodeDiff.EditType.Insert:
        this._className = "diff-entry-insert";
        break;
      case SourceFrame.SourceCodeDiff.EditType.Delete:
        this._className = "diff-entry-delete";
        break;
      case SourceFrame.SourceCodeDiff.EditType.Modify:
        this._className = "diff-entry-modify";
        break;
    }

    this.type = o;
  }
  lineNumber() {
    const e = this._position.resolve();
    return e ? e.lineNumber : -1;
  }
  install() {
    const e = this._position.resolve();
    if (!e) {
      return;
    }
    const t = document.createElement("div");
    t.classList.add("diff-marker");
    t.textContent = " ";
    this._textEditor.setGutterDecoration(e.lineNumber, DiffGutterType, t);
    this._textEditor.toggleLineClass(e.lineNumber, this._className, true);
  }
  remove() {
    const e = this._position.resolve();

    if (e) {
      this._textEditor.setGutterDecoration(e.lineNumber, DiffGutterType, null);
      this._textEditor.toggleLineClass(e.lineNumber, this._className, false);
    }
  }
}
export const DiffGutterType = "CodeMirror-gutter-diff";
export class ContextMenuProvider {
  appendApplicableItems(e, t, o) {
    let i = o;
    const s = self.Persistence.persistence.binding(i);

    if (s) {
      i = s.network;
    }

    GutterDiffPlugin._appendRevealDiffContextMenu(t, i);
  }
}

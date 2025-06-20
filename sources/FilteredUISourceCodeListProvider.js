import * as Common from "../common/common.js";
import * as QuickOpen from "../quick_open/quick_open.js";
import * as UI from "../ui/ui.js";
import * as Workspace from "../workspace/workspace.js";
import { FilePathScoreFunction } from "./FilePathScoreFunction.js";
export class FilteredUISourceCodeListProvider extends QuickOpen
  .FilteredListWidget.Provider {
  constructor() {
    super();
    this._queryLineNumberAndColumnNumber = "";
    this._defaultScores = null;
    this._scorer = new FilePathScoreFunction("");
  }
  _projectRemoved(e) {
    const t = e.data;
    this._populate(t);
    this.refresh();
  }
  _populate(e) {
    this._uiSourceCodes = [];
    const t = Workspace.Workspace.WorkspaceImpl.instance()
      .projects()
      .filter(this.filterProject.bind(this));
    for (let s = 0; s < t.length; ++s) {
      if (e && t[s] === e) {
        continue;
      }
      const r = t[s]
        .uiSourceCodes()
        .filter(this._filterUISourceCode.bind(this));
      this._uiSourceCodes = this._uiSourceCodes.concat(r);
    }
  }
  _filterUISourceCode(e) {
    const t = self.Persistence.persistence.binding(e);
    return !t || t.fileSystem === e;
  }
  uiSourceCodeSelected(e, t, s) {}
  filterProject(e) {
    return true;
  }
  itemCount() {
    return this._uiSourceCodes.length;
  }
  itemKeyAt(e) {
    return this._uiSourceCodes[e].url();
  }
  setDefaultScores(e) {
    this._defaultScores = e;
  }
  itemScoreAt(e, t) {
    const s = this._uiSourceCodes[e];
    const r = (this._defaultScores && this._defaultScores.get(s)) || 0;
    if (!t || t.length < 2) {
      return r;
    }

    if (this._query !== t) {
      this._query = t;
      this._scorer = new FilePathScoreFunction(t);
    }

    let o = 10;
    s.project().type() !== Workspace.Workspace.projectTypes.FileSystem ||
      self.Persistence.persistence.binding(s) ||
      self.Persistence.persistence.binding(s) ||
      5;
    const i = s.fullDisplayName();
    return r + o * this._scorer.score(i, null);
  }
  renderItem(e, t, s, r) {
    t = this.rewriteQuery(t);
    const o = this._uiSourceCodes[e];
    const i = o.fullDisplayName();
    const n = [];
    new FilePathScoreFunction(t).score(i, n);
    const c = i.lastIndexOf("/");
    s.classList.add("monospace");
    r.classList.add("monospace");
    s.textContent =
      o.displayName() + (this._queryLineNumberAndColumnNumber || "");
    this._renderSubtitleElement(r, i);
    r.title = i;
    const u = [];
    for (let e = 0; e < n.length; ++e) {
      u.push({ offset: n[e], length: 1 });
    }
    if (n[0] > c) {
      for (let e = 0; e < u.length; ++e) {
        u[e].offset -= c + 1;
      }
      UI.UIUtils.highlightRangesWithStyleClass(s, u, "highlight");
    } else {
      UI.UIUtils.highlightRangesWithStyleClass(r, u, "highlight");
    }
  }
  _renderSubtitleElement(e, t) {
    e.removeChildren();
    let s = t.lastIndexOf("/");

    if (t.length > 55) {
      s = t.length - 55;
    }

    e.createChild("div", "first-part").textContent = t.substring(0, s);
    e.createChild("div", "second-part").textContent = t.substring(s);
    e.title = t;
  }
  selectItem(e, t) {
    const s = t.trim().match(/^([^:]*)(:\d+)?(:\d+)?$/);
    if (!s) {
      return;
    }
    let r;
    let o;

    if (s[2]) {
      r = parseInt(s[2].substr(1), 10) - 1;
    }

    if (s[3]) {
      o = parseInt(s[3].substr(1), 10) - 1;
    }

    const i = e !== null ? this._uiSourceCodes[e] : null;
    this.uiSourceCodeSelected(i, r, o);
  }
  rewriteQuery(e) {
    if (!(e = e ? e.trim() : "") || e === ":") {
      return "";
    }
    const t = e.match(/^([^:]+)((?::[^:]*){0,2})$/);
    this._queryLineNumberAndColumnNumber = t ? t[2] : "";
    return t ? t[1] : e;
  }
  _uiSourceCodeAdded(e) {
    const t = e.data;

    if (this._filterUISourceCode(t) && this.filterProject(t.project())) {
      this._uiSourceCodes.push(t);
      this.refresh();
    }
  }
  notFoundText() {
    return Common.UIString.UIString("No files found");
  }
  attach() {
    Workspace.Workspace.WorkspaceImpl.instance().addEventListener(
      Workspace.Workspace.Events.UISourceCodeAdded,
      this._uiSourceCodeAdded,
      this
    );

    Workspace.Workspace.WorkspaceImpl.instance().addEventListener(
      Workspace.Workspace.Events.ProjectRemoved,
      this._projectRemoved,
      this
    );

    this._populate();
  }
  detach() {
    Workspace.Workspace.WorkspaceImpl.instance().removeEventListener(
      Workspace.Workspace.Events.UISourceCodeAdded,
      this._uiSourceCodeAdded,
      this
    );

    Workspace.Workspace.WorkspaceImpl.instance().removeEventListener(
      Workspace.Workspace.Events.ProjectRemoved,
      this._projectRemoved,
      this
    );

    this._queryLineNumberAndColumnNumber = "";
    this._defaultScores = null;
  }
}

import * as Bindings from "../bindings/bindings.js";
import * as Common from "../common/common.js";
import * as Search from "../search/search.js";
import * as TextUtils from "../text_utils/text_utils.js";
import * as Workspace from "../workspace/workspace.js";
export class SourcesSearchScope {
  constructor() {
    this._searchId = 0;
    this._searchResultCandidates = [];
    this._searchResultCallback = null;
    this._searchFinishedCallback = null;
    this._searchConfig = null;
  }
  static _filesComparator(e, s) {
    if (e.isDirty() && !s.isDirty()) {
      return -1;
    }
    if (!e.isDirty() && s.isDirty()) {
      return 1;
    }
    const t =
      e.project().type() === Workspace.Workspace.projectTypes.FileSystem &&
      !self.Persistence.persistence.binding(e);
    if (
      t !==
      (s.project().type() === Workspace.Workspace.projectTypes.FileSystem &&
        !self.Persistence.persistence.binding(s))
    ) {
      return t ? 1 : -1;
    }
    const r = e.url();
    const i = s.url();
    return r && !i
      ? -1
      : !r && i
      ? 1
      : String.naturalOrderComparator(e.fullDisplayName(), s.fullDisplayName());
  }
  performIndexing(e) {
    this.stopSearch();
    const s = this._projects();
    const t = new Common.Progress.CompositeProgress(e);

    for (const r of s) {
      const i = t.createSubProgress(r.uiSourceCodes().length);
      r.indexContent(i);
    }
  }
  _projects() {
    const e = Common.Settings.Settings.instance()
      .moduleSetting("searchInAnonymousAndContentScripts")
      .get();
    return Workspace.Workspace.WorkspaceImpl.instance()
      .projects()
      .filter(
        (s) =>
          s.type() !== Workspace.Workspace.projectTypes.Service &&
          !(!e && s.isServiceProject()) &&
          !(!e && s.type() === Workspace.Workspace.projectTypes.ContentScripts)
      );
  }
  performSearch(e, s, t, r) {
    this.stopSearch();
    this._searchResultCandidates = [];
    this._searchResultCallback = t;
    this._searchFinishedCallback = r;
    this._searchConfig = e;
    const i = [];
    const o = new Common.Progress.CompositeProgress(s);
    const n = o.createSubProgress();
    const c = new Common.Progress.CompositeProgress(o.createSubProgress());
    for (const s of this._projects()) {
      const t = s.uiSourceCodes().length;
      const r = c.createSubProgress(t);
      const o = this._projectFilesMatchingFileQuery(s, e);

      const n = s
        .findFilesMatchingSearchRequest(e, o, r)
        .then(
          this._processMatchingFilesForProject.bind(
            this,
            this._searchId,
            s,
            e,
            o
          )
        );

      i.push(n);
    }
    Promise.all(i).then(
      this._processMatchingFiles.bind(
        this,
        this._searchId,
        n,
        this._searchFinishedCallback.bind(this, true)
      )
    );
  }
  _projectFilesMatchingFileQuery(e, s, t) {
    const r = [];
    const i = e.uiSourceCodes();

    for (const o of i) {
      if (!o.contentType().isTextType()) {
        continue;
      }
      const n = self.Persistence.persistence.binding(o);

      if ((!n || n.network !== o) && (!t || o.isDirty())) {
        if (s.filePathMatchesFileQuery(o.fullDisplayName())) {
          r.push(o.url());
        }
      }
    }

    r.sort(String.naturalOrderComparator);
    return r;
  }
  _processMatchingFilesForProject(e, s, t, r, i) {
    if (e !== this._searchId) {
      return void this._searchFinishedCallback(false);
    }
    i.sort(String.naturalOrderComparator);
    i = i.intersectOrdered(r, String.naturalOrderComparator);
    const o = this._projectFilesMatchingFileQuery(s, t, true);
    i = i.mergeOrdered(o, String.naturalOrderComparator);
    const n = [];
    for (const e of i) {
      const t = s.uiSourceCodeForURL(e);
      if (!t) {
        continue;
      }
      const r =
        Bindings.DefaultScriptMapping.DefaultScriptMapping.scriptForUISourceCode(
          t
        );

      if (!r || r.isAnonymousScript()) {
        n.push(t);
      }
    }
    n.sort(SourcesSearchScope._filesComparator);

    this._searchResultCandidates = this._searchResultCandidates.mergeOrdered(
      n,
      SourcesSearchScope._filesComparator
    );
  }
  _processMatchingFiles(e, s, t) {
    if (e !== this._searchId) {
      return void this._searchFinishedCallback(false);
    }
    const r = this._searchResultCandidates;
    if (!r.length) {
      s.done();
      return void t();
    }
    s.setTotalWork(r.length);
    let i = 0;
    let o = 0;
    for (let e = 0; e < 20 && e < r.length; ++e) {
      c.call(this);
    }
    function n(e) {
      if (e.isDirty()) {
        a.call(this, e, e.workingCopy());
      } else {
        e.requestContent().then((s) => {
          a.call(this, e, s.content || "");
        });
      }
    }
    function c() {
      if (i >= r.length) {
        return o || (s.done(), void t());
      }
      ++o;
      const e = r[i++];
      setTimeout(n.bind(this, e), 0);
    }
    function a(e, t) {
      function r(e, s) {
        return e.lineNumber - s.lineNumber;
      }
      s.worked(1);
      let i = [];
      const n = this._searchConfig.queries();
      if (t !== null) {
        for (let e = 0; e < n.length; ++e) {
          const s = TextUtils.TextUtils.performSearchInContent(
            t,
            n[e],
            !this._searchConfig.ignoreCase(),
            this._searchConfig.isRegex()
          );
          i = i.mergeOrdered(s, r);
        }
      }
      if (i) {
        const s = new FileBasedSearchResult(e, i);
        this._searchResultCallback(s);
      }
      --o;
      c.call(this);
    }
  }
  stopSearch() {
    ++this._searchId;
  }
}
export class FileBasedSearchResult {
  constructor(e, s) {
    this._uiSourceCode = e;
    this._searchMatches = s;
  }
  label() {
    return this._uiSourceCode.displayName();
  }
  description() {
    return this._uiSourceCode.fullDisplayName();
  }
  matchesCount() {
    return this._searchMatches.length;
  }
  matchLineContent(e) {
    return this._searchMatches[e].lineContent;
  }
  matchRevealable(e) {
    const s = this._searchMatches[e];
    return this._uiSourceCode.uiLocation(s.lineNumber, undefined);
  }
  matchLabel(e) {
    return this._searchMatches[e].lineNumber + 1;
  }
}

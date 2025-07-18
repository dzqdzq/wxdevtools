import * as Common from "../common/common.js";
import * as TextUtils from "../text_utils/text_utils.js";
import * as Workspace from "../workspace/workspace.js";
export class ContentProviderBasedProject extends Workspace.Workspace
  .ProjectStore {
  constructor(e, t, r, o, n) {
    super(e, t, r, o),
      (this._contentProviders = {}),
      (this._isServiceProject = n),
      e.addProject(this);
  }
  async requestFileContent(e) {
    const t = this._contentProviders[e.url()];
    try {
      const [e, r] = await Promise.all([
        t.requestContent(),
        t.contentEncoded(),
      ]);
      return { content: e.content, isEncoded: r, error: e.error };
    } catch (e) {
      return {
        content: null,
        isEncoded: !1,
        error: e ? String(e) : ls`Unknown error loading file`,
      };
    }
  }
  isServiceProject() {
    return this._isServiceProject;
  }
  requestMetadata(e) {
    return Promise.resolve(e[_metadata]);
  }
  canSetFileContent() {
    return !1;
  }
  async setFileContent(e, t, r) {}
  fullDisplayName(e) {
    let t = e.parentURL().replace(/^(?:https?|file)\:\/\//, "");
    try {
      t = decodeURI(t);
    } catch (e) {}
    return t + "/" + e.displayName(!0);
  }
  mimeType(e) {
    return e[_mimeType];
  }
  canRename() {
    return !1;
  }
  rename(e, t, r) {
    const o = e.url();
    this.performRename(
      o,
      t,
      function (t, n) {
        if (t && n) {
          const t = o.split("/");
          t[t.length - 1] = n;
          const r = t.join("/");
          (this._contentProviders[r] = this._contentProviders[o]),
            delete this._contentProviders[o],
            this.renameUISourceCode(e, n);
        }
        r(t, n);
      }.bind(this)
    );
  }
  excludeFolder(e) {}
  canExcludeFolder(e) {
    return !1;
  }
  createFile(e, t, r, o) {}
  canCreateFile() {
    return !1;
  }
  deleteFile(e) {}
  remove() {}
  performRename(e, t, r) {
    r(!1);
  }
  searchInFileContent(e, t, r, o) {
    return this._contentProviders[e.url()].searchInContent(t, r, o);
  }
  async findFilesMatchingSearchRequest(e, t, r) {
    const o = [];
    return (
      r.setTotalWork(t.length),
      await Promise.all(
        t.map(
          async function (t) {
            const n = this._contentProviders[t];
            let s = !0;
            for (const t of e.queries().slice()) {
              if (
                !(await n.searchInContent(t, !e.ignoreCase(), e.isRegex()))
                  .length
              ) {
                s = !1;
                break;
              }
            }
            s && o.push(t);
            r.worked(1);
          }.bind(this)
        )
      ),
      r.done(),
      o
    );
  }
  indexContent(e) {
    setImmediate(e.done.bind(e));
  }
  addUISourceCodeWithProvider(e, t, r, o) {
    (e[_mimeType] = o),
      (this._contentProviders[e.url()] = t),
      (e[_metadata] = r),
      this.addUISourceCode(e);
  }
  addContentProvider(e, t, r) {
    const o = this.createUISourceCode(e, t.contentType());
    return this.addUISourceCodeWithProvider(o, t, null, r), o;
  }
  removeFile(e) {
    delete this._contentProviders[e], this.removeUISourceCode(e);
  }
  reset() {
    (this._contentProviders = {}),
      this.removeProject(),
      this.workspace().addProject(this);
  }
  dispose() {
    (this._contentProviders = {}), this.removeProject();
  }
}
const _metadata = Symbol("ContentProviderBasedProject.Metadata"),
  _mimeType = Symbol("ContentProviderBasedProject.MimeType");

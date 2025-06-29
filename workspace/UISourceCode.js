import * as Common from "../common/common.js";
import * as Platform from "../platform/platform.js";
import * as TextUtils from "../text_utils/text_utils.js";
import {
  Events as WorkspaceImplEvents,
  Project,
  projectTypes,
} from "./WorkspaceImpl.js";
export class UISourceCode extends Common.ObjectWrapper.ObjectWrapper {
  constructor(t, e, n) {
    super(), (this._project = t), (this._url = e);
    const i = Common.ParsedURL.ParsedURL.fromString(e);
    i
      ? ((this._origin = i.securityOrigin()),
        (this._parentURL = this._origin + i.folderPathComponents),
        (this._name = i.lastPathComponent),
        i.queryParams && (this._name += "?" + i.queryParams))
      : ((this._origin = ""), (this._parentURL = ""), (this._name = e)),
      (this._contentType = n),
      (this._requestContentPromise = null),
      (this._decorations = null),
      (this._hasCommits = !1),
      (this._messages = null),
      (this._contentLoaded = !1),
      (this._content = null),
      (this._forceLoadOnCheckContent = !1),
      (this._checkingContent = !1),
      (this._lastAcceptedContent = null),
      (this._workingCopy = null),
      (this._workingCopyGetter = null),
      (this._disableEdit = !1);
  }
  requestMetadata() {
    return this._project.requestMetadata(this);
  }
  name() {
    return this._name;
  }
  mimeType() {
    return this._project.mimeType(this);
  }
  url() {
    return this._url;
  }
  parentURL() {
    return this._parentURL;
  }
  origin() {
    return this._origin;
  }
  fullDisplayName() {
    return this._project.fullDisplayName(this);
  }
  displayName(t) {
    if (!this._name) return Common.UIString.UIString("(index)");
    let e = this._name;
    try {
      e =
        this.project().type() === projectTypes.FileSystem
          ? unescape(e)
          : decodeURI(e);
    } catch (t) {}
    return t ? e : e.trimEndWithMaxLength(100);
  }
  canRename() {
    return this._project.canRename();
  }
  rename(t) {
    let e;
    const n = new Promise((t) => {
      e = t;
    });
    return (
      this._project.rename(
        this,
        t,
        function (t, n, i, o) {
          t && this._updateName(n, i, o);
          e(t);
        }.bind(this)
      ),
      n
    );
  }
  remove() {
    this._project.deleteFile(this);
  }
  _updateName(t, e, n) {
    const i = this._url;
    (this._url =
      this._url.substring(0, this._url.length - this._name.length) + t),
      (this._name = t),
      e && (this._url = e),
      n && (this._contentType = n),
      this.dispatchEventToListeners(Events.TitleChanged, this),
      this.project()
        .workspace()
        .dispatchEventToListeners(WorkspaceImplEvents.UISourceCodeRenamed, {
          oldURL: i,
          uiSourceCode: this,
        });
  }
  contentURL() {
    return this.url();
  }
  contentType() {
    return this._contentType;
  }
  async contentEncoded() {
    return await this.requestContent(), this._contentEncoded || !1;
  }
  project() {
    return this._project;
  }
  requestContent() {
    return this._requestContentPromise
      ? this._requestContentPromise
      : this._contentLoaded
      ? Promise.resolve(this._content)
      : ((this._requestContentPromise = this._requestContentImpl()),
        this._requestContentPromise);
  }
  async _requestContentImpl() {
    try {
      const t = await this._project.requestFileContent(this);
      this._contentLoaded ||
        ((this._contentLoaded = !0),
        (this._content = t),
        (this._contentEncoded = t.isEncoded));
    } catch (t) {
      (this._contentLoaded = !0),
        (this._content = {
          content: null,
          error: t ? String(t) : "",
          isEncoded: !1,
        });
    }
    return this._content;
  }
  async checkContentUpdated() {
    if (!this._contentLoaded && !this._forceLoadOnCheckContent) return;
    if (!this._project.canSetFileContent() || this._checkingContent) return;
    this._checkingContent = !0;
    const t = await this._project.requestFileContent(this);
    if ("error" in t) return;
    if (((this._checkingContent = !1), null === t.content)) {
      const t = this.workingCopy();
      return this._contentCommitted("", !1), void this.setWorkingCopy(t);
    }
    if (this._lastAcceptedContent === t.content) return;
    if (
      this._content &&
      "content" in this._content &&
      this._content.content === t.content
    )
      return void (this._lastAcceptedContent = null);
    if (!this.isDirty() || this._workingCopy === t.content)
      return void this._contentCommitted(t.content, !1);
    await Common.Revealer.reveal(this),
      await new Promise((t) => setTimeout(t, 0));
    window.confirm(
      ls`This file was changed externally. Would you like to reload it?`
    )
      ? this._contentCommitted(t.content, !1)
      : (this._lastAcceptedContent = t.content);
  }
  forceLoadOnCheckContent() {
    this._forceLoadOnCheckContent = !0;
  }
  _commitContent(t) {
    this._project.canSetFileContent() &&
      this._project.setFileContent(this, t, !1),
      this._contentCommitted(t, !0);
  }
  _contentCommitted(t, e) {
    (this._lastAcceptedContent = null),
      (this._content = { content: t, isEncoded: !1 }),
      (this._contentLoaded = !0),
      (this._requestContentPromise = null),
      (this._hasCommits = !0),
      this._innerResetWorkingCopy();
    const n = { uiSourceCode: this, content: t, encoded: this._contentEncoded };
    this.dispatchEventToListeners(Events.WorkingCopyCommitted, n),
      this._project
        .workspace()
        .dispatchEventToListeners(WorkspaceImplEvents.WorkingCopyCommitted, n),
      e &&
        this._project
          .workspace()
          .dispatchEventToListeners(
            WorkspaceImplEvents.WorkingCopyCommittedByUser,
            n
          );
  }
  addRevision(t) {
    this._commitContent(t);
  }
  hasCommits() {
    return this._hasCommits;
  }
  workingCopy() {
    return (
      this._workingCopyGetter &&
        ((this._workingCopy = this._workingCopyGetter()),
        (this._workingCopyGetter = null)),
      this.isDirty()
        ? this._workingCopy
        : (this._content &&
            "content" in this._content &&
            this._content.content) ||
          ""
    );
  }
  resetWorkingCopy() {
    this._innerResetWorkingCopy(), this._workingCopyChanged();
  }
  _innerResetWorkingCopy() {
    (this._workingCopy = null), (this._workingCopyGetter = null);
  }
  setWorkingCopy(t) {
    (this._workingCopy = t),
      (this._workingCopyGetter = null),
      this._workingCopyChanged();
  }
  setContent(t, e) {
    (this._contentEncoded = e),
      this._project.canSetFileContent() &&
        this._project.setFileContent(this, t, e),
      this._contentCommitted(t, !0);
  }
  setWorkingCopyGetter(t) {
    (this._workingCopyGetter = t), this._workingCopyChanged();
  }
  _workingCopyChanged() {
    this._removeAllMessages(),
      this.dispatchEventToListeners(Events.WorkingCopyChanged, this),
      this._project
        .workspace()
        .dispatchEventToListeners(WorkspaceImplEvents.WorkingCopyChanged, {
          uiSourceCode: this,
        });
  }
  removeWorkingCopyGetter() {
    this._workingCopyGetter &&
      ((this._workingCopy = this._workingCopyGetter()),
      (this._workingCopyGetter = null));
  }
  commitWorkingCopy() {
    this.isDirty() && this._commitContent(this.workingCopy());
  }
  isDirty() {
    return null !== this._workingCopy || null !== this._workingCopyGetter;
  }
  extension() {
    return Common.ParsedURL.ParsedURL.extractExtension(this._name);
  }
  content() {
    return (
      (this._content && "content" in this._content && this._content.content) ||
      ""
    );
  }
  loadError() {
    return (
      (this._content && "error" in this._content && this._content.error) || null
    );
  }
  searchInContent(t, e, n) {
    const i = this.content();
    return i
      ? Promise.resolve(TextUtils.TextUtils.performSearchInContent(i, t, e, n))
      : this._project.searchInFileContent(this, t, e, n);
  }
  contentLoaded() {
    return this._contentLoaded;
  }
  uiLocation(t, e) {
    return void 0 === e && (e = 0), new UILocation(this, t, e);
  }
  messages() {
    return this._messages ? new Set(this._messages) : new Set();
  }
  addLineMessage(t, e, n, i) {
    return this.addMessage(
      t,
      e,
      new TextUtils.TextRange.TextRange(n, i || 0, n, i || 0)
    );
  }
  addMessage(t, e, n) {
    const i = new Message(this, t, e, n);
    return (
      this._messages || (this._messages = new Set()),
      this._messages.add(i),
      this.dispatchEventToListeners(Events.MessageAdded, i),
      i
    );
  }
  removeMessage(t) {
    this._messages &&
      this._messages.delete(t) &&
      this.dispatchEventToListeners(Events.MessageRemoved, t);
  }
  _removeAllMessages() {
    if (this._messages) {
      for (const t of this._messages)
        this.dispatchEventToListeners(Events.MessageRemoved, t);
      this._messages = null;
    }
  }
  addLineDecoration(t, e, n) {
    this.addDecoration(
      TextUtils.TextRange.TextRange.createFromLocation(t, 0),
      e,
      n
    );
  }
  addDecoration(t, e, n) {
    const i = new LineMarker(t, e, n);
    this._decorations || (this._decorations = new Platform.Multimap()),
      this._decorations.set(e, i),
      this.dispatchEventToListeners(Events.LineDecorationAdded, i);
  }
  removeDecorationsForType(t) {
    if (!this._decorations) return;
    const e = this._decorations.get(t);
    this._decorations.deleteAll(t),
      e.forEach((t) => {
        this.dispatchEventToListeners(Events.LineDecorationRemoved, t);
      });
  }
  allDecorations() {
    return this._decorations ? this._decorations.valuesArray() : [];
  }
  removeAllDecorations() {
    if (!this._decorations) return;
    const t = this._decorations.valuesArray();
    this._decorations.clear(),
      t.forEach((t) =>
        this.dispatchEventToListeners(Events.LineDecorationRemoved, t)
      );
  }
  decorationsForType(t) {
    return this._decorations ? this._decorations.get(t) : null;
  }
  disableEdit() {
    this._disableEdit = !0;
  }
  editDisabled() {
    return this._disableEdit;
  }
}
export const Events = {
  WorkingCopyChanged: Symbol("WorkingCopyChanged"),
  WorkingCopyCommitted: Symbol("WorkingCopyCommitted"),
  TitleChanged: Symbol("TitleChanged"),
  MessageAdded: Symbol("MessageAdded"),
  MessageRemoved: Symbol("MessageRemoved"),
  LineDecorationAdded: Symbol("LineDecorationAdded"),
  LineDecorationRemoved: Symbol("LineDecorationRemoved"),
};
export class UILocation {
  constructor(t, e, n) {
    (this.uiSourceCode = t), (this.lineNumber = e), (this.columnNumber = n);
  }
  linkText(t) {
    let e = this.uiSourceCode.displayName(t);
    return (
      "application/wasm" === this.uiSourceCode.mimeType()
        ? (e += ":0x" + this.columnNumber.toString(16))
        : "number" == typeof this.lineNumber &&
          (e += ":" + (this.lineNumber + 1)),
      e
    );
  }
  id() {
    return (
      this.uiSourceCode.project().id() +
      ":" +
      this.uiSourceCode.url() +
      ":" +
      this.lineNumber +
      ":" +
      this.columnNumber
    );
  }
  lineId() {
    return (
      this.uiSourceCode.project().id() +
      ":" +
      this.uiSourceCode.url() +
      ":" +
      this.lineNumber
    );
  }
  toUIString() {
    return this.uiSourceCode.url() + ":" + (this.lineNumber + 1);
  }
  static comparator(t, e) {
    return t.compareTo(e);
  }
  compareTo(t) {
    return this.uiSourceCode.url() !== t.uiSourceCode.url()
      ? this.uiSourceCode.url() > t.uiSourceCode.url()
        ? 1
        : -1
      : this.lineNumber !== t.lineNumber
      ? this.lineNumber - t.lineNumber
      : this.columnNumber - t.columnNumber;
  }
}
export class Message {
  constructor(t, e, n, i) {
    (this._uiSourceCode = t),
      (this._level = e),
      (this._text = n),
      (this._range = i);
  }
  uiSourceCode() {
    return this._uiSourceCode;
  }
  level() {
    return this._level;
  }
  text() {
    return this._text;
  }
  range() {
    return this._range;
  }
  lineNumber() {
    return this._range.startLine;
  }
  columnNumber() {
    return this._range.startColumn;
  }
  isEqual(t) {
    return (
      this._uiSourceCode === t._uiSourceCode &&
      this.text() === t.text() &&
      this.level() === t.level() &&
      this.range().equal(t.range())
    );
  }
  remove() {
    this._uiSourceCode.removeMessage(this);
  }
}
Message.Level = { Error: "Error", Warning: "Warning" };
export class LineMarker {
  constructor(t, e, n) {
    (this._range = t), (this._type = e), (this._data = n);
  }
  range() {
    return this._range;
  }
  type() {
    return this._type;
  }
  data() {
    return this._data;
  }
}
export class UISourceCodeMetadata {
  constructor(t, e) {
    (this.modificationTime = t), (this.contentSize = e);
  }
}

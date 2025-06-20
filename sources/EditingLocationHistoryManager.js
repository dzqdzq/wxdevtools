import * as Common from "../common/common.js";
import * as SourceFrame from "../source_frame/source_frame.js";
import * as TextUtils from "../text_utils/text_utils.js";
import * as Workspace from "../workspace/workspace.js";
import { HistoryEntry, SimpleHistoryManager } from "./SimpleHistoryManager.js";
import { SourcesView } from "./SourcesView.js";
import { UISourceCodeFrame } from "./UISourceCodeFrame.js";
export class EditingLocationHistoryManager {
  constructor(t, e) {
    this._sourcesView = t;
    this._historyManager = new SimpleHistoryManager(HistoryDepth);
    this._currentSourceFrameCallback = e;
  }
  trackSourceFrameCursorJumps(t) {
    t.textEditor.addEventListener(
      SourceFrame.SourcesTextEditor.Events.JumpHappened,
      this._onJumpHappened.bind(this)
    );
  }
  _onJumpHappened(t) {
    if (t.data.from) {
      this._updateActiveState(t.data.from);
    }

    if (t.data.to) {
      this._pushActiveState(t.data.to);
    }
  }
  rollback() {
    this._historyManager.rollback();
  }
  rollover() {
    this._historyManager.rollover();
  }
  updateCurrentState() {
    const t = this._currentSourceFrameCallback();

    if (t) {
      this._updateActiveState(t.textEditor.selection());
    }
  }
  pushNewState() {
    const t = this._currentSourceFrameCallback();

    if (t) {
      this._pushActiveState(t.textEditor.selection());
    }
  }
  _updateActiveState(t) {
    const e = this._historyManager.active();
    if (!e) {
      return;
    }
    const r = this._currentSourceFrameCallback();
    if (!r) {
      return;
    }
    const o = new EditingLocationHistoryEntry(this._sourcesView, this, r, t);
    e.merge(o);
  }
  _pushActiveState(t) {
    const e = this._currentSourceFrameCallback();
    if (!e) {
      return;
    }
    const r = new EditingLocationHistoryEntry(this._sourcesView, this, e, t);
    this._historyManager.push(r);
  }
  removeHistoryForSourceCode(t) {
    this._historyManager.filterOut(
      (e) => e._projectId === t.project().id() && e._url === t.url()
    );
  }
}
export const HistoryDepth = 20;
export class EditingLocationHistoryEntry {
  constructor(t, e, r, o) {
    this._sourcesView = t;
    this._editingLocationManager = e;
    const i = r.uiSourceCode();
    this._projectId = i.project().id();
    this._url = i.url();
    const s = this._positionFromSelection(o);
    this._positionHandle = r.textEditor.textEditorPositionHandle(
      s.lineNumber,
      s.columnNumber
    );
  }
  merge(t) {
    if (this._projectId === t._projectId && this._url === t._url) {
      this._positionHandle = t._positionHandle;
    }
  }
  _positionFromSelection(t) {
    return { lineNumber: t.endLine, columnNumber: t.endColumn };
  }
  valid() {
    const t = this._positionHandle.resolve();

    const e = Workspace.Workspace.WorkspaceImpl.instance().uiSourceCode(
      this._projectId,
      this._url
    );

    return !(!t || !e);
  }
  reveal() {
    const t = this._positionHandle.resolve();

    const e = Workspace.Workspace.WorkspaceImpl.instance().uiSourceCode(
      this._projectId,
      this._url
    );

    if (t && e) {
      this._editingLocationManager.updateCurrentState();
      this._sourcesView.showSourceLocation(e, t.lineNumber, t.columnNumber);
    }
  }
}

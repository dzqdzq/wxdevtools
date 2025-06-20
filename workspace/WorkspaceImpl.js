import * as Common from "../common/common.js";
import * as TextUtils from "../text_utils/text_utils.js";
import { UISourceCode, UISourceCodeMetadata } from "./UISourceCode.js";
export class ProjectSearchConfig {
  query() {
    throw new Error("not implemented");
  }
  ignoreCase() {
    throw new Error("not implemented");
  }
  isRegex() {
    throw new Error("not implemented");
  }
  queries() {
    throw new Error("not implemented");
  }
  filePathMatchesFileQuery(e) {
    throw new Error("not implemented");
  }
}
export class Project {
  workspace() {
    throw new Error("not implemented");
  }
  id() {
    throw new Error("not implemented");
  }
  type() {
    throw new Error("not implemented");
  }
  isServiceProject() {
    throw new Error("not implemented");
  }
  displayName() {
    throw new Error("not implemented");
  }
  requestMetadata(e) {
    throw new Error("not implemented");
  }
  requestFileContent(e) {
    throw new Error("not implemented");
  }
  canSetFileContent() {
    throw new Error("not implemented");
  }
  setFileContent(e, o, t) {
    throw new Error("not implemented");
  }
  fullDisplayName(e) {
    throw new Error("not implemented");
  }
  mimeType(e) {
    throw new Error("not implemented");
  }
  canRename() {
    throw new Error("not implemented");
  }
  rename(e, o, t) {}
  excludeFolder(e) {}
  canExcludeFolder(e) {
    throw new Error("not implemented");
  }
  createFile(e, o, t, r) {
    throw new Error("not implemented");
  }
  canCreateFile() {
    throw new Error("not implemented");
  }
  deleteFile(e) {}
  remove() {}
  searchInFileContent(e, o, t, r) {
    throw new Error("not implemented");
  }
  findFilesMatchingSearchRequest(e, o, t) {
    throw new Error("not implemented");
  }
  indexContent(e) {}
  uiSourceCodeForURL(e) {
    throw new Error("not implemented");
  }
  uiSourceCodes() {
    throw new Error("not implemented");
  }
}
export const projectTypes = {
  Debugger: "debugger",
  Formatter: "formatter",
  Network: "network",
  FileSystem: "filesystem",
  ContentScripts: "contentscripts",
  Service: "service",
};
export class ProjectStore {
  constructor(e, o, t, r) {
    (this._workspace = e),
      (this._id = o),
      (this._type = t),
      (this._displayName = r),
      (this._uiSourceCodesMap = new Map()),
      (this._uiSourceCodesList = []),
      (this._project = this);
  }
  id() {
    return this._id;
  }
  type() {
    return this._type;
  }
  displayName() {
    return this._displayName;
  }
  workspace() {
    return this._workspace;
  }
  createUISourceCode(e, o) {
    return new UISourceCode(this._project, e, o);
  }
  addUISourceCode(e) {
    const o = e.url();
    if(!this.uiSourceCodeForURL(o)){
        this._uiSourceCodesMap.set(o, {uiSourceCode: e,index: this._uiSourceCodesList.length,});
        this._uiSourceCodesList.push(e);
        this._workspace.dispatchEventToListeners(Events.UISourceCodeAdded, e);
        return true;
    }
  }
  removeUISourceCode(e) {
    if (!this.uiSourceCodeForURL(e)) return;
    const o = this._uiSourceCodesMap.get(e);
    if (!o) return;
    const t = this._uiSourceCodesList[this._uiSourceCodesList.length - 1];
    this._uiSourceCodesList[o.index] = t;
    const r = this._uiSourceCodesMap.get(t.url());
    r && (r.index = o.index),
      this._uiSourceCodesList.splice(this._uiSourceCodesList.length - 1, 1),
      this._uiSourceCodesMap.delete(e),
      this._workspace.dispatchEventToListeners(
        Events.UISourceCodeRemoved,
        o.uiSourceCode
      );
  }
  removeProject() {
    this._workspace._removeProject(this._project),
      (this._uiSourceCodesMap = new Map()),
      (this._uiSourceCodesList = []);
  }
  uiSourceCodeForURL(e) {
    const o = this._uiSourceCodesMap.get(e);
    return o ? o.uiSourceCode : null;
  }
  uiSourceCodes() {
    return this._uiSourceCodesList;
  }
  renameUISourceCode(e, o) {
    const t = e.url(),
      r = e.parentURL() ? e.parentURL() + "/" + o : o,
      s = this._uiSourceCodesMap.get(t);
    this._uiSourceCodesMap.set(r, s), this._uiSourceCodesMap.delete(t);
  }
}
let workspaceInstance;
export class WorkspaceImpl extends Common.ObjectWrapper.ObjectWrapper {
  constructor() {
    super(),
      (this._projects = new Map()),
      (this._hasResourceContentTrackingExtensions = !1);
  }
  static instance(e = { forceNew: null }) {
    const { forceNew: o } = e;
    return (
      (workspaceInstance && !o) || (workspaceInstance = new WorkspaceImpl()),
      workspaceInstance
    );
  }
  uiSourceCode(e, o) {
    const t = this._projects.get(e);
    return t ? t.uiSourceCodeForURL(o) : null;
  }
  uiSourceCodeForURL(e) {
    for (const o of this._projects.values()) {
      const t = o.uiSourceCodeForURL(e);
      if (t) return t;
    }
    return null;
  }
  uiSourceCodesForProjectType(e) {
    const o = [];
    for (const t of this._projects.values())
      t.type() === e && o.push(...t.uiSourceCodes());
    return o;
  }
  addProject(e) {
    console.assert(
      !this._projects.has(e.id()),
      `A project with id ${e.id()} already exists!`
    ),
      this._projects.set(e.id(), e),
      this.dispatchEventToListeners(Events.ProjectAdded, e);
  }
  _removeProject(e) {
    this._projects.delete(e.id()),
      this.dispatchEventToListeners(Events.ProjectRemoved, e);
  }
  project(e) {
    return this._projects.get(e) || null;
  }
  projects() {
    return [...this._projects.values()];
  }
  projectsForType(e) {
    return this.projects().filter(function (o) {
      return o.type() === e;
    });
  }
  uiSourceCodes() {
    const e = [];
    for (const o of this._projects.values()) e.push(...o.uiSourceCodes());
    return e;
  }
  setHasResourceContentTrackingExtensions(e) {
    this._hasResourceContentTrackingExtensions = e;
  }
  hasResourceContentTrackingExtensions() {
    return this._hasResourceContentTrackingExtensions;
  }
}
export const Events = {
  UISourceCodeAdded: Symbol("UISourceCodeAdded"),
  UISourceCodeRemoved: Symbol("UISourceCodeRemoved"),
  UISourceCodeRenamed: Symbol("UISourceCodeRenamed"),
  WorkingCopyChanged: Symbol("WorkingCopyChanged"),
  WorkingCopyCommitted: Symbol("WorkingCopyCommitted"),
  WorkingCopyCommittedByUser: Symbol("WorkingCopyCommittedByUser"),
  ProjectAdded: Symbol("ProjectAdded"),
  ProjectRemoved: Symbol("ProjectRemoved"),
};

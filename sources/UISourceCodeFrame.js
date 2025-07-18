import * as Common from "../common/common.js";
import * as Persistence from "../persistence/persistence.js";
import * as Platform from "../platform/platform.js";
import * as SourceFrame from "../source_frame/source_frame.js";
import * as TextEditor from "../text_editor/text_editor.js";
import * as TextUtils from "../text_utils/text_utils.js";
import * as UI from "../ui/ui.js";
import * as Workspace from "../workspace/workspace.js";
import { CoveragePlugin } from "./CoveragePlugin.js";
import { CSSPlugin } from "./CSSPlugin.js";
import { DebuggerPlugin } from "./DebuggerPlugin.js";
import { GutterDiffPlugin } from "./GutterDiffPlugin.js";
import { JavaScriptCompilerPlugin } from "./JavaScriptCompilerPlugin.js";
import { Plugin } from "./Plugin.js";
import { ScriptOriginPlugin } from "./ScriptOriginPlugin.js";
import { SnippetsPlugin } from "./SnippetsPlugin.js";
import { SourcesPanel } from "./SourcesPanel.js";
export class UISourceCodeFrame extends SourceFrame.SourceFrame.SourceFrameImpl {
  constructor(e) {
    super(() => {
      if (e.isDirty()) {
        return Promise.resolve({ content: e.workingCopy(), isEncoded: false });
      }
      return e.requestContent();
    });

    this._uiSourceCode = e;

    if (Root.Runtime.experiments.isEnabled("sourceDiff")) {
      this._diff = new SourceFrame.SourceCodeDiff.SourceCodeDiff(
        this.textEditor
      );
    }

    this._muteSourceCodeEvents = false;
    this._isSettingContent = false;
    this._persistenceBinding = self.Persistence.persistence.binding(e);
    this._rowMessageBuckets = new Map();
    this._typeDecorationsPending = new Set();
    this._uiSourceCodeEventListeners = [];
    this._messageAndDecorationListeners = [];
    this._boundOnBindingChanged = this._onBindingChanged.bind(this);

    this.textEditor.addEventListener(
      SourceFrame.SourcesTextEditor.Events.EditorBlurred,
      () => UI.Context.Context.instance().setFlavor(UISourceCodeFrame, null)
    );

    this.textEditor.addEventListener(
      SourceFrame.SourcesTextEditor.Events.EditorFocused,
      () => UI.Context.Context.instance().setFlavor(UISourceCodeFrame, this)
    );

    Common.Settings.Settings.instance()
      .moduleSetting("persistenceNetworkOverridesEnabled")
      .addChangeListener(this._onNetworkPersistenceChanged, this);

    this._errorPopoverHelper = new UI.PopoverHelper.PopoverHelper(
      this.element,
      this._getErrorPopoverContent.bind(this)
    );

    this._errorPopoverHelper.setHasPadding(true);
    this._errorPopoverHelper.setTimeout(100, 100);
    this._plugins = [];
    this._initializeUISourceCode();
  }
  _installMessageAndDecorationListeners() {
    if (this._persistenceBinding) {
      const e = this._persistenceBinding.network;
      const t = this._persistenceBinding.fileSystem;
      this._messageAndDecorationListeners = [
        e.addEventListener(
          Workspace.UISourceCode.Events.MessageAdded,
          this._onMessageAdded,
          this
        ),
        e.addEventListener(
          Workspace.UISourceCode.Events.MessageRemoved,
          this._onMessageRemoved,
          this
        ),
        e.addEventListener(
          Workspace.UISourceCode.Events.LineDecorationAdded,
          this._onLineDecorationAdded,
          this
        ),
        e.addEventListener(
          Workspace.UISourceCode.Events.LineDecorationRemoved,
          this._onLineDecorationRemoved,
          this
        ),
        t.addEventListener(
          Workspace.UISourceCode.Events.MessageAdded,
          this._onMessageAdded,
          this
        ),
        t.addEventListener(
          Workspace.UISourceCode.Events.MessageRemoved,
          this._onMessageRemoved,
          this
        ),
      ];
    } else {
      this._messageAndDecorationListeners = [
        this._uiSourceCode.addEventListener(
          Workspace.UISourceCode.Events.MessageAdded,
          this._onMessageAdded,
          this
        ),
        this._uiSourceCode.addEventListener(
          Workspace.UISourceCode.Events.MessageRemoved,
          this._onMessageRemoved,
          this
        ),
        this._uiSourceCode.addEventListener(
          Workspace.UISourceCode.Events.LineDecorationAdded,
          this._onLineDecorationAdded,
          this
        ),
        this._uiSourceCode.addEventListener(
          Workspace.UISourceCode.Events.LineDecorationRemoved,
          this._onLineDecorationRemoved,
          this
        ),
      ];
    }
  }
  uiSourceCode() {
    return this._uiSourceCode;
  }
  setUISourceCode(e) {
    this._unloadUISourceCode();
    this._uiSourceCode = e;

    if (e.contentLoaded()) {
      if (e.workingCopy() !== this.textEditor.text()) {
        this._innerSetContent(e.workingCopy());
      }
    } else {
      e.requestContent().then(() => {
        if (
          this._uiSourceCode === e &&
          e.workingCopy() !== this.textEditor.text()
        ) {
          this._innerSetContent(e.workingCopy());
        }
      });
    }

    this._initializeUISourceCode();
  }
  _unloadUISourceCode() {
    this._disposePlugins();
    for (const e of this._allMessages()) {
      this._removeMessageFromSource(e);
    }

    Common.EventTarget.EventTarget.removeEventListeners(
      this._messageAndDecorationListeners
    );

    Common.EventTarget.EventTarget.removeEventListeners(
      this._uiSourceCodeEventListeners
    );

    this._uiSourceCode.removeWorkingCopyGetter();

    self.Persistence.persistence.unsubscribeFromBindingEvent(
      this._uiSourceCode,
      this._boundOnBindingChanged
    );
  }
  _initializeUISourceCode() {
    this._uiSourceCodeEventListeners = [
      this._uiSourceCode.addEventListener(
        Workspace.UISourceCode.Events.WorkingCopyChanged,
        this._onWorkingCopyChanged,
        this
      ),
      this._uiSourceCode.addEventListener(
        Workspace.UISourceCode.Events.WorkingCopyCommitted,
        this._onWorkingCopyCommitted,
        this
      ),
      this._uiSourceCode.addEventListener(
        Workspace.UISourceCode.Events.TitleChanged,
        this._refreshHighlighterType,
        this
      ),
    ];

    self.Persistence.persistence.subscribeForBindingEvent(
      this._uiSourceCode,
      this._boundOnBindingChanged
    );

    for (const e of this._allMessages()) {
      this._addMessageToSource(e);
    }
    this._installMessageAndDecorationListeners();
    this._updateStyle();
    this._decorateAllTypes();
    this._refreshHighlighterType();

    if (Root.Runtime.experiments.isEnabled("sourcesPrettyPrint")) {
      const e = new Set(["text/html", "text/css", "text/javascript"]);
      this.setCanPrettyPrint(e.has(this.highlighterType()), true);
    }

    this._ensurePluginsLoaded();
  }
  wasShown() {
    super.wasShown();
    setImmediate(this._updateBucketDecorations.bind(this));
    this.setEditable(this._canEditSource());
    for (const e of this._plugins) {
      e.wasShown();
    }
  }
  willHide() {
    for (const e of this._plugins) {
      e.willHide();
    }
    super.willHide();
    UI.Context.Context.instance().setFlavor(UISourceCodeFrame, null);
    this._uiSourceCode.removeWorkingCopyGetter();
  }
  _refreshHighlighterType() {
    const e = self.Persistence.persistence.binding(this._uiSourceCode);
    const t = e ? e.network.mimeType() : this._uiSourceCode.mimeType();

    if (this.highlighterType() !== t) {
      this._disposePlugins();
      this.setHighlighterType(t);
      this._ensurePluginsLoaded();
    }
  }
  _canEditSource() {
    return (
      !this.hasLoadError() &&
      !this._uiSourceCode.editDisabled() &&
      this._uiSourceCode.mimeType() !== "application/wasm" &&
      (!!self.Persistence.persistence.binding(this._uiSourceCode) ||
        !!this._uiSourceCode.project().canSetFileContent() ||
        (!this._uiSourceCode.project().isServiceProject() &&
          (!(
            this._uiSourceCode.project().type() !==
              Workspace.Workspace.projectTypes.Network ||
            !self.Persistence.networkPersistenceManager.active()
          ) ||
            ((!this.pretty || !this._uiSourceCode.contentType().hasScripts()) &&
              this._uiSourceCode.contentType() !==
                Common.ResourceType.resourceTypes.Document))))
    );
  }
  _onNetworkPersistenceChanged() {
    this.setEditable(this._canEditSource());
  }
  commitEditing() {
    if (this._uiSourceCode.isDirty()) {
      this._muteSourceCodeEvents = true;
      this._uiSourceCode.commitWorkingCopy();
      this._muteSourceCodeEvents = false;
    }
  }
  setContent(e, t) {
    this._disposePlugins();
    this._rowMessageBuckets.clear();
    super.setContent(e, t);
    for (const e of this._allMessages()) {
      this._addMessageToSource(e);
    }
    this._decorateAllTypes();
    this._ensurePluginsLoaded();
  }
  _allMessages() {
    if (this._persistenceBinding) {
      const e = this._persistenceBinding.network.messages();

      Platform.SetUtilities.addAll(
        e,
        this._persistenceBinding.fileSystem.messages()
      );

      return e;
    }
    return this._uiSourceCode.messages();
  }
  onTextChanged(e, t) {
    const s = this.pretty;
    super.onTextChanged(e, t);
    this._errorPopoverHelper.hidePopover();

    if (!this._isSettingContent) {
      SourcesPanel.instance().updateLastModificationTime();
      this._muteSourceCodeEvents = true;

      if (this.isClean()) {
        this._uiSourceCode.resetWorkingCopy();
      } else {
        this._uiSourceCode.setWorkingCopyGetter(
          this.textEditor.text.bind(this.textEditor)
        );
      }

      this._muteSourceCodeEvents = false;

      if (s !== this.pretty) {
        this._updateStyle();
        this._disposePlugins();
        this._ensurePluginsLoaded();
      }
    }
  }
  _onWorkingCopyChanged(e) {
    if (!this._muteSourceCodeEvents) {
      this._innerSetContent(this._uiSourceCode.workingCopy());
    }
  }
  _onWorkingCopyCommitted(e) {
    if (!this._muteSourceCodeEvents) {
      this._innerSetContent(this._uiSourceCode.workingCopy());
    }

    this.contentCommitted();
    this._updateStyle();
  }
  _ensurePluginsLoaded() {
    if (!this.loaded || this._plugins.length) {
      return;
    }
    const e = self.Persistence.persistence.binding(this._uiSourceCode);
    const t = e ? e.network : this._uiSourceCode;

    if (DebuggerPlugin.accepts(t)) {
      this._plugins.push(new DebuggerPlugin(this.textEditor, t, this));
    }

    if (CSSPlugin.accepts(t)) {
      this._plugins.push(new CSSPlugin(this.textEditor));
    }

    if (!this.pretty && JavaScriptCompilerPlugin.accepts(t)) {
      this._plugins.push(new JavaScriptCompilerPlugin(this.textEditor, t));
    }

    if (SnippetsPlugin.accepts(t)) {
      this._plugins.push(new SnippetsPlugin(this.textEditor, t));
    }

    if (ScriptOriginPlugin.accepts(t)) {
      this._plugins.push(new ScriptOriginPlugin(this.textEditor, t));
    }

    if (
      !this.pretty &&
      Root.Runtime.experiments.isEnabled("sourceDiff") &&
      GutterDiffPlugin.accepts(t)
    ) {
      this._plugins.push(new GutterDiffPlugin(this.textEditor, t));
    }

    if (CoveragePlugin.accepts(t)) {
      this._plugins.push(new CoveragePlugin(this.textEditor, t));
    }

    this.dispatchEventToListeners(Events.ToolbarItemsChanged);
    for (const e of this._plugins) {
      e.wasShown();
    }
  }
  _disposePlugins() {
    this.textEditor.operation(() => {
      for (const e of this._plugins) {
        e.dispose();
      }
    });

    this._plugins = [];
  }
  _onBindingChanged() {
    const e = self.Persistence.persistence.binding(this._uiSourceCode);

    if (e !== this._persistenceBinding) {
      this._unloadUISourceCode();
      this._persistenceBinding = e;
      this._initializeUISourceCode();
    }
  }
  _updateStyle() {
    this.setEditable(this._canEditSource());
  }
  _innerSetContent(e) {
    this._isSettingContent = true;
    const t = this.textEditor.text();

    if (this._diff) {
      this._diff.highlightModifiedLines(t, e);
    }

    if (t !== e) {
      this.setContent(e, null);
    }

    this._isSettingContent = false;
  }
  async populateTextAreaContextMenu(e, t, s) {
    await super.populateTextAreaContextMenu(e, t, s);
    e.appendApplicableItems(this._uiSourceCode);
    const i = this.editorLocationToUILocation(t, s);

    e.appendApplicableItems(
      new Workspace.UISourceCode.UILocation(
        this._uiSourceCode,
        i.lineNumber,
        i.columnNumber
      )
    );

    e.appendApplicableItems(this);
    for (const i of this._plugins) {
      await i.populateTextAreaContextMenu(e, t, s);
    }
  }
  dispose() {
    this._errorPopoverHelper.dispose();
    this._unloadUISourceCode();
    this.textEditor.dispose();
    this.detach();

    Common.Settings.Settings.instance()
      .moduleSetting("persistenceNetworkOverridesEnabled")
      .removeChangeListener(this._onNetworkPersistenceChanged, this);
  }
  _onMessageAdded(e) {
    const t = e.data;
    this._addMessageToSource(t);
  }
  _getClampedEditorLineNumberForMessage(e) {
    let { lineNumber: t } = this.uiLocationToEditorLocation(
      e.lineNumber(),
      e.columnNumber()
    );

    if (t >= this.textEditor.linesCount) {
      t = this.textEditor.linesCount - 1;
    }

    if (t < 0) {
      t = 0;
    }

    return t;
  }
  _addMessageToSource(e) {
    if (!this.loaded) {
      return;
    }
    const t = this._getClampedEditorLineNumberForMessage(e);
    let s = this._rowMessageBuckets.get(t);

    if (!s) {
      s = new RowMessageBucket(this, this.textEditor, t);
      this._rowMessageBuckets.set(t, s);
    }

    s.addMessage(e);
  }
  _onMessageRemoved(e) {
    const t = e.data;
    this._removeMessageFromSource(t);
  }
  _removeMessageFromSource(e) {
    if (!this.loaded) {
      return;
    }
    const t = this._getClampedEditorLineNumberForMessage(e);
    const s = this._rowMessageBuckets.get(t);

    if (s) {
      s.removeMessage(e);

      if (!s.uniqueMessagesCount()) {
        s.detachFromEditor();
        this._rowMessageBuckets.delete(t);
      }
    }
  }
  _getErrorPopoverContent(e) {
    const t =
      e.target.enclosingNodeOrSelfWithClass(
        "text-editor-line-decoration-icon"
      ) ||
      e.target.enclosingNodeOrSelfWithClass("text-editor-line-decoration-wave");
    if (!t) {
      return null;
    }
    return {
      box: t.enclosingNodeOrSelfWithClass("text-editor-line-decoration-icon")
        ? t.boxInWindow()
        : new AnchorBox(e.clientX, e.clientY, 1, 1),
      show: (e) => {
        const s = t
          .enclosingNodeOrSelfWithClass("text-editor-line-decoration")
          ._messageBucket.messagesDescription();
        e.contentElement.appendChild(s);
        return Promise.resolve(true);
      },
    };
  }
  _updateBucketDecorations() {
    for (const e of this._rowMessageBuckets.values()) {
      e._updateDecoration();
    }
  }
  _onLineDecorationAdded(e) {
    const t = e.data;
    this._decorateTypeThrottled(t.type());
  }
  _onLineDecorationRemoved(e) {
    const t = e.data;
    this._decorateTypeThrottled(t.type());
  }
  async _decorateTypeThrottled(e) {
    if (this._typeDecorationsPending.has(e)) {
      return;
    }
    this._typeDecorationsPending.add(e);
    const t = await self.runtime
      .extensions(SourceFrame.SourceFrame.LineDecorator)
      .find((t) => t.descriptor().decoratorType === e)
      .instance();
    this._typeDecorationsPending.delete(e);

    this.textEditor.codeMirror().operation(() => {
      t.decorate(
        this._persistenceBinding
          ? this._persistenceBinding.network
          : this.uiSourceCode(),
        this.textEditor,
        e
      );
    });
  }
  _decorateAllTypes() {
    if (this.loaded) {
      for (const e of self.runtime.extensions(
        SourceFrame.SourceFrame.LineDecorator
      )) {
        const t = e.descriptor().decoratorType;

        if (this._uiSourceCode.decorationsForType(t)) {
          this._decorateTypeThrottled(t);
        }
      }
    }
  }
  async toolbarItems() {
    const e = await super.toolbarItems();
    const t = [];
    for (const s of this._plugins) {
      e.push(...s.leftToolbarItems());
      t.push(...(await s.rightToolbarItems()));
    }
    return t.length ? [...e, new UI.Toolbar.ToolbarSeparator(true), ...t] : e;
  }
  async populateLineGutterContextMenu(e, t) {
    await super.populateLineGutterContextMenu(e, t);
    for (const s of this._plugins) {
      await s.populateLineGutterContextMenu(e, t);
    }
  }
}
export const iconClassPerLevel = {};
iconClassPerLevel[Workspace.UISourceCode.Message.Level.Error] =
  "smallicon-error";
iconClassPerLevel[Workspace.UISourceCode.Message.Level.Warning] =
  "smallicon-warning";
export const bubbleTypePerLevel = {};
bubbleTypePerLevel[Workspace.UISourceCode.Message.Level.Error] = "error";
bubbleTypePerLevel[Workspace.UISourceCode.Message.Level.Warning] = "warning";
export const lineClassPerLevel = {};
lineClassPerLevel[Workspace.UISourceCode.Message.Level.Error] =
  "text-editor-line-with-error";
lineClassPerLevel[Workspace.UISourceCode.Message.Level.Warning] =
  "text-editor-line-with-warning";
export class RowMessage {
  constructor(e) {
    this._message = e;
    this._repeatCount = 1;
    this.element = document.createElement("div");
    this.element.classList.add("text-editor-row-message");
    this._icon = this.element.createChild("label", "", "dt-icon-label");
    this._icon.type = iconClassPerLevel[e.level()];

    this._repeatCountElement = this.element.createChild(
      "span",
      "text-editor-row-message-repeat-count hidden",
      "dt-small-bubble"
    );

    this._repeatCountElement.type = bubbleTypePerLevel[e.level()];
    const t = this.element.createChild("div");
    const s = this._message.text().split("\n");
    for (let e = 0; e < s.length; ++e) {
      t.createChild("div").textContent = s[e];
    }
  }
  message() {
    return this._message;
  }
  repeatCount() {
    return this._repeatCount;
  }
  setRepeatCount(e) {
    if (this._repeatCount !== e) {
      this._repeatCount = e;
      this._updateMessageRepeatCount();
    }
  }
  _updateMessageRepeatCount() {
    this._repeatCountElement.textContent = this._repeatCount;
    const e = this._repeatCount > 1;
    this._repeatCountElement.classList.toggle("hidden", !e);
    this._icon.classList.toggle("hidden", e);
  }
}
export class RowMessageBucket {
  constructor(e, t, s) {
    this._sourceFrame = e;
    this.textEditor = t;
    this._lineHandle = t.textEditorPositionHandle(s, 0);
    this._decoration = document.createElement("div");
    this._decoration.classList.add("text-editor-line-decoration");
    this._decoration._messageBucket = this;

    this._wave = this._decoration.createChild(
      "div",
      "text-editor-line-decoration-wave"
    );

    this._icon = this._wave.createChild(
      "span",
      "text-editor-line-decoration-icon",
      "dt-icon-label"
    );

    this._decorationStartColumn = null;
    this._messagesDescriptionElement = document.createElement("div");

    this._messagesDescriptionElement.classList.add(
      "text-editor-messages-description-container"
    );

    this._messages = [];
    this._level = null;
  }
  _updateWavePosition(e, t) {
    e = Math.min(e, this.textEditor.linesCount - 1);
    const s = this.textEditor.line(e);
    t = Math.min(t, s.length);
    const i = TextUtils.TextUtils.Utils.lineIndent(s).length;
    const o = Math.max(t - 1, i);

    if (this._decorationStartColumn !== o) {
      if (this._decorationStartColumn !== null) {
        this.textEditor.removeDecoration(this._decoration, e);
      }

      this.textEditor.addDecoration(this._decoration, e, o);
      this._decorationStartColumn = o;
    }
  }
  messagesDescription() {
    this._messagesDescriptionElement.removeChildren();

    UI.Utils.appendStyle(
      this._messagesDescriptionElement,
      "source_frame/messagesPopover.css"
    );

    for (let e = 0; e < this._messages.length; ++e) {
      this._messagesDescriptionElement.appendChild(this._messages[e].element);
    }
    return this._messagesDescriptionElement;
  }
  detachFromEditor() {
    const e = this._lineHandle.resolve();
    if (!e) {
      return;
    }
    const t = e.lineNumber;

    if (this._level) {
      this.textEditor.toggleLineClass(t, lineClassPerLevel[this._level], false);
    }

    if (this._decorationStartColumn !== null) {
      this.textEditor.removeDecoration(this._decoration, t);
      this._decorationStartColumn = null;
    }
  }
  uniqueMessagesCount() {
    return this._messages.length;
  }
  addMessage(e) {
    for (const s of this._messages) {
      if (s.message().isEqual(e)) {
        return void s.setRepeatCount(s.repeatCount() + 1);
      }
    }

    const t = new RowMessage(e);
    this._messages.push(t);
    this._updateDecoration();
  }
  removeMessage(e) {
    for (let t = 0; t < this._messages.length; ++t) {
      const s = this._messages[t];
      if (s.message().isEqual(e)) {
        s.setRepeatCount(s.repeatCount() - 1);

        if (!s.repeatCount()) {
          this._messages.splice(t, 1);
        }

        return void this._updateDecoration();
      }
    }
  }
  _updateDecoration() {
    if (!this._sourceFrame.isShowing()) {
      return;
    }
    if (!this._messages.length) {
      return;
    }
    const e = this._lineHandle.resolve();
    if (!e) {
      return;
    }
    const t = e.lineNumber;
    let s = Number.MAX_VALUE;
    let i = null;
    for (let e = 0; e < this._messages.length; ++e) {
      const o = this._messages[e].message();

      const { columnNumber: n } = this._sourceFrame.uiLocationToEditorLocation(
        t,
        o.columnNumber()
      );

      s = Math.min(s, n);

      if (
        !i ||
        Workspace.UISourceCode.Message.messageLevelComparator(i, o) < 0
      ) {
        i = o;
      }
    }
    this._updateWavePosition(t, s);

    if (this._level !== i.level()) {
      if (this._level) {
        this.textEditor.toggleLineClass(
          t,
          lineClassPerLevel[this._level],
          false
        );

        this._icon.type = "";
      }

      this._level = i.level();

      if (this._level) {
        this.textEditor.toggleLineClass(
          t,
          lineClassPerLevel[this._level],
          true
        );

        this._icon.type = iconClassPerLevel[this._level];
      }
    }
  }
}

Workspace.UISourceCode.Message._messageLevelPriority = {
  Warning: 3,
  Error: 4,
};

Workspace.UISourceCode.Message.messageLevelComparator = (e, t) =>
  Workspace.UISourceCode.Message._messageLevelPriority[e.level()] -
  Workspace.UISourceCode.Message._messageLevelPriority[t.level()];

export const Events = { ToolbarItemsChanged: Symbol("ToolbarItemsChanged") };

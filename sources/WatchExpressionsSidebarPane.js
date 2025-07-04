import * as Common from "../common/common.js";
import * as Components from "../components/components.js";
import * as Host from "../host/host.js";
import * as ObjectUI from "../object_ui/object_ui.js";
import * as Platform from "../platform/platform.js";
import * as SDK from "../sdk/sdk.js";
import * as UI from "../ui/ui.js";
import { UISourceCodeFrame } from "./UISourceCodeFrame.js";
export class WatchExpressionsSidebarPane extends UI.ThrottledWidget
  .ThrottledWidget {
  constructor() {
    super(true);
    this.registerRequiredCSS("object_ui/objectValue.css");
    this.registerRequiredCSS("sources/watchExpressionsSidebarPane.css");
    this._watchExpressions = [];

    this._watchExpressionsSetting =
      Common.Settings.Settings.instance().createLocalSetting(
        "watchExpressions",
        []
      );

    this._addButton = new UI.Toolbar.ToolbarButton(
      ls`Add watch expression`,
      "largeicon-add"
    );

    this._addButton.addEventListener(
      UI.Toolbar.ToolbarButton.Events.Click,
      (e) => {
        this._addButtonClicked();
      }
    );

    this._refreshButton = new UI.Toolbar.ToolbarButton(
      ls`Refresh watch expressions`,
      "largeicon-refresh"
    );

    this._refreshButton.addEventListener(
      UI.Toolbar.ToolbarButton.Events.Click,
      this.update,
      this
    );

    this.contentElement.classList.add("watch-expressions");

    this.contentElement.addEventListener(
      "contextmenu",
      this._contextMenu.bind(this),
      false
    );

    this._treeOutline =
      new ObjectUI.ObjectPropertiesSection.ObjectPropertiesSectionsTreeOutline();

    this._treeOutline.registerRequiredCSS(
      "sources/watchExpressionsSidebarPane.css"
    );

    this._treeOutline.setShowSelectionOnKeyboardFocus(true);

    this._expandController =
      new ObjectUI.ObjectPropertiesSection.ObjectPropertiesSectionsTreeExpandController(
        this._treeOutline
      );

    UI.Context.Context.instance().addFlavorChangeListener(
      SDK.RuntimeModel.ExecutionContext,
      this.update,
      this
    );

    UI.Context.Context.instance().addFlavorChangeListener(
      SDK.DebuggerModel.CallFrame,
      this.update,
      this
    );

    this._linkifier = new Components.Linkifier.Linkifier();
    this.update();
  }
  toolbarItems() {
    return [this._addButton, this._refreshButton];
  }
  focus() {
    if (!this.hasFocus()) {
      if (this._watchExpressions.length > 0) {
        this._treeOutline.forceSelect();
      }
    }
  }
  hasExpressions() {
    return !!this._watchExpressionsSetting.get().length;
  }
  _saveExpressions() {
    const e = [];
    for (let t = 0; t < this._watchExpressions.length; t++) {
      if (this._watchExpressions[t].expression()) {
        e.push(this._watchExpressions[t].expression());
      }
    }
    this._watchExpressionsSetting.set(e);
  }
  async _addButtonClicked() {
    await UI.ViewManager.ViewManager.instance().showView("sources.watch");
    this._createWatchExpression(null).startEditing();
  }
  doUpdate() {
    this._linkifier.reset();
    this.contentElement.removeChildren();
    this._treeOutline.removeChildren();
    this._watchExpressions = [];

    this._emptyElement = this.contentElement.createChild(
      "div",
      "gray-info-message"
    );

    this._emptyElement.textContent = Common.UIString.UIString(
      "No watch expressions"
    );

    this._emptyElement.tabIndex = -1;
    const e = this._watchExpressionsSetting.get();

    for (const s of e) {
      if (s) {
        this._createWatchExpression(s);
      }
    }

    return Promise.resolve();
  }
  _createWatchExpression(e) {
    this._emptyElement.classList.add("hidden");
    this.contentElement.appendChild(this._treeOutline.element);
    const t = new WatchExpression(e, this._expandController, this._linkifier);

    t.addEventListener(
      WatchExpression.Events.ExpressionUpdated,
      this._watchExpressionUpdated,
      this
    );

    this._treeOutline.appendChild(t.treeElement());
    this._watchExpressions.push(t);
    return t;
  }
  _watchExpressionUpdated(e) {
    const t = e.data;

    if (!t.expression()) {
      Platform.ArrayUtilities.removeElement(this._watchExpressions, t);
      this._treeOutline.removeChild(t.treeElement());

      this._emptyElement.classList.toggle(
        "hidden",
        !!this._watchExpressions.length
      );

      this._watchExpressions.length === 0 && this._treeOutline.element.remove();
    }

    this._saveExpressions();
  }
  _contextMenu(e) {
    const t = new UI.ContextMenu.ContextMenu(e);
    this._populateContextMenu(t, e);
    t.show();
  }
  _populateContextMenu(e, t) {
    let s = false;
    for (const e of this._watchExpressions) {
      s |= e.isEditing();
    }

    if (!s) {
      e.debugSection().appendItem(
        Common.UIString.UIString("Add watch expression"),
        this._addButtonClicked.bind(this)
      );
    }

    if (this._watchExpressions.length > 1) {
      e.debugSection().appendItem(
        Common.UIString.UIString("Delete all watch expressions"),
        this._deleteAllButtonClicked.bind(this)
      );
    }

    const i = this._treeOutline.treeElementFromEvent(t);
    if (!i) {
      return;
    }
    this._watchExpressions
      .find((e) => i.hasAncestorOrSelf(e.treeElement()))
      ._populateContextMenu(e, t);
  }
  _deleteAllButtonClicked() {
    this._watchExpressions = [];
    this._saveExpressions();
    this.update();
  }
  _focusAndAddExpressionToWatch(e) {
    UI.ViewManager.ViewManager.instance().showView("sources.watch");
    this.doUpdate();
    this._addExpressionToWatch(e);
  }
  _addExpressionToWatch(e) {
    this._createWatchExpression(e);
    this._saveExpressions();
  }
  handleAction(e, t) {
    const s = UI.Context.Context.instance().flavor(UISourceCodeFrame);
    if (!s) {
      return false;
    }
    const i = s.textEditor.text(s.textEditor.selection());
    this._focusAndAddExpressionToWatch(i);
    return true;
  }
  _addPropertyPathToWatch(e) {
    this._addExpressionToWatch(e.path());
  }
  appendApplicableItems(e, t, s) {
    if (
      s instanceof ObjectUI.ObjectPropertiesSection.ObjectPropertyTreeElement &&
      !s.property.synthetic
    ) {
      t.debugSection().appendItem(
        ls`Add property path to watch`,
        this._addPropertyPathToWatch.bind(this, s)
      );
    }

    const i = UI.Context.Context.instance().flavor(UISourceCodeFrame);

    if (i && !i.textEditor.selection().isEmpty()) {
      t.debugSection().appendAction("sources.add-to-watch");
    }
  }
}
export class WatchExpression extends Common.ObjectWrapper.ObjectWrapper {
  constructor(e, t, s) {
    super();
    this._expression = e;
    this._expandController = t;
    this._element = document.createElement("div");
    this._element.classList.add("watch-expression");
    this._element.classList.add("monospace");
    this._editing = false;
    this._linkifier = s;
    this._createWatchExpression();
    this.update();
  }
  treeElement() {
    return this._treeElement;
  }
  expression() {
    return this._expression;
  }
  update() {
    const e = UI.Context.Context.instance().flavor(
      SDK.RuntimeModel.ExecutionContext
    );

    if (e && this._expression) {
      e.evaluate(
        {
          expression: this._expression,
          objectGroup: WatchExpression._watchObjectGroupId,
          includeCommandLineAPI: false,
          silent: true,
          returnByValue: false,
          generatePreview: false,
        },
        false,
        false
      ).then((e) => this._createWatchExpression(e.object, e.exceptionDetails));
    }
  }
  startEditing() {
    this._editing = true;
    this._element.removeChildren();
    const e = this._element.createChild("div");
    e.textContent = this._nameElement.textContent;
    this._textPrompt =
      new ObjectUI.ObjectPropertiesSection.ObjectPropertyPrompt();
    this._textPrompt.renderAsBlock();
    const t = this._textPrompt.attachAndStartEditing(
      e,
      this._finishEditing.bind(this)
    );
    this._treeElement.listItemElement.classList.add("watch-expression-editing");
    this._treeElement.collapse();
    t.classList.add("watch-expression-text-prompt-proxy");
    t.addEventListener("keydown", this._promptKeyDown.bind(this), false);
    this._element.getComponentSelection().selectAllChildren(e);
  }
  isEditing() {
    return !!this._editing;
  }
  _finishEditing(e, t) {
    if (e) {
      e.consume(t);
    }

    this._editing = false;

    this._treeElement.listItemElement.classList.remove(
      "watch-expression-editing"
    );

    this._textPrompt.detach();
    const s = t ? this._expression : this._textPrompt.text();
    delete this._textPrompt;
    this._element.removeChildren();
    this._updateExpression(s);
  }
  _dblClickOnWatchExpression(e) {
    e.consume();

    if (!this.isEditing()) {
      this.startEditing();
    }
  }
  _updateExpression(e) {
    if (this._expression) {
      this._expandController.stopWatchSectionsWithId(this._expression);
    }

    this._expression = e;
    this.update();

    this.dispatchEventToListeners(
      WatchExpression.Events.ExpressionUpdated,
      this
    );
  }
  _deleteWatchExpression(e) {
    e.consume(true);
    this._updateExpression(null);
  }
  _createWatchExpression(e, t) {
    this._result = e || null;
    this._element.removeChildren();
    const s = this._treeElement;
    this._createWatchExpressionTreeElement(e, t);

    if (s && s.parent) {
      const e = s.parent;
      const t = e.indexOfChild(s);
      e.removeChild(s);
      e.insertChild(this._treeElement, t);
    }

    this._treeElement.select();
  }
  _createWatchExpressionHeader(e, t) {
    const s = this._element.createChild("div", "watch-expression-header");

    const i = UI.Icon.Icon.create(
      "smallicon-cross",
      "watch-expression-delete-button"
    );

    i.title = ls`Delete watch expression`;
    i.addEventListener("click", this._deleteWatchExpression.bind(this), false);
    const n = s.createChild("div", "watch-expression-title tree-element-title");
    n.appendChild(i);

    this._nameElement =
      ObjectUI.ObjectPropertiesSection.ObjectPropertiesSection.createNameElement(
        this._expression
      );

    if (t || !e) {
      this._valueElement = document.createElement("span");
      this._valueElement.classList.add("watch-expression-error");
      this._valueElement.classList.add("value");
      n.classList.add("dimmed");
      this._valueElement.textContent =
        Common.UIString.UIString("<not available>");
    } else {
      const s =
        ObjectUI.ObjectPropertiesSection.ObjectPropertiesSection.createPropertyValueWithCustomSupport(
          e,
          !!t,
          false,
          n,
          this._linkifier
        );
      this._valueElement = s.element;
    }

    const o = document.createElement("span");
    o.classList.add("watch-expressions-separator");
    o.textContent = ": ";
    n.appendChildren(this._nameElement, o, this._valueElement);
    return s;
  }
  _createWatchExpressionTreeElement(e, t) {
    const s = this._createWatchExpressionHeader(e, t);

    if (!t && e && e.hasChildren && !e.customPreview()) {
      s.classList.add("watch-expression-object-header");

      this._treeElement = new ObjectUI.ObjectPropertiesSection.RootElement(
        e,
        this._linkifier
      );

      this._expandController.watchSection(this._expression, this._treeElement);

      this._treeElement.toggleOnClick = false;

      this._treeElement.listItemElement.addEventListener(
        "click",
        this._onSectionClick.bind(this),
        false
      );

      this._treeElement.listItemElement.addEventListener(
        "dblclick",
        this._dblClickOnWatchExpression.bind(this)
      );
    } else {
      s.addEventListener(
        "dblclick",
        this._dblClickOnWatchExpression.bind(this)
      );

      this._treeElement = new UI.TreeOutline.TreeElement();
    }

    this._treeElement.title = this._element;

    this._treeElement.listItemElement.classList.add(
      "watch-expression-tree-item"
    );

    this._treeElement.listItemElement.addEventListener("keydown", (e) => {
      if (isEnterKey(e) && !this.isEditing()) {
        this.startEditing();
        e.consume(true);
      }
    });
  }
  _onSectionClick(e) {
    e.consume(true);

    if (e.detail === 1) {
      this._preventClickTimeout = setTimeout(() => {
        if (!this._treeElement) {
          return;
        }

        if (this._treeElement.expanded) {
          this._treeElement.collapse();
        } else {
          this._treeElement.expand();
        }
      }, 333);
    } else {
      clearTimeout(this._preventClickTimeout);
      delete this._preventClickTimeout;
    }
  }
  _promptKeyDown(e) {
    if (isEnterKey(e) || isEscKey(e)) {
      this._finishEditing(e, isEscKey(e));
    }
  }
  _populateContextMenu(e, t) {
    if (!this.isEditing()) {
      e.editSection().appendItem(
        Common.UIString.UIString("Delete watch expression"),
        this._updateExpression.bind(this, null)
      );
    }

    if (
      !this.isEditing() &&
      this._result &&
      (this._result.type === "number" || this._result.type === "string")
    ) {
      e.clipboardSection().appendItem(
        Common.UIString.UIString("Copy value"),
        this._copyValueButtonClicked.bind(this)
      );
    }

    const s = t.deepElementFromPoint();

    if (s && this._valueElement.isSelfOrAncestor(s)) {
      e.appendApplicableItems(this._result);
    }
  }
  _copyValueButtonClicked() {
    Host.InspectorFrontendHost.InspectorFrontendHostInstance.copyText(
      this._valueElement.textContent
    );
  }
}
WatchExpression._watchObjectGroupId = "watch-group";
WatchExpression.Events = { ExpressionUpdated: Symbol("ExpressionUpdated") };

import * as Common from "../common/common.js";
import * as ObjectUI from "../object_ui/object_ui.js";
import * as Platform from "../platform/platform.js";
import * as SDK from "../sdk/sdk.js";
import * as UI from "../ui/ui.js";
export class JSONView extends UI.Widget.VBox {
  constructor(e, t) {
    super();
    this._initialized = false;
    this.registerRequiredCSS("source_frame/jsonView.css");
    this._parsedJSON = e;
    this._startCollapsed = !!t;
    this.element.classList.add("json-view");
    this._searchableView;
    this._treeOutline;
    this._currentSearchFocusIndex = 0;
    this._currentSearchTreeElements = [];
    this._searchRegex = null;
  }
  static async createView(e) {
    const t = await JSONView._parseJSON(e);
    if (!t || typeof t.data != "object") {
      return null;
    }
    const r = new JSONView(t);
    const s = new UI.SearchableView.SearchableView(r);
    s.setPlaceholder(Common.UIString.UIString("Find"));
    r._searchableView = s;
    r.show(s.element);
    return s;
  }
  static createViewSync(e) {
    const t = new JSONView(new ParsedJSON(e, "", ""));
    const r = new UI.SearchableView.SearchableView(t);
    r.setPlaceholder(Common.UIString.UIString("Find"));
    t._searchableView = r;
    t.show(r.element);
    t.element.setAttribute("tabIndex", 0);
    return r;
  }
  static _parseJSON(e) {
    let t = null;

    if (e) {
      t = JSONView._extractJSON(e);
    }

    if (!t) {
      return Promise.resolve(null);
    }

    try {
      const e = JSON.parse(t.data);
      if (!e) {
        return Promise.resolve(null);
      }
      t.data = e;
    } catch (e) {
      t = null;
    }
    return Promise.resolve(t);
  }
  static _extractJSON(e) {
    if (e.startsWith("<")) {
      return null;
    }
    let t = JSONView._findBrackets(e, "{", "}");
    const r = JSONView._findBrackets(e, "[", "]");
    t = r.length > t.length ? r : t;

    if (-1 === t.length || e.length - t.length > 80) {
      return null;
    }

    const s = e.substring(0, t.start);
    const i = e.substring(t.end + 1);
    e = e.substring(t.start, t.end + 1);

    return !i.trim().length ||
      (i.trim().startsWith(")") && s.trim().endsWith("("))
      ? new ParsedJSON(e, s, i)
      : null;
  }
  static _findBrackets(e, t, r) {
    const s = e.indexOf(t);
    const i = e.lastIndexOf(r);
    let n = i - s - 1;

    if (-1 === s || -1 === i || -1 === i || i < s) {
      n = -1;
    }

    return { start: s, end: i, length: n };
  }
  wasShown() {
    this._initialize();
  }
  _initialize() {
    if (this._initialized) {
      return;
    }
    this._initialized = true;

    const e = SDK.RemoteObject.RemoteObject.fromLocalObject(
      this._parsedJSON.data
    );

    const t = this._parsedJSON.prefix + e.description + this._parsedJSON.suffix;

    this._treeOutline =
      new ObjectUI.ObjectPropertiesSection.ObjectPropertiesSection(
        e,
        t,
        undefined,
        undefined,
        undefined,
        undefined,
        true
      );

    this._treeOutline.enableContextMenu();
    this._treeOutline.setEditable(false);

    if (!this._startCollapsed) {
      this._treeOutline.expand();
    }

    this.element.appendChild(this._treeOutline.element);
    this._treeOutline.firstChild().select(true, false);
  }
  _jumpToMatch(e) {
    if (!this._searchRegex) {
      return;
    }
    const t = this._currentSearchTreeElements[this._currentSearchFocusIndex];

    if (t) {
      t.setSearchRegex(this._searchRegex);
    }

    const r = this._currentSearchTreeElements[e];

    if (r) {
      this._updateSearchIndex(e);

      r.setSearchRegex(
        this._searchRegex,
        UI.UIUtils.highlightedCurrentSearchResultClassName
      );

      r.reveal();
    } else {
      this._updateSearchIndex(0);
    }
  }
  _updateSearchCount(e) {
    if (this._searchableView) {
      this._searchableView.updateSearchMatchesCount(e);
    }
  }
  _updateSearchIndex(e) {
    this._currentSearchFocusIndex = e;

    if (this._searchableView) {
      this._searchableView.updateCurrentMatchIndex(e);
    }
  }
  searchCanceled() {
    this._searchRegex = null;
    this._currentSearchTreeElements = [];
    for (
      let e = this._treeOutline.rootElement();
      e;
      e = e.traverseNextTreeElement(false)
    ) {
      if (
        e instanceof ObjectUI.ObjectPropertiesSection.ObjectPropertyTreeElement
      ) {
        e.revertHighlightChanges();
      }
    }
    this._updateSearchCount(0);
    this._updateSearchIndex(0);
  }
  performSearch(e, t, r) {
    let s = this._currentSearchFocusIndex;
    const i = this._currentSearchTreeElements[s];
    this.searchCanceled();
    this._searchRegex = e.toSearchRegex(true);
    for (
      let e = this._treeOutline.rootElement();
      e;
      e = e.traverseNextTreeElement(false)
    ) {
      if (
        !(
          e instanceof
          ObjectUI.ObjectPropertiesSection.ObjectPropertyTreeElement
        )
      ) {
        continue;
      }
      const t = e.setSearchRegex(this._searchRegex);

      if (t) {
        this._currentSearchTreeElements.push(e);
      }

      if (i === e) {
        const e = this._currentSearchTreeElements.length - 1;
        s = t || r ? e : e + 1;
      }
    }
    this._updateSearchCount(this._currentSearchTreeElements.length);

    if (this._currentSearchTreeElements.length) {
      s = Platform.NumberUtilities.mod(
        s,
        this._currentSearchTreeElements.length
      );

      this._jumpToMatch(s);
    } else {
      this._updateSearchIndex(0);
    }
  }
  jumpToNextSearchResult() {
    if (!this._currentSearchTreeElements.length) {
      return;
    }
    const e = Platform.NumberUtilities.mod(
      this._currentSearchFocusIndex + 1,
      this._currentSearchTreeElements.length
    );
    this._jumpToMatch(e);
  }
  jumpToPreviousSearchResult() {
    if (!this._currentSearchTreeElements.length) {
      return;
    }
    const e = Platform.NumberUtilities.mod(
      this._currentSearchFocusIndex - 1,
      this._currentSearchTreeElements.length
    );
    this._jumpToMatch(e);
  }
  supportsCaseSensitiveSearch() {
    return true;
  }
  supportsRegexSearch() {
    return true;
  }
}
export class ParsedJSON {
  constructor(e, t, r) {
    this.data = e;
    this.prefix = t;
    this.suffix = r;
  }
}

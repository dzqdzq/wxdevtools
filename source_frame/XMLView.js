import * as Common from "../common/common.js";
import * as Platform from "../platform/platform.js";
import * as TextUtils from "../text_utils/text_utils.js";
import * as UI from "../ui/ui.js";
export class XMLView extends UI.Widget.Widget {
  constructor(e) {
    super(true);
    this.registerRequiredCSS("source_frame/xmlView.css");
    this.contentElement.classList.add("shadow-xml-view", "source-code");
    this._treeOutline = new UI.TreeOutline.TreeOutlineInShadow();
    this._treeOutline.registerRequiredCSS("source_frame/xmlTree.css");
    this.contentElement.appendChild(this._treeOutline.element);
    this._searchableView;
    this._currentSearchFocusIndex = 0;
    this._currentSearchTreeElements = [];
    this._searchConfig;
    XMLViewNode.populate(this._treeOutline, e, this);
    this._treeOutline.firstChild().select(true, false);
  }
  static createSearchableView(e) {
    const t = new XMLView(e);
    const s = new UI.SearchableView.SearchableView(t);
    s.setPlaceholder(Common.UIString.UIString("Find"));
    t._searchableView = s;
    t.show(s.element);
    return s;
  }
  static parseXML(e, t) {
    let s;
    try {
      s = new DOMParser().parseFromString(e, t);
    } catch (e) {
      return null;
    }
    return s.body || s;
  }
  _jumpToMatch(e, t) {
    if (!this._searchConfig) {
      return;
    }
    const s = this._searchConfig.toSearchRegex(true);
    const i = this._currentSearchTreeElements[this._currentSearchFocusIndex];

    if (i) {
      i.setSearchRegex(s);
    }

    const r = this._currentSearchTreeElements[e];

    if (r) {
      this._updateSearchIndex(e);
      t && r.reveal(true);
      r.setSearchRegex(s, UI.UIUtils.highlightedCurrentSearchResultClassName);
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
  _innerPerformSearch(e, t) {
    if (!this._searchConfig) {
      return;
    }
    let s = this._currentSearchFocusIndex;
    const i = this._currentSearchTreeElements[s];
    this._innerSearchCanceled();
    this._currentSearchTreeElements = [];
    const r = this._searchConfig.toSearchRegex(true);
    for (
      let e = this._treeOutline.rootElement();
      e;
      e = e.traverseNextTreeElement(false)
    ) {
      if (!(e instanceof XMLViewNode)) {
        continue;
      }
      const h = e.setSearchRegex(r);

      if (h) {
        this._currentSearchTreeElements.push(e);
      }

      if (i === e) {
        const e = this._currentSearchTreeElements.length - 1;
        s = h || t ? e : e + 1;
      }
    }
    this._updateSearchCount(this._currentSearchTreeElements.length);

    if (this._currentSearchTreeElements.length) {
      s = Platform.NumberUtilities.mod(
        s,
        this._currentSearchTreeElements.length
      );

      this._jumpToMatch(s, e);
    } else {
      this._updateSearchIndex(0);
    }
  }
  _innerSearchCanceled() {
    for (
      let e = this._treeOutline.rootElement();
      e;
      e = e.traverseNextTreeElement(false)
    ) {
      if (e instanceof XMLViewNode) {
        e.revertHighlightChanges();
      }
    }
    this._updateSearchCount(0);
    this._updateSearchIndex(0);
  }
  searchCanceled() {
    this._searchConfig = null;
    this._currentSearchTreeElements = [];
    this._innerSearchCanceled();
  }
  performSearch(e, t, s) {
    this._searchConfig = e;
    this._innerPerformSearch(t, s);
  }
  jumpToNextSearchResult() {
    if (!this._currentSearchTreeElements.length) {
      return;
    }
    const e = Platform.NumberUtilities.mod(
      this._currentSearchFocusIndex + 1,
      this._currentSearchTreeElements.length
    );
    this._jumpToMatch(e, true);
  }
  jumpToPreviousSearchResult() {
    if (!this._currentSearchTreeElements.length) {
      return;
    }
    const e = Platform.NumberUtilities.mod(
      this._currentSearchFocusIndex - 1,
      this._currentSearchTreeElements.length
    );
    this._jumpToMatch(e, true);
  }
  supportsCaseSensitiveSearch() {
    return true;
  }
  supportsRegexSearch() {
    return true;
  }
}
export class XMLViewNode extends UI.TreeOutline.TreeElement {
  constructor(e, t, s) {
    super("", !t && !!e.childElementCount);
    this._node = e;
    this._closeTag = t;
    this.selectable = true;
    this._highlightChanges = [];
    this._xmlView = s;
    this._updateTitle();
  }
  static populate(e, t, s) {
    let t_firstChild = t.firstChild;

    while (t_firstChild) {
      const t = t_firstChild;
      t_firstChild = t_firstChild.nextSibling;
      const t_nodeType = t.nodeType;

      if (
        (t_nodeType !== 3 || !t.nodeValue.match(/\s+/)) &&
        (t_nodeType === 1 ||
          t_nodeType === 3 ||
          t_nodeType === 4 ||
          t_nodeType === 7 ||
          t_nodeType === 8)
      ) {
        e.appendChild(new XMLViewNode(t, false, s));
      }
    }
  }
  setSearchRegex(e, t) {
    this.revertHighlightChanges();

    if (!e) {
      return false;
    }

    if (this._closeTag && this.parent && !this.parent.expanded) {
      return false;
    }
    e.lastIndex = 0;
    let s = UI.UIUtils.highlightedSearchResultClassName;

    if (t) {
      s += ` ${t}`;
    }

    const i = this.listItemElement.textContent.replace(/\xA0/g, " ");
    let r = e.exec(i);
    const h = [];

    while (r) {
      h.push(new TextUtils.TextRange.SourceRange(r.index, r[0].length));
      r = e.exec(i);
    }

    if (h.length) {
      UI.UIUtils.highlightRangesWithStyleClass(
        this.listItemElement,
        h,
        s,
        this._highlightChanges
      );
    }

    return !!this._highlightChanges.length;
  }
  revertHighlightChanges() {
    UI.UIUtils.revertDomChanges(this._highlightChanges);
    this._highlightChanges = [];
  }
  _updateTitle() {
    const e = this._node;
    switch (e.nodeType) {
      case 1: {
        const { tagName, attributes } = e;

        if (this._closeTag) {
          return void this._setTitle([`</${tagName}>`, "shadow-xml-view-tag"]);
        }
        const s = [`<${tagName}`, "shadow-xml-view-tag"];
        for (let e = 0; e < attributes.length; ++e) {
          const t = attributes.item(e);
          s.push(
            " ",
            "shadow-xml-view-tag",
            t.name,
            "shadow-xml-view-attribute-name",
            '="',
            "shadow-xml-view-tag",
            t.value,
            "shadow-xml-view-attribute-value",
            '"',
            "shadow-xml-view-tag"
          );
        }

        if (!this.expanded) {
          if (e.childElementCount) {
            s.push(
              ">",
              "shadow-xml-view-tag",
              "…",
              "shadow-xml-view-comment",
              `</${tagName}`,
              "shadow-xml-view-tag"
            );
          } else if (this._node.textContent) {
            s.push(
              ">",
              "shadow-xml-view-tag",
              e.textContent,
              "shadow-xml-view-text",
              `</${tagName}`,
              "shadow-xml-view-tag"
            );
          } else {
            s.push(" /", "shadow-xml-view-tag");
          }
        }

        s.push(">", "shadow-xml-view-tag");
        return void this._setTitle(s);
      }
      case 3: {
        return void this._setTitle([e.nodeValue, "shadow-xml-view-text"]);
      }
      case 4: {
        return void this._setTitle([
          "<![CDATA[",
          "shadow-xml-view-cdata",
          e.nodeValue,
          "shadow-xml-view-text",
          "]]>",
          "shadow-xml-view-cdata",
        ]);
      }
      case 7: {
        return void this._setTitle([
          `<?${e.nodeName} ${e.nodeValue}?>`,
          "shadow-xml-view-processing-instruction",
        ]);
      }
      case 8: {
        return void this._setTitle([
          `\x3c!--${e.nodeValue}--\x3e`,
          "shadow-xml-view-comment",
        ]);
      }
    }
  }
  _setTitle(e) {
    const t = createDocumentFragment();
    for (let s = 0; s < e.length; s += 2) {
      t.createChild("span", e[s + 1]).textContent = e[s];
    }
    this.title = t;
    this._xmlView._innerPerformSearch(false, false);
  }
  onattach() {
    this.listItemElement.classList.toggle(
      "shadow-xml-view-close-tag",
      this._closeTag
    );
  }
  onexpand() {
    this._updateTitle();
  }
  oncollapse() {
    this._updateTitle();
  }
  async onpopulate() {
    XMLViewNode.populate(this, this._node, this._xmlView);
    this.appendChild(new XMLViewNode(this._node, true, this._xmlView));
  }
}

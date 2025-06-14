import * as TextUtils from "../text_utils/text_utils.js";
import * as UI from "../ui/ui.js";
import { SourceFrameImpl } from "./SourceFrame.js";
export class ResourceSourceFrame extends SourceFrameImpl {
  constructor(e, t, r) {
    super(async () => {
      let t = (await e.requestContent()).content || "";

      if (await e.contentEncoded()) {
        t = window.atob(t);
      }

      return { content: t, isEncoded: false };
    }, r);

    this._resource = e;

    this.setCanPrettyPrint(
      this._resource.contentType().isDocumentOrScriptOrStyleSheet(),
      t
    );
  }
  static createSearchableView(e, t, r) {
    return new SearchableContainer(e, t, r);
  }
  get resource() {
    return this._resource;
  }
  populateTextAreaContextMenu(e, t, r) {
    e.appendApplicableItems(this._resource);
    return Promise.resolve();
  }
}
export class SearchableContainer extends UI.Widget.VBox {
  constructor(e, t, r) {
    super(true);
    this.registerRequiredCSS("source_frame/resourceSourceFrame.css");
    const o = new ResourceSourceFrame(e, r);
    this._sourceFrame = o;
    o.setHighlighterType(t);
    const s = new UI.SearchableView.SearchableView(o);
    s.element.classList.add("searchable-view");
    s.setPlaceholder(ls`Find`);
    o.show(s.element);
    o.setSearchableView(s);
    s.show(this.contentElement);
    const a = new UI.Toolbar.Toolbar("toolbar", this.contentElement);
    o.toolbarItems().then((e) => {
      e.map((e) => a.appendToolbarItem(e));
    });
  }
  async revealPosition(e, t) {
    this._sourceFrame.revealPosition(e, t, true);
  }
}

import * as Search from "../search/search.js";
import * as UI from "../ui/ui.js";
import { SourcesSearchScope } from "./SourcesSearchScope.js";
export class SearchSourcesView extends Search.SearchView.SearchView {
  constructor() {
    super("sources");
  }
  static async openSearch(e, r) {
    const a = UI.ViewManager.ViewManager.instance().view(
      "sources.search-sources-tab"
    );

    (
      await UI.ViewManager.ViewManager.instance().resolveLocation("drawer-view")
    ).appendView(a);

    await UI.ViewManager.ViewManager.instance().revealView(a);
    const c = await a.widget();
    c.toggle(e, !!r);
    return c;
  }
  createScope() {
    return new SourcesSearchScope();
  }
}
export class ActionDelegate {
  handleAction(e, r) {
    this._showSearch();
    return true;
  }
  _showSearch() {
    const e = self.UI.inspectorView.element.window().getSelection();
    let r = "";

    if (e.rangeCount) {
      r = e.toString().replace(/\r?\n.*/, "");
    }

    return SearchSourcesView.openSearch(r);
  }
}

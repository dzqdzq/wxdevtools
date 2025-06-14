import { NetworkNavigatorView } from "./SourcesNavigator.js";
import { DebuggerPlugin } from "./DebuggerPlugin.js";
let wasNetworkNavigatorViewShown = false;

if (wxMain.isFeatureEnabled("autoRevealInstanceFrame")) {
  NetworkNavigatorView.instance = () =>
    self.runtime.sharedInstance(NetworkNavigatorView);

  NetworkNavigatorView.prototype.wasShown = () => {
    wasNetworkNavigatorViewShown = true;
  };

  wxMain.on(WxMain.Events.autoRevealInstanceFrame, (e) => {
    if (wasNetworkNavigatorViewShown) {
      setTimeout(() => {
        const r = NetworkNavigatorView.instance();
        try {
          const t = r._scriptsTree._rootElement._children[0]._children.find(
            (r) => r._title === "instanceframe" && r._node.id.endsWith(e)
          );

          if (t) {
            t._children[0]._children[0].reveal();
            t._children[0]._children[0].expand();
          }
        } catch (e) {
          console.error(e);
        }
      }, 500);
    }
  });
}

if (wxMain.isFeatureEnabled("fixBreakpoint")) {
  DebuggerPlugin.prototype._shouldIgnoreExternalBreakpointEvents = function (
    e
  ) {
    if (e.data.uiLocation.uiSourceCode.url() !== this._uiSourceCode.url()) {
      return true;
    }
    if (this._muted) {
      return true;
    }
    for (const e of this._scriptFileForDebuggerModel.values()) {
      if (e.isDivergingFromVM() || e.isMergingToVM()) {
        return true;
      }
    }
    return false;
  };
}

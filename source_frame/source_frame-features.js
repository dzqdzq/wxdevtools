import { SourceFrameImpl } from "./SourceFrame.js";
import * as Common from "../common/common.js";
import { contain, some } from "../third_party/licia.js";
import { ImageView } from "./ImageView.js";
import * as UI from "../ui/ui.js";
const wxApplibToHide = [
  "WAService.js",
  "WAServiceMainContext.js",
  "WASubContext.js",
  "WAGame.js",
];
if (wxMain.isFeatureEnabled("hideWxapplib")) {
  const e = SourceFrameImpl.prototype.setContent;
  SourceFrameImpl.prototype.setContent = function (o, t) {
    const i = Common.Settings.Settings.instance()
      .moduleSetting("hideWxapplib")
      .get();
    if (this._uiSourceCode && i) {
      const e = this._uiSourceCode.name();
      if (some(wxApplibToHide, (o) => contain(e, o))) {
        let e = false;
        const t = o.split("\n");
        if (t.length < 50) {
          for (let o = 0, i = t.length; o < i; o++) {
            if (t[o].length > 100000 /* 1e5 */) {
              e = true;
              break;
            }
          }
        }

        if (e) {
          o = "// Hidden by wechat devtools";
        }
      }
    }
    return e.call(this, o, t);
  };
}

if (wxMain.isFeatureEnabled("fixImageViewSave")) {
  ImageView.prototype._saveImage = function () {
    const e = createElement("a");
    e.download = this._parsedURL.displayName;

    e.href = `devtools://download?name=${encodeURIComponent(
      this._parsedURL.displayName
    )}&url=${encodeURIComponent(this._url)}`;

    e.target = "_blank";
    e.click();
  };
}

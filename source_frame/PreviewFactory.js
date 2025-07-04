import * as Common from "../common/common.js";
import * as TextUtils from "../text_utils/text_utils.js";
import * as UI from "../ui/ui.js";
import { FontView } from "./FontView.js";
import { ImageView } from "./ImageView.js";
import { JSONView } from "./JSONView.js";
import { ResourceSourceFrame } from "./ResourceSourceFrame.js";
import { XMLView } from "./XMLView.js";
export class PreviewFactory {
  static async createPreview(e, r) {
    let t = Common.ResourceType.ResourceType.fromMimeType(r);

    if (t === Common.ResourceType.resourceTypes.Other) {
      t = e.contentType();
    }

    switch (t) {
      case Common.ResourceType.resourceTypes.Image: {
        return new ImageView(r, e);
      }
      case Common.ResourceType.resourceTypes.Font: {
        return new FontView(r, e);
      }
    }

    const o = await e.requestContent();
    if (o.error) {
      return new UI.EmptyWidget.EmptyWidget(o.error);
    }
    if (!o.content) {
      return new UI.EmptyWidget.EmptyWidget(
        Common.UIString.UIString("Nothing to preview")
      );
    }
    let i = o.content;

    if (await e.contentEncoded()) {
      i = window.atob(i);
    }

    const n = XMLView.parseXML(i, r);
    if (n) {
      return XMLView.createSearchableView(n);
    }
    const m = await JSONView.createView(i);
    if (m) {
      return m;
    }
    if (t.isTextType()) {
      const t = e.contentType().canonicalMimeType() || r.replace(/;.*/, "");
      return ResourceSourceFrame.createSearchableView(e, t, true);
    }
    return null;
  }
}

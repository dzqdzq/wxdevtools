import * as Common from "../common/common.js";
import * as Host from "../host/host.js";
import * as Platform from "../platform/platform.js";
import * as TextUtils from "../text_utils/text_utils.js";
import * as UI from "../ui/ui.js";
import * as Workspace from "../workspace/workspace.js";
export class ImageView extends UI.View.SimpleView {
  constructor(e, t) {
    super(Common.UIString.UIString("Image"));
    this.registerRequiredCSS("source_frame/imageView.css");
    this.element.tabIndex = -1;
    this.element.classList.add("image-view");
    this._url = t.contentURL();
    this._parsedURL = new Common.ParsedURL.ParsedURL(this._url);
    this._mimeType = e;
    this._contentProvider = t;
    this._uiSourceCode =
      t instanceof Workspace.UISourceCode.UISourceCode ? t : null;

    if (this._uiSourceCode) {
      this._uiSourceCode.addEventListener(
        Workspace.UISourceCode.Events.WorkingCopyCommitted,
        this._workingCopyCommitted,
        this
      );

      new UI.DropTarget.DropTarget(
        this.element,
        [UI.DropTarget.Type.ImageFile, UI.DropTarget.Type.URI],
        Common.UIString.UIString("Drop image file here"),
        this._handleDrop.bind(this)
      );
    }

    this._sizeLabel = new UI.Toolbar.ToolbarText();
    this._dimensionsLabel = new UI.Toolbar.ToolbarText();
    this._mimeTypeLabel = new UI.Toolbar.ToolbarText(e);
    this._container = this.element.createChild("div", "image");

    this._imagePreviewElement = this._container.createChild(
      "img",
      "resource-image-view"
    );

    this._imagePreviewElement.addEventListener(
      "contextmenu",
      this._contextMenu.bind(this),
      true
    );

    this._imagePreviewElement.alt = ls`Image from ${this._url}`;
  }
  async toolbarItems() {
    return [
      this._sizeLabel,
      new UI.Toolbar.ToolbarSeparator(),
      this._dimensionsLabel,
      new UI.Toolbar.ToolbarSeparator(),
      this._mimeTypeLabel,
    ];
  }
  wasShown() {
    this._updateContentIfNeeded();
  }
  disposeView() {
    if (this._uiSourceCode) {
      this._uiSourceCode.removeEventListener(
        Workspace.UISourceCode.Events.WorkingCopyCommitted,
        this._workingCopyCommitted,
        this
      );
    }
  }
  _workingCopyCommitted() {
    this._updateContentIfNeeded();
  }
  async _updateContentIfNeeded() {
    const { content } = await this._contentProvider.requestContent();
    if (this._cachedContent === content) {
      return;
    }
    const t = await this._contentProvider.contentEncoded();
    this._cachedContent = content;
    let o = TextUtils.ContentProvider.contentAsDataURL(
      content,
      this._mimeType,
      t
    );

    if (content === null) {
      o = this._url;
    }

    const i = new Promise((e) => {
      this._imagePreviewElement.onload = e;
    });
    this._imagePreviewElement.src = o;
    const n = content && !t ? content.length : base64ToSize(content);
    this._sizeLabel.setText(Platform.NumberUtilities.bytesToString(n));
    await i;

    this._dimensionsLabel.setText(
      Common.UIString.UIString(
        "%d × %d",
        this._imagePreviewElement.naturalWidth,
        this._imagePreviewElement.naturalHeight
      )
    );
  }
  _contextMenu(e) {
    const t = new UI.ContextMenu.ContextMenu(e);

    if (!this._parsedURL.isDataURL()) {
      t.clipboardSection().appendItem(
        Common.UIString.UIString("Copy image URL"),
        this._copyImageURL.bind(this)
      );
    }

    if (this._imagePreviewElement.src) {
      t.clipboardSection().appendItem(
        Common.UIString.UIString("Copy image as data URI"),
        this._copyImageAsDataURL.bind(this)
      );
    }

    t.clipboardSection().appendItem(
      Common.UIString.UIString("Open image in new tab"),
      this._openInNewTab.bind(this)
    );

    t.clipboardSection().appendItem(
      Common.UIString.UIString("Save…"),
      this._saveImage.bind(this)
    );

    t.show();
  }
  _copyImageAsDataURL() {
    Host.InspectorFrontendHost.InspectorFrontendHostInstance.copyText(
      this._imagePreviewElement.src
    );
  }
  _copyImageURL() {
    Host.InspectorFrontendHost.InspectorFrontendHostInstance.copyText(
      this._url
    );
  }
  _saveImage() {
    const e = createElement("a");
    e.download = this._parsedURL.displayName;
    e.href = this._url;
    e.click();
  }
  _openInNewTab() {
    Host.InspectorFrontendHost.InspectorFrontendHostInstance.openInNewTab(
      this._url
    );
  }
  async _handleDrop(e) {
    const e_items = e.items;
    if (!e_items.length || e_items[0].kind !== "file") {
      return;
    }
    const o = e_items[0].webkitGetAsEntry();
    const i = !o.name.endsWith(".svg");
    o.file((e) => {
      const t = new FileReader();

      t.onloadend = () => {
        let e;
        try {
          e = t.result;
        } catch (t) {
          e = null;
          console.error(`Can't read file: ${t}`);
        }

        if (typeof e == "string") {
          this._uiSourceCode.setContent(i ? btoa(e) : e, i);
        }
      };

      if (i) {
        t.readAsBinaryString(e);
      } else {
        t.readAsText(e);
      }
    });
  }
}

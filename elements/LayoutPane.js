import*as Common from"../common/common.js";import*as ComponentHelpers from"../component_helpers/component_helpers.js";import*as LitHtml from"../third_party/lit-html/lit-html.js";import{NodeText}from"./NodeText.js";const{render:render,html:html}=LitHtml,ls=Common.ls,getStyleSheets=ComponentHelpers.GetStylesheet.getStyleSheets,showElementButtonTitle=ls`Show element in the Elements panel`;export class SettingChangedEvent extends Event{constructor(e,t){super("setting-changed",{}),this.data={setting:e,value:t}}}export class OverlayChangedEvent extends Event{constructor(e,t){super("overlay-changed",{}),this.data={id:e,value:t}}}export class ElementClickedEvent extends Event{constructor(e){super("element-clicked",{}),this.data={id:e}}}function isEnumSetting(e){return"enum"===e.type}function isBooleanSetting(e){return"boolean"===e.type}export class LayoutPane extends HTMLElement{constructor(){super(),this.shadow=this.attachShadow({mode:"open"}),this.settings=[],this.gridElements=[],this.shadow.adoptedStyleSheets=[...getStyleSheets("ui/inspectorCommon.css",{patchThemeSupport:!0}),...getStyleSheets("ui/inspectorSyntaxHighlight.css",{patchThemeSupport:!0}),...getStyleSheets("elements/layoutPane.css")]}set data(e){this.settings=e.settings,this.gridElements=e.gridElements,this.render()}render(){render(html`
      <details open>
        <summary class="header">
          ${ls`Grid`}
        </summary>
        ${this.gridElements?html`<div class="content-section">
            <h3 class="content-section-title">${ls`Grid overlays`}</h3>
            <div class="elements">
              ${this.gridElements.map(e=>this.renderElement(e))}
            </div>
          </div>`:""}
        <div class="content-section">
          <h3 class="content-section-title">${ls`Overlay display settings`}</h3>
          <div class="checkbox-settings">
            ${this.getBooleanSettings().map(e=>this.renderBooleanSetting(e))}
          </div>
          <div class="select-settings">
            ${this.getEnumSettings().map(e=>this.renderEnumSetting(e))}
          </div>
        </div>
      </details>
    `,this.shadow,{eventContext:this})}getEnumSettings(){return this.settings.filter(isEnumSetting)}getBooleanSettings(){return this.settings.filter(isBooleanSetting)}onBooleanSettingChange(e,t){t.preventDefault(),this.dispatchEvent(new SettingChangedEvent(e.name,t.target.checked))}onEnumSettingChange(e,t){t.preventDefault(),this.dispatchEvent(new SettingChangedEvent(e.name,t.target.value))}onElementToggle(e,t){t.preventDefault(),this.dispatchEvent(new OverlayChangedEvent(e.id,t.target.checked))}onElementClick(e,t){t.preventDefault(),this.dispatchEvent(new ElementClickedEvent(e.id))}renderElement(e){const t=new NodeText;t.data={nodeId:e.domId,nodeTitle:e.name,nodeClasses:e.domClasses};const n=this.onElementToggle.bind(this,e),s=this.onElementClick.bind(this,e);return html`<div class="element">
      <label data-element="true" class="checkbox-label" title=${e.name}>
        <input data-input="true" type="checkbox" .checked=${e.enabled} @change=${n} />
        <span data-label="true">${t}</span>
        </label>
        <button @click=${s} title=${showElementButtonTitle} class="show-element">
        </button>
    </div>`}renderBooleanSetting(e){const t=this.onBooleanSettingChange.bind(this,e);return html`<label data-boolean-setting="true" class="checkbox-label" title=${e.title}>
      <input data-input="true" type="checkbox" .checked=${e.value} @change=${t} />
      <span data-label="true">${e.title}</span>
    </label>`}renderEnumSetting(e){const t=this.onEnumSettingChange.bind(this,e);return html`<label data-enum-setting="true" class="select-label" title=${e.title}>
      <span data-label="true">${e.title}</span>
      <select class="chrome-select" data-input="true" @change=${t}>
        ${e.options.map(t=>html`<option value=${t.value} .selected=${e.value===t.value}>${t.title}</option>`)}
      </select>
    </label>`}}customElements.define("devtools-layout-pane",LayoutPane);
import*as LitHtml from"../third_party/lit-html/lit-html.js";const{render:render,html:html}=LitHtml;export class NodeText extends HTMLElement{constructor(){super(),this.shadow=this.attachShadow({mode:"open"}),this.nodeTitle="",this.nodeId="",this.nodeClasses=[]}set data(e){this.nodeTitle=e.nodeTitle,this.nodeId=e.nodeId,this.nodeClasses=e.nodeClasses,this.render()}render(){const e=[html`<span class="node-label-name">${this.nodeTitle}</span>`];if(this.nodeId&&e.push(html`<span class="node-label-id">#${CSS.escape(this.nodeId)}</span>`),this.nodeClasses&&this.nodeClasses.length>0){const s=this.nodeClasses.map(e=>"."+CSS.escape(e)).join("");e.push(html`<span class="node-label-class">${s}</span>`)}render(html`
      <style>
        .node-label-name {
          color: var(--dom-tag-name-color);
        }

        .node-label-class {
          color: var(--dom-attribute-name-color);
        }
      </style>
      ${e}
    `,this.shadow,{eventContext:this})}}customElements.define("devtools-node-text",NodeText);
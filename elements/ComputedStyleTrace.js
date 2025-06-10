import*as LitHtml from"../third_party/lit-html/lit-html.js";const{render:render,html:html}=LitHtml;export class ComputedStyleTrace extends HTMLElement{constructor(){super(...arguments),this.shadow=this.attachShadow({mode:"open"}),this.selector="",this.active=!1,this.onNavigateToSource=()=>{}}set data(e){this.selector=e.selector,this.active=e.active,this.onNavigateToSource=e.onNavigateToSource,this.render()}render(){render(html`
      <style>
        :host {
          text-overflow: ellipsis;
          overflow: hidden;
          flex-grow: 1;
        }

        .computed-style-trace {
          margin-left: 16px;
        }

        .computed-style-trace:hover {
          background-color: var(--focus-bg-color);
          cursor: pointer;
        }

        .goto {
          /* TODO: reuse with ComputedStyleProperty */
          --size: 16px;
          display: none;
          position: absolute;
          width: var(--size);
          height: var(--size);
          margin: -1px 0 0 calc(-1 * var(--size));
          -webkit-mask-image: url(Images/mediumIcons.svg);
          -webkit-mask-position: -32px 48px;
          background-color: var(--active-control-bg-color);
        }

        .computed-style-trace:hover .goto {
          display: inline-block;
        }

        .trace-value {
          margin-left: 16px;
        }

        .computed-style-trace.inactive slot[name="trace-value"] {
          text-decoration: line-through;
        }

        .trace-selector {
          color: gray;
          padding-left: 2em;
        }

        ::slotted([slot="trace-link"]) {
          user-select: none;
          float: right;
          padding-left: 1em;
          position: relative;
          z-index: 1;
        }

        /* high-contrast styles */
        @media (forced-colors: active) {
          :host-context(.monospace.computed-properties) .computed-style-trace:hover {
            forced-color-adjust: none;
            background-color: Highlight;
          }

          :host-context(.monospace.computed-properties) .goto {
            background-color: HighlightText;
          }

          :host-context(.monospace.computed-properties) .computed-style-trace:hover * {
            color: HighlightText;
          }
        }
      </style>

      <div class="computed-style-trace ${this.active?"active":"inactive"}">
        <span class="goto" @click=${this.onNavigateToSource}></span>
        <slot name="trace-value" @click=${this.onNavigateToSource}></slot>
        <span class="trace-selector">${this.selector}</span>
        <slot name="trace-link"></slot>
      </div>
    `,this.shadow,{eventContext:this})}}customElements.define("devtools-computed-style-trace",ComputedStyleTrace);
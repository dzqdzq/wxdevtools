import*as LitHtml from"../third_party/lit-html/lit-html.js";const html=LitHtml.html,render=LitHtml.render;export class MarkdownView extends HTMLElement{constructor(){super(...arguments),this.shadow=this.attachShadow({mode:"open"}),this.tokenData=[]}set data(e){this.tokenData=e.tokens,this.update()}update(){this.render()}render(){render(html`
      <style>
      .message {
        line-height: 20px;
        font-size: 14px;
        color: var(--issue-gray);
        margin-bottom: 4px;
        user-select: text;
      }

      .message p {
        margin-bottom: 16px;
        margin-block-start: 2px;
      }

      .message ul {
        list-style-type: none;
        list-style-position: inside;
        padding-inline-start: 0;
      }

      .message li {
        margin-top: 8px;
        display: list-item;
      }

      .message li::before {
        content: "→";
        -webkit-mask-image: none;
        padding-right: 5px;
        position: relative;
        top: -1px;
      }

      .message code {
        color: var(--issue-black);
        font-size: 12px;
        user-select: text;
        cursor: text;
        background: var(--issue-code);
      }
      </style>
      <div class='message'>
        ${this.tokenData.map(renderToken)}
      </div>
    `,this.shadow)}}customElements.define("devtools-markdown-view",MarkdownView);const renderChildTokens=e=>e.tokens.map(renderToken),renderText=e=>e.tokens&&e.tokens.length>0?html`${renderChildTokens(e)}`:html`${e.text}`,tokenRenderers=new Map([["paragraph",e=>html`<p>${renderChildTokens(e)}</p>`],["list",e=>html`<ul>${e.items.map(renderToken)}</ul>`],["list_item",e=>html`<li>${renderChildTokens(e)}</li>`],["text",renderText],["codespan",e=>html`<code>${e.text}</code>`],["space",()=>html``]]);export const renderToken=e=>{const t=tokenRenderers.get(e.type);if(!t)throw new Error(`Markdown token type '${e.type}' not supported.`);return t(e)};
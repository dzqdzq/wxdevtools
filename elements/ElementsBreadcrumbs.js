import*as ComponentHelpers from"../component_helpers/component_helpers.js";import*as LitHtml from"../third_party/lit-html/lit-html.js";import{crumbsToRender,NodeSelectedEvent}from"./ElementsBreadcrumbsUtils.js";import{NodeText}from"./NodeText.js";export class ElementsBreadcrumbs extends HTMLElement{constructor(){super(...arguments),this.shadow=this.attachShadow({mode:"open"}),this.resizeObserver=new ResizeObserver(()=>this.update()),this.crumbsData=[],this.selectedDOMNode=null,this.overflowing=!1,this.userScrollPosition="start",this.isObservingResize=!1}set data(e){this.selectedDOMNode=e.selectedNode,this.crumbsData=e.crumbs,this.update()}disconnectedCallback(){this.isObservingResize=!1,this.resizeObserver.disconnect()}onCrumbClick(e){return t=>{t.preventDefault(),this.dispatchEvent(new NodeSelectedEvent(e))}}update(){this.overflowing=!1,this.userScrollPosition="start",this.render(),this.engageResizeObserver(),this.ensureSelectedNodeIsVisible()}onCrumbMouseMove(e){return()=>e.highlightNode()}onCrumbMouseLeave(e){return()=>e.clearHighlight()}onCrumbFocus(e){return()=>e.highlightNode()}onCrumbBlur(e){return()=>e.clearHighlight()}engageResizeObserver(){if(!this.resizeObserver||!0===this.isObservingResize)return;const e=this.shadow.querySelector(".crumbs");e&&(this.resizeObserver.observe(e),this.isObservingResize=!0)}renderCrumbText(e){const t=new NodeText;return t.data={nodeTitle:e.main,nodeId:e.extras.id,nodeClasses:e.extras.classes},t}checkForOverflow(){if(this.overflowing)return;const e=this.shadow.querySelector(".crumbs-scroll-container"),t=this.shadow.querySelector(".crumbs-window");if(!e||!t)return;const r=t.clientWidth-20;e.clientWidth<r||(this.overflowing=!0,this.render())}onCrumbsWindowScroll(e){if(!e.target)return;const t=e.target;this.updateScrollState(t)}updateScrollState(e){const t=e.scrollWidth-e.clientWidth,r=e.scrollLeft;this.userScrollPosition=r<10?"start":r>=t-10?"end":"middle",this.render()}onOverflowClick(e){return()=>{const t=this.shadow.querySelector(".crumbs-window");if(!t)return;const r=t.clientWidth/2,s="left"===e?Math.max(Math.floor(t.scrollLeft-r),0):t.scrollLeft+r;t.scrollTo({behavior:"smooth",left:s})}}renderOverflowButton(e,t){return!1===this.overflowing?LitHtml.html``:LitHtml.html`
      <button
        class="overflow ${e}"
        @click=${this.onOverflowClick(e)}
        ?disabled=${t}
        aria-label="Scroll ${e}"
      >&hellip;</button>
      `}render(){const e=crumbsToRender(this.crumbsData,this.selectedDOMNode);LitHtml.render(LitHtml.html`
      <style>
        .crumbs {
          display: inline-flex;
          align-items: stretch;
          width: 100%;
          overflow: hidden;
          pointer-events: auto;
          cursor: default;
          white-space: nowrap;
          position: relative;
        }

        .crumbs-window {
          flex-grow: 2;
          overflow: hidden;
        }

        .crumbs-scroll-container {
          display: inline-flex;
          margin: 0;
          padding: 0;
        }

        .crumb {
          display: block;
          padding: 0 7px;
          line-height: 23px;
          white-space: nowrap;
        }

        .overflow {
          padding: 0 7px;
          font-weight: bold;
          display: block;
          border: none;
          flex-grow: 0;
          flex-shrink: 0;
          text-align: center;
        }

        .crumb.selected,
        .crumb:hover {
          background-color: var(--toolbar-bg-color);
        }

        .overflow {
          background-color: var(--toolbar-bg-color);
        }

        .overflow:not(:disabled):hover {
          background-color: var(--toolbar-hover-bg-color);
          cursor: pointer;
        }

        .crumb-link {
          text-decoration: none;
          color: inherit;
        }

        ${ComponentHelpers.GetStylesheet.DARK_MODE_CLASS} .overflow:not(:disabled) {
          color: #fff;
        }
      </style>

      <nav class=${"crumbs "+ComponentHelpers.GetStylesheet.applyDarkModeClassIfNeeded()}>
        ${this.renderOverflowButton("left","start"===this.userScrollPosition)}

        <div class="crumbs-window" @scroll=${this.onCrumbsWindowScroll}>
          <ul class="crumbs-scroll-container">
            ${e.map(e=>{const t={crumb:!0,selected:e.selected},r=this.renderCrumbText(e.title);return LitHtml.html`
                <li class=${LitHtml.Directives.classMap(t)}
                  data-node-id=${e.node.id}
                  data-crumb="true"
                >
                  <a href="#"
                    class="crumb-link"
                    @click=${this.onCrumbClick(e.node)}
                    @mousemove=${this.onCrumbMouseMove(e.node)}
                    @mouseleave=${this.onCrumbMouseLeave(e.node)}
                    @focus=${this.onCrumbFocus(e.node)}
                    @blur=${this.onCrumbBlur(e.node)}
                  >${r}</a>
                </li>`})}
          </ul>
        </div>
        ${this.renderOverflowButton("right","end"===this.userScrollPosition)}
      </nav>
    `,this.shadow,{eventContext:this}),this.checkForOverflow()}ensureSelectedNodeIsVisible(){if(!this.selectedDOMNode||!this.shadow||!this.overflowing)return;const e=this.selectedDOMNode.id,t=this.shadow.querySelector(`.crumb[data-node-id="${e}"]`);t&&t.scrollIntoView()}}customElements.define("devtools-elements-breadcrumbs",ElementsBreadcrumbs);
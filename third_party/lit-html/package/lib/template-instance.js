/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
import{isCEPolyfill}from"./dom.js";import{isTemplatePartActive}from"./template.js";export class TemplateInstance{constructor(t,e,s){this.__parts=[],this.template=t,this.processor=e,this.options=s}update(t){let e=0;for(const s of this.__parts)void 0!==s&&s.setValue(t[e]),e++;for(const t of this.__parts)void 0!==t&&t.commit()}_clone(){const t=isCEPolyfill?this.template.element.content.cloneNode(!0):document.importNode(this.template.element.content,!0),e=[],s=this.template.parts,o=document.createTreeWalker(t,133,null,!1);let i,n=0,r=0,p=o.nextNode();for(;n<s.length;)if(i=s[n],isTemplatePartActive(i)){for(;r<i.index;)r++,"TEMPLATE"===p.nodeName&&(e.push(p),o.currentNode=p.content),null===(p=o.nextNode())&&(o.currentNode=e.pop(),p=o.nextNode());if("node"===i.type){const t=this.processor.handleTextExpression(this.options);t.insertAfterNode(p.previousSibling),this.__parts.push(t)}else this.__parts.push(...this.processor.handleAttributeExpressions(p,i.name,i.strings,this.options));n++}else this.__parts.push(void 0),n++;return isCEPolyfill&&(document.adoptNode(t),customElements.upgrade(t)),t}}
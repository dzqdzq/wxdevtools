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
import{reparentNodes}from"./dom.js";import{boundAttributeSuffix,lastAttributeNameRegex,marker,nodeMarker}from"./template.js";const commentMarker=` ${marker} `;export class TemplateResult{constructor(e,t,r,s){this.strings=e,this.values=t,this.type=r,this.processor=s}getHTML(){const e=this.strings.length-1;let t="",r=!1;for(let s=0;s<e;s++){const e=this.strings[s],n=e.lastIndexOf("\x3c!--");r=(n>-1||r)&&-1===e.indexOf("--\x3e",n+1);const l=lastAttributeNameRegex.exec(e);t+=null===l?e+(r?commentMarker:nodeMarker):e.substr(0,l.index)+l[1]+l[2]+boundAttributeSuffix+l[3]+marker}return t+=this.strings[e],t}getTemplateElement(){const e=document.createElement("template");return e.innerHTML=this.getHTML(),e}}export class SVGTemplateResult extends TemplateResult{getHTML(){return`<svg>${super.getHTML()}</svg>`}getTemplateElement(){const e=super.getTemplateElement(),t=e.content,r=t.firstChild;return t.removeChild(r),reparentNodes(t,r.firstChild),e}}
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
import{AttributeCommitter,BooleanAttributePart,EventPart,NodePart,PropertyCommitter}from"./parts.js";export class DefaultTemplateProcessor{handleAttributeExpressions(t,e,r,o){const n=e[0];if("."===n){return new PropertyCommitter(t,e.slice(1),r).parts}if("@"===n)return[new EventPart(t,e.slice(1),o.eventContext)];if("?"===n)return[new BooleanAttributePart(t,e.slice(1),r)];return new AttributeCommitter(t,e,r).parts}handleTextExpression(t){return new NodePart(t)}}export const defaultTemplateProcessor=new DefaultTemplateProcessor;
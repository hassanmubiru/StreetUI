"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  BrowserDOMAdapter: () => BrowserDOMAdapter,
  browserDOMAdapter: () => browserDOMAdapter
});
module.exports = __toCommonJS(index_exports);

// src/browser-adapter.ts
var BrowserDOMAdapter = class {
  createElement(tag, ns) {
    if (ns !== void 0) {
      return document.createElementNS(ns, tag);
    }
    return document.createElement(tag);
  }
  createTextNode(data) {
    return document.createTextNode(data);
  }
  createComment(data) {
    return document.createComment(data);
  }
  createFragment() {
    return document.createDocumentFragment();
  }
  appendChild(parent, child) {
    parent.appendChild(child);
  }
  insertBefore(parent, child, reference) {
    parent.insertBefore(child, reference);
  }
  removeChild(parent, child) {
    parent.removeChild(child);
  }
  replaceChild(parent, newChild, oldChild) {
    parent.replaceChild(newChild, oldChild);
  }
  setAttribute(element, name, value) {
    element.setAttribute(name, value);
  }
  removeAttribute(element, name) {
    element.removeAttribute(name);
  }
  getAttribute(element, name) {
    return element.getAttribute(name);
  }
  setProperty(element, name, value) {
    element[name] = value;
  }
  setTextContent(node, text) {
    node.textContent = text;
  }
  getTextContent(node) {
    return node.textContent;
  }
  addEventListener(target, type, handler, options) {
    target.addEventListener(type, handler, options);
  }
  removeEventListener(target, type, handler, options) {
    target.removeEventListener(type, handler, options);
  }
  querySelector(root, selector) {
    return root.querySelector(selector);
  }
  querySelectorAll(root, selector) {
    return root.querySelectorAll(selector);
  }
  getElementById(id) {
    return document.getElementById(id);
  }
  isElement(node) {
    return node.nodeType === Node.ELEMENT_NODE;
  }
  isTextNode(node) {
    return node.nodeType === Node.TEXT_NODE;
  }
  parentNode(node) {
    return node.parentNode;
  }
  nextSibling(node) {
    return node.nextSibling;
  }
};
var browserDOMAdapter = new BrowserDOMAdapter();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  BrowserDOMAdapter,
  browserDOMAdapter
});
//# sourceMappingURL=index.cjs.map
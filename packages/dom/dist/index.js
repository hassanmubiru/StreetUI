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
export {
  BrowserDOMAdapter,
  browserDOMAdapter
};
//# sourceMappingURL=index.js.map
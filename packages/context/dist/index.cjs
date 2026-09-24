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
  createContext: () => createContext
});
module.exports = __toCommonJS(index_exports);

// src/context.ts
function createContext(defaultValue, description) {
  const id = Symbol(description ?? "streetui.context");
  const stack = [];
  return {
    id,
    defaultValue,
    provide(value, run) {
      stack.push(value);
      try {
        return run();
      } finally {
        stack.pop();
      }
    },
    consume() {
      return stack.length > 0 ? stack[stack.length - 1] : defaultValue;
    },
    hasProvider() {
      return stack.length > 0;
    }
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createContext
});
//# sourceMappingURL=index.cjs.map
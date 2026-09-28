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
  createI18n: () => createI18n,
  interpolate: () => interpolate
});
module.exports = __toCommonJS(index_exports);

// src/i18n.ts
var import_state = require("@streetui/state");
var INTERPOLATION = /\{(\w+)\}/g;
function interpolate(template, params) {
  if (params === void 0) return template;
  return template.replace(INTERPOLATION, (whole, name) => {
    const value = params[name];
    return value === void 0 ? whole : String(value);
  });
}
function createI18n(config) {
  const messages = config.messages;
  const fallback = config.fallbackLocale;
  const localeSignal = (0, import_state.signal)(config.locale);
  const locales = Object.keys(messages);
  function lookup(loc, key) {
    const active = messages[loc];
    const hit = active === void 0 ? void 0 : active[key];
    if (hit !== void 0) return hit;
    if (fallback !== void 0 && fallback !== loc) {
      const fb = messages[fallback];
      if (fb !== void 0) return fb[key];
    }
    return void 0;
  }
  function resolve(loc, key, params) {
    const template = lookup(loc, key);
    return template === void 0 ? key : interpolate(template, params);
  }
  function pluralKey(loc, key, count) {
    const category = new Intl.PluralRules(loc).select(count);
    if (lookup(loc, `${key}.${category}`) !== void 0) return `${key}.${category}`;
    return `${key}.other`;
  }
  return {
    locale: localeSignal,
    locales,
    setLocale(loc) {
      localeSignal.set(loc);
    },
    t(key, params) {
      return (0, import_state.derived)(() => resolve(localeSignal.get(), key, params));
    },
    translate(key, params) {
      return resolve(localeSignal.peek(), key, params);
    },
    plural(key, count, params) {
      const merged = { count, ...params ?? {} };
      return (0, import_state.derived)(() => {
        const loc = localeSignal.get();
        return resolve(loc, pluralKey(loc, key, count), merged);
      });
    },
    has(key) {
      return lookup(localeSignal.peek(), key) !== void 0;
    }
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createI18n,
  interpolate
});
//# sourceMappingURL=index.cjs.map
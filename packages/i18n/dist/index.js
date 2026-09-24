// src/i18n.ts
import {
  signal,
  derived
} from "@streetui/state";
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
  const localeSignal = signal(config.locale);
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
      return derived(() => resolve(localeSignal.get(), key, params));
    },
    translate(key, params) {
      return resolve(localeSignal.peek(), key, params);
    },
    plural(key, count, params) {
      const merged = { count, ...params ?? {} };
      return derived(() => {
        const loc = localeSignal.get();
        return resolve(loc, pluralKey(loc, key, count), merged);
      });
    },
    has(key) {
      return lookup(localeSignal.peek(), key) !== void 0;
    }
  };
}
export {
  createI18n,
  interpolate
};
//# sourceMappingURL=index.js.map
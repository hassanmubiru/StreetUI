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
  createForm: () => createForm,
  email: () => email,
  maxLength: () => maxLength,
  minLength: () => minLength,
  pattern: () => pattern,
  required: () => required,
  runValidators: () => runValidators
});
module.exports = __toCommonJS(index_exports);

// src/validators.ts
function required(message = "This field is required") {
  return (value) => value.trim().length === 0 ? message : void 0;
}
function minLength(length, message) {
  return (value) => value.length < length ? message ?? `Must be at least ${length} characters` : void 0;
}
function maxLength(length, message) {
  return (value) => value.length > length ? message ?? `Must be at most ${length} characters` : void 0;
}
var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function email(message = "Enter a valid email address") {
  return (value) => value.length === 0 || EMAIL_RE.test(value) ? void 0 : message;
}
function pattern(regex, message = "Invalid format") {
  return (value) => value.length === 0 || regex.test(value) ? void 0 : message;
}
function runValidators(value, validators) {
  if (validators === void 0) return void 0;
  const list = Array.isArray(validators) ? validators : [validators];
  for (const validate of list) {
    const error = validate(value);
    if (error !== void 0) return error;
  }
  return void 0;
}

// src/form.ts
var import_state = require("@streetui/state");
function createForm(config) {
  const names = Object.keys(config.initialValues);
  const validators = config.validators ?? {};
  let programmatic = false;
  const fields = /* @__PURE__ */ new Map();
  for (const name of names) {
    const initial = config.initialValues[name];
    const value = (0, import_state.signal)(initial);
    const touched = (0, import_state.signal)(false);
    const error = (0, import_state.derived)(
      () => runValidators(value.get(), validators[name])
    );
    const valid2 = (0, import_state.derived)(() => error.get() === void 0);
    const dirty2 = (0, import_state.derived)(() => value.get() !== initial);
    const unsub = value.subscribe(() => {
      if (!programmatic) touched.set(true);
    });
    const api = {
      name,
      value,
      error,
      touched,
      dirty: dirty2,
      valid: valid2,
      setValue(next) {
        value.set(next);
      },
      markTouched(next = true) {
        touched.set(next);
      },
      reset() {
        programmatic = true;
        try {
          (0, import_state.batch)(() => {
            value.set(initial);
            touched.set(false);
          });
        } finally {
          programmatic = false;
        }
      }
    };
    fields.set(name, { api, value, touched, error, valid: valid2, dirty: dirty2, initial, unsub });
  }
  const field = (name) => {
    const f = fields.get(name);
    if (f === void 0) throw new Error(`Unknown form field: ${name}`);
    return f;
  };
  const values = (0, import_state.derived)(() => {
    const out = {};
    for (const name of names) out[name] = field(name).value.get();
    return out;
  });
  const errors = (0, import_state.derived)(() => {
    const out = {};
    for (const name of names) {
      const e = field(name).error.get();
      if (e !== void 0) out[name] = e;
    }
    return out;
  });
  const touchedMap = (0, import_state.derived)(() => {
    const out = {};
    for (const name of names) out[name] = field(name).touched.get();
    return out;
  });
  const dirty = (0, import_state.derived)(() => names.some((n) => field(n).dirty.get()));
  const valid = (0, import_state.derived)(() => names.every((n) => field(n).valid.get()));
  const status = (0, import_state.signal)("idle");
  const submitting = (0, import_state.derived)(() => status.get() === "submitting");
  const submitted = (0, import_state.derived)(() => status.get() === "success");
  const submitError = (0, import_state.signal)(void 0);
  function setValues(partial) {
    programmatic = true;
    try {
      (0, import_state.batch)(() => {
        for (const name of names) {
          const next = partial[name];
          if (next !== void 0) field(name).value.set(next);
        }
      });
    } finally {
      programmatic = false;
    }
  }
  function reset() {
    programmatic = true;
    try {
      (0, import_state.batch)(() => {
        for (const name of names) {
          const f = field(name);
          f.value.set(f.initial);
          f.touched.set(false);
        }
        status.set("idle");
        submitError.set(void 0);
      });
    } finally {
      programmatic = false;
    }
  }
  async function submit() {
    (0, import_state.batch)(() => {
      for (const name of names) field(name).touched.set(true);
    });
    if (!valid.peek()) {
      return;
    }
    submitError.set(void 0);
    status.set("submitting");
    try {
      await config.onSubmit?.(values.peek());
      status.set("success");
    } catch (err) {
      submitError.set(err);
      status.set("error");
    }
  }
  function dispose() {
    for (const f of fields.values()) {
      f.unsub();
      f.error.dispose();
      f.valid.dispose();
      f.dirty.dispose();
    }
    values.dispose();
    errors.dispose();
    touchedMap.dispose();
    dirty.dispose();
    valid.dispose();
    submitting.dispose();
    submitted.dispose();
  }
  return {
    values,
    errors,
    touched: touchedMap,
    dirty,
    valid,
    submitting,
    submitted,
    status,
    submitError,
    field: (name) => field(name).api,
    setValues,
    submit,
    reset,
    dispose
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createForm,
  email,
  maxLength,
  minLength,
  pattern,
  required,
  runValidators
});
//# sourceMappingURL=index.cjs.map
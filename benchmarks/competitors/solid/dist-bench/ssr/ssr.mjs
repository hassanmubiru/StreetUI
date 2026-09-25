const ERROR = Symbol("error");
function castError(err) {
  if (err instanceof Error) return err;
  return new Error(typeof err === "string" ? err : "Unknown error", {
    cause: err
  });
}
function handleError(err, owner = Owner) {
  const fns = owner && owner.context && owner.context[ERROR];
  const error = castError(err);
  if (!fns) throw error;
  try {
    for (const f of fns) f(error);
  } catch (e) {
    handleError(e, owner && owner.owner || null);
  }
}
const UNOWNED = {
  context: null,
  owner: null,
  owned: null,
  cleanups: null
};
let Owner = null;
function createRoot(fn, detachedOwner) {
  const owner = Owner, current = owner, root = fn.length === 0 ? UNOWNED : {
    context: current ? current.context : null,
    owner: current,
    owned: null,
    cleanups: null
  };
  Owner = root;
  let result;
  try {
    result = fn(fn.length === 0 ? () => {
    } : () => cleanNode(root));
  } catch (err) {
    handleError(err);
  } finally {
    Owner = owner;
  }
  return result;
}
function cleanNode(node) {
  if (node.owned) {
    for (let i = 0; i < node.owned.length; i++) cleanNode(node.owned[i]);
    node.owned = null;
  }
  if (node.cleanups) {
    for (let i = 0; i < node.cleanups.length; i++) node.cleanups[i]();
    node.cleanups = null;
  }
}
const sharedConfig = {
  context: void 0,
  getContextId() {
    if (!this.context) throw new Error(`getContextId cannot be used under non-hydrating context`);
    return getContextId(this.context.count);
  },
  getNextContextId() {
    if (!this.context)
      throw new Error(`getNextContextId cannot be used under non-hydrating context`);
    return getContextId(this.context.count++);
  }
};
function getContextId(count) {
  const num = String(count), len = num.length - 1;
  return sharedConfig.context.id + (len ? String.fromCharCode(96 + len) : "") + num;
}
function setHydrateContext(context) {
  sharedConfig.context = context;
}
function nextHydrateContext() {
  return sharedConfig.context ? {
    ...sharedConfig.context,
    id: sharedConfig.getNextContextId(),
    count: 0
  } : void 0;
}
function createComponent(Comp, props) {
  if (sharedConfig.context && !sharedConfig.context.noHydrate) {
    const c = sharedConfig.context;
    setHydrateContext(nextHydrateContext());
    const r = Comp(props || {});
    setHydrateContext(c);
    return r;
  }
  return Comp(props || {});
}
function simpleMap(props, wrap) {
  const list = props.each || [], len = list.length, fn = props.children;
  if (len) {
    let mapped = Array(len);
    for (let i = 0; i < len; i++) mapped[i] = wrap(fn, list[i], i);
    return mapped;
  }
  return props.fallback;
}
function Index(props) {
  return simpleMap(props, (fn, item, i) => fn(() => item, i));
}
let Feature = /* @__PURE__ */ function(Feature2) {
  Feature2[Feature2["AggregateError"] = 1] = "AggregateError";
  Feature2[Feature2["ArrowFunction"] = 2] = "ArrowFunction";
  Feature2[Feature2["ErrorPrototypeStack"] = 4] = "ErrorPrototypeStack";
  Feature2[Feature2["ObjectAssign"] = 8] = "ObjectAssign";
  Feature2[Feature2["BigIntTypedArray"] = 16] = "BigIntTypedArray";
  Feature2[Feature2["RegExp"] = 32] = "RegExp";
  Feature2[Feature2["Temporal"] = 64] = "Temporal";
  return Feature2;
}({});
const SYM_ASYNC_ITERATOR = Symbol.asyncIterator;
const SYM_HAS_INSTANCE = Symbol.hasInstance;
const SYM_IS_CONCAT_SPREADABLE = Symbol.isConcatSpreadable;
const SYM_ITERATOR = Symbol.iterator;
const SYM_MATCH = Symbol.match;
const SYM_MATCH_ALL = Symbol.matchAll;
const SYM_REPLACE = Symbol.replace;
const SYM_SEARCH = Symbol.search;
const SYM_SPECIES = Symbol.species;
const SYM_SPLIT = Symbol.split;
const SYM_TO_PRIMITIVE = Symbol.toPrimitive;
const SYM_TO_STRING_TAG = Symbol.toStringTag;
const SYM_UNSCOPABLES = Symbol.unscopables;
const SYMBOL_STRING = {
  [0]: "Symbol.asyncIterator",
  [1]: "Symbol.hasInstance",
  [2]: "Symbol.isConcatSpreadable",
  [3]: "Symbol.iterator",
  [4]: "Symbol.match",
  [5]: "Symbol.matchAll",
  [6]: "Symbol.replace",
  [7]: "Symbol.search",
  [8]: "Symbol.species",
  [9]: "Symbol.split",
  [10]: "Symbol.toPrimitive",
  [11]: "Symbol.toStringTag",
  [12]: "Symbol.unscopables"
};
const INV_SYMBOL_REF = {
  [SYM_ASYNC_ITERATOR]: 0,
  [SYM_HAS_INSTANCE]: 1,
  [SYM_IS_CONCAT_SPREADABLE]: 2,
  [SYM_ITERATOR]: 3,
  [SYM_MATCH]: 4,
  [SYM_MATCH_ALL]: 5,
  [SYM_REPLACE]: 6,
  [SYM_SEARCH]: 7,
  [SYM_SPECIES]: 8,
  [SYM_SPLIT]: 9,
  [SYM_TO_PRIMITIVE]: 10,
  [SYM_TO_STRING_TAG]: 11,
  [SYM_UNSCOPABLES]: 12
};
const CONSTANT_STRING = {
  [2]: "!0",
  [3]: "!1",
  [1]: "void 0",
  [0]: "null",
  [4]: "-0",
  [5]: "1/0",
  [6]: "-1/0",
  [7]: "0/0"
};
const ERROR_CONSTRUCTOR_STRING = {
  [0]: "Error",
  [1]: "EvalError",
  [2]: "RangeError",
  [3]: "ReferenceError",
  [4]: "SyntaxError",
  [5]: "TypeError",
  [6]: "URIError"
};
function createSerovalNode(t, i, s, c, m, p, e, a, f, b, o, l) {
  return {
    t,
    i,
    s,
    c,
    m,
    p,
    e,
    a,
    f,
    b,
    o,
    l
  };
}
function createConstantNode(value) {
  return createSerovalNode(2, void 0, value, void 0, void 0, void 0, void 0, void 0, void 0, void 0, void 0, void 0);
}
const TRUE_NODE = /* @__PURE__ */ createConstantNode(2);
const FALSE_NODE = /* @__PURE__ */ createConstantNode(3);
const UNDEFINED_NODE = /* @__PURE__ */ createConstantNode(1);
const NULL_NODE = /* @__PURE__ */ createConstantNode(0);
const NEG_ZERO_NODE = /* @__PURE__ */ createConstantNode(4);
const INFINITY_NODE = /* @__PURE__ */ createConstantNode(5);
const NEG_INFINITY_NODE = /* @__PURE__ */ createConstantNode(6);
const NAN_NODE = /* @__PURE__ */ createConstantNode(7);
const MIN_JSON_STRINGIFY_LENGTH = 64;
const JSON_ESCAPE_DIFFERENCES = /[\x00-\x07\x0b\x0e-\x1f<\u2028\u2029\ud800-\udfff]/;
function serializeChar(str) {
  switch (str) {
    case '"':
      return '\\"';
    case "\\":
      return "\\\\";
    case "\n":
      return "\\n";
    case "\r":
      return "\\r";
    case "\b":
      return "\\b";
    case "	":
      return "\\t";
    case "\f":
      return "\\f";
    case "<":
      return "\\x3C";
    case "\u2028":
      return "\\u2028";
    case "\u2029":
      return "\\u2029";
    default:
      return;
  }
}
function serializeString(str) {
  if (str.length >= MIN_JSON_STRINGIFY_LENGTH && !JSON_ESCAPE_DIFFERENCES.test(str)) return JSON.stringify(str).slice(1, -1);
  let result = "";
  let lastPos = 0;
  let replacement;
  for (let i = 0, len = str.length; i < len; i++) {
    replacement = serializeChar(str[i]);
    if (replacement) {
      result += str.slice(lastPos, i) + replacement;
      lastPos = i + 1;
    }
  }
  if (lastPos === 0) result = str;
  else result += str.slice(lastPos);
  return result;
}
function deserializeReplacer(str) {
  switch (str) {
    case "\\\\":
      return "\\";
    case '\\"':
      return '"';
    case "\\n":
      return "\n";
    case "\\r":
      return "\r";
    case "\\b":
      return "\b";
    case "\\t":
      return "	";
    case "\\f":
      return "\f";
    case "\\x3C":
      return "<";
    case "\\u2028":
      return "\u2028";
    case "\\u2029":
      return "\u2029";
    default:
      return str;
  }
}
function deserializeString(str) {
  if (typeof str === "string" && !str.includes("\\")) return str;
  return str.replace(/(\\\\|\\"|\\n|\\r|\\b|\\t|\\f|\\u2028|\\u2029|\\x3C)/g, deserializeReplacer);
}
const STEP_ERROR_CODES = {
  parsing: 1,
  serialization: 2,
  deserialization: 3
};
function getErrorMessageProd(type) {
  return `Seroval Error (step: ${STEP_ERROR_CODES[type]})`;
}
const getErrorMessage = (type, cause) => getErrorMessageProd(type);
var SerovalError = class extends Error {
  constructor(type, cause) {
    super(getErrorMessage(type));
    this.cause = cause;
  }
};
var SerovalParserError = class extends SerovalError {
  constructor(cause) {
    super("parsing", cause);
  }
};
function getSpecificErrorMessage(code) {
  return `Seroval Error (specific: ${code})`;
}
var SerovalUnsupportedTypeError = class extends Error {
  constructor(value) {
    super(getSpecificErrorMessage(1));
    this.value = value;
  }
};
var SerovalUnsupportedNodeError = class extends Error {
  constructor(node) {
    super(getSpecificErrorMessage(2));
  }
};
var SerovalMissingPluginError = class extends Error {
  constructor(tag) {
    super(getSpecificErrorMessage(3));
  }
};
var SerovalMissingReferenceError = class extends Error {
  constructor(value) {
    super(getSpecificErrorMessage(5));
    this.value = value;
  }
};
var SerovalDepthLimitError = class extends Error {
  constructor(limit) {
    super(getSpecificErrorMessage(9));
  }
};
const REFERENCES_KEY = "__SEROVAL_REFS__";
const GLOBAL_CONTEXT_R = `self.$R`;
function getCrossReferenceHeader(id) {
  if (id == null) return `${GLOBAL_CONTEXT_R}=${GLOBAL_CONTEXT_R}||[]`;
  return `(${GLOBAL_CONTEXT_R}=${GLOBAL_CONTEXT_R}||{})["${serializeString(id)}"]=[]`;
}
const REFERENCE = /* @__PURE__ */ new Map();
const INV_REFERENCE = /* @__PURE__ */ new Map();
function hasReferenceID(value) {
  return REFERENCE.has(value);
}
function getReferenceID(value) {
  if (hasReferenceID(value)) return REFERENCE.get(value);
  throw new SerovalMissingReferenceError(value);
}
if (typeof globalThis !== "undefined") Object.defineProperty(globalThis, REFERENCES_KEY, {
  value: INV_REFERENCE,
  configurable: true,
  writable: false,
  enumerable: false
});
else if (typeof window !== "undefined") Object.defineProperty(window, REFERENCES_KEY, {
  value: INV_REFERENCE,
  configurable: true,
  writable: false,
  enumerable: false
});
else if (typeof self !== "undefined") Object.defineProperty(self, REFERENCES_KEY, {
  value: INV_REFERENCE,
  configurable: true,
  writable: false,
  enumerable: false
});
else if (typeof global !== "undefined") Object.defineProperty(global, REFERENCES_KEY, {
  value: INV_REFERENCE,
  configurable: true,
  writable: false,
  enumerable: false
});
function getErrorConstructor(error) {
  if (error instanceof EvalError) return 1;
  if (error instanceof RangeError) return 2;
  if (error instanceof ReferenceError) return 3;
  if (error instanceof SyntaxError) return 4;
  if (error instanceof TypeError) return 5;
  if (error instanceof URIError) return 6;
  return 0;
}
function getInitialErrorOptions(error) {
  const construct = ERROR_CONSTRUCTOR_STRING[getErrorConstructor(error)];
  if (error.name !== construct) return { name: error.name };
  if (error.constructor.name !== construct) return { name: error.constructor.name };
  return {};
}
function getErrorOptions(error, features) {
  let options = getInitialErrorOptions(error);
  const names = Object.getOwnPropertyNames(error);
  for (let i = 0, len = names.length, name; i < len; i++) {
    name = names[i];
    if (name !== "name" && name !== "message") {
      if (name === "stack") {
        if (features & 4) {
          options = options || {};
          options[name] = error[name];
        }
      } else {
        options = options || {};
        options[name] = error[name];
      }
    }
  }
  return options;
}
function getObjectFlag(obj) {
  if (Object.isFrozen(obj)) return 3;
  if (Object.isSealed(obj)) return 2;
  if (Object.isExtensible(obj)) return 0;
  return 1;
}
function createNumberNode(value) {
  switch (value) {
    case Number.POSITIVE_INFINITY:
      return INFINITY_NODE;
    case Number.NEGATIVE_INFINITY:
      return NEG_INFINITY_NODE;
  }
  if (value !== value) return NAN_NODE;
  if (Object.is(value, -0)) return NEG_ZERO_NODE;
  return createSerovalNode(0, void 0, value, void 0, void 0, void 0, void 0, void 0, void 0, void 0, void 0, void 0);
}
function createStringNode(value) {
  return createSerovalNode(1, void 0, serializeString(value), void 0, void 0, void 0, void 0, void 0, void 0, void 0, void 0, void 0);
}
function createBigIntNode(current) {
  return createSerovalNode(3, void 0, "" + current, void 0, void 0, void 0, void 0, void 0, void 0, void 0, void 0, void 0);
}
function createIndexedValueNode(id) {
  return createSerovalNode(4, id, void 0, void 0, void 0, void 0, void 0, void 0, void 0, void 0, void 0, void 0);
}
function createDateNode(id, current) {
  const timestamp = current.valueOf();
  return createSerovalNode(5, id, timestamp !== timestamp ? "" : current.toISOString(), void 0, void 0, void 0, void 0, void 0, void 0, void 0, void 0, void 0);
}
function createTemporalNode(id, type, current) {
  return createSerovalNode(36, id, current.toString(), type, void 0, void 0, void 0, void 0, void 0, void 0, void 0, void 0);
}
function createRegExpNode(id, current) {
  return createSerovalNode(6, id, void 0, serializeString(current.source), current.flags, void 0, void 0, void 0, void 0, void 0, void 0, void 0);
}
function createWKSymbolNode(id, current) {
  return createSerovalNode(17, id, INV_SYMBOL_REF[current], void 0, void 0, void 0, void 0, void 0, void 0, void 0, void 0, void 0);
}
function createReferenceNode(id, ref) {
  return createSerovalNode(18, id, serializeString(getReferenceID(ref)), void 0, void 0, void 0, void 0, void 0, void 0, void 0, void 0, void 0);
}
function createPluginNode(id, tag, value) {
  return createSerovalNode(25, id, value, serializeString(tag), void 0, void 0, void 0, void 0, void 0, void 0, void 0, void 0);
}
function createArrayNode(id, current, parsedItems) {
  return createSerovalNode(9, id, void 0, void 0, void 0, void 0, void 0, parsedItems, void 0, void 0, getObjectFlag(current), void 0);
}
function createBoxedNode(id, boxed) {
  return createSerovalNode(21, id, void 0, void 0, void 0, void 0, void 0, void 0, boxed, void 0, void 0, void 0);
}
const MAX_TYPED_ARRAY_LENGTH = 1e6;
function createTypedArrayNode(id, current, buffer) {
  if (current.length > MAX_TYPED_ARRAY_LENGTH) throw new SerovalUnsupportedTypeError(current);
  return createSerovalNode(15, id, void 0, current.constructor.name, void 0, void 0, void 0, void 0, buffer, current.byteOffset, void 0, current.length);
}
function createBigIntTypedArrayNode(id, current, buffer) {
  if (current.length > MAX_TYPED_ARRAY_LENGTH) throw new SerovalUnsupportedTypeError(current);
  return createSerovalNode(16, id, void 0, current.constructor.name, void 0, void 0, void 0, void 0, buffer, current.byteOffset, void 0, current.length);
}
function createDataViewNode(id, current, buffer) {
  if (current.byteLength > MAX_TYPED_ARRAY_LENGTH) throw new SerovalUnsupportedTypeError(current);
  return createSerovalNode(20, id, void 0, void 0, void 0, void 0, void 0, void 0, buffer, current.byteOffset, void 0, current.byteLength);
}
function createErrorNode(id, current, options) {
  return createSerovalNode(13, id, getErrorConstructor(current), void 0, serializeString(current.message), options, void 0, void 0, void 0, void 0, void 0, void 0);
}
function createAggregateErrorNode(id, current, options) {
  return createSerovalNode(14, id, getErrorConstructor(current), void 0, serializeString(current.message), options, void 0, void 0, void 0, void 0, void 0, void 0);
}
function createSetNode(id, items) {
  return createSerovalNode(7, id, void 0, void 0, void 0, void 0, void 0, items, void 0, void 0, void 0, void 0);
}
function createIteratorFactoryInstanceNode(factory, items) {
  return createSerovalNode(28, void 0, void 0, void 0, void 0, void 0, void 0, [factory, items], void 0, void 0, void 0, void 0);
}
function createAsyncIteratorFactoryInstanceNode(factory, items) {
  return createSerovalNode(30, void 0, void 0, void 0, void 0, void 0, void 0, [factory, items], void 0, void 0, void 0, void 0);
}
function createStreamConstructorNode(id, factory, sequence) {
  return createSerovalNode(31, id, void 0, void 0, void 0, void 0, void 0, sequence, factory, void 0, void 0, void 0);
}
function createStreamNextNode(id, parsed) {
  return createSerovalNode(32, id, void 0, void 0, void 0, void 0, void 0, void 0, parsed, void 0, void 0, void 0);
}
function createStreamThrowNode(id, parsed) {
  return createSerovalNode(33, id, void 0, void 0, void 0, void 0, void 0, void 0, parsed, void 0, void 0, void 0);
}
function createStreamReturnNode(id, parsed) {
  return createSerovalNode(34, id, void 0, void 0, void 0, void 0, void 0, void 0, parsed, void 0, void 0, void 0);
}
function createSequenceNode(id, sequence, throwAt, doneAt) {
  return createSerovalNode(35, id, throwAt, void 0, void 0, void 0, void 0, sequence, void 0, void 0, void 0, doneAt);
}
var OpaqueReference = class {
  constructor(value, replacement) {
    this.value = value;
    this.replacement = replacement;
  }
};
const PROMISE_CONSTRUCTOR = () => {
  const resolver = {
    p: 0,
    s: 0,
    f: 0
  };
  resolver.p = new Promise((resolve, reject) => {
    resolver.s = resolve;
    resolver.f = reject;
  });
  return resolver;
};
const PROMISE_SUCCESS = (resolver, data) => {
  resolver.s(data);
  resolver.p.s = 1;
  resolver.p.v = data;
};
const PROMISE_FAILURE = (resolver, data) => {
  resolver.f(data);
  resolver.p.s = 2;
  resolver.p.v = data;
};
const SERIALIZED_PROMISE_CONSTRUCTOR = /* @__PURE__ */ PROMISE_CONSTRUCTOR.toString();
const SERIALIZED_PROMISE_SUCCESS = /* @__PURE__ */ PROMISE_SUCCESS.toString();
const SERIALIZED_PROMISE_FAILURE = /* @__PURE__ */ PROMISE_FAILURE.toString();
const STREAM_CONSTRUCTOR = () => {
  const buffer = [];
  const listeners = [];
  let alive = true;
  let success = false;
  let count = 0;
  const internal = {
    flush(value, mode, x) {
      for (x = 0; x < count; x++) {
        const listener = listeners[x];
        if (listener) listener[mode](value);
      }
    },
    up(listener, x, z, current) {
      for (x = 0, z = buffer.length; x < z; x++) {
        current = buffer[x];
        if (!alive && x === z - 1) listener[success ? "return" : "throw"](current);
        else listener.next(current);
      }
    },
    on(listener, temp = 0) {
      let subscribed = alive;
      if (alive) {
        for (temp = 0; temp < count; temp++) if (!listeners[temp]) break;
        if (temp === count) count++;
        listeners[temp] = listener;
      }
      internal.up(listener);
      return () => {
        if (alive && subscribed) {
          subscribed = false;
          listeners[temp] = void 0;
          while (count > 0 && !listeners[count - 1]) count--;
          listeners.length = count;
        }
      };
    }
  };
  return {
    __SEROVAL_STREAM__: true,
    on(listener) {
      return internal.on(listener);
    },
    next(value) {
      if (alive) {
        buffer.push(value);
        internal.flush(value, "next");
      }
    },
    throw(value) {
      if (alive) {
        buffer.push(value);
        internal.flush(value, "throw");
        alive = false;
        success = false;
        listeners.length = 0;
      }
    },
    return(value) {
      if (alive) {
        buffer.push(value);
        internal.flush(value, "return");
        alive = false;
        success = true;
        listeners.length = 0;
      }
    }
  };
};
const SERIALIZED_STREAM_CONSTRUCTOR = /* @__PURE__ */ STREAM_CONSTRUCTOR.toString();
const ITERATOR_CONSTRUCTOR = (symbol) => (sequence) => () => {
  let index = 0;
  const instance = {
    [symbol]() {
      return instance;
    },
    next() {
      if (index > sequence.d) return {
        done: true,
        value: void 0
      };
      const currentIndex = index++;
      const data = sequence.v[currentIndex];
      if (currentIndex === sequence.t) throw data;
      return {
        done: currentIndex === sequence.d,
        value: data
      };
    }
  };
  return instance;
};
const SERIALIZED_ITERATOR_CONSTRUCTOR = /* @__PURE__ */ ITERATOR_CONSTRUCTOR.toString();
const ASYNC_ITERATOR_CONSTRUCTOR = (symbol, createPromise) => (stream) => () => {
  let count = 0;
  let doneAt = -1;
  let isThrow = false;
  const buffer = [];
  const pending = [];
  const internal = { finalize(i = 0, len = pending.length) {
    for (; i < len; i++) pending[i].s({
      done: true,
      value: void 0
    });
  } };
  stream.on({
    next(value) {
      const temp = pending.shift();
      if (temp) temp.s({
        done: false,
        value
      });
      buffer.push(value);
    },
    throw(value) {
      const temp = pending.shift();
      if (temp) temp.f(value);
      internal.finalize();
      doneAt = buffer.length;
      isThrow = true;
      buffer.push(value);
    },
    return(value) {
      const temp = pending.shift();
      if (temp) temp.s({
        done: true,
        value
      });
      internal.finalize();
      doneAt = buffer.length;
      buffer.push(value);
    }
  });
  const instance = {
    [symbol]() {
      return instance;
    },
    next() {
      if (doneAt === -1) {
        const index2 = count++;
        if (index2 >= buffer.length) {
          const temp = createPromise();
          pending.push(temp);
          return temp.p;
        }
        return {
          done: false,
          value: buffer[index2]
        };
      }
      if (count > doneAt) return {
        done: true,
        value: void 0
      };
      const index = count++;
      const value = buffer[index];
      if (index !== doneAt) return {
        done: false,
        value
      };
      if (isThrow) throw value;
      return {
        done: true,
        value
      };
    }
  };
  return instance;
};
const SERIALIZED_ASYNC_ITERATOR_CONSTRUCTOR = /* @__PURE__ */ ASYNC_ITERATOR_CONSTRUCTOR.toString();
const ARRAY_BUFFER_CONSTRUCTOR = (b64) => {
  const decoded = atob(b64);
  const length = decoded.length;
  const arr = new Uint8Array(length);
  for (let i = 0; i < length; i++) arr[i] = decoded.charCodeAt(i);
  return arr.buffer;
};
const SERIALIZED_ARRAY_BUFFER_CONSTRUCTOR = /* @__PURE__ */ ARRAY_BUFFER_CONSTRUCTOR.toString();
function isSequence(value) {
  return "__SEROVAL_SEQUENCE__" in value;
}
function createSequence(values, throwAt, doneAt) {
  return {
    __SEROVAL_SEQUENCE__: true,
    v: values,
    t: throwAt,
    d: doneAt
  };
}
function createSequenceFromIterable(source) {
  const values = [];
  let throwsAt = -1;
  let doneAt = -1;
  const iterator = source[SYM_ITERATOR]();
  while (true) try {
    const value = iterator.next();
    values.push(value.value);
    if (value.done) {
      doneAt = values.length - 1;
      break;
    }
  } catch (error) {
    throwsAt = values.length;
    values.push(error);
  }
  return createSequence(values, throwsAt, doneAt);
}
const ITERATOR = {};
const ASYNC_ITERATOR = {};
const SPECIAL_REFS = {
  [0]: {},
  [1]: {},
  [2]: {},
  [3]: {},
  [4]: {},
  [5]: {}
};
const SPECIAL_REF_STRING = {
  [0]: "[]",
  [1]: SERIALIZED_PROMISE_CONSTRUCTOR,
  [2]: SERIALIZED_PROMISE_SUCCESS,
  [3]: SERIALIZED_PROMISE_FAILURE,
  [4]: SERIALIZED_STREAM_CONSTRUCTOR,
  [5]: SERIALIZED_ARRAY_BUFFER_CONSTRUCTOR
};
function isStream(value) {
  return "__SEROVAL_STREAM__" in value;
}
function createStream() {
  return STREAM_CONSTRUCTOR();
}
function createStreamFromAsyncIterable(iterable, cleanups) {
  const stream = createStream();
  const iterator = iterable[SYM_ASYNC_ITERATOR]();
  let cancelled = false;
  let done = false;
  cleanups === null || cleanups === void 0 || cleanups.push(() => {
    if (!(done || cancelled)) {
      cancelled = true;
      Promise.resolve().then(() => {
        var _iterator$return;
        return (_iterator$return = iterator.return) === null || _iterator$return === void 0 ? void 0 : _iterator$return.call(iterator);
      }).catch(() => {
      });
    }
  });
  async function push() {
    try {
      while (!cancelled) {
        const value = await iterator.next();
        if (cancelled) return;
        if (value.done) {
          done = true;
          stream.return(value.value);
          break;
        }
        stream.next(value.value);
      }
    } catch (error) {
      done = true;
      if (!cancelled) stream.throw(error);
    }
  }
  push().catch(() => {
  });
  return stream;
}
function createBaseParserContext(mode, options) {
  var _options$compactArray;
  return {
    plugins: options.plugins,
    mode,
    marked: /* @__PURE__ */ new Set(),
    features: 127 ^ (options.disabledFeatures || 0),
    refs: options.refs || /* @__PURE__ */ new Map(),
    depthLimit: options.depthLimit || 1e3,
    compactArrayBufferViews: (_options$compactArray = options.compactArrayBufferViews) !== null && _options$compactArray !== void 0 ? _options$compactArray : false
  };
}
function markParserRef(ctx, id) {
  ctx.marked.add(id);
}
function createIndexForValue(ctx, current) {
  const id = ctx.refs.size;
  ctx.refs.set(current, id);
  return id;
}
function getNodeForIndexedValue(ctx, current) {
  const registeredId = ctx.refs.get(current);
  if (registeredId != null) {
    markParserRef(ctx, registeredId);
    return {
      type: 1,
      value: createIndexedValueNode(registeredId)
    };
  }
  return {
    type: 0,
    value: createIndexForValue(ctx, current)
  };
}
function getReferenceNode(ctx, current) {
  const indexed = getNodeForIndexedValue(ctx, current);
  if (indexed.type === 1) return indexed;
  if (hasReferenceID(current)) return {
    type: 2,
    value: createReferenceNode(indexed.value, current)
  };
  return indexed;
}
function parseWellKnownSymbol(ctx, current) {
  const ref = getReferenceNode(ctx, current);
  if (ref.type !== 0) return ref.value;
  if (current in INV_SYMBOL_REF) return createWKSymbolNode(ref.value, current);
  throw new SerovalUnsupportedTypeError(current);
}
function parseSpecialReference(ctx, ref) {
  const result = getNodeForIndexedValue(ctx, SPECIAL_REFS[ref]);
  if (result.type === 1) return result.value;
  return createSerovalNode(26, result.value, ref, void 0, void 0, void 0, void 0, void 0, void 0, void 0, void 0, void 0);
}
function parseIteratorFactory(ctx) {
  const result = getNodeForIndexedValue(ctx, ITERATOR);
  if (result.type === 1) return result.value;
  return createSerovalNode(27, result.value, void 0, void 0, void 0, void 0, void 0, void 0, parseWellKnownSymbol(ctx, SYM_ITERATOR), void 0, void 0, void 0);
}
function parseAsyncIteratorFactory(ctx) {
  const result = getNodeForIndexedValue(ctx, ASYNC_ITERATOR);
  if (result.type === 1) return result.value;
  return createSerovalNode(29, result.value, void 0, void 0, void 0, void 0, void 0, [parseSpecialReference(ctx, 1), parseWellKnownSymbol(ctx, SYM_ASYNC_ITERATOR)], void 0, void 0, void 0, void 0);
}
function createObjectNode(id, current, empty, record) {
  return createSerovalNode(empty ? 11 : 10, id, void 0, void 0, void 0, record, void 0, void 0, void 0, void 0, getObjectFlag(current), void 0);
}
function createMapNode(ctx, id, k, v) {
  return createSerovalNode(8, id, void 0, void 0, void 0, void 0, {
    k,
    v
  }, void 0, parseSpecialReference(ctx, 0), void 0, void 0, void 0);
}
function createPromiseConstructorNode(ctx, id, resolver) {
  return createSerovalNode(22, id, resolver, void 0, void 0, void 0, void 0, void 0, parseSpecialReference(ctx, 1), void 0, void 0, void 0);
}
function getArrayBufferView(ctx, current) {
  if (!ctx.compactArrayBufferViews) return current;
  const buffer = new Uint8Array(current.buffer, current.byteOffset, current.byteLength).slice().buffer;
  const Constructor = current.constructor;
  return new Constructor(buffer);
}
function encodeArrayBuffer(current) {
  if (typeof Buffer !== "undefined") return Buffer.from(current).toString("base64");
  const bytes = new Uint8Array(current);
  if (typeof bytes.toBase64 === "function") return bytes.toBase64();
  let result = "";
  for (let i = 0, len = bytes.length; i < len; i++) result += String.fromCharCode(bytes[i]);
  return btoa(result);
}
function createArrayBufferNode(ctx, id, current) {
  return createSerovalNode(19, id, encodeArrayBuffer(current), void 0, void 0, void 0, void 0, void 0, parseSpecialReference(ctx, 5), void 0, void 0, void 0);
}
function createPlugin(plugin) {
  return plugin;
}
function dedupePlugins(deduped, plugins) {
  for (let i = 0, len = plugins.length; i < len; i++) {
    const current = plugins[i];
    if (!deduped.has(current)) {
      deduped.add(current);
      if (current.extends) dedupePlugins(deduped, current.extends);
    }
  }
}
function resolvePlugins(plugins) {
  if (plugins) {
    const deduped = /* @__PURE__ */ new Set();
    dedupePlugins(deduped, plugins);
    return [...deduped];
  }
}
function isValidKey(key) {
  switch (key) {
    case "constructor":
    case "__proto__":
    case "prototype":
    case "__defineGetter__":
    case "__defineSetter__":
    case "__lookupGetter__":
    case "__lookupSetter__":
      return false;
    default:
      return true;
  }
}
const RETURN = () => T;
const SERIALIZED_RETURN = /* @__PURE__ */ RETURN.toString();
const IS_MODERN = /* @__PURE__ */ /=>/.test(SERIALIZED_RETURN);
function createFunction(parameters, body) {
  if (IS_MODERN) return (parameters.length === 1 ? parameters[0] : "(" + parameters.join(",") + ")") + "=>" + (body.startsWith("{") ? "(" + body + ")" : body);
  return "function(" + parameters.join(",") + "){return " + body + "}";
}
function createEffectfulFunction(parameters, body) {
  if (IS_MODERN) return (parameters.length === 1 ? parameters[0] : "(" + parameters.join(",") + ")") + "=>{" + body + "}";
  return "function(" + parameters.join(",") + "){" + body + "}";
}
const REF_START_CHARS = "hjkmoquxzABCDEFGHIJKLNPQRTUVWXYZ$_";
const REF_START_CHARS_LEN = 34;
const REF_CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$_";
const REF_CHARS_LEN = 64;
function getIdentifier(index) {
  let mod = index % REF_START_CHARS_LEN;
  let ref = REF_START_CHARS[mod];
  index = (index - mod) / REF_START_CHARS_LEN;
  while (index > 0) {
    mod = index % REF_CHARS_LEN;
    ref += REF_CHARS[mod];
    index = (index - mod) / REF_CHARS_LEN;
  }
  return ref;
}
const IDENTIFIER_CHECK = /^[$A-Z_][0-9A-Z_$]*$/i;
function isValidIdentifier(name) {
  const char = name[0];
  return (char === "$" || char === "_" || char >= "A" && char <= "Z" || char >= "a" && char <= "z") && IDENTIFIER_CHECK.test(name);
}
function getAssignmentExpression(assignment) {
  switch (assignment.t) {
    case 0:
      return assignment.s + "=" + assignment.v;
    case 2:
      return assignment.s + ".set(" + assignment.k + "," + assignment.v + ")";
    case 1:
      return assignment.s + ".add(" + assignment.v + ")";
    case 3:
      return assignment.s + ".delete(" + assignment.k + ")";
    case 4:
      return "Object.defineProperty(" + assignment.s + ',"__proto__",{value:' + assignment.k + ",configurable:!0,enumerable:!0,writable:!0})";
  }
}
function mergeAssignments(assignments) {
  const newAssignments = [];
  let current = assignments[0];
  for (let i = 1, len = assignments.length, item, prev = current; i < len; i++) {
    item = assignments[i];
    if (item.t === 0 && item.v === prev.v) current = {
      t: 0,
      s: item.s,
      k: void 0,
      v: getAssignmentExpression(current)
    };
    else if (item.t === 2 && item.s === prev.s) current = {
      t: 2,
      s: getAssignmentExpression(current),
      k: item.k,
      v: item.v
    };
    else if (item.t === 1 && item.s === prev.s) current = {
      t: 1,
      s: getAssignmentExpression(current),
      k: void 0,
      v: item.v
    };
    else if (item.t === 3 && item.s === prev.s) current = {
      t: 3,
      s: getAssignmentExpression(current),
      k: item.k,
      v: void 0
    };
    else {
      newAssignments.push(current);
      current = item;
    }
    prev = item;
  }
  newAssignments.push(current);
  return newAssignments;
}
function resolveAssignments(assignments) {
  if (assignments.length) {
    let result = "";
    const merged = mergeAssignments(assignments);
    for (let i = 0, len = merged.length; i < len; i++) result += getAssignmentExpression(merged[i]) + ",";
    return result;
  }
}
const NULL_CONSTRUCTOR = "Object.create(null)";
const SET_CONSTRUCTOR = "new Set";
const MAP_CONSTRUCTOR = "new Map";
const PROMISE_RESOLVE = "Promise.resolve";
const PROMISE_REJECT = "Promise.reject";
const OBJECT_FLAG_CONSTRUCTOR = {
  [3]: "Object.freeze",
  [2]: "Object.seal",
  [1]: "Object.preventExtensions",
  [0]: void 0
};
function createBaseSerializerContext(mode, options) {
  return {
    mode,
    plugins: options.plugins,
    features: options.features,
    marked: new Set(options.markedRefs),
    stack: [],
    flags: [],
    assignments: []
  };
}
function createCrossSerializerContext(options) {
  return {
    mode: 2,
    base: createBaseSerializerContext(2, options),
    state: options,
    child: void 0
  };
}
var SerializePluginContext = class {
  constructor(_p) {
    this._p = _p;
  }
  serialize(node) {
    return serialize$1(this._p, node);
  }
};
function getVanillaRefParam(state, index) {
  let actualIndex = state.valid.get(index);
  if (actualIndex == null) {
    actualIndex = state.valid.size;
    state.valid.set(index, actualIndex);
  }
  let identifier = state.vars[actualIndex];
  if (identifier == null) {
    identifier = getIdentifier(actualIndex);
    state.vars[actualIndex] = identifier;
  }
  return identifier;
}
function getCrossRefParam(id) {
  return "$R[" + id + "]";
}
function getRefParam(ctx, id) {
  return ctx.mode === 1 ? getVanillaRefParam(ctx.state, id) : getCrossRefParam(id);
}
function markSerializerRef(ctx, id) {
  ctx.marked.add(id);
}
function isSerializerRefMarked(ctx, id) {
  return ctx.marked.has(id);
}
function pushObjectFlag(ctx, flag, id) {
  if (flag !== 0) {
    markSerializerRef(ctx.base, id);
    ctx.base.flags.push({
      type: flag,
      value: getRefParam(ctx, id)
    });
  }
}
function resolveFlags(ctx) {
  let result = "";
  for (let i = 0, current = ctx.flags, len = current.length; i < len; i++) {
    const flag = current[i];
    result += OBJECT_FLAG_CONSTRUCTOR[flag.type] + "(" + flag.value + "),";
  }
  return result;
}
function resolvePatches(ctx) {
  const assignments = resolveAssignments(ctx.assignments);
  const flags = resolveFlags(ctx);
  if (assignments) {
    if (flags) return assignments + flags;
    return assignments;
  }
  return flags;
}
function createAssignment(ctx, source, value) {
  ctx.assignments.push({
    t: 0,
    s: source,
    k: void 0,
    v: value
  });
}
function createAddAssignment(ctx, ref, value) {
  ctx.base.assignments.push({
    t: 1,
    s: getRefParam(ctx, ref),
    k: void 0,
    v: value
  });
}
function createSetAssignment(ctx, ref, key, value) {
  ctx.base.assignments.push({
    t: 2,
    s: getRefParam(ctx, ref),
    k: key,
    v: value
  });
}
function createDeleteAssignment(ctx, ref, key) {
  ctx.base.assignments.push({
    t: 3,
    s: getRefParam(ctx, ref),
    k: key,
    v: void 0
  });
}
function createArrayAssign(ctx, ref, index, value) {
  createAssignment(ctx.base, getRefParam(ctx, ref) + "[" + index + "]", value);
}
function createObjectAssign(ctx, ref, key, value) {
  if (!isValidKey(key)) {
    ctx.base.assignments.push({
      t: 4,
      s: getRefParam(ctx, ref),
      k: value,
      v: void 0
    });
    return;
  }
  createAssignment(ctx.base, getRefParam(ctx, ref) + "." + key, value);
}
function createSequenceAssign(ctx, ref, index, value) {
  createAssignment(ctx.base, getRefParam(ctx, ref) + ".v[" + index + "]", value);
}
function isIndexedValueInStack(ctx, node) {
  return node.t === 4 && ctx.stack.includes(node.i);
}
function assignIndexedValue(ctx, index, value) {
  if (ctx.mode === 1 && !isSerializerRefMarked(ctx.base, index)) return value;
  return getRefParam(ctx, index) + "=" + value;
}
function serializeReference(node) {
  return '__SEROVAL_REFS__.get("' + node.s + '")';
}
function serializeArrayItem(ctx, id, item, index) {
  if (item) {
    if (isIndexedValueInStack(ctx.base, item)) {
      markSerializerRef(ctx.base, id);
      createArrayAssign(ctx, id, index, getRefParam(ctx, item.i));
      return "";
    }
    return serialize$1(ctx, item);
  }
  return "";
}
function serializeArray(ctx, node) {
  const id = node.i;
  const list = node.a;
  const len = list.length;
  if (len > 0) {
    ctx.base.stack.push(id);
    let values = serializeArrayItem(ctx, id, list[0], 0);
    let isHoley = values === "";
    for (let i = 1, item; i < len; i++) {
      item = serializeArrayItem(ctx, id, list[i], i);
      values += "," + item;
      isHoley = item === "";
    }
    ctx.base.stack.pop();
    pushObjectFlag(ctx, node.o, node.i);
    return "[" + values + (isHoley ? ",]" : "]");
  }
  return "[]";
}
function serializeProperty(ctx, source, key, val) {
  if (typeof key === "string") {
    const check = Number(key);
    const isIdentifier = check >= 0 && check.toString() === key || isValidIdentifier(key);
    if (isIndexedValueInStack(ctx.base, val)) {
      const refParam = getRefParam(ctx, val.i);
      markSerializerRef(ctx.base, source.i);
      if (isIdentifier && check !== check) createObjectAssign(ctx, source.i, key, refParam);
      else createArrayAssign(ctx, source.i, isIdentifier ? key : '"' + key + '"', refParam);
      return "";
    }
    if (isValidKey(key)) return (isIdentifier ? key : '"' + key + '"') + ":" + serialize$1(ctx, val);
    return '["' + key + '"]:' + serialize$1(ctx, val);
  }
  return "[" + serialize$1(ctx, key) + "]:" + serialize$1(ctx, val);
}
function serializeProperties(ctx, source, record) {
  const keys = record.k;
  const len = keys.length;
  if (len > 0) {
    const values = record.v;
    ctx.base.stack.push(source.i);
    let result = serializeProperty(ctx, source, keys[0], values[0]);
    for (let i = 1, item = result; i < len; i++) {
      item = serializeProperty(ctx, source, keys[i], values[i]);
      result += (item && result && ",") + item;
    }
    ctx.base.stack.pop();
    return "{" + result + "}";
  }
  return "{}";
}
function serializeObject(ctx, node) {
  pushObjectFlag(ctx, node.o, node.i);
  return serializeProperties(ctx, node, node.p);
}
function serializeWithObjectAssign(ctx, source, value, serialized) {
  const fields = serializeProperties(ctx, source, value);
  if (fields !== "{}") return "Object.assign(" + serialized + "," + fields + ")";
  return serialized;
}
function serializeStringKeyAssignment(ctx, source, mainAssignments, key, value) {
  const base = ctx.base;
  const serialized = serialize$1(ctx, value);
  const check = Number(key);
  const isIdentifier = check >= 0 && check.toString() === key || isValidIdentifier(key);
  if (isIndexedValueInStack(base, value)) {
    if (isIdentifier && check !== check) createObjectAssign(ctx, source.i, key, serialized);
    else createArrayAssign(ctx, source.i, isIdentifier ? key : '"' + key + '"', serialized);
  } else {
    const parentAssignment = base.assignments;
    base.assignments = mainAssignments;
    if (isIdentifier && check !== check) createObjectAssign(ctx, source.i, key, serialized);
    else createArrayAssign(ctx, source.i, isIdentifier ? key : '"' + key + '"', serialized);
    base.assignments = parentAssignment;
  }
}
function serializeAssignment(ctx, source, mainAssignments, key, value) {
  if (typeof key === "string") serializeStringKeyAssignment(ctx, source, mainAssignments, key, value);
  else {
    const base = ctx.base;
    const parent = base.stack;
    base.stack = [];
    const serialized = serialize$1(ctx, value);
    base.stack = parent;
    const parentAssignment = base.assignments;
    base.assignments = mainAssignments;
    createArrayAssign(ctx, source.i, serialize$1(ctx, key), serialized);
    base.assignments = parentAssignment;
  }
}
function serializeAssignments(ctx, source, node) {
  const keys = node.k;
  const len = keys.length;
  if (len > 0) {
    const mainAssignments = [];
    const values = node.v;
    ctx.base.stack.push(source.i);
    for (let i = 0; i < len; i++) serializeAssignment(ctx, source, mainAssignments, keys[i], values[i]);
    ctx.base.stack.pop();
    return resolveAssignments(mainAssignments);
  }
}
function serializeDictionary(ctx, node, init) {
  if (node.p) {
    const base = ctx.base;
    if (base.features & 8) init = serializeWithObjectAssign(ctx, node, node.p, init);
    else {
      markSerializerRef(base, node.i);
      const assignments = serializeAssignments(ctx, node, node.p);
      if (assignments) return "(" + assignIndexedValue(ctx, node.i, init) + "," + assignments + getRefParam(ctx, node.i) + ")";
    }
  }
  return init;
}
function serializeNullConstructor(ctx, node) {
  pushObjectFlag(ctx, node.o, node.i);
  return serializeDictionary(ctx, node, NULL_CONSTRUCTOR);
}
function serializeDate(node) {
  return 'new Date("' + node.s + '")';
}
const TEMPORAL_CONSTRUCTOR = {
  [0]: "Temporal.Instant",
  [1]: "Temporal.Duration",
  [2]: "Temporal.PlainDate",
  [3]: "Temporal.PlainDateTime",
  [4]: "Temporal.PlainMonthDay",
  [5]: "Temporal.PlainTime",
  [6]: "Temporal.PlainYearMonth",
  [7]: "Temporal.ZonedDateTime"
};
function serializeTemporal(ctx, node) {
  if (ctx.base.features & 64) return TEMPORAL_CONSTRUCTOR[node.c] + '.from("' + node.s + '")';
  throw new SerovalUnsupportedNodeError(node);
}
function serializeRegExp(ctx, node) {
  if (ctx.base.features & 32) return "/" + deserializeString(node.c) + "/" + node.m;
  throw new SerovalUnsupportedNodeError(node);
}
function serializeSetItem(ctx, id, item) {
  const base = ctx.base;
  if (isIndexedValueInStack(base, item)) {
    markSerializerRef(base, id);
    createAddAssignment(ctx, id, getRefParam(ctx, item.i));
    return "";
  }
  return serialize$1(ctx, item);
}
function serializeSet(ctx, node) {
  let serialized = SET_CONSTRUCTOR;
  const items = node.a;
  const size = items.length;
  const id = node.i;
  if (size > 0) {
    ctx.base.stack.push(id);
    let result = serializeSetItem(ctx, id, items[0]);
    for (let i = 1, item = result; i < size; i++) {
      item = serializeSetItem(ctx, id, items[i]);
      result += (item && result && ",") + item;
    }
    ctx.base.stack.pop();
    if (result) serialized += "([" + result + "])";
  }
  return serialized;
}
function serializeMapEntry(ctx, id, key, val, sentinel) {
  const base = ctx.base;
  if (isIndexedValueInStack(base, key)) {
    const keyRef = getRefParam(ctx, key.i);
    markSerializerRef(base, id);
    if (isIndexedValueInStack(base, val)) {
      createSetAssignment(ctx, id, keyRef, getRefParam(ctx, val.i));
      return "";
    }
    if (val.t !== 4 && val.i != null && isSerializerRefMarked(base, val.i)) {
      const serialized = "(" + serialize$1(ctx, val) + ",[" + sentinel + "," + sentinel + "])";
      createSetAssignment(ctx, id, keyRef, getRefParam(ctx, val.i));
      createDeleteAssignment(ctx, id, sentinel);
      return serialized;
    }
    const parent = base.stack;
    base.stack = [];
    createSetAssignment(ctx, id, keyRef, serialize$1(ctx, val));
    base.stack = parent;
    return "";
  }
  if (isIndexedValueInStack(base, val)) {
    const valueRef = getRefParam(ctx, val.i);
    markSerializerRef(base, id);
    if (key.t !== 4 && key.i != null && isSerializerRefMarked(base, key.i)) {
      const serialized = "(" + serialize$1(ctx, key) + ",[" + sentinel + "," + sentinel + "])";
      createSetAssignment(ctx, id, getRefParam(ctx, key.i), valueRef);
      createDeleteAssignment(ctx, id, sentinel);
      return serialized;
    }
    const parent = base.stack;
    base.stack = [];
    createSetAssignment(ctx, id, serialize$1(ctx, key), valueRef);
    base.stack = parent;
    return "";
  }
  return "[" + serialize$1(ctx, key) + "," + serialize$1(ctx, val) + "]";
}
function serializeMap(ctx, node) {
  let serialized = MAP_CONSTRUCTOR;
  const keys = node.e.k;
  const size = keys.length;
  const id = node.i;
  const sentinel = node.f;
  const sentinelId = getRefParam(ctx, sentinel.i);
  const base = ctx.base;
  if (size > 0) {
    const vals = node.e.v;
    base.stack.push(id);
    let result = serializeMapEntry(ctx, id, keys[0], vals[0], sentinelId);
    for (let i = 1, item = result; i < size; i++) {
      item = serializeMapEntry(ctx, id, keys[i], vals[i], sentinelId);
      result += (item && result && ",") + item;
    }
    base.stack.pop();
    if (result) serialized += "([" + result + "])";
  }
  if (sentinel.t === 26) {
    markSerializerRef(base, sentinel.i);
    serialized = "(" + serialize$1(ctx, sentinel) + "," + serialized + ")";
  }
  return serialized;
}
function serializeArrayBuffer(ctx, node) {
  return getConstructor(ctx, node.f) + '("' + node.s + '")';
}
function serializeTypedArray(ctx, node) {
  return "new " + node.c + "(" + serialize$1(ctx, node.f) + "," + node.b + "," + node.l + ")";
}
function serializeDataView(ctx, node) {
  return "new DataView(" + serialize$1(ctx, node.f) + "," + node.b + "," + node.l + ")";
}
function serializeAggregateError(ctx, node) {
  const id = node.i;
  ctx.base.stack.push(id);
  const serialized = serializeDictionary(ctx, node, 'new AggregateError([],"' + node.m + '")');
  ctx.base.stack.pop();
  return serialized;
}
function serializeError(ctx, node) {
  return serializeDictionary(ctx, node, "new " + ERROR_CONSTRUCTOR_STRING[node.s] + '("' + node.m + '")');
}
function serializePromise(ctx, node) {
  let serialized;
  const fulfilled = node.f;
  const id = node.i;
  const promiseConstructor = node.s ? PROMISE_RESOLVE : PROMISE_REJECT;
  const base = ctx.base;
  if (isIndexedValueInStack(base, fulfilled)) {
    const ref = getRefParam(ctx, fulfilled.i);
    serialized = promiseConstructor + (node.s ? "().then(" + createFunction([], ref) + ")" : "().catch(" + createEffectfulFunction([], "throw " + ref) + ")");
  } else {
    base.stack.push(id);
    const result = serialize$1(ctx, fulfilled);
    base.stack.pop();
    serialized = promiseConstructor + "(" + result + ")";
  }
  return serialized;
}
function serializeBoxed(ctx, node) {
  return "Object(" + serialize$1(ctx, node.f) + ")";
}
function getConstructor(ctx, node) {
  const current = serialize$1(ctx, node);
  return node.t === 4 ? current : "(" + current + ")";
}
function serializePromiseConstructor(ctx, node) {
  if (ctx.mode === 1) throw new SerovalUnsupportedNodeError(node);
  return "(" + assignIndexedValue(ctx, node.s, getConstructor(ctx, node.f) + "()") + ").p";
}
function serializePromiseResolve(ctx, node) {
  if (ctx.mode === 1) throw new SerovalUnsupportedNodeError(node);
  return getConstructor(ctx, node.a[0]) + "(" + getRefParam(ctx, node.i) + "," + serialize$1(ctx, node.a[1]) + ")";
}
function serializePromiseReject(ctx, node) {
  if (ctx.mode === 1) throw new SerovalUnsupportedNodeError(node);
  return getConstructor(ctx, node.a[0]) + "(" + getRefParam(ctx, node.i) + "," + serialize$1(ctx, node.a[1]) + ")";
}
function serializePlugin(ctx, node) {
  const currentPlugins = ctx.base.plugins;
  if (currentPlugins) for (let i = 0, len = currentPlugins.length; i < len; i++) {
    const plugin = currentPlugins[i];
    if (plugin.tag === node.c) {
      if (ctx.child == null) ctx.child = new SerializePluginContext(ctx);
      return plugin.serialize(node.s, ctx.child, { id: node.i });
    }
  }
  throw new SerovalMissingPluginError(node.c);
}
function serializeIteratorFactory(ctx, node) {
  let result = "";
  let initialized = false;
  if (node.f.t !== 4) {
    markSerializerRef(ctx.base, node.f.i);
    result = "(" + serialize$1(ctx, node.f) + ",";
    initialized = true;
  }
  result += assignIndexedValue(ctx, node.i, "(" + SERIALIZED_ITERATOR_CONSTRUCTOR + ")(" + getRefParam(ctx, node.f.i) + ")");
  if (initialized) result += ")";
  return result;
}
function serializeIteratorFactoryInstance(ctx, node) {
  return getConstructor(ctx, node.a[0]) + "(" + serialize$1(ctx, node.a[1]) + ")";
}
function serializeAsyncIteratorFactory(ctx, node) {
  const promise = node.a[0];
  const symbol = node.a[1];
  const base = ctx.base;
  let result = "";
  if (promise.t !== 4) {
    markSerializerRef(base, promise.i);
    result += "(" + serialize$1(ctx, promise);
  }
  if (symbol.t !== 4) {
    markSerializerRef(base, symbol.i);
    result += (result ? "," : "(") + serialize$1(ctx, symbol);
  }
  if (result) result += ",";
  const iterator = assignIndexedValue(ctx, node.i, "(" + SERIALIZED_ASYNC_ITERATOR_CONSTRUCTOR + ")(" + getRefParam(ctx, symbol.i) + "," + getRefParam(ctx, promise.i) + ")");
  if (result) return result + iterator + ")";
  return iterator;
}
function serializeAsyncIteratorFactoryInstance(ctx, node) {
  return getConstructor(ctx, node.a[0]) + "(" + serialize$1(ctx, node.a[1]) + ")";
}
function serializeStreamConstructor(ctx, node) {
  const result = assignIndexedValue(ctx, node.i, getConstructor(ctx, node.f) + "()");
  const len = node.a.length;
  if (len) {
    let values = serialize$1(ctx, node.a[0]);
    for (let i = 1; i < len; i++) values += "," + serialize$1(ctx, node.a[i]);
    return "(" + result + "," + values + "," + getRefParam(ctx, node.i) + ")";
  }
  return result;
}
function serializeStreamNext(ctx, node) {
  return getRefParam(ctx, node.i) + ".next(" + serialize$1(ctx, node.f) + ")";
}
function serializeStreamThrow(ctx, node) {
  return getRefParam(ctx, node.i) + ".throw(" + serialize$1(ctx, node.f) + ")";
}
function serializeStreamReturn(ctx, node) {
  return getRefParam(ctx, node.i) + ".return(" + serialize$1(ctx, node.f) + ")";
}
function serializeSequenceItem(ctx, id, index, item) {
  const base = ctx.base;
  if (isIndexedValueInStack(base, item)) {
    markSerializerRef(base, id);
    createSequenceAssign(ctx, id, index, getRefParam(ctx, item.i));
    return "";
  }
  return serialize$1(ctx, item);
}
function serializeSequence(ctx, node) {
  const items = node.a;
  const size = items.length;
  const id = node.i;
  if (size > 0) {
    ctx.base.stack.push(id);
    let result = serializeSequenceItem(ctx, id, 0, items[0]);
    for (let i = 1, item = result; i < size; i++) {
      item = serializeSequenceItem(ctx, id, i, items[i]);
      result += (item && result && ",") + item;
    }
    ctx.base.stack.pop();
    if (result) return "{__SEROVAL_SEQUENCE__:!0,v:[" + result + "],t:" + node.s + ",d:" + node.l + "}";
  }
  return "{__SEROVAL_SEQUENCE__:!0,v:[],t:-1,d:0}";
}
function serializeAssignable(ctx, node) {
  switch (node.t) {
    case 17:
      return SYMBOL_STRING[node.s];
    case 18:
      return serializeReference(node);
    case 9:
      return serializeArray(ctx, node);
    case 10:
      return serializeObject(ctx, node);
    case 11:
      return serializeNullConstructor(ctx, node);
    case 5:
      return serializeDate(node);
    case 6:
      return serializeRegExp(ctx, node);
    case 7:
      return serializeSet(ctx, node);
    case 8:
      return serializeMap(ctx, node);
    case 19:
      return serializeArrayBuffer(ctx, node);
    case 16:
    case 15:
      return serializeTypedArray(ctx, node);
    case 20:
      return serializeDataView(ctx, node);
    case 14:
      return serializeAggregateError(ctx, node);
    case 13:
      return serializeError(ctx, node);
    case 12:
      return serializePromise(ctx, node);
    case 21:
      return serializeBoxed(ctx, node);
    case 22:
      return serializePromiseConstructor(ctx, node);
    case 25:
      return serializePlugin(ctx, node);
    case 26:
      return SPECIAL_REF_STRING[node.s];
    case 35:
      return serializeSequence(ctx, node);
    case 36:
      return serializeTemporal(ctx, node);
    default:
      throw new SerovalUnsupportedNodeError(node);
  }
}
function serialize$1(ctx, node) {
  switch (node.t) {
    case 2:
      return CONSTANT_STRING[node.s];
    case 0:
      return "" + node.s;
    case 1:
      return '"' + node.s + '"';
    case 3:
      return node.s + "n";
    case 4:
      return getRefParam(ctx, node.i);
    case 23:
      return serializePromiseResolve(ctx, node);
    case 24:
      return serializePromiseReject(ctx, node);
    case 27:
      return serializeIteratorFactory(ctx, node);
    case 28:
      return serializeIteratorFactoryInstance(ctx, node);
    case 29:
      return serializeAsyncIteratorFactory(ctx, node);
    case 30:
      return serializeAsyncIteratorFactoryInstance(ctx, node);
    case 31:
      return serializeStreamConstructor(ctx, node);
    case 32:
      return serializeStreamNext(ctx, node);
    case 33:
      return serializeStreamThrow(ctx, node);
    case 34:
      return serializeStreamReturn(ctx, node);
    default:
      return assignIndexedValue(ctx, node.i, serializeAssignable(ctx, node));
  }
}
function serializeTopCross(ctx, tree) {
  const result = serialize$1(ctx, tree);
  const id = tree.i;
  if (id == null) return result;
  const patches = resolvePatches(ctx.base);
  const ref = getRefParam(ctx, id);
  const scopeId = ctx.state.scopeId;
  const params = scopeId == null ? "" : "$R";
  const body = patches ? "(" + result + "," + patches + ref + ")" : result;
  if (params === "") {
    if (tree.t === 10 && !patches) return "(" + body + ")";
    return body;
  }
  const args = scopeId == null ? "()" : '($R["' + serializeString(scopeId) + '"])';
  return "(" + createFunction([params], body) + ")" + args;
}
var SyncParsePluginContext = class {
  constructor(_p, depth) {
    this._p = _p;
    this.depth = depth;
  }
  parse(current) {
    return parseSOS(this._p, this.depth, current);
  }
};
var StreamParsePluginContext = class {
  constructor(_p, depth) {
    this._p = _p;
    this.depth = depth;
  }
  parse(current) {
    return parseSOS(this._p, this.depth, current);
  }
  parseWithError(current) {
    return parseWithError(this._p, this.depth, current);
  }
  isAlive() {
    return this._p.state.alive;
  }
  pushPendingState() {
    pushPendingState(this._p);
  }
  popPendingState() {
    popPendingState(this._p);
  }
  onParse(node) {
    onParse(this._p, node);
  }
  onError(error) {
    onError(this._p, error);
  }
  addCleanup(callback) {
    this._p.state.cleanups.push(callback);
  }
};
function createStreamParserState(options) {
  return {
    alive: true,
    pending: 0,
    initial: true,
    buffer: [],
    onParse: options.onParse,
    onError: options.onError,
    onDone: options.onDone,
    cleanups: []
  };
}
function createStreamParserContext(options) {
  return {
    type: 2,
    base: createBaseParserContext(2, options),
    state: createStreamParserState(options)
  };
}
function parseItems(ctx, depth, current) {
  const nodes = [];
  for (let i = 0, len = current.length; i < len; i++) if (i in current) nodes[i] = parseSOS(ctx, depth, current[i]);
  else nodes[i] = 0;
  return nodes;
}
function parseArray(ctx, depth, id, current) {
  return createArrayNode(id, current, parseItems(ctx, depth, current));
}
function parseProperties(ctx, depth, properties) {
  const entries = Object.entries(properties);
  const keyNodes = [];
  const valueNodes = [];
  for (let i = 0, len = entries.length; i < len; i++) {
    keyNodes.push(serializeString(entries[i][0]));
    valueNodes.push(parseSOS(ctx, depth, entries[i][1]));
  }
  if (SYM_ITERATOR in properties) {
    keyNodes.push(parseWellKnownSymbol(ctx.base, SYM_ITERATOR));
    valueNodes.push(createIteratorFactoryInstanceNode(parseIteratorFactory(ctx.base), parseSOS(ctx, depth, createSequenceFromIterable(properties))));
  }
  if (SYM_ASYNC_ITERATOR in properties) {
    keyNodes.push(parseWellKnownSymbol(ctx.base, SYM_ASYNC_ITERATOR));
    valueNodes.push(createAsyncIteratorFactoryInstanceNode(parseAsyncIteratorFactory(ctx.base), parseSOS(ctx, depth, ctx.type === 1 ? createStream() : createStreamFromAsyncIterable(properties, ctx.state.cleanups))));
  }
  if (SYM_TO_STRING_TAG in properties) {
    keyNodes.push(parseWellKnownSymbol(ctx.base, SYM_TO_STRING_TAG));
    valueNodes.push(createStringNode(properties[SYM_TO_STRING_TAG]));
  }
  if (SYM_IS_CONCAT_SPREADABLE in properties) {
    keyNodes.push(parseWellKnownSymbol(ctx.base, SYM_IS_CONCAT_SPREADABLE));
    valueNodes.push(properties[SYM_IS_CONCAT_SPREADABLE] ? TRUE_NODE : FALSE_NODE);
  }
  return {
    k: keyNodes,
    v: valueNodes
  };
}
function parsePlainObject(ctx, depth, id, current, empty) {
  return createObjectNode(id, current, empty, parseProperties(ctx, depth, current));
}
function parseBoxed(ctx, depth, id, current) {
  return createBoxedNode(id, parseSOS(ctx, depth, current.valueOf()));
}
function parseTypedArray(ctx, depth, id, current) {
  current = getArrayBufferView(ctx.base, current);
  return createTypedArrayNode(id, current, parseSOS(ctx, depth, current.buffer));
}
function parseBigIntTypedArray(ctx, depth, id, current) {
  current = getArrayBufferView(ctx.base, current);
  return createBigIntTypedArrayNode(id, current, parseSOS(ctx, depth, current.buffer));
}
function parseDataView(ctx, depth, id, current) {
  current = getArrayBufferView(ctx.base, current);
  return createDataViewNode(id, current, parseSOS(ctx, depth, current.buffer));
}
function parseError(ctx, depth, id, current) {
  const options = getErrorOptions(current, ctx.base.features);
  return createErrorNode(id, current, options ? parseProperties(ctx, depth, options) : void 0);
}
function parseAggregateError(ctx, depth, id, current) {
  const options = getErrorOptions(current, ctx.base.features);
  return createAggregateErrorNode(id, current, options ? parseProperties(ctx, depth, options) : void 0);
}
function parseMap(ctx, depth, id, current) {
  const keyNodes = [];
  const valueNodes = [];
  for (const [key, value] of current.entries()) {
    keyNodes.push(parseSOS(ctx, depth, key));
    valueNodes.push(parseSOS(ctx, depth, value));
  }
  return createMapNode(ctx.base, id, keyNodes, valueNodes);
}
function parseSet(ctx, depth, id, current) {
  const items = [];
  for (const item of current.keys()) items.push(parseSOS(ctx, depth, item));
  return createSetNode(id, items);
}
function parseStream(ctx, depth, id, current) {
  const result = createStreamConstructorNode(id, parseSpecialReference(ctx.base, 4), []);
  if (ctx.type === 1) return result;
  pushPendingState(ctx);
  current.on({
    next: (value) => {
      if (ctx.state.alive) {
        const parsed = parseWithError(ctx, depth, value);
        if (parsed) onParse(ctx, createStreamNextNode(id, parsed));
      }
    },
    throw: (value) => {
      if (ctx.state.alive) {
        const parsed = parseWithError(ctx, depth, value);
        if (parsed) onParse(ctx, createStreamThrowNode(id, parsed));
      }
      popPendingState(ctx);
    },
    return: (value) => {
      if (ctx.state.alive) {
        const parsed = parseWithError(ctx, depth, value);
        if (parsed) onParse(ctx, createStreamReturnNode(id, parsed));
      }
      popPendingState(ctx);
    }
  });
  return result;
}
function handlePromiseSuccess(id, depth, data) {
  if (this.state.alive) {
    const parsed = parseWithError(this, depth, data);
    if (parsed) onParse(this, createSerovalNode(23, id, void 0, void 0, void 0, void 0, void 0, [parseSpecialReference(this.base, 2), parsed], void 0, void 0, void 0, void 0));
    popPendingState(this);
  }
}
function handlePromiseFailure(id, depth, data) {
  if (this.state.alive) {
    const parsed = parseWithError(this, depth, data);
    if (parsed) onParse(this, createSerovalNode(24, id, void 0, void 0, void 0, void 0, void 0, [parseSpecialReference(this.base, 3), parsed], void 0, void 0, void 0, void 0));
  }
  popPendingState(this);
}
function parsePromise(ctx, depth, id, current) {
  const resolver = createIndexForValue(ctx.base, {});
  if (ctx.type === 2) {
    pushPendingState(ctx);
    current.then(handlePromiseSuccess.bind(ctx, resolver, depth), handlePromiseFailure.bind(ctx, resolver, depth));
  }
  return createPromiseConstructorNode(ctx.base, id, resolver);
}
function parsePluginSync(ctx, depth, id, current, currentPlugins) {
  for (let i = 0, len = currentPlugins.length; i < len; i++) {
    const plugin = currentPlugins[i];
    if (plugin.parse.sync && plugin.test(current)) return createPluginNode(id, plugin.tag, plugin.parse.sync(current, new SyncParsePluginContext(ctx, depth), { id }));
  }
}
function parsePluginStream(ctx, depth, id, current, currentPlugins) {
  for (let i = 0, len = currentPlugins.length; i < len; i++) {
    const plugin = currentPlugins[i];
    if (plugin.parse.stream && plugin.test(current)) return createPluginNode(id, plugin.tag, plugin.parse.stream(current, new StreamParsePluginContext(ctx, depth), { id }));
  }
}
function parsePlugin(ctx, depth, id, current) {
  const currentPlugins = ctx.base.plugins;
  if (currentPlugins) return ctx.type === 1 ? parsePluginSync(ctx, depth, id, current, currentPlugins) : parsePluginStream(ctx, depth, id, current, currentPlugins);
}
function parseSequence(ctx, depth, id, current) {
  const nodes = [];
  for (let i = 0, len = current.v.length; i < len; i++) nodes[i] = parseSOS(ctx, depth, current.v[i]);
  return createSequenceNode(id, nodes, current.t, current.d);
}
function parseObjectPhase2(ctx, depth, id, current, currentClass) {
  switch (currentClass) {
    case Object:
      return parsePlainObject(ctx, depth, id, current, false);
    case void 0:
      return parsePlainObject(ctx, depth, id, current, true);
    case Date:
      return createDateNode(id, current);
    case Error:
    case EvalError:
    case RangeError:
    case ReferenceError:
    case SyntaxError:
    case TypeError:
    case URIError:
      return parseError(ctx, depth, id, current);
    case Number:
    case Boolean:
    case String:
    case BigInt:
      return parseBoxed(ctx, depth, id, current);
    case ArrayBuffer:
      return createArrayBufferNode(ctx.base, id, current);
    case Int8Array:
    case Int16Array:
    case Int32Array:
    case Uint8Array:
    case Uint16Array:
    case Uint32Array:
    case Uint8ClampedArray:
    case Float32Array:
    case Float64Array:
      return parseTypedArray(ctx, depth, id, current);
    case DataView:
      return parseDataView(ctx, depth, id, current);
    case Map:
      return parseMap(ctx, depth, id, current);
    case Set:
      return parseSet(ctx, depth, id, current);
  }
  if (currentClass === Promise || current instanceof Promise) return parsePromise(ctx, depth, id, current);
  const currentFeatures = ctx.base.features;
  if (currentFeatures & 32 && currentClass === RegExp) return createRegExpNode(id, current);
  if (currentFeatures & 16) switch (currentClass) {
    case BigInt64Array:
    case BigUint64Array:
      return parseBigIntTypedArray(ctx, depth, id, current);
  }
  if (currentFeatures & 1 && typeof AggregateError !== "undefined" && (currentClass === AggregateError || current instanceof AggregateError)) return parseAggregateError(ctx, depth, id, current);
  if (currentFeatures & 64 && typeof Temporal !== "undefined") switch (currentClass) {
    case Temporal.Instant:
      return createTemporalNode(id, 0, current);
    case Temporal.Duration:
      return createTemporalNode(id, 1, current);
    case Temporal.PlainDate:
      return createTemporalNode(id, 2, current);
    case Temporal.PlainDateTime:
      return createTemporalNode(id, 3, current);
    case Temporal.PlainMonthDay:
      return createTemporalNode(id, 4, current);
    case Temporal.PlainTime:
      return createTemporalNode(id, 5, current);
    case Temporal.PlainYearMonth:
      return createTemporalNode(id, 6, current);
    case Temporal.ZonedDateTime:
      return createTemporalNode(id, 7, current);
  }
  if (current instanceof Error) return parseError(ctx, depth, id, current);
  if (SYM_ITERATOR in current || SYM_ASYNC_ITERATOR in current) return parsePlainObject(ctx, depth, id, current, !!currentClass);
  throw new SerovalUnsupportedTypeError(current);
}
function parseObject(ctx, depth, id, current) {
  if (Array.isArray(current)) return parseArray(ctx, depth, id, current);
  if (isStream(current)) return parseStream(ctx, depth, id, current);
  if (isSequence(current)) return parseSequence(ctx, depth, id, current);
  let currentClass = current.constructor;
  if (currentClass !== void 0 && typeof currentClass !== "function") {
    const proto = Object.getPrototypeOf(current);
    currentClass = proto === null ? void 0 : proto.constructor;
  }
  if (currentClass === OpaqueReference) return parseSOS(ctx, depth, current.replacement);
  const parsed = parsePlugin(ctx, depth, id, current);
  if (parsed) return parsed;
  return parseObjectPhase2(ctx, depth, id, current, currentClass);
}
function parseFunction(ctx, depth, current) {
  const ref = getReferenceNode(ctx.base, current);
  if (ref.type !== 0) return ref.value;
  const plugin = parsePlugin(ctx, depth, ref.value, current);
  if (plugin) return plugin;
  throw new SerovalUnsupportedTypeError(current);
}
function parseSOS(ctx, depth, current) {
  if (depth >= ctx.base.depthLimit) throw new SerovalDepthLimitError(ctx.base.depthLimit);
  switch (typeof current) {
    case "boolean":
      return current ? TRUE_NODE : FALSE_NODE;
    case "undefined":
      return UNDEFINED_NODE;
    case "string":
      return createStringNode(current);
    case "number":
      return createNumberNode(current);
    case "bigint":
      return createBigIntNode(current);
    case "object":
      if (current) {
        const ref = getReferenceNode(ctx.base, current);
        return ref.type === 0 ? parseObject(ctx, depth + 1, ref.value, current) : ref.value;
      }
      return NULL_NODE;
    case "symbol":
      return parseWellKnownSymbol(ctx.base, current);
    case "function":
      return parseFunction(ctx, depth, current);
    default:
      throw new SerovalUnsupportedTypeError(current);
  }
}
function onParse(ctx, node) {
  if (ctx.state.initial) ctx.state.buffer.push(node);
  else onParseInternal(ctx, node, false);
}
function onError(ctx, error) {
  if (ctx.state.onError) ctx.state.onError(error);
  else throw error instanceof SerovalParserError ? error : new SerovalParserError(error);
}
function onDone(ctx) {
  if (ctx.state.onDone) ctx.state.onDone();
  for (let i = 0, len = ctx.state.cleanups.length; i < len; i++) ctx.state.cleanups[i]();
}
function onParseInternal(ctx, node, initial) {
  try {
    ctx.state.onParse(node, initial);
  } catch (error) {
    onError(ctx, error);
  }
}
function pushPendingState(ctx) {
  ctx.state.pending++;
}
function popPendingState(ctx) {
  if (--ctx.state.pending <= 0) onDone(ctx);
}
function parseWithError(ctx, depth, current) {
  try {
    return parseSOS(ctx, depth, current);
  } catch (err) {
    onError(ctx, err);
    return;
  }
}
function startStreamParse(ctx, current) {
  const parsed = parseWithError(ctx, 0, current);
  if (parsed) {
    onParseInternal(ctx, parsed, true);
    ctx.state.initial = false;
    flushStreamParse(ctx, ctx.state);
    if (ctx.state.pending <= 0) destroyStreamParse(ctx);
  }
}
function flushStreamParse(ctx, state) {
  for (let i = 0, len = state.buffer.length; i < len; i++) onParseInternal(ctx, state.buffer[i], false);
}
function destroyStreamParse(ctx) {
  if (ctx.state.alive) {
    onDone(ctx);
    ctx.state.alive = false;
  }
}
function crossSerializeStream(source, options) {
  const plugins = resolvePlugins(options.plugins);
  const ctx = createStreamParserContext({
    compactArrayBufferViews: options.compactArrayBufferViews,
    plugins,
    refs: options.refs,
    disabledFeatures: options.disabledFeatures,
    onParse(node, initial) {
      const serial = createCrossSerializerContext({
        plugins,
        features: ctx.base.features,
        scopeId: options.scopeId,
        markedRefs: ctx.base.marked
      });
      let serialized;
      try {
        serialized = serializeTopCross(serial, node);
      } catch (err) {
        if (options.onError) options.onError(err);
        return;
      }
      options.onSerialize(serialized, initial);
    },
    onError: options.onError,
    onDone: options.onDone
  });
  startStreamParse(ctx, source);
  return destroyStreamParse.bind(null, ctx);
}
var Serializer = class {
  constructor(options) {
    this.options = options;
    this.alive = true;
    this.flushed = false;
    this.done = false;
    this.pending = 0;
    this.cleanups = [];
    this.refs = /* @__PURE__ */ new Map();
    this.keys = /* @__PURE__ */ new Set();
    this.ids = 0;
    this.plugins = resolvePlugins(options.plugins);
  }
  write(key, value) {
    if (this.alive && !this.flushed) {
      this.pending++;
      this.keys.add(key);
      this.cleanups.push(crossSerializeStream(value, {
        plugins: this.plugins,
        scopeId: this.options.scopeId,
        refs: this.refs,
        disabledFeatures: this.options.disabledFeatures,
        compactArrayBufferViews: this.options.compactArrayBufferViews,
        onError: this.options.onError,
        onSerialize: (data, initial) => {
          if (this.alive) this.options.onData(initial ? this.options.globalIdentifier + '["' + serializeString(key) + '"]=' + data : data);
        },
        onDone: () => {
          if (this.alive) {
            this.pending--;
            if (this.pending <= 0 && this.flushed && !this.done && this.options.onDone) {
              this.options.onDone();
              this.done = true;
            }
          }
        }
      }));
    }
  }
  getNextID() {
    while (this.keys.has("" + this.ids)) this.ids++;
    return "" + this.ids;
  }
  push(value) {
    const newID = this.getNextID();
    this.write(newID, value);
    return newID;
  }
  flush() {
    if (this.alive) {
      this.flushed = true;
      if (this.pending <= 0 && !this.done && this.options.onDone) {
        this.options.onDone();
        this.done = true;
      }
    }
  }
  close() {
    if (this.alive) {
      for (let i = 0, len = this.cleanups.length; i < len; i++) this.cleanups[i]();
      if (!this.done && this.options.onDone) {
        this.options.onDone();
        this.done = true;
      }
      this.alive = false;
    }
  }
};
function createCustomEventOptions(current) {
  return {
    detail: current.detail,
    bubbles: current.bubbles,
    cancelable: current.cancelable,
    composed: current.composed
  };
}
const CustomEventPlugin = /* @__PURE__ */ createPlugin({
  tag: "seroval-plugins/web/CustomEvent",
  test(value) {
    if (typeof CustomEvent === "undefined") return false;
    return value instanceof CustomEvent;
  },
  parse: {
    sync(value, ctx) {
      return {
        type: ctx.parse(value.type),
        options: ctx.parse(createCustomEventOptions(value))
      };
    },
    async async(value, ctx) {
      return {
        type: await ctx.parse(value.type),
        options: await ctx.parse(createCustomEventOptions(value))
      };
    },
    stream(value, ctx) {
      return {
        type: ctx.parse(value.type),
        options: ctx.parse(createCustomEventOptions(value))
      };
    }
  },
  serialize(node, ctx) {
    return "new CustomEvent(" + ctx.serialize(node.type) + "," + ctx.serialize(node.options) + ")";
  },
  deserialize(node, ctx) {
    return new CustomEvent(ctx.deserialize(node.type), ctx.deserialize(node.options));
  }
});
const DOMExceptionPlugin = /* @__PURE__ */ createPlugin({
  tag: "seroval-plugins/web/DOMException",
  test(value) {
    if (typeof DOMException === "undefined") return false;
    return value instanceof DOMException;
  },
  parse: {
    sync(value, ctx) {
      return {
        name: ctx.parse(value.name),
        message: ctx.parse(value.message)
      };
    },
    async async(value, ctx) {
      return {
        name: await ctx.parse(value.name),
        message: await ctx.parse(value.message)
      };
    },
    stream(value, ctx) {
      return {
        name: ctx.parse(value.name),
        message: ctx.parse(value.message)
      };
    }
  },
  serialize(node, ctx) {
    return "new DOMException(" + ctx.serialize(node.message) + "," + ctx.serialize(node.name) + ")";
  },
  deserialize(node, ctx) {
    return new DOMException(ctx.deserialize(node.message), ctx.deserialize(node.name));
  }
});
function createEventOptions(current) {
  return {
    bubbles: current.bubbles,
    cancelable: current.cancelable,
    composed: current.composed
  };
}
const EventPlugin = /* @__PURE__ */ createPlugin({
  tag: "seroval-plugins/web/Event",
  test(value) {
    if (typeof Event === "undefined") return false;
    return value instanceof Event;
  },
  parse: {
    sync(value, ctx) {
      return {
        type: ctx.parse(value.type),
        options: ctx.parse(createEventOptions(value))
      };
    },
    async async(value, ctx) {
      return {
        type: await ctx.parse(value.type),
        options: await ctx.parse(createEventOptions(value))
      };
    },
    stream(value, ctx) {
      return {
        type: ctx.parse(value.type),
        options: ctx.parse(createEventOptions(value))
      };
    }
  },
  serialize(node, ctx) {
    return "new Event(" + ctx.serialize(node.type) + "," + ctx.serialize(node.options) + ")";
  },
  deserialize(node, ctx) {
    return new Event(ctx.deserialize(node.type), ctx.deserialize(node.options));
  }
});
const FilePlugin = /* @__PURE__ */ createPlugin({
  tag: "seroval-plugins/web/File",
  test(value) {
    if (typeof File === "undefined") return false;
    return value instanceof File;
  },
  parse: { async async(value, ctx) {
    return {
      name: await ctx.parse(value.name),
      options: await ctx.parse({
        type: value.type,
        lastModified: value.lastModified
      }),
      buffer: await ctx.parse(await value.arrayBuffer())
    };
  } },
  serialize(node, ctx) {
    return "new File([" + ctx.serialize(node.buffer) + "]," + ctx.serialize(node.name) + "," + ctx.serialize(node.options) + ")";
  },
  deserialize(node, ctx) {
    return new File([ctx.deserialize(node.buffer)], ctx.deserialize(node.name), ctx.deserialize(node.options));
  }
});
function convertFormData(instance) {
  const items = [];
  instance.forEach((value, key) => {
    items.push([key, value]);
  });
  return items;
}
const FORM_DATA_FACTORY = {};
const FORM_DATA_FACTORY_CONSTRUCTOR = (e, f = new FormData(), i = 0, s = e.length, t) => {
  for (; i < s; i++) {
    t = e[i];
    f.append(t[0], t[1]);
  }
  return f;
};
const FormDataPlugin = /* @__PURE__ */ createPlugin({
  tag: "seroval-plugins/web/FormData",
  extends: [FilePlugin, /* @__PURE__ */ createPlugin({
    tag: "seroval-plugins/web/FormDataFactory",
    test(value) {
      return value === FORM_DATA_FACTORY;
    },
    parse: {
      sync() {
        return FORM_DATA_FACTORY;
      },
      async async() {
        return await Promise.resolve(FORM_DATA_FACTORY);
      },
      stream() {
        return FORM_DATA_FACTORY;
      }
    },
    serialize() {
      return FORM_DATA_FACTORY_CONSTRUCTOR.toString();
    },
    deserialize() {
      return FORM_DATA_FACTORY;
    }
  })],
  test(value) {
    if (typeof FormData === "undefined") return false;
    return value instanceof FormData;
  },
  parse: {
    sync(value, ctx) {
      return {
        factory: ctx.parse(FORM_DATA_FACTORY),
        entries: ctx.parse(convertFormData(value))
      };
    },
    async async(value, ctx) {
      return {
        factory: await ctx.parse(FORM_DATA_FACTORY),
        entries: await ctx.parse(convertFormData(value))
      };
    },
    stream(value, ctx) {
      return {
        factory: ctx.parse(FORM_DATA_FACTORY),
        entries: ctx.parse(convertFormData(value))
      };
    }
  },
  serialize(node, ctx) {
    return "(" + ctx.serialize(node.factory) + ")(" + ctx.serialize(node.entries) + ")";
  },
  deserialize(node, ctx) {
    return FORM_DATA_FACTORY_CONSTRUCTOR(ctx.deserialize(node.entries));
  }
});
function convertHeaders(instance) {
  const items = [];
  instance.forEach((value, key) => {
    items.push([key, value]);
  });
  return items;
}
const HeadersPlugin = /* @__PURE__ */ createPlugin({
  tag: "seroval-plugins/web/Headers",
  test(value) {
    if (typeof Headers === "undefined") return false;
    return value instanceof Headers;
  },
  parse: {
    sync(value, ctx) {
      return { value: ctx.parse(convertHeaders(value)) };
    },
    async async(value, ctx) {
      return { value: await ctx.parse(convertHeaders(value)) };
    },
    stream(value, ctx) {
      return { value: ctx.parse(convertHeaders(value)) };
    }
  },
  serialize(node, ctx) {
    return "new Headers(" + ctx.serialize(node.value) + ")";
  },
  deserialize(node, ctx) {
    return new Headers(ctx.deserialize(node.value));
  }
});
const READABLE_STREAM_FACTORY = {};
const READABLE_STREAM_FACTORY_CONSTRUCTOR = (stream) => new ReadableStream({ start(controller) {
  stream.on({
    next(value) {
      try {
        controller.enqueue(value);
      } catch (_error) {
      }
    },
    throw(value) {
      controller.error(value);
    },
    return() {
      try {
        controller.close();
      } catch (_error) {
      }
    }
  });
} });
const ReadableStreamFactoryPlugin = /* @__PURE__ */ createPlugin({
  tag: "seroval-plugins/web/ReadableStreamFactory",
  test(value) {
    return value === READABLE_STREAM_FACTORY;
  },
  parse: {
    sync() {
      return READABLE_STREAM_FACTORY;
    },
    async async() {
      return await Promise.resolve(READABLE_STREAM_FACTORY);
    },
    stream() {
      return READABLE_STREAM_FACTORY;
    }
  },
  serialize() {
    return READABLE_STREAM_FACTORY_CONSTRUCTOR.toString();
  },
  deserialize() {
    return READABLE_STREAM_FACTORY;
  }
});
async function drainStream(stream, reader) {
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) {
        stream.return(result.value);
        reader.releaseLock();
        break;
      }
      stream.next(result.value);
    }
  } catch (error) {
    reader.releaseLock();
    stream.throw(error);
  }
}
function cleanupStream(reader) {
  reader.cancel().catch(() => {
  });
  reader.releaseLock();
}
function toStream(value) {
  const stream = createStream();
  const reader = value.getReader();
  const cleanup = cleanupStream.bind(null, reader);
  drainStream(stream, reader).catch(cleanup);
  return [stream, cleanup];
}
const ReadableStreamPlugin = /* @__PURE__ */ createPlugin({
  tag: "seroval/plugins/web/ReadableStream",
  extends: [ReadableStreamFactoryPlugin],
  test(value) {
    if (typeof ReadableStream === "undefined") return false;
    return value instanceof ReadableStream;
  },
  parse: {
    sync(_value, ctx) {
      return {
        factory: ctx.parse(READABLE_STREAM_FACTORY),
        stream: ctx.parse(createStream())
      };
    },
    async async(value, ctx) {
      return {
        factory: await ctx.parse(READABLE_STREAM_FACTORY),
        stream: await ctx.parse(toStream(value)[0])
      };
    },
    stream(value, ctx) {
      const [stream, cleanup] = toStream(value);
      ctx.addCleanup(cleanup);
      return {
        factory: ctx.parse(READABLE_STREAM_FACTORY),
        stream: ctx.parse(stream)
      };
    }
  },
  serialize(node, ctx) {
    return "(" + ctx.serialize(node.factory) + ")(" + ctx.serialize(node.stream) + ")";
  },
  deserialize(node, ctx) {
    const stream = ctx.deserialize(node.stream);
    if (!stream || typeof stream !== "object" || !isStream(stream)) throw new Error("Expected a stream source.");
    return READABLE_STREAM_FACTORY_CONSTRUCTOR(stream);
  }
});
function createRequestOptions(current, body) {
  return {
    body,
    cache: current.cache,
    credentials: current.credentials,
    headers: current.headers,
    integrity: current.integrity,
    keepalive: current.keepalive,
    method: current.method,
    mode: current.mode,
    redirect: current.redirect,
    referrer: current.referrer,
    referrerPolicy: current.referrerPolicy
  };
}
const RequestPlugin = /* @__PURE__ */ createPlugin({
  tag: "seroval-plugins/web/Request",
  extends: [ReadableStreamPlugin, HeadersPlugin],
  test(value) {
    if (typeof Request === "undefined") return false;
    return value instanceof Request;
  },
  parse: {
    async async(value, ctx) {
      return {
        url: await ctx.parse(value.url),
        options: await ctx.parse(createRequestOptions(value, value.body && !value.bodyUsed ? await value.clone().arrayBuffer() : null))
      };
    },
    stream(value, ctx) {
      return {
        url: ctx.parse(value.url),
        options: ctx.parse(createRequestOptions(value, value.body && !value.bodyUsed ? value.clone().body : null))
      };
    }
  },
  serialize(node, ctx) {
    return "new Request(" + ctx.serialize(node.url) + "," + ctx.serialize(node.options) + ")";
  },
  deserialize(node, ctx) {
    return new Request(ctx.deserialize(node.url), ctx.deserialize(node.options));
  }
});
function createResponseOptions(current) {
  return {
    headers: current.headers,
    status: current.status,
    statusText: current.statusText
  };
}
const ResponsePlugin = /* @__PURE__ */ createPlugin({
  tag: "seroval-plugins/web/Response",
  extends: [ReadableStreamPlugin, HeadersPlugin],
  test(value) {
    if (typeof Response === "undefined") return false;
    return value instanceof Response;
  },
  parse: {
    async async(value, ctx) {
      return {
        body: await ctx.parse(value.body && !value.bodyUsed ? await value.clone().arrayBuffer() : null),
        options: await ctx.parse(createResponseOptions(value))
      };
    },
    stream(value, ctx) {
      return {
        body: ctx.parse(value.body && !value.bodyUsed ? value.clone().body : null),
        options: ctx.parse(createResponseOptions(value))
      };
    }
  },
  serialize(node, ctx) {
    return "new Response(" + ctx.serialize(node.body) + "," + ctx.serialize(node.options) + ")";
  },
  deserialize(node, ctx) {
    return new Response(ctx.deserialize(node.body), ctx.deserialize(node.options));
  }
});
const URLPlugin = /* @__PURE__ */ createPlugin({
  tag: "seroval-plugins/web/URL",
  test(value) {
    if (typeof URL === "undefined") return false;
    return value instanceof URL;
  },
  parse: {
    sync(value, ctx) {
      return { value: ctx.parse(value.href) };
    },
    async async(value, ctx) {
      return { value: await ctx.parse(value.href) };
    },
    stream(value, ctx) {
      return { value: ctx.parse(value.href) };
    }
  },
  serialize(node, ctx) {
    return "new URL(" + ctx.serialize(node.value) + ")";
  },
  deserialize(node, ctx) {
    return new URL(ctx.deserialize(node.value));
  }
});
const URLSearchParamsPlugin = /* @__PURE__ */ createPlugin({
  tag: "seroval-plugins/web/URLSearchParams",
  test(value) {
    if (typeof URLSearchParams === "undefined") return false;
    return value instanceof URLSearchParams;
  },
  parse: {
    sync(value, ctx) {
      return { value: ctx.parse(value.toString()) };
    },
    async async(value, ctx) {
      return { value: await ctx.parse(value.toString()) };
    },
    stream(value, ctx) {
      return { value: ctx.parse(value.toString()) };
    }
  },
  serialize(node, ctx) {
    return "new URLSearchParams(" + ctx.serialize(node.value) + ")";
  },
  deserialize(node, ctx) {
    return new URLSearchParams(ctx.deserialize(node.value));
  }
});
const ES2017FLAG = Feature.AggregateError | Feature.BigIntTypedArray;
const GLOBAL_IDENTIFIER = "_$HY.r";
function createSerializer({ onData, onDone: onDone2, scopeId, onError: onError2 }) {
  return new Serializer({
    scopeId,
    plugins: [
      CustomEventPlugin,
      DOMExceptionPlugin,
      EventPlugin,
      FormDataPlugin,
      HeadersPlugin,
      ReadableStreamPlugin,
      RequestPlugin,
      ResponsePlugin,
      URLSearchParamsPlugin,
      URLPlugin
    ],
    globalIdentifier: GLOBAL_IDENTIFIER,
    disabledFeatures: ES2017FLAG,
    onData,
    onDone: onDone2,
    onError: onError2
  });
}
function getLocalHeaderScript(id) {
  return getCrossReferenceHeader(id) + ";";
}
function renderToString(code, options = {}) {
  const { renderId } = options;
  let scripts = "";
  const serializer = createSerializer({
    scopeId: renderId,
    onData(script) {
      if (!scripts) {
        scripts = getLocalHeaderScript(renderId);
      }
      scripts += script + ";";
    },
    onError: options.onError
  });
  sharedConfig.context = {
    id: renderId || "",
    count: 0,
    suspense: {},
    lazy: {},
    assets: [],
    nonce: options.nonce,
    serialize(id, p) {
      !sharedConfig.context.noHydrate && serializer.write(id, p);
    },
    roots: 0,
    nextRoot() {
      return this.renderId + "i-" + this.roots++;
    }
  };
  let html = createRoot((d) => {
    setTimeout(d);
    return resolveSSRNode(escape(code()));
  });
  sharedConfig.context.noHydrate = true;
  serializer.close();
  html = injectAssets(sharedConfig.context.assets, html);
  if (scripts.length) html = injectScripts(html, scripts, options.nonce);
  return html;
}
function escape(s, attr) {
  const t = typeof s;
  if (t !== "string") {
    if (t === "function") return escape(s());
    if (Array.isArray(s)) {
      for (let i = 0; i < s.length; i++) s[i] = escape(s[i]);
      return s;
    }
    return s;
  }
  const delim = "<";
  const escDelim = "&lt;";
  let iDelim = s.indexOf(delim);
  let iAmp = s.indexOf("&");
  if (iDelim < 0 && iAmp < 0) return s;
  let left = 0, out = "";
  while (iDelim >= 0 && iAmp >= 0) {
    if (iDelim < iAmp) {
      if (left < iDelim) out += s.substring(left, iDelim);
      out += escDelim;
      left = iDelim + 1;
      iDelim = s.indexOf(delim, left);
    } else {
      if (left < iAmp) out += s.substring(left, iAmp);
      out += "&amp;";
      left = iAmp + 1;
      iAmp = s.indexOf("&", left);
    }
  }
  if (iDelim >= 0) {
    do {
      if (left < iDelim) out += s.substring(left, iDelim);
      out += escDelim;
      left = iDelim + 1;
      iDelim = s.indexOf(delim, left);
    } while (iDelim >= 0);
  } else
    while (iAmp >= 0) {
      if (left < iAmp) out += s.substring(left, iAmp);
      out += "&amp;";
      left = iAmp + 1;
      iAmp = s.indexOf("&", left);
    }
  return left < s.length ? out + s.substring(left) : out;
}
function resolveSSRNode(node, top) {
  const t = typeof node;
  if (t === "string") return node;
  if (node == null || t === "boolean") return "";
  if (Array.isArray(node)) {
    let prev = {};
    let mapped = "";
    for (let i = 0, len = node.length; i < len; i++) {
      if (typeof prev !== "object" && typeof node[i] !== "object") mapped += `<!--!$-->`;
      mapped += resolveSSRNode(prev = node[i]);
    }
    return mapped;
  }
  if (t === "object") return node.t;
  if (t === "function") return resolveSSRNode(node());
  return String(node);
}
function injectAssets(assets, html) {
  if (!assets || !assets.length) return html;
  let out = "";
  for (let i = 0, len = assets.length; i < len; i++) out += assets[i]();
  return html.replace(`</head>`, out + `</head>`);
}
function injectScripts(html, scripts, nonce) {
  const tag = `<script${nonce ? ` nonce="${nonce}"` : ""}>${scripts}<\/script>`;
  const index = html.indexOf("<!--xs-->");
  if (index > -1) {
    return html.slice(0, index) + tag + html.slice(index);
  }
  return html + tag;
}
function notSup() {
  throw new Error(
    "Client-only API called on the server side. Run client-only code in onMount, or conditionally run client-only component with <Show>."
  );
}
const now = () => globalThis.performance.now();
const round = (x) => Math.round(x * 1e4) / 1e4;
async function measure(fn, { warmup = 5, iterations = 25, setup } = {}) {
  for (let i = 0; i < warmup; i++) {
    const s = setup?.();
    await fn(s);
  }
  const samples = [];
  for (let i = 0; i < iterations; i++) {
    const s = setup?.();
    const t0 = now();
    await fn(s);
    samples.push(now() - t0);
  }
  samples.sort((a, b) => a - b);
  const med = samples[Math.floor(samples.length / 2)];
  const p95 = samples[Math.min(samples.length - 1, Math.ceil(0.95 * samples.length) - 1)];
  return {
    medianMs: round(med),
    p95Ms: round(p95),
    minMs: round(samples[0]),
    maxMs: round(samples[samples.length - 1]),
    samples: samples.length
  };
}
const N_BIG = 1e4;
var _tmpl$ = /* @__PURE__ */ notSup(), _tmpl$2 = /* @__PURE__ */ notSup();
function FlatList(props) {
  const rows = Array.from({
    length: props.n
  }, (_, i) => i);
  return (() => {
    var _el$ = _tmpl$();
    notSup(_el$, createComponent(Index, {
      each: rows,
      children: (i) => (() => {
        var _el$2 = _tmpl$2();
        notSup(_el$2, () => `node ${i()}`);
        return _el$2;
      })()
    }));
    return _el$;
  })();
}
function renderFlatHtml() {
  return renderToString(() => createComponent(FlatList, {
    n: N_BIG
  }));
}
async function runSSR() {
  let bytes = 0;
  const timing = await measure(() => {
    bytes = Buffer.byteLength(renderToString(() => createComponent(FlatList, {
      n: N_BIG
    })), "utf8");
  }, {
    iterations: 20,
    warmup: 5
  });
  return {
    nodes: N_BIG,
    ...timing,
    outputBytes: bytes,
    note: "renderToString of a 10k-node app; output size in bytes"
  };
}
export {
  renderFlatHtml,
  runSSR
};

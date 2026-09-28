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
export {
  createContext
};
//# sourceMappingURL=index.js.map
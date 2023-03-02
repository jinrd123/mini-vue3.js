export const isObject = (val: unknown): val is object => {
  return val !== null && typeof val === 'object'
}

export const hasChanged = (value: any, oldVal: any): boolean => {
  return !Object.is(value, oldVal)
}

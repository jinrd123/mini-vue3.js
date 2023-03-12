// 判断是否为一个对象
export const isObject = (val: unknown): val is object => {
  return val !== null && typeof val === 'object'
}

// 判断两者是否相等
export const hasChanged = (value: any, oldVal: any): boolean => {
  return !Object.is(value, oldVal)
}

// 判断是否为一个函数
export const isFunction = (val: unknown): val is Function => {
  return typeof val === 'function'
}

// 合并
export const extend = Object.assign

// 空对象
export const EMPTY_OBJ: { readonly [key: string]: any } = {}

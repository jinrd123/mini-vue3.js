// 判断是否为一个对象
export const isObject = (val: unknown): val is object => {
  return val !== null && typeof val === 'object'
}

// 判断两者是否相等
export const hasChanged = (value: any, oldVal: any): boolean => {
  return !Object.is(value, oldVal)
}

// 判断是否为数组
export const isArray = Array.isArray

// 判断是否为一个函数
export const isFunction = (val: unknown): val is Function => {
  return typeof val === 'function'
}

// 合并
export const extend = Object.assign

// 空对象
export const EMPTY_OBJ: { readonly [key: string]: any } = {}

// 判断是否为string
export const isString = (val: unknown): val is string => typeof val === 'string'

// 判断是否以on开头，且on后面为非a-z
const onRe = /^on[^a-z]/
export const isOn = (key: string) => onRe.test(key)

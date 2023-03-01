import { track, trigger } from './effect'

// 创建get函数
const get = createGetter()

function createGetter() {
  // get的核心逻辑：1. Reflect.get 2. track收集依赖
  return function get(target: object, key: string | symbol, receiver: object) {
    const res = Reflect.get(target, key, receiver)

    track(target, key)

    return res
  }
}

// 创建set函数
const set = createSetter()

function createSetter() {
  // set的核心逻辑：1. Reflect.set 2. trigger触发依赖
  return function set(
    target: object,
    key: string | symbol,
    value: unknown,
    receiver: object
  ) {
    const result = Reflect.set(target, key, value, receiver)

    trigger(target, key)

    return result
  }
}

export const mutableHandlers: ProxyHandler<object> = {
  get,
  set
}

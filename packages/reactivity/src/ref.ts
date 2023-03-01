import { createDep, Dep } from './dep'
import { activeEffect, trackEffects } from './effect'
import { toReactive } from './reactive'

export interface Ref<T = any> {
  value: T
}

export function ref(value?: unknown) {
  return createRef(value, false)
}

function createRef(rawValue: unknown, shallow: boolean) {
  if (isRef(rawValue)) {
    return rawValue
  }
  return new RefImpl(rawValue, shallow)
}

class RefImpl<T> {
  private _value: T

  public dep?: Dep = undefined

  public readonly __v_isRef = true

  // __v_isShallow标记ref的参数是否为复杂数据类型（shallow：浅的，即简单数据类型）
  constructor(value: T, public readonly __v_isShallow: boolean) {
    // _value: 1. value(ref参数)为简单数据类型，进行get/set处理 2. value为复杂数据类型，直接用reactive函数进行包装
    this._value = __v_isShallow ? value : toReactive(value)
  }

  get value() {
    trackRefValue(this)
    return this._value
  }

  set value(newVal) {}
}

export function trackRefValue(ref) {
  if (activeEffect) {
    trackEffects(ref.dep || (ref.dep = createDep()))
  }
}

export function isRef(r: any): r is Ref {
  return !!(r && r.__v_isRef === true)
}

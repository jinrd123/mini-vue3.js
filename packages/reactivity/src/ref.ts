import { hasChanged } from '@vue/shared'
import { createDep, Dep } from './dep'
import { activeEffect, trackEffects, triggerEffects } from './effect'
import { toReactive } from './reactive'

export interface Ref<T = any> {
  value: T
}

// 核心逻辑创建一个RefImpl对象，通过对value属性的get与set方法进行拦截以添加依赖收集与依赖触发
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

  private _rawValue: T

  public dep?: Dep = undefined

  public readonly __v_isRef = true

  // __v_isShallow标记ref的参数是否为复杂数据类型（shallow：浅的，即简单数据类型）
  constructor(value: T, public readonly __v_isShallow: boolean) {
    // _value: 1. value(ref参数)为简单数据类型，进行get/set处理 2. value为复杂数据类型，直接用reactive函数进行包装
    this._value = __v_isShallow ? value : toReactive(value)

    this._rawValue = value
  }

  get value() {
    // trackRefValue函数：将依赖收集至RefImpl对象本身维护的dep集合中
    trackRefValue(this)
    return this._value
  }

  set value(newVal) {
    if (hasChanged(newVal, this._rawValue)) {
      this._rawValue = newVal
      this._value = toReactive(newVal)
      // triggerRefValue函数：触发自身dep集合中的所有依赖
      triggerRefValue(this)
    }
  }
}

// 收集依赖
export function trackRefValue(ref) {
  if (activeEffect) {
    trackEffects(ref.dep || (ref.dep = createDep()))
  }
}

// 触发依赖
export function triggerRefValue(ref) {
  if (ref.dep) {
    triggerEffects(ref.dep)
  }
}

export function isRef(r: any): r is Ref {
  return !!(r && r.__v_isRef === true)
}

import { isFunction } from '@vue/shared'
import { Dep } from './dep'
import { ReactiveEffect } from './effect'
import { trackRefValue, triggerRefValue } from './ref'

export class ComputedRefImpl<T> {
  public dep?: Dep = undefined

  private _value!: T

  public readonly effect: ReactiveEffect<T>

  public readonly __v_isRef = true

  // true 表示需要重新执行run方法
  public _dirty = true

  constructor(getter) {
    this.effect = new ReactiveEffect(getter, () => {
      if (!this._dirty) {
        this._dirty = true
        triggerRefValue(this)
      }
    })
    // 一个循环引用标记吧，应该没啥用
    this.effect.computed = this
  }

  get value() {
    trackRefValue(this)
    if (this._dirty) {
      this._dirty = false
      this._value = this.effect.run()
    }
    return this._value
  }
}

export function computed(getterOrOptions) {
  let getter

  const onlyGetter = isFunction(getterOrOptions)

  if (onlyGetter) {
    getter = getterOrOptions
  }

  const cRef = new ComputedRefImpl(getter)

  return cRef
}

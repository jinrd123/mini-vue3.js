import { ComputedRefImpl } from './computed'
import { createDep, Dep } from './dep'

export type EffectScheduler = (...args: any[]) => any

// targetMap为一个WeakMap，相当于维护的整个vue应用的响应式对象到对应的副作用函数的映射关系
// targetMap:( 被Reactive方法包装的对象 --> Map:( 对象属性名 --> Set<effect> ) )
type KeyToDepMap = Map<any, Dep>
const targetMap = new WeakMap<any, KeyToDepMap>()

// effect函数的核心逻辑就是：（借助包装类）1.更新此模块的activeEffect 2. 调用fn
export function effect<T = any>(fn: () => T) {
  const _effect = new ReactiveEffect(fn)

  _effect.run()
}

// 记录上一个effect调用的对应包装类
export let activeEffect: ReactiveEffect | undefined

// effect(fn)中fn的包装类
export class ReactiveEffect<T = any> {
  computed?: ComputedRefImpl<T>

  constructor(
    public fn: () => T,
    public scheduler: EffectScheduler | null = null
  ) {}

  run() {
    activeEffect = this

    return this.fn()
  }
}

// 收集依赖
export function track(target: object, key: unknown) {
  if (!activeEffect) {
    return
  }

  // depsMap即为Map:( 对象属性名 --> Set<effect> )
  let depsMap = targetMap.get(target)
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map()))
  }

  let dep = depsMap.get(key)
  if (!dep) {
    depsMap.set(key, (dep = createDep()))
  }

  trackEffects(dep)
}

export function trackEffects(dep: Dep) {
  dep.add(activeEffect!)
}

// 触发依赖
// 核心逻辑即执行所有targetMap[target][key].fn （targetMap[target][key]是一个Set集合）
export function trigger(target: object, key: unknown) {
  const depsMap = targetMap.get(target)
  if (!depsMap) {
    return
  }

  const dep: Dep | undefined = depsMap.get(key)

  if (!dep) {
    return
  }

  triggerEffects(dep)
}

// 执行Set<effect>集合中所有effect相关的逻辑
export function triggerEffects(dep: Dep) {
  const effects = Array.isArray(dep) ? dep : [...dep]

  for (const effect of effects) {
    triggerEffect(effect)
  }
}

export function triggerEffect(effect: ReactiveEffect) {
  if (effect.scheduler) {
    effect.scheduler()
  } else {
    effect.run()
  }
}

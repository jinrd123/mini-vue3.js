// targetMap为一个WeakMap，相当于维护的整个vue应用的响应式对象到对应的副作用函数的映射关系
// targetMap的key值存放所有的响应式对象，对应的value为一个Map<KeyToDepMap>，其key一般情况下可以理解为响应式对象的属性名，value即为对回调函数fn的包装类实例
type KeyToDepMap = Map<any, ReactiveEffect>
const targetMap = new WeakMap<any, KeyToDepMap>()

// effect函数的核心逻辑就是：（借助包装类）1.更新此模块的activeEffect 2. 调用fn
export function effect<T = any>(fn: () => T) {
  const _effect = new ReactiveEffect(fn)

  _effect.run()
}

// 记录上一个effect调用的对应包装类
export let activeEffect: ReactiveEffect | undefined

// 对调用effect函数传入的回调函数的包装类
export class ReactiveEffect<T = any> {
  constructor(public fn: () => T) {}

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
  let depMap = targetMap.get(target)
  if (!depMap) {
    targetMap.set(target, (depMap = new Map()))
  }

  depMap.set(key, activeEffect)

  console.log(targetMap)
}

// 触发依赖
export function trigger(target: object, key: unknown) {}

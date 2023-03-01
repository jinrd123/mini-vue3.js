import { mutableHandlers } from './baseHandlers'

// reactiveMap这个WeakMap对象用于记录所有创建的响应式对象，相当于一个缓存机制——>重复为一个对象创建响应式对象时直接返回原来已经创建的响应式对象
// plus：WeakMap与Map的区别除了key为object之外，还就是WeakMap中key是一个弱引用，即如果此引用没有被使用时将会被垃圾回收机制自动回收，而Map中的key会影响垃圾回收机制导致其无法被自动回收，所以说选择WeakMap也有一定性能优化的作用
export const reactiveMap = new WeakMap<object, any>()

// reactive方法总目标就是接收一个对象，为其创建一个proxy代理对象
export function reactive(target: object) {
  return createReactiveObject(target, mutableHandlers, reactiveMap)
}

function createReactiveObject(
  target: object,
  baseHandlers: ProxyHandler<any>,
  proxyMap: WeakMap<object, any>
) {
  const existingProxy = proxyMap.get(target)
  if (existingProxy) {
    return existingProxy
  }

  // 创建Proxy对象的核心逻辑就是给target设置一个get和set，所以baseHandler对象的作用就是提供get和set
  const porxy = new Proxy(target, baseHandlers)

  proxyMap.set(target, porxy)

  return porxy
}

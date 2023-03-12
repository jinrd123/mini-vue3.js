import { queuePreFlushCb } from '@vue/runtime-core'
import { EMPTY_OBJ, hasChanged, isObject } from '@vue/shared'
import { ReactiveEffect } from 'packages/reactivity/src/effect'
import { isReactive } from 'packages/reactivity/src/reactive'

export interface WatchOptions<immediate = boolean> {
  immediate?: immediate
  deep?: boolean
}

export function watch(source, cb: Function, options?: WatchOptions) {
  return doWatch(source, cb, options)
}

function doWatch(
  source,
  cb: Function,
  { immediate, deep }: WatchOptions = EMPTY_OBJ
) {
  let getter: () => any

  if (isReactive(source)) {
    getter = () => source
    deep = true
  } else {
    getter = () => {}
  }

  if (cb && deep) {
    // 因为我们watch监听一个响应式对象时，默认就是监听其所有属性（包括对象属性的属性）的变化然后执行回调
    // getter函数是用来创建watch的ReactiveEffect对象的第一个参数，所以我们要让监听的所有响应式数据收集到这个ReactiveEffect对象（watch的副作用）
    // 所以我们用traverse包装getter，即处发监听的对象的所有属性的getter行为
    const baseGetter = getter
    getter = () => traverse(baseGetter())
  }

  // oldValue变量用来记录上一次source（getter函数）的值，在执行job，即传给watch回调作为参数
  let oldValue = {}

  // job函数的核心逻辑：1、 更新oldValue 2、 执行cb，即watch的参数函数
  // 可以理解为job就是对上面两个行为的捆绑
  const job = () => {
    if (cb) {
      const newValue = effect.run()
      if (deep || hasChanged(newValue, oldValue)) {
        cb(newValue, oldValue)
        oldValue = newValue
      }
    }
  }

  // 被监听的响应式数据发生变化时触发自己的依赖（包含收集到的watch依赖），触发watch依赖就是执行这个scheduler函数
  let scheduler = () => queuePreFlushCb(job) // 从这里可以得知 —— （watch被监听的响应式数据发生变化时）watch的副作用作为本轮宏任务同步代码之后的微任务执行

  const effect = new ReactiveEffect(getter, scheduler)

  // 处理配置对象的属性
  if (cb) {
    // 如果immediate为true，执行一次job（更新oldValue + 执行cb）；如果immediate为false，只记录一下oldValue即可
    if (immediate) {
      job()
    } else {
      oldValue = effect.run()
    }
  } else {
    effect.run()
  }

  // watch函数的返回值，emmm好像基本用不到，至于返回的这个effect.stop是个什么也无所谓了（ReactiveEffect类里也没具体实现stop方法）
  return () => {
    effect.stop()
  }
}

// 接收一个变量，如果是对象就深层次遍历其所有属性（触发所有属性的get行为）
export function traverse(value: unknown) {
  if (!isObject(value)) {
    return value
  }

  for (const key in value as object) {
    traverse((value as object)[key])
  }

  return value
}

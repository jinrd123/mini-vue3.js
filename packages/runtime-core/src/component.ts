import { reactive } from '@vue/reactivity'
import { isFunction, isObject } from '@vue/shared'
import { onBeforeMount, onMounted } from './apiLifecycle'

let uid = 0

export const enum LifecycleHooks {
  BEFORE_CREATE = 'bc',
  CREATED = 'c',
  BEFORE_MOUNT = 'bm',
  MOUNTED = 'm'
}

export function createComponentInstance(vnode) {
  const type = vnode.type

  const instance = {
    uid: uid++,
    vnode,
    type,
    subTree: null,
    effect: null,
    update: null,
    render: null,
    isMounted: false,
    bc: null,
    c: null,
    bm: null,
    m: null
  }

  return instance
}

export function setupComponent(instance) {
  // 嵌套调用setupStatefulComponent
  setupStatefulComponent(instance)
}

function setupStatefulComponent(instance) {
  const Component = instance.type

  const { setup } = Component

  if (setup) {
    const setupResult = setup()
    handleSetupResult(instance, setupResult)
  } else {
    finishComponentSetup(instance)
  }
}

export function handleSetupResult(instance, setupResult) {
  if (isFunction(setupResult)) {
    instance.render = setupResult
  }
  finishComponentSetup(instance)
}

export function finishComponentSetup(instance) {
  const Component = instance.type

  // 从type中取出render挂载到instance上
  if (!instance.render) {
    instance.render = Component.render
  }

  // applyOption方法中挂载其它vue常用配置到instance身上
  applyOptions(instance)
}

function applyOptions(instance: any) {
  // 解构获取type身上的属性方法
  const {
    data: dataOptions,
    beforeCreate,
    created,
    beforeMount,
    mounted
  } = instance.type

  // 若存在beforeCreate生命周期，执行
  if (beforeCreate) {
    callHook(beforeCreate, instance.data)
  }

  // 存在data函数（一般return一个对象），我们拿到data返回的对象变成reactive响应式对象后挂载到instance身上
  if (dataOptions) {
    const data = dataOptions()
    if (isObject(data)) {
      instance.data = reactive(data)
    }
  }

  // 若存在created生命周期，执行
  if (created) {
    callHook(created, instance.data)
  }

  function registerLifecycleHook(register: Function, hook?: Function) {
    // 修改生命周期函数的this指向为Reactive(data)
    register(hook?.bind(instance.data), instance)
  }

  // registerLifecycleHook函数的作用就是注册其它的那些生命周期，说白了就是把beforeCreate和created之外的那些生命周期挂载到instance身上，具体实现细节就不看了
  registerLifecycleHook(onBeforeMount, beforeMount)
  registerLifecycleHook(onMounted, mounted)
}

function callHook(hook: Function, proxy) {
  // 通过bind函数修改生命周期函数的this指向从而让生命周期函数访问data中的数据
  hook.bind(proxy)()
}

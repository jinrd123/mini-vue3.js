# runtime-dom

浏览器部分运行时模块

提供浏览器宿主下的配置以及方法实例，比如针对 render 函数，runtime-core 中存放生成 render 函数的工厂函数 createRenderer，runtime-dom 就提供 createRenderer 相关的浏览器环境下的入参，然后导出一个 render 函数实例

浏览器环境下的入参：比如 nodeOps.ts 里的 nodeOps 对象里的方法都是一些原生 dom 操作的包装、patchProps 也一样，是对 dom 方法的一些包装



## vei（vue event invoker）

~~~typescript
export function patchEvent(
  el: Element & { _vei?: Object },
  rawName: string,
  prevValue,
  nextValue
) {
  const invokers = el._vei || (el._vei = {})
  const existingInvoker = invokers[rawName]
  if (nextValue && existingInvoker) {
    existingInvoker.value = nextValue
  } else {
    const name = parseName(rawName)
    if (nextValue) {
      const invoker = (invokers[rawName] = createInvoker(nextValue))
      el.addEventListener(name, invoker)
    } else if (existingInvoker) {
      el.removeEventListener(name, existingInvoker)
      invokers[rawName] = undefined
    }
  }
}

function parseName(name: string) {
  return name.slice(2).toLowerCase()
}

function createInvoker(initialValue) {
  // invoker是一个函数，同时这个函数作为一个对象，上面有一个value方法，invoker函数的执行逻辑就是调用invoker.value方法
  const invoker = (e: Event) => {
    invoker.value && invoker.value()
  }

  invoker.value = initialValue
  return invoker
}
~~~

在`patchEvent`函数更新事件回调函数的时候，并不是`removeEventListener`移除原有事件监听然后`addEventListener`增加新的事件回调，而是在添加事件回调的dom元素上挂载了一个`_vei`对象，如果给这个dom添加一个`onClick`属性，那么`_vei`中就会记录一条`key = onClick & value = invoker`的记录，同时`addEventListener`添加事件监听，回调函数是这个`invoker`函数：invoker是一个函数，同时这个函数作为一个对象，上面有一个`value`方法，`invoker`函数的执行逻辑就是调用`invoker.value`方法，这样如果更新事件回调就直接修改`invoker.value`即可。

效果就是不用频繁的执行`addEventListener`和`removeEventListener`（性能耗费比较高）

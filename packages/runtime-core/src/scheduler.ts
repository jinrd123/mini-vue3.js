let isFlushPending = false

const resolvePromise = Promise.resolve() as Promise<any>

const pendingPreFlushCbs: Function[] = []

let currentFlushPromise: Promise<void> | null = null

// queuePreFlusCb(cb)方法说白了就是把cb放入pendingPreFlushCbs队列中，用Promise.resolve包装任务队列的执行方法flushJobs
// 分析：他的一个作用就是把某个函数逻辑变为微任务：使之在当前宏任务的同步代码执行完毕之后、下一个宏任务（异步任务）开始之前执行
// 网上的一个描述——queuePreFlushCb API: 任务加入 Pre 队列 组件更新前执行，它说组件更新前执行，那么应该暗指了组件更新是一个异步任务（宏任务）（也有对应的queuePostFlushCb API: 加入 Post 队列 组件更新后执行）
// 所以这应该就是一个改变逻辑执行顺序的方法函数
export function queuePreFlushCb(cb: Function) {
  queueCb(cb, pendingPreFlushCbs)
}

function queueCb(cb: Function, pendingQueue: Function[]) {
  pendingQueue.push(cb)
  queueFlush()
}

function queueFlush() {
  if (!isFlushPending) {
    isFlushPending = true
    currentFlushPromise = resolvePromise.then(flushJobs)
  }
}

function flushJobs() {
  isFlushPending = false
  flushPreFlushCbs()
}

export function flushPreFlushCbs() {
  if (pendingPreFlushCbs.length) {
    let activePreFlushCbs = [...new Set(pendingPreFlushCbs)]
    pendingPreFlushCbs.length = 0

    for (let i = 0; i < activePreFlushCbs.length; i++) {
      activePreFlushCbs[i]()
    }
  }
}

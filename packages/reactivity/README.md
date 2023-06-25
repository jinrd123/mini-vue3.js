# reactivity

响应性



## ref与reactive



### reactive

`reactive`方法的主线逻辑就是接收一个对象，返回其`Proxy`代理对象。

#### 依赖收集：

`proxy代理对象`的`get`拦截器中调用`track(target, key)`方法，即给`effect.ts`模块中的`targetMap`添加一条由`对象——>属性——>依赖集合`的映射记录

#### 依赖触发：

`proxy代理对象`的`set`拦截器中调用`trigger(target, key)`方法，即寻找到`effect.ts`模块中`targetMap`记录的`target[key]`对应的依赖集合（`Set`），（转化为`Array`后）全部执行



### ref

`ref`方法的主线逻辑为接收一个复杂数据类型或者简单数据类型，返回`RefImpl`类的实例，`ref`方法的参数作为`RefImpl`实例的私有属性`_value`进行维护，设置`get value`和`set value`进行拦截

#### （针对简单数据类型）依赖收集：

`RefImpl`对象的`get value`中调用`trackRefValue(this)`。`reactive`方法中存放依赖的容器为`effect.ts`模块中的WeakMap对象`targetMap`，而使用`ref`方法创建的响应式数据经过`trackRefValue(this)`的逻辑，依赖都存放在响应式数据对应的`RefImpl`对象的`dep`集合中，`dep`即为一个`Set<ReactiveEffect>`，相当于`RefImpl`对象独立管理（存放）依赖。

#### （针对简单数据类型）依赖触发：

`RefImpl`对象的`set value`中调用`triggerRefValue(this)`，即把`RefImpl`对象的`dep`集合转化为数组后全部执行

#### 针对复杂数据类型

直接把`RefImpl`对象的`_value`属性初始化为一个`reactive`对象（直接借助`reactive`生成一个`Proxy`代理对象），通过`reactive`对象去对复杂数据的每个属性的get和set进行拦截（收集依赖/触发依赖）



### 总结

Vue里面的响应性数据可分为两种：

* 复杂数据类型的响应性：通过`Proxy`对象实现对`get`与`set`行为的监听来实现依赖收集与依赖触发

* 简单数据类型的响应性：通过对象实例的`get value`和`set value`实现依赖收集与触发，所以使用时需要我们手动触发即`ref数据.value`

* `ref`代理复杂数据类型与`reactive`代理复杂数据类型也不相同，`RefImpl`对象的`_value`属性是被代理的对象，所以`refObj.value`的`set`行为会触发依赖，也就是可以监听到代理对象引用的变化；但是`reactive`所代理的对象如果引用改变，响应式系统是监听不到的。







## computed与watch



### computed



先来回顾一下`reactive`与`ref`的响应式大体逻辑：我们`reactive`或者`ref`函数接收一个变量使之成为响应式变量，本质上其实是为这个变量收集`依赖`（`副作用`），不管是在`RefImpl`对象的`dep`中还是在`targetMap`容器中。什么时候收集，自然是访问这些响应式变量的时候，访问就相当于其他地方用到它们了，`依赖`是一个`ReactiveEffect`对象，本质上其实就是对一个函数的包装，当访问`reactive`或者`ref`对象的时候，就把`依赖`收集起来。

但是`reactive`函数和`ref`函数的调用（响应式对象的创建）本身不会产生`依赖`（`副作用`），暂时需要我们手动生成`副作用`函数，即调用`effect`函数，以测试用例`ref.html`为例：

~~~html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Document</title>
    <script src="../../dist/vue.js"></script>
  </head>
  <body>
    <div id="app"></div>
  </body>
  <script>
    const { ref, effect } = Vue

    const obj = ref('荣达') // 我们创建了一个响应式对象obj

    effect(() => { // 我们手动调用effect方法生成一个副作用对象
      document.querySelector('#app').innerText = obj.value // 为了让这个副作用对象被obj收集（成为obj的副作用），我们在回调函数中对obj执行get行为——obj.value
    })

    setTimeout(() => {
      obj.value = '荣达大佬' // 触发obj的set行为，执行obj所收集到的所有“副作用”，也就是重新执行effect里的方法，文本内容变为荣达大佬
    }, 2000)
  </script>
</html>
~~~



然后我们再来审视`computed`方法创建的响应式对象与前两者有什么异同：

~~~typescript
export function computed(getterOrOptions) { // 一般情况下，computed方法接收一个函数为参数，就是创建一个ComputedRefImpl对象
  let getter

  const onlyGetter = isFunction(getterOrOptions)

  if (onlyGetter) {
    getter = getterOrOptions
  }

  const cRef = new ComputedRefImpl(getter)

  return cRef
}

// 创建的这个ComputedRefImpl对象与RefImpl最核心的一个区别就是：这个对象本身有个effect属性，也就是一个“依赖/副作用”对象
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
~~~



我们来看看创建`ComputedRefImpl`对象时具体做了什么：

~~~typescript
public _dirty = true

constructor(getter) {
  // 说白了就是根据传给computed函数的函数参数getter创建一个依赖对象，但是相比于我们以前手动执行effect函数创建的依赖对象，ComputedRefImpl的依赖对象多了第二个参数，即调度器scheduler属性
  this.effect = new ReactiveEffect(getter, () => {
    if (!this._dirty) {
      this._dirty = true
      triggerRefValue(this)
    }
  })
  // 一个循环引用标记吧，应该没啥用
  this.effect.computed = this
}
~~~

`scheduler`本身也是一个函数，拥有`scheduler`的`ReactiveEffect`对象在被`triggerEffect(effect: ReactiveEffect)`执行时优先执行`scheduler`函数而不是第一个函数参数



所以为什么要给`ComputedRefImpl`对象内置一个`effect`依赖对象呢？——**给其它响应式对象使用，换句话说，作为其他响应式对象的依赖**

其它响应式对象指谁呢？——如**`computed(() => refA.name + refB.name)`**，其它对象就是指`refA`与`refB`



我们根据测试用例`computed.html`来具体分析：

~~~html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Document</title>
    <script src="../../dist/vue.js"></script>
  </head>
  <body>
    <div id="app"></div>
  </body>
  <script>
    const { reactive, effect, computed } = Vue
		
    // reactive创建一个响应式对象obj（Proxy）
    const obj = reactive({
      name: '张三'
    })
		
    // 创建一个ComputedRefImpl对象，这个对象的getter函数中对obj对象进行了get行为（obj.name）
    const computedObj = computed(() => {
      return '姓名:' + obj.name
    })
		
    // 用effect方法为ComputedRefImpl对象手动创建一个副作用
    // 然后effect(fn)，fn被执行，触发ComputedRefImpl对象的get行为使此副作用被ComputedRefImpl对象的dep收集，对应---- 1 ----
    // 又因为一开始_dirty初始化为true，切换_dirty为false的同时执行effect.fn，也就是传给computed函数的getter参数，对应 ---- 2 ----，这一执行getter，就导致getter中所有用到的响应式对象把ComputedRefImpl对象的ReactiveEffect依赖对象给收集了
    // 这就导致：以后响应式数据一旦触发了set行为，就会触发ComputedRefImpl对象的ReactiveEffect依赖
    effect(() => {
      document.querySelector('#app').innerText = computedObj.value
    })
		
    // obj.name触发响应式对象的set行为，他的依赖集合中有ComputedRefImpl对象的ReactiveEffect依赖对象，但是因为此依赖有scheduler，所以triggerEffect(effect: ReactiveEffect)触发此依赖时，执行scheduler，scheduler的逻辑，对应 ---- 3 ----：
    // 1. 修改_dirty为true
    // 2. 触发ComputedRefImpl对象本身的副作用，也就是上面effect函数传入的函数，最终导致视图修改
    setTimeout(() => {
      obj.name = '李四'
    }, 2000)
  </script>
</html>
~~~

对照代码：

~~~typescript
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
        this._dirty = true // ---- 3 ----
        triggerRefValue(this)
      }
    })
    this.effect.computed = this
  }

  get value() {
    trackRefValue(this) // ---- 1 ----
    if (this._dirty) {
      this._dirty = false
      this._value = this.effect.run() // ---- 2 ----
    }
    return this._value
  }
}
~~~



关于`ComputedRefImpl`对象自身的脏变量`_dirty`的理解：

`ComputedRefImpl`对象自身的核心逻辑就是维护一个`_value`值，然后对其进行get的时候返回这个值。

`_value`值是依赖`getter`函数（`computed`函数接收的函数参数）的，但是`getter`函数可能是依赖其他响应式对象的，其它响应式对象值更改，我们就要更改`_value`，所以`_value`的值是具有时效性的，我们用`_dirty`来标识此事的`_value`需不需要重新计算，`_dirty:true`，表示`_value`“脏”了，需要重新计算：

* `ComputedRefImpl`创建之初，`_value`还没有被计算，`_dirty`值自然初始化为`true`
* `ComputedRefImpl`被`get`之后，`_value`已经被计算，`_dirty`为`false`，此时访问`ComputedRefImpl`对象的值返沪`_value`即可，无需重新计算
* 一旦（收集了`ComputedRefImpl.effect`的）响应式对象发生改变，就需要把`_dirty`置为`true`，让`ComputedRefImpl`下一次被get时重新计算`_value`

上面也就是所谓的`computed`缓存数据，即读取一个`computed`响应式数据的时候不要每次都重新计算（重新计算即计算`_value`的操作，对应上面的`---- 2 ----`），因为计算操作会触发所有`computed`对象所依赖的响应式数据的`get`行为，造成性能浪费。



### watch



`watch`的实现思路与`computed`非常相似：`watch`函数和`computed`函数的执行都内部创建了一个独立的`ReactiveEffect`副作用对象，`computed`是把这个依赖挂在`computedRefImpl`对象上，而一般场景下`watch`是不需要用一个变量接收返回值的，所以`watch`也没有返回值（有返回值，但是起码不用像`computed`那样为返回值创建一个类），所以`watch`的`ReactiveEffect`对象就单纯创建出来即可

两者的副作用对象（依赖）都是让其它响应式对象去收集的，`computed`是让所有参数函数体内用到的响应式变量收集，`watch`就是让第一个参数指定的响应式变量收集。

测试用例`watch.html`:

~~~html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Document</title>
    <script src="../../dist/vue.js"></script>
  </head>
  <body>
    <div id="app"></div>
  </body>
  <script>
    const { reactive, watch } = Vue
		
    // 创建了一个响应式变量obj
    const obj = reactive({
      name: '张三'
    })

    // 执行watch函数，说白了就是执行doWatch
    // doWatch中的核心逻辑，创建一个ReactiveEffect对象，即new ReactiveEffect(getter, scheduler)对应---------- 1 ----------
    // 这个ReactiveEffect对象是有scheduler调度器的，我们知道new ReactiveEffect的逻辑是上来执行一次getter，往后再触发这个依赖时就执行scheduler了，所以我们要对getter进行加工，即让被监听对象obj的所有属性都收集到这个依赖（触发obj所有属性的get行为），对应---------- 2 ----------
    // 以后响应式数据发生变化，触发了watch创建的这个依赖后，执行的scheduler，说白了就是job函数，对应---------- 3 ----------，scheduler就是用queuePreFlushCb(job)改变了一下job的执行顺序（使job变成微任务），job函数呢，说白了就是对watch的第二个函数参数cb的包装，说白了还是调用cb，对应 ---------- 4 ----------，包装的目的是维护给cb提供的newValue和oldValue参数（维护oldValue对应---------- 5 ---------- && 计算newValue对应---------- 6 ----------）
    watch(
      obj,
      (value, oldValue) => {
        console.log('watch监听被触发')
        console.log('value：', value)
      },
      // 对于watch的第三个配置对象参数的immediate属性，我们根据其true或者false决定是不是上来就执行一次job函数即可，对应---------- 7 ----------
      {
        immediate: true
      }
    )
		
    // 因为watch函数创建的ReactiveEffect依赖对象已经被obj的所有属性收集，自然obj.name = "xxx"后触发watch的回调函数
    setTimeout(() => {
      obj.name = '荣达'
    }, 2000)
  </script>
</html>
~~~



`packages/compiler-dom/src/apiWatch.ts`：

~~~typescript
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
    getter = () => traverse(baseGetter()) // ---------- 2 ----------
  }

  // oldValue变量用来记录上一次source（getter函数）的值，在执行job，即传给watch回调作为参数
  let oldValue = {}

  // job函数的核心逻辑：1、 更新oldValue 2、 执行cb，即watch的参数函数
  // 可以理解为job就是对上面两个行为的捆绑
  const job = () => { // ---------- 3 ----------
    if (cb) {
      const newValue = effect.run() // ---------- 6 ----------
      if (deep || hasChanged(newValue, oldValue)) {
        cb(newValue, oldValue) // ---------- 4 ----------
        oldValue = newValue // ---------- 5 ----------
      }
    }
  }

  // 被监听的响应式数据发生变化时触发自己的依赖（包含收集到的watch依赖），触发watch依赖就是执行这个scheduler函数
  let scheduler = () => queuePreFlushCb(job) // 从这里可以得知 —— （watch被监听的响应式数据发生变化时）watch的副作用作为本轮宏任务同步代码之后的微任务执行

  const effect = new ReactiveEffect(getter, scheduler) // ---------- 1 ----------

  // 处理配置对象的属性
  if (cb) {
    // 如果immediate为true，执行一次job（更新oldValue + 执行cb）；如果immediate为false，只记录一下oldValue即可
    if (immediate) { // ---------- 7 ----------
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
~~~



## 总结



`ref`与`reactive`同性质，本质上就是创建响应时数据，即在对其get行为时收集依赖，对其set行为时触发它收集到的依赖

`computed`与`watch`类似，本质上都是创建一个`ReactiveEffect`依赖对象，然后让其它的响应式变量去收集，当响应式变量的set行为被触发时，触发`computed`与`watch`创建的副作用对象，即`computed`的`ReactiveEffect`的函数逻辑是重新完成计算，而`watch`的`ReactiveEffect`的函数逻辑是执行一遍传给`watch`的第二个函数参数。

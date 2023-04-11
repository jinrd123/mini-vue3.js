# runtime-core

运行时核心



# h函数



函数逻辑：根据传入的参数（数量、类型...）调用`createVNode`函数

目标：构造`vnode`结点



## vnode结点核心属性



~~~typescript
export interface VNode {
  __v_isVNode: true  // vnode标识
  type: any // 对于Fragment、Text文本、Comment注释类型的结点type为Symbol对象；对于标签，type即为字符串如'div'
  props: any // class、style等（增强的class属性解析后得到的普通字符串）
  children: any // 可能为text文本，或者vnode结点
  shapeFlag: number // 标识vnode的类特征（主要形容vnode本身与children），如 本身标签 + children为文本
}
~~~



## h函数逻辑思路



### h函数

~~~typescript
export function h(type: any, propsOrChildren?: any, children?: any): VNode {
  const l = arguments.length

  if (l === 2) {
    if (isObject(propsOrChildren) && !isArray(propsOrChildren)) {
      if (isVNode(propsOrChildren)) {
        return createVNode(type, null, [propsOrChildren])
      }
      return createVNode(type, propsOrChildren, [])
    } else {
      return createVNode(type, null, propsOrChildren)
    }
  } else {
    if (l > 3) {
      children = Array.prototype.slice.call(arguments)
    } else if (l === 3 && isVNode(children)) {
      children = [children]
    }
    return createVNode(type, propsOrChildren, children)
  }
}
~~~

#### 分析：

从函数体可以知道，`h`函数的核心逻辑就是调用`createVNode`函数并返回创建的`vnode`节点。

关注一下入参的参数名`type && propsOrChildren && children`，不看函数体，单从第二个参数和第三个参数的命名上其实就能感知到可以传给`h`函数两个参数或者三个参数，`props`和`children`都不是`h`函数的必须项，所以`h`函数的逻辑就是根据入参的个数以及具体参数是什么类型去判断究竟入参传入的`props`和`children`是什么，然后进行`createVNode`的调用。

#### h函数调用举例

~~~js
// ---------- 例一 ----------
const vnode = h(
  'div', // type 为一个 'div' 字符串（标签名）
  { // props为一个对象，里面可以有class或者style属性
    class: [
      {
        red: true
      },
      {
        blue: true
      },
      {
        yellow: false
      }
    ]
  },
  'hello render' // 这里的children是一个字符串
)

// ---------- 例二 ----------
const vnode = h(
  'div',
  {
    class: 'test'
  },
  [h('p', 'p1'), h('p', 'p2'), h('p', 'p3')] // childeren为一个vnode数组（数组里面都是h函数的调用，即返回vnode）
)

// ---------- 例三 ----------
// 作为h函数第一个参数 type，为对象，判定为有状态组件，shapeFlag为4
const component = {
  render() {
    const vnode1 = h('div', '这是一个 component')
    return vnode1
  }
}

// 第二个参数children为undefined，flag为0
const vnode2 = h(component) // h函数只有一个type参数，为一个对象
~~~



### createVNode函数

~~~typescript
export function createVNode(type, props, children): VNode {
  // 对class与style进行增强处理，所谓class增强，就是指class不光支持字符串，还支持对象、数组
  if (props) {
    let { class: klass, style } = props
    if (klass && !isString(klass)) {
      props.class = normalizeClass(klass)
    }
  }

  // 用二进制数相或得到vnode.shapeFlag，所以vnode.shapeFlag通过二进制的不同位携带了多种vnode的描述信息
  // 初步构造vnode.shapeFlag信息：type如果是string类型，那么我们初步判定要构造的vnode应该是一个ELEMENT元素类型
  const shapeFlag = isString(type)
    ? ShapeFlags.ELEMENT
    : isObject(type)
    ? ShapeFlags.STATEFUL_COMPONENT
    : 0

  return createBaseVNode(type, props, children, shapeFlag)
}
~~~

#### 分析：

首先第一步对`props.style(未实现) && props.class`进行处理，这里是就是vue对`class`以及`style`做的所谓的增强处理，也就是`class`和`style`可以是数组、对象，而不限于字符串，`normalizeClass`函数其实逻辑很清晰明了，就是对`klass`的类型进行判断，针对数组、对象、字符串进行不同的逻辑处理：

~~~typescript
// class增强处理函数
export function normalizeClass(value: unknown): string {
  let res = ''

  // 字符串直接返回；数组类型把所有数组项都加上normalizeClass之后的结果；对象加上所有值为true的属性
  if (isString(value)) {
    res = value
  } else if (isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const normalized = normalizeClass(value[i])
      if (normalized) {
        res += normalized + ' '
      }
    }
  } else if (isObject(value)) {
    for (const name in value as object) {
      if ((value as object)[name]) {
        res += name + ' '
      }
    }
  }

  return res.trim()
}
~~~

回到`createVNode`函数中，第二步就是构造一个`shapeFlag`值，说白了就是一个数字，标识了`h`函数第一个入参`type`的类型，最后把处理好的`props`和`shapeFlag`传入`return createBaseVNode(type, props, children, shapeFlag)`，细心的话已经发现了：`h`函数的参数中，`createVNode`函数中处理了`props`属性，但是还没处理`children`参数，所以在`createBaseVNode`函数中，完成对`children`的处理并最终完成`vnode`节点的构造

plus：我们只是对`class`和`style`进行增强处理，但并不意味着`props`中只能有`class`、`style`属性，类似于表单元素的`value`属性、`type`属性等是完完全全随意放在`props`对象中的，如下面的`h`函数调用：

~~~typescript
const vnode = h('textarea', {
  class: 'test-class',
  value: 'textarea value',
  type: 'text'
})
~~~





### createBaseVNode函数

~~~typescript
function createBaseVNode(type, props, children, shapeFlag) {
  const vnode = {
    __v_isVNode: true,
    type,
    props,
    shapeFlag
  } as VNode

  // normalizeChildren进一步完善（normalize：规范化）vnode.shapeFlag的信息
  // 通过 " | " 运算把vnode的children类型描述合并到vnode.shapFlag中
  normalizeChildren(vnode, children)

  return vnode
}
~~~

#### 分析：

直接构造一个`vnode`对象，说白了就是存放了`createVNode`函数中处理好的`props`和`shapeFlag`属性以及不用处理的`type`，就等`normalizeChildren`函数给`vnode`加上`children`相关的信息，`vnode`的构造就大功告成了。



### normalizeChildren函数

~~~typescript
export function normalizeChildren(vnode: VNode, children: unknown) {
  let type = 0

  if (children == null) {
    children = null
  } else if (isArray(children)) {
    type = ShapeFlags.ARRAY_CHILDREN
  } else if (typeof children === 'object') {
  } else if (isFunction(children)) {
  } else {
    children = String(children)
    type = ShapeFlags.TEXT_CHILDREN
  }

  vnode.children = children
  vnode.shapeFlag |= type
  /**
   *  type为text判定为标签 1 + children为text 8 =>  9
   *  type为text判定为标签 1 + children为Array 16 =>  17
   *  type为对象判定为有状态组件 4 + children为undefined 0 => 4
   */
}
~~~

#### 分析：

`normalizeChildren`函数做了两件事：对`children`的类型进行记录，也就是根据`children`的类型修改`vnode.shapeFlag`，原本`shapeFlag`只记录了`type`（`h`函数的第一个参数）的类型信息，现在通过位运算，增加上对`children`信息的记录。第二件事，就是把`children`本身挂载到`vnode`对象身上。



经过上面的逻辑处理，我们就通过`h`函数得到了一个`vnode`节点，大致类型如下：

~~~typescript
const vnode = {
  __v_isVNode: true,
  type, // h函数的第一个参数
  props, // normalizeClass（以及normalizeStyle）处理后的得到的props对象：{class: xxx, style: xxx}
  shapeFlag, // 一个数字，记录了type与children的类型信息
  children // h函数的参数
} as VNode
~~~





# render函数



## render函数的导出

`render`函数是`runtime-core`模块中`createRenderer`函数返回的对象中的一个属性方法，然后我们在`runtime-dom`中进行对外导出（`runtime-dom`模块提供浏览器宿主下的运行环境，比如浏览器环境下具体的`dom操作`的方法）

## render函数逻辑思路



### render函数

~~~typescript
const render = (vnode, container) => {
  if (vnode === null) {
    // 卸载
    if (container._value) {
      unmount(container._value)
    }
  } else {
    patch(container._value || null, vnode, container)
  }
  container._value = vnode // 给container元素添加_value属性，从而记录本次render的vnode信息
}
~~~

#### 分析：

先说一下入参，`vnode`就是`h`函数创建出来的对象（是对一个dom的节点信息的描述），然后`container`就是一个真实dom节点，表示我们`render`函数要操作（挂载or卸载or打补丁）的“位置”。

`render`函数的逻辑就是根据本次`render`的性质决定调用`unmount`或者`patch`，所谓性质就大致分为`挂载(patch)`、`卸载(unmount)`、`打补丁(patch)`等，当然这里`render`函数的“性质”是根据有没有传入`vnode`来判断的，这也只是一个最上层的判断，在整个`render`函数包括其`unmount`和`patch`等子函数中函数中一直都是秉承着区分`挂载`与`打补丁`从而进行不同处理的逻辑。

`container`这个dom元素身上，每一次被`render`（当作`render`函数的参数）结束时，都会在dom上添加一个`_value`属性即记录这次`render`的`vnode`。这个`_value`属性就是我们在`patch`函数中进行前后对比，从而决定逻辑类型（`挂载 or 更新`）的依据，`_value`代表了上次`render`的信息。



### unmount函数

~~~typescript
const unmount = vnode => {
  hostRemove(vnode.el)
}
~~~

#### 分析：

`hostRemove`是`runtime-dom`模块具体提供的方法：

~~~typescript
remove: (child: Element) => {
  const parent = child.parentNode
  if (parent) {
    parent.removeChild(child)
  }
}
~~~

这里`vnode.el`肯定是`patch`函数中某处的逻辑给`vnode`节点加上的属性，指向`vnode`实际渲染出来的dom元素，`remove方法`的逻辑就是通过真实dom的`parentNode`属性访问到父dom，父dom调用`removeChild`方法删除子节点



### patch函数

~~~typescript
const patch = (oldVNode, newVNode, container, anchor = null) => {
  if (oldVNode === newVNode) {
    return
  }

  // ---------- 正确的理解 ----------
  // 这里的oldVNode决定了下面switch中具体进行patch时是执行挂载还是打补丁patch
  // 所以如果oldVNode与newVNode的type都不一样，那肯定不是打补丁的逻辑了，直接下面的所有细节都走挂载逻辑即可

  // 两次render不同的vnode，即type不同（标签不同）或者key（就是v-for中那个）不同
  if (oldVNode && !isSameVNodeType(oldVNode, newVNode)) {
    // 先unmount卸载，即容器中删除这个dom节点（vnode节点的el属性绑定了对应的dom元素，然后通过dom的parentNode拿到父dom，父dom执行removeChild完成卸载）
    unmount(oldVNode)
    // 更新oldVNode为null，下面switch中进行具体情况的处理时，process函数中因为oldVNode为null，就会执行挂载逻辑，而非更新逻辑
    oldVNode = null
  }

  const { type, shapeFlag } = newVNode
  switch (type) {
    case Text:
      processText(oldVNode, newVNode, container, anchor)
      break
    case Comment:
      processCommentNode(oldVNode, newVNode, container, anchor)
      break
    case Fragment:
      processFragment(oldVNode, newVNode, container, anchor)
      break
    default:
      if (shapeFlag & ShapeFlags.ELEMENT) {
        processElement(oldVNode, newVNode, container, anchor)
      } else if (shapeFlag & ShapeFlags.COMPONENT) {
        processComponent(oldVNode, newVNode, container, anchor)
      }
  }
}
~~~

#### 分析：

首先通过`oldVNode && !isSameVNodeType(oldVNode, newVNode)`判断如果`oldVNode`与`newVNode`的`type`属性都不一样，那么就把`oldVNode`设置为`null`，这是让下面的`process`函数进行判断后执行挂载操作（而非更新）

下面通过`switch`判断`newVNode`的`type`与`shapeFlag`，`case Text & case Comment & case Fragment`这三种情况都是基本节点，没有`children`，所以无需涉及`shapeFlag`的判断，最后`default`中根据`shapeFlag`判断走`processElement`逻辑还是`processComponent`的逻辑。

`processText & processCommentNode & processFragment`：

~~~typescript
const processFragment = (oldVNode, newVNode, container, anchor) => {
  if (oldVNode == null) {
    mountChildren(newVNode.children, container, anchor)
  } else {
    patchChildren(oldVNode, newVNode, container, anchor)
  }
}

const processCommentNode = (oldVNode, newVNode, container, anchor) => {
  if (oldVNode == null) {
    // 挂载
    newVNode.el = hostCreateComment(newVNode.children)
    hostInsert(newVNode.el, container, anchor)
  } else {
    // 无更新
    newVNode.el = oldVNode.el
  }
}

const processText = (oldVNode, newVNode, container, anchor) => {
  // 挂载
  if (oldVNode == null) {
    newVNode.el = hostCreateText(newVNode.children)
    hostInsert(newVNode.el, container, anchor)
  } else {
    const el = (newVNode.el = oldVNode.el!)
    if (newVNode.children !== oldVNode.children) {
      hostSetText(el, newVNode.children)
    }
  }
}
~~~

`Fragment`类型的`vnode`暂时没搞定是个啥，处理方式也和`Text`和`Comment`类型的`vnode`不太一样，先不记录了，对于`Text`类型和`Comment`类型的节点逻辑类似，要做的事情有两个，一个是更新`newVNode`身上的`el`属性，再者就是操作dom。

重点来记录一下对于`Element`节点和`Component`节点的操作



### processElement函数

~~~typescript
const processElement = (oldVNode, newVNode, container, anchor) => {
  if (oldVNode == null) {
    // 挂载操作
    mountElement(newVNode, container, anchor)
  } else {
    // 更新操作
    patchElement(oldVNode, newVNode)
  }
}

const mountElement = (vnode, container, anchor) => {
  const { type, props, shapeFlag } = vnode
  // 1. 创建 element
  const el = (vnode.el = hostCreateElement(type))
  // 2. 设置文本
  if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
    hostSetElementText(el, vnode.children)
  } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
    // 设置 Array 子节点
    mountChildren(vnode.children, el, anchor)
  }
  // 3. 设置props
  if (props) {
    for (const key in props) {
      hostPatchProp(el, key, null, props[key])
    }
  }
  // 4. 插入
  hostInsert(el, container, anchor)
}

const patchElement = (oldVNode, newVNode) => {
  const el = (newVNode.el = oldVNode.el)
  const oldProps = oldVNode.props || EMPTY_OBJ
  const newProps = newVNode.props || EMPTY_OBJ

  patchChildren(oldVNode, newVNode, el, null)

  patchProps(el, newVNode, oldProps, newProps)
}
~~~

#### 分析：

`processElement`的逻辑就是根据`oldVNode`是否存在从而选择`mountElement`挂载还是`patchElement`更新

不管挂载还是更新，核心就是把`vnode`所携带的信息反映到试图上，什么信息？就是`type`所代表的元素本身的种类，`props`所携带的元素本身的属性信息，以及`children`所携带的子节点的信息。无论挂载还是更新，都是处理这三者，这三者处理完即操作完成。

所谓的`diff`算法，就是在`patchElement`函数中的`patchChildren`函数，即处理`children`属性的函数中进行的操作。



### patchComponent函数

~~~typescript
const processComponent = (oldVNode, newVNode, container, anchor) => {
  if (oldVNode == null) {
    mountComponent(newVNode, container, anchor)
  }
}
~~~

#### 分析：

暂时只实现了组件的挂载操作，即`oldVNode`如果为空，则执行`mountComponent`



### mountComponent函数

~~~typescript
const mountComponent = (initialVNode, container, anchor) => {
  // 生成组件实例
  initialVNode.component = createComponentInstance(initialVNode)
  // 浅拷贝，绑定同一块内存空间
  const instance = initialVNode.component

  // 标准化组件实例数据
  setupComponent(instance)

  // 设置组件渲染
  setupRenderEffect(instance, initialVNode, container, anchor)
}
~~~

#### 分析：

`mountComponent`挂载组件的第一步就是给`vnode`节点上挂载一个`component`属性对象，这个属性对象通过`createComponentInstance`方法创建出来，说白了就是一个对象，代表了这个组件实例，上面有组件的各种信息属性，`createComponentInstance`：

~~~typescript
let uid = 0
export function createComponentInstance(vnode) {
	const type = vnode.type

	const instance = {
		uid: uid++, // 唯一标记
		vnode, // 虚拟节点
		type, // 组件类型
		subTree: null!, // render 函数的返回值
		effect: null!, // ReactiveEffect 实例
		update: null!, // update 函数，触发 effect.run
		render: null, // 组件内的 render 函数
		// 生命周期相关
		isMounted: false, // 是否挂载
		bc: null, // beforeCreate
		c: null, // created
		bm: null, // beforeMount
		m: null // mounted
	}

	return instance
}
~~~

下面我们明确一下各个属性的来源：

* `uid`没啥好说的，一个全局唯一编号；

* `vnode`就是`h`函数创建的虚拟节点，也是我们`render`函数在页面渲染真实dom时真正用到的变量，在上面的`mountComponent`函数中在组件对应的`vnode`身上挂载的`component`属性，就是我们`createComponentInstance`执行完毕的返回值，即这里创建的`instance`对象。（`instance.vnode.component === instance`，形成循环引用，说白了就是让`instance`方便访问到对应的`vnode`节点，毕竟`vnode`节点才是`render`的核心，说不定后面哪里会用到）

* `type`即为`h`函数的第一个参数，回忆一下`type`的取值：`Text(symbol对象) & Comment & Fragment`、`'div'(标签名字符串)`，还有一种就是对象，也就是代表组件类型，看如下`h`函数的调用：

  ~~~js
  // 作为h函数第一个参数 type，为对象，判定为有状态组件，shapeFlag为4
  const component = {
    render() {
      const vnode1 = h('div', '这是一个 component')
      return vnode1
    }
  }
  
  // 第二个参数children为undefined，flag为0
  const vnode2 = h(component)
  ~~~

  对于上面`h`函数创建的`vnode`节点来说，其`type`属性就是上面的`component`对象，对象里面有`render`、以及后来还会增加的`data`、`mounted`等方法。

* `subTree`即为`render`函数的返回值，即一个`vnode`对象。通过上面的`h`函数调用举例也能看出，一个组件的`render`函数，其返回值就是一个`vnode`

* `render`、`bc(beforeCreate)`、`c(created)`、`bm(beforeMount)`、`m(mounted)`都是组件对象里的属性方法

`createComponentInstance`创建（初始化）好`instance`实例之后，此时`instance`大部分属性还都是`null`的状态，`setupComponent(instance)`方法的作用就是对`instance`上的属性信息进行完善。



### setupComponent函数

~~~typescript
export function setupComponent(instance) {
  // 嵌套调用setupStatefulComponent
  setupStatefulComponent(instance)
}

function setupStatefulComponent(instance) {
  // 嵌套调用
  finishComponentSetup(instance)
}

export function finishComponentSetup(instance) {
  const Component = instance.type
	
  // 从type中取出render挂载到instance上
  instance.render = Component.render
	
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
    callHook(beforeCreate)
  }
	
  // 重点细节：data挂载到instance对象上之前进行响应式化
  // 存在data函数（一般return一个对象），我们拿到data返回的对象变成reactive响应式对象后挂载到instance身上
  if (dataOptions) {
    const data = dataOptions()
    if (isObject(data)) {
      instance.data = reactive(data)
    }
  }
	
  // 若存在created生命周期，执行
  if (created) {
    callHook(created)
  }

  function registerLifecycleHook(register: Function, hook?: Function) {
    register(hook, instance)
  }
	
  // registerLifecycleHook函数的作用就是注册其它的那些生命周期，说白了就是把beforeCreate和created之外的那些生命周期挂载到instance身上，具体实现细节就不看了
  registerLifecycleHook(onBeforeMount, beforeMount)
  registerLifecycleHook(onMounted, mounted)
}

function callHook(hook: Function) {
  hook()
}
~~~

#### 分析：

`setupComponent`函数本身的逻辑并不复杂，说白了就是去**完善`instance`对象的信息**，完善信息具体是什么? 这些信息从哪里来?

 `instance`对象的`type`（传给`h`函数第一个参数，也就是那个包含了`render`、`data`、`beforeMount...`的对象）里的这些对象，把他们拿出来，挂载到`instance`对象身上。自然信息来源就是`instance`对象身上的`type`属性。

具体细节看上面代码注释吧



### setupRenderEffect函数

`mountComponent`函数中执行完了`setupComponent`逻辑之后，就是`setupRenderEffect(instance, initialVNode, container, anchor)`了（组件渲染逻辑）

~~~typescript
const setupRenderEffect = (instance, initialVNode, container, anchor) => {
  const componentUpdateFn = () => {
    if (!instance.isMounted) {
      const { bm, m } = instance
			
      // 执行beforeMount生命周期函数
      if (bm) {
        bm()
      }
			
      // 给instance组件对象挂载了subTree属性，即renderComponentRoot函数的返回值，说白了就是执行render函数，返回render函数创建的vnode节点，但是这个render函数的this指向通过call方法修改为了instance.data，这也就是render函数可以使用data中数据的原因
      // （下面包装render!.call(data)的normalizeVNode函数可以忽略）
      // ***** 重点 *****，我们不是先创建了一个ReactiveEffect对象，然后才接着执行的这里的逻辑嘛（update => effect.run），这里是data（data挂载到instance对象上时已经被包装为Reactive响应式对象了）的响应式属性就会收集刚刚创建的ReactiveEffect依赖，也就是说，组件用到的响应式数据以后触发set行为时，这里的componentUpdateFn函数还会执行（queuePreFlushCb(update)本质上也是执行componentUpdateFn）
      /*
        export function renderComponentRoot(instance) {
          const { vnode, render, data } = instance

          let result

          try {
            if (vnode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT) {
              result = normalizeVNode(render!.call(data))
            }
          } catch (error) {
            console.error(error)
          }

          return result
        }
      */
      const subTree = (instance.subTree = renderComponentRoot(instance))
			
      // 执行patch函数对vnode节点进行挂载，subTree就是组件vnode，说白了就是组件的render函数中返回的vnode
      patch(null, subTree, container, anchor)

      initialVNode = subTree.el
			
      // 执行mounted生命周期函数
      if (m) {
        m()
      }
    } else {
    }
  }

  const effect = (instance.effect = new ReactiveEffect(
    componentUpdateFn,
    () => queuePreFlushCb(update)
  ))

  const update = (instance.update = () => effect.run())

  update()
}
~~~

#### 分析：

说白了`setupRenderEffect`函数体的逻辑就两点：

1. 创建一个`ReactiveEffect`对象`effect`
2. 执行`update`函数，`updata`函数实际上就是执行`effect.run()`，即执行`ReactiveEffect`对象的第一个参数函数`componentUpdateFn`。

我们看一下`componentUpdateFn`函数做了什么，看上面的代码注释

总结来说`setupRenderEffect`函数做的事情就是创建一个依赖对象，然后用`data`去调用`render`，自然而然`data`数据收集到了依赖对象，`patch`函数渲染`render`函数创建的`vnode`完成组件挂载（当然在挂载前后合适的时机分别调用`bm`和`m`生命周期）

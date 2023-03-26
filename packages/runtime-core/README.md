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


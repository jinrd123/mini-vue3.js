import { EMPTY_OBJ, isString } from '@vue/shared'
import { ReactiveEffect } from 'packages/reactivity/src/effect'
import { ShapeFlags } from 'packages/shared/src/shapeFlags'
import { createComponentInstance, setupComponent } from './component'
import { normalizeVNode, renderComponentRoot } from './componentRenderUtils'
import { queuePreFlushCb } from './scheduler'
import { Text, Comment, Fragment, isSameVNodeType } from './vnode'
export interface RendererOptions {
  /**
   * 为指定的 element 的 props 打补丁
   */
  patchProp(el: Element, key: string, prevValue: any, nextValue: any): void
  /**
   * 为指定的 Element 设置 text
   */
  setElementText(node: Element, test: string): void
  /**
   * 插入指定的 el 到 parent 中，anchor 表示插入的位置，即锚点
   */
  insert(el, parent: Element, anchor?): void
  /**
   * 创建 element
   */
  createElement(type: string)

  remove(el: Element)

  createText(text: string)

  setText(node, text)

  createComment(text: string)
}

export function createRenderer(options: RendererOptions) {
  return baseCreateRenderer(options)
}

function baseCreateRenderer(options: RendererOptions): any {
  const {
    insert: hostInsert,
    patchProp: hostPatchProp,
    createElement: hostCreateElement,
    setElementText: hostSetElementText,
    remove: hostRemove,
    createText: hostCreateText,
    setText: hostSetText,
    createComment: hostCreateComment
  } = options

  const processComponent = (oldVNode, newVNode, container, anchor) => {
    if (oldVNode == null) {
      mountComponent(newVNode, container, anchor)
    }
  }

  const processFragment = (oldVNode, newVNode, container, anchor) => {
    if (oldVNode == null) {
      mountChildren(newVNode.children, container, anchor)
    } else {
      patchChildren(oldVNode, newVNode, container, anchor)
    }
  }

  const processCommentNode = (oldVNode, newVNode, container, anchor) => {
    if (oldVNode == null) {
      newVNode.el = hostCreateComment(newVNode.children)
      hostInsert(newVNode.el, container, anchor)
    } else {
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

  const processElement = (oldVNode, newVNode, container, anchor) => {
    if (oldVNode == null) {
      // 挂载操作
      mountElement(newVNode, container, anchor)
    } else {
      // 更新操作
      patchElement(oldVNode, newVNode)
    }
  }

  const patchElement = (oldVNode, newVNode) => {
    const el = (newVNode.el = oldVNode.el)
    const oldProps = oldVNode.props || EMPTY_OBJ
    const newProps = newVNode.props || EMPTY_OBJ

    patchChildren(oldVNode, newVNode, el, null)

    patchProps(el, newVNode, oldProps, newProps)
  }

  const mountChildren = (children, container, anchor) => {
    if (isString(children)) {
      children = children.split('')
    }
    for (let i = 0; i < children.length; i++) {
      const child = (children[i] = normalizeVNode(children[i]))

      patch(null, child, container, anchor)
    }
  }

  const patchChildren = (oldVNode, newVNode, container, anchor) => {
    const c1 = oldVNode && oldVNode.children
    const prevShapeFlag = oldVNode ? oldVNode.shapeFlag : 0
    const c2 = newVNode && newVNode.children
    const { shapeFlag } = newVNode

    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        // TODO: 卸载旧子节点
      }

      // 新旧子节点不同（旧的不为TEXT_CHILDREN）
      if (c2 !== c1) {
        // 挂载新子节点的文本
        hostSetElementText(container, c2)
      }
    } else {
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          // TODO: diff
          patchKeyedChildren(c1, c2, container, anchor)
        } else {
          // TODO: 卸载
        }
      } else {
        if (prevShapeFlag & ShapeFlags.TEXT_CHILDREN) {
          // 删除旧节点的 text
          hostSetElementText(container, '')
        }
        if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          // TODO: 单独新子节点的挂载
        }
      }
    }
  }

  const patchKeyedChildren = (
    oldChildren,
    newChildren,
    container,
    parentAnchor
  ) => {
    let i = 0
    const newChildrenLength = newChildren.length
    let oldChildrenEnd = oldChildren.length - 1
    let newChildrenEnd = newChildrenLength - 1

    // 1. 自前向后
    // 遍历children数组中的相同下标的每一项（都是一个vnode），如果isSameVNodeType(oldVNode, newVNode)，就进行patch(oldVNode, newVNode, container, null)
    while (i <= oldChildrenEnd && i <= newChildrenEnd) {
      const oldVNode = oldChildren[i]
      const newVNode = normalizeVNode(newChildren[i])
      if (isSameVNodeType(oldVNode, newVNode)) {
        patch(oldVNode, newVNode, container, null)
      } else {
        break
      }
      i++
    }

    // 2. 自后向前
    while (i <= oldChildrenEnd && i <= newChildrenEnd) {
      const oldVNode = oldChildren[oldChildrenEnd]
      const newVNode = newChildren[newChildrenEnd]
      if (isSameVNodeType(oldVNode, newVNode)) {
        patch(oldVNode, newVNode, container, null)
      } else {
        break
      }
      oldChildrenEnd--
      newChildrenEnd--
    }

    // 3. 新节点多于旧节点
    if (i > oldChildrenEnd) {
      if (i <= newChildrenEnd) {
        const nextPos = newChildrenEnd + 1
        const anchor =
          nextPos < newChildrenLength ? newChildren[nextPos].el : parentAnchor
        while (i <= newChildrenEnd) {
          patch(null, normalizeVNode(newChildren[i]), container, anchor)
          i++
        }
      }
    }

    // 4. 旧节点多于新节点
    else if (i > newChildrenEnd) {
      while (i <= oldChildrenEnd) {
        unmount(oldChildren[i])
        i++
      }
    }
  }

  const patchProps = (el: Element, vnode, oldProps, newProps) => {
    if (oldProps !== newProps) {
      // 更新新props相较于旧props的变化
      for (const key in newProps) {
        const next = newProps[key]
        const prev = oldProps[key]
        if (next !== prev) {
          hostPatchProp(el, key, prev, next)
        }
      }

      // 删除旧props中拥有，但新props中没有的属性
      if (oldProps !== EMPTY_OBJ) {
        for (const key in oldProps) {
          if (!(key in newProps)) {
            hostPatchProp(el, key, oldProps[key], null)
          }
        }
      }
    }
  }

  const mountComponent = (initialVNode, container, anchor) => {
    initialVNode.component = createComponentInstance(initialVNode)
    const instance = initialVNode.component

    // 把h函数接收的component对象的render函数挂载到instance的render属性上
    setupComponent(instance)

    setupRenderEffect(instance, initialVNode, container, anchor)
  }

  const setupRenderEffect = (instance, initialVNode, container, anchor) => {
    const componentUpdateFn = () => {
      if (!instance.isMounted) {
        const { bm, m } = instance

        if (bm) {
          bm()
        }

        const subTree = (instance.subTree = renderComponentRoot(instance))

        patch(null, subTree, container, anchor)

        if (m) {
          m()
        }

        initialVNode = subTree.el

        instance.isMounted = true // 使再次触发componentUpdateFn函数时进入else的逻辑
      } else {
        let { next, vnode } = instance
        if (!next) {
          next = vnode
        }

        const nextTree = renderComponentRoot(instance) // 拿着新数据创建对应的新的vnode节点

        const prevTree = instance.subTree
        instance.subTree = nextTree // 更新instance的subTree属性，就是对当前vnode节点的记录

        patch(prevTree, nextTree, container, anchor) // patch函数：传入新旧vnode节点，（经过对比后）真正的去修改dom

        next.el = nextTree.el
      }
    }

    const effect = (instance.effect = new ReactiveEffect(
      componentUpdateFn,
      () => queuePreFlushCb(update)
    ))

    const update = (instance.update = () => effect.run())

    update()
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

  const unmount = vnode => {
    hostRemove(vnode.el)
  }

  const render = (vnode, container) => {
    if (vnode === null) {
      // 卸载
      if (container._value) {
        unmount(container._value)
      }
    } else {
      patch(container._value || null, vnode, container)
    }
    container._value = vnode
  }

  return {
    render
  }
}

// 计算arr数组的最长递增子序列的下标数组，如arr: [6, 1, 4, 2, 5, 8]，1458和1258都是最长递增子序列，但是算法细节原因应该会返回1258对应的下标，也就是result: [1, 3, 4, 5]（了解一下计算目标即可）
// 为了方便理解算法的思想，我们不考虑返回的是子序列元素的下标还是元素本身（不重要，都代表了那个子序列就可以了），所以下面result[i]我们直接指最长递增子序列中具体的元素而非下标，如何寻找一个最长递增子序列，使用贪心法大致的思路：
// 遍历arr数组中的每一个数，如果当前这个数比数组里的最后一个数更大，那么就将这个数插入数组的最后；反之，替换掉数组中第一个大于等于这个数的元素。result数组的长度就是最长子序列的长度
// 对于这个贪心策略，考虑一种理解方式：result数组不用于记录最终的最长子序列，result[i]的含义是以result[i]为结尾的子序列长度最长为 i，另一个角度说，长度为 i 的递增序列中，result[i]为结尾的子序列就是末尾元素最小（序列增长最缓慢）的子序列。理解了这一点，正确性就显然了。
// 但是上面也说了，result数组本身记录的不是最长子序列，但是result的构造过程就是一个找到最长递增子序列的过程，所以我们需要额外去记录构造result数组的过程中，最长子序列的信息，最终把result还原成最长子序列数组
// 我们思考，当在result数组中插入一个元素时发生了什么，首先，在插入之前，result数组每一个元素都代表了arr数组中的一个元素，也就是说，即将插入的元素肯定是在result数组中元素后面的（在arr中从左到右出现的顺序），但是呢，插入一个元素的位置，可能是在result数组的任何位置（插入在最后或者更换掉前面一个元素）
// 也就是说，我们插入一个元素时，只能保证result中已经存在的元素在新插入的元素之前。然后我们利用这个分析，执行如下操作：每次result数组中加入新元素时（这里我们用的是下标，但其实就是代表了一个元素），我们就用一个map记录新加入的元素的上一个元素，即key为当前元素，value为当前元素在递增子序列中紧挨着的上一个元素
// 1. 如果是arrI(当前考察元素) > arr[j](此时递增子序列最后一个元素)，即在result数组最后添加i时，此时对于arrI来说，arrI新加进来作为递增子序列的最后一个元素，自然它之前紧挨着的递增子序列的元素即位arr[j]。所以记录p[i] = j（p是一个当作map用的数组），即我们通过p[i] = j知道了子序列中i元素上一个是j
// 2. 如果arrI <= arr[j]，即要把arrI更新到result数组之前的一个位置，如下代码中我们通过二分法计算出了应该更新result[u]位置的值，在更新之前，我们同样的记录这个**新元素为结尾的**递增子序列的上一个元素是谁，它的上一个元素肯定就是result[u - 1]，所以执行p[i] = result[u - 1]
// 我们经过上面的操作，遍历完所有元素后，想一下p数组（map）中的每个值有什么特点，即我们总是可以通过查找p来确定某个元素的上一个元素是什么。
// 所以，我们最后来倒叙遍历一遍p数组（map），这样从最后一个元素，找到倒数第二个元素，...，最终还原出整个递增子序列，又因为我们还原的子序列时是从result中的最后一个元素开始的，也就是说是最长的那个子序列，所以我们就找到了最长递增子序列
function getSequence(arr) {
  // p实际是是一个map的功能，p[i] = j，代表arr[i]的下标在result数组中位置的前一个位置值为j（根本看不懂，没必要看懂这句话，要想理解这句代码需要宏观理解它做了什么事情）
  // 我们所构造的result数组
  const p = arr.slice()
  const result = [0] // 初始化一个值，方便算法循环，同时这个值也并非无意义，对于只有第一个元素时，最长递增子序列就是这个元素本身
  let i, j, u, v, c
  const len = arr.length
  for (i = 0; i < len; i++) {
    const arrI = arr[i]
    if (arrI !== 0) {
      j = result[result.length - 1]
      if (arr[j] < arrI) {
        p[i] = j
        result.push(i)
        continue
      }
      u = 0
      v = result.length - 1
      // 寻找arrI该插入的位置，关于这里二分的分析：https://juejin.cn/post/7222549965271711801
      while (u < v) {
        c = (u + v) >> 1
        if (arr[result[c]] < arrI) {
          u = c + 1
        } else if(arr[result[c]] > arrI){
          v = c
        } else if(arr[result[c]] === arrI) {
          v = c 
        }
      }
      if (arrI < arr[result[u]]) {
        if (u > 0) {
          p[i] = result[u - 1]
        }
        result[u] = i
      }
    }
  }
  u = result.length
  v = result[u - 1]
  while (u-- > 0) {
    result[u] = v
    v = p[v]
  }
  return result
}

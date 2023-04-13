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

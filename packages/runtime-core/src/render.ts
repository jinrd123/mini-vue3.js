import { ShapeFlags } from 'packages/shared/src/shapeFlags'
import { Text, Comment, Fragment } from './vnode'
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
}

export function createRenderer(options: RendererOptions) {
  return baseCreateRenderer(options)
}

function baseCreateRenderer(options: RendererOptions): any {
  const patch = (oldVNode, newVNode, container, anchor = null) => {
    if (oldVNode === newVNode) {
      return
    }

    const { type, shapeFlag } = newVNode
    switch (type) {
      case Text:
        break
      case Comment:
        break
      case Fragment:
        break
      default:
        if (shapeFlag & ShapeFlags.ELEMENT) {
        } else if (shapeFlag & ShapeFlags.COMPONENT) {
        }
    }
  }

  const render = (vnode, container) => {
    if (vnode === null) {
      // TODO: 卸载
    } else {
      patch(container._value || null, vnode, container)
    }
  }

  return {
    render
  }
}

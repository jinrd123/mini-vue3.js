import { isArray, isFunction, isObject, isString } from '@vue/shared'
import { normalizeClass } from 'packages/shared/src/normalizePorp'
import { ShapeFlags } from 'packages/shared/src/shapeFlags'

export const Fragment = Symbol('Fragment')
export const Text = Symbol('Text')
export const Comment = Symbol('comment')

export interface VNode {
  __v_isVNode: true
  type: any
  props: any
  children: any
  shapeFlag: number
}

export function isVNode(value: any): value is VNode {
  return value ? value.__v_isVNode === true : false
}

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

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


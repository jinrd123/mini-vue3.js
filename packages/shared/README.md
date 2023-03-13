# shared

公共方法



## shapeFlags.ts

枚举类型`ShapeFlags`其属性用作虚拟dom结点`vnode`的一种标识，不同数字对应了dom结点不同的类型。

~~~typescript
export const enum ShapeFlags {
  /**
   * type = Element
   */
  ELEMENT = 1,
  /**
   * 函数组件
   */
  FUNCTIONAL_COMPONENT = 1 << 1,
  /**
   * 有状态（响应数据）组件
   */
  STATEFUL_COMPONENT = 1 << 2,
  /**
   * children = Text
   */
  TEXT_CHILDREN = 1 << 3,
  /**
   * children = Array
   */
  ARRAY_CHILDREN = 1 << 4,
  /**
   * children = slot
   */
  SLOTS_CHILDREN = 1 << 5,
  /**
   * 组件：有状态（响应数据）组件 | 函数组件
   */
  COMPONENT = ShapeFlags.STATEFUL_COMPONENT | ShapeFlags.FUNCTIONAL_COMPONENT
}
~~~

关于位运算：

~~~js
let num = 5; // 二进制表示为 101
num = num << 2; // 左移两位，变为 10100，即十进制的20
console.log(num); // 输出20
~~~

在上面的例子中，将数字5左移2位，即将101向左移动两位变成10100，得到的结果是20（十进制）。注意，**左移运算符将操作数转换为32位整数再进行移位运算**（plus：js的`number`类型是以64为二进制进行存储），因此左移的最大位数是31。如果移动超过了31位，则移位运算的结果是undefined。

**vue源码中使用位运算的目的即让一个数字携带更多的信息**：比如17，表示为`10001`，第一位和第五位就可以表示不同的意义，`10000`与`00001`相`|`得到`10001`即一个变量表示了多个信息。
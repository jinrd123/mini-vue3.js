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

### （针对简单数据类型）依赖收集：

`RefImpl`对象的`get value`中调用`trackRefValue(this)`。`reactive`方法中存放依赖的容器为`effect.ts`模块中的WeakMap对象`targetMap`，而使用`ref`方法创建的响应式数据经过`trackRefValue(this)`的逻辑，依赖都存放在响应式数据对应的`RefImpl`对象的`dep`集合中，`dep`即为一个`Set<ReactiveEffect>`，相当于`RefImpl`对象独立管理（存放）依赖。

### （针对简单数据类型）依赖触发：

`RefImpl`对象的`set value`中调用`triggerRefValue(this)`，即把`RefImpl`对象的`dep`集合转化为数组后全部执行

### 针对复杂数据类型

直接把`RefImpl`对象的`_value`属性初始化为一个`reactive`对象（直接借助`reactive`生成一个`Proxy`代理对象），通过`reactive`对象去对复杂数据的每个属性的get和set进行拦截（收集依赖/触发依赖）

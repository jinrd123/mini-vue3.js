# runtime-dom

浏览器部分运行时模块

提供浏览器宿主下的配置以及方法实例，比如针对 render 函数，runtime-core 中存放生成 render 函数的工厂函数 createRenderer，runtime-dom 就提供 createRenderer 相关的浏览器环境下的入参，然后导出一个 render 函数实例

浏览器环境下的入参：比如 nodeOps.ts 里的 nodeOps 对象里的方法都是一些原生 dom 操作的包装、patchProps 也一样，是对 dom 方法的一些包装

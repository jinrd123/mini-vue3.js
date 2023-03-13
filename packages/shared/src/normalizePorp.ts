import { isArray, isObject, isString } from '.'

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

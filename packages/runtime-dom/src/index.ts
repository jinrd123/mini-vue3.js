import { extend } from '@vue/shared'
import { createRenderer } from 'packages/runtime-core/src/renderer'
import { nodeOps } from './nodeOps'
import { patchProp } from './patchProps'

const rendererOptions = extend({ patchProp }, nodeOps)

let renderer

function ensureRender() {
  return renderer || (renderer = createRenderer(rendererOptions))
}

export const render = (...args) => {
  ensureRender().render(...args)
}

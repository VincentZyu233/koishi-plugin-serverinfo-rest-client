function element(type: string, attrs?: unknown, children?: unknown) {
  if (Array.isArray(attrs) && children === undefined) {
    children = attrs
    attrs = {}
  }
  return {
    type,
    attrs: attrs ?? {},
    children: children === undefined ? [] : Array.isArray(children) ? children : [children],
  }
}

export const h = Object.assign(element, {
  text: (content: string) => element('text', { content }),
  image: (data: unknown, mime: string) => element('image', { data, mime }),
  quote: (id: string) => element('quote', { id }),
  normalize: (source: unknown) => {
    if (typeof source === 'string') return [element('text', { content: source })]
    if (Array.isArray(source)) return source
    return source == null ? [] : [source]
  },
})

const schemaChain: any = new Proxy(function schema() {}, {
  get: () => (..._args: unknown[]) => schemaChain,
  apply: () => schemaChain,
})

export const Schema: any = new Proxy({}, {
  get: () => (..._args: unknown[]) => schemaChain,
})

export class Context {}

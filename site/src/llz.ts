import { useUrlState } from 'use-prms'
import type { Param } from 'use-prms'

export type LLZ = { lat: number; lng: number; zoom: number }

export const llzParam: Param<LLZ> = {
  encode: ({ lat, lng, zoom }) =>
    `${lat.toFixed(4)},${lng.toFixed(4)},${zoom.toFixed(2)}`,
  decode: (encoded) => {
    if (!encoded) return { lat: 0, lng: 0, zoom: 2 }
    const [lat, lng, zoom] = encoded.split(',').map(Number)
    return { lat: lat || 0, lng: lng || 0, zoom: zoom || 2 }
  },
}

export function useLLZ(defaults: LLZ) {
  const param: Param<LLZ> = {
    encode: (v) => {
      if (
        v.lat.toFixed(4) === defaults.lat.toFixed(4) &&
        v.lng.toFixed(4) === defaults.lng.toFixed(4) &&
        v.zoom.toFixed(2) === defaults.zoom.toFixed(2)
      ) return undefined
      return llzParam.encode(v)
    },
    decode: (encoded) => encoded ? llzParam.decode(encoded) : defaults,
  }
  return useUrlState('llz', param, { debounce: 300 })
}

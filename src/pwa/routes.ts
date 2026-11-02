export interface RouteMatch {
  url: URL
  sameOrigin: boolean
}

export const isExerciseImage = ({ url, sameOrigin }: RouteMatch) => sameOrigin && url.pathname.startsWith('/ex/')

export const isApi = ({ url, sameOrigin }: RouteMatch) => sameOrigin && url.pathname.startsWith('/api/')

export const isFontCss = ({ url }: RouteMatch) => url.origin === 'https://fonts.googleapis.com'

export const isFontFile = ({ url }: RouteMatch) => url.origin === 'https://fonts.gstatic.com'

export const NAV_DENYLIST = [/^\/api\//, /^\/overview(\/|$)/, /^\/deck(\/|$)/, /^\/ex\//]

export const PRECACHE_IGNORE = ['ex/**', 'overview/**', 'deck/**']

export const IMAGE_CACHE = { name: 'gym-ex-images', maxEntries: 600, maxAgeSeconds: 60 * 24 * 3600 }

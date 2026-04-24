import { useHostBridge } from './host-bridge'

const ALLOWED_LINK_SCHEMES = new Set(['http:', 'https:', 'mailto:'])

/**
 * Ask the host to open a URL outside the iframe sandbox. Only `http(s)` and
 * `mailto` are allowed (so an iframe can't escalate to `javascript:`). Internal
 * building block behind {@link useMcpApp}; exported for tests only.
 * @internal
 */
export function useExternalLink(): (url: string) => void {
  const bridge = useHostBridge()

  return (url: string): void => {
    if (typeof url !== 'string') {
      bridge.error.value = new TypeError('useExternalLink: url must be a string.')
      return
    }
    let parsed: URL
    try {
      parsed = new URL(url)
    }
    catch {
      bridge.error.value = new TypeError(`useExternalLink: ${JSON.stringify(url)} is not a valid absolute URL.`)
      return
    }
    if (!ALLOWED_LINK_SCHEMES.has(parsed.protocol)) {
      bridge.error.value = new TypeError(`useExternalLink: scheme ${JSON.stringify(parsed.protocol)} is not allowed (use http, https, or mailto).`)
      return
    }

    const href = parsed.toString()
    if (bridge.openai?.openExternal) {
      bridge.openai.openExternal({ href })
      return
    }
    bridge.request('ui/open-link', { url: href }).catch((err) => {
      bridge.error.value = err instanceof Error ? err : new Error(String(err))
    })
    bridge.postLegacy('link', { url: href })
  }
}

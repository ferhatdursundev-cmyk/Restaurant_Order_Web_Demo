export function normalizeFirebaseDownloadUrl(url?: string) {
    if (!url) return ''

    const trimmed = url.trim()
    if (!trimmed) return ''

    const qIndex = trimmed.indexOf('?')
    const base = qIndex >= 0 ? trimmed.slice(0, qIndex) : trimmed
    const query = qIndex >= 0 ? trimmed.slice(qIndex) : ''

    const marker = '/o/'
    const oIndex = base.indexOf(marker)
    if (oIndex === -1) return trimmed

    const prefix = base.slice(0, oIndex + marker.length)
    const objectPart = base.slice(oIndex + marker.length)

    // double encode
    const fixed = objectPart.replace(/%252F/g, '%2F')

    let decoded = fixed
    try {
        decoded = decodeURIComponent(fixed)
    } catch {
        // ignore
    }

    const reEncoded = encodeURIComponent(decoded)
    return `${prefix}${reEncoded}${query}`
}

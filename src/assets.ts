export function assetPath(path: string) {
  const cleanPath = path.replace(/^\/+/, '')
  return `${import.meta.env.BASE_URL}${cleanPath}`
}

export function publicAsset(assetPath: string): string {
  const normalized = assetPath.startsWith("/") ? assetPath.slice(1) : assetPath;
  return `./${normalized}`;
}

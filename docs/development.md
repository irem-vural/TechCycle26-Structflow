# Geliştirme, Çalıştırma ve Build Rehberi

## Gereksinimler

- Node.js **22.12+**
- npm
- Git
- Electron için masaüstü oturumu

## Temiz kurulum

```bash
npm ci
```

## Çalıştırma

Masaüstü:

```bash
npm run electron:dev
```

Yalnız web:

```bash
npm run dev
```

## Kalite kontrolleri

```bash
npm run typecheck
npm test
npm run lint
npm run electron:compile
npm run build
```

ESLint 9 flat config `eslint.config.mjs` içindedir. Mevcut davranışı değiştirmeden takip edilen bazı React statik-analiz bulguları warning seviyesindedir.

## Windows masaüstü build

```bash
npm run electron:build
```

Akış: TypeScript → Next.js static export → Electron compile → Electron Builder.

Builder ayarları `package.json`, web/static export davranışı `next.config.ts`, Electron compiler ayarı `tsconfig.electron.json` içindedir.

## Remotion

```bash
npm run video:studio
npm run video:render
npm run video:still
```

Kaynak `tooling/remotion/`, yeni çıktı `artifacts/generated/video/` altındadır.

## Doküman ve lisans üretimi

```bash
npm run docs:file-map
npm run licenses:inventory
```

Dosya haritası mevcut repo ağacından yeniden oluşturulur. Lisans envanteri `docs/legal/THIRD-PARTY-NOTICES.*` dosyalarını yeniler.

## Yeniden üretilebilir klasörler

- `.next/`
- `out/`
- `dist-electron/`
- `release/`
- `artifacts/generated/`

## Sorun giderme

### Electron açılmıyorsa

Önce `npm run typecheck` ve `npm run electron:compile` çalıştırın. `electron:dev`, localhost:3000 ile derlenmiş main/preload dosyalarını bekler.

### Native save web modunda çalışmıyorsa

Filesystem capability akışı `window.electronAPI` gerektirir; `npm run electron:dev` kullanın.

### Eski istinat dosyası açılmıyorsa

Şu zinciri kontrol edin:

- `src/core/workspace/sflowFormat.ts`
- `src/core/workspace/projectSchemas.ts`
- `src/core/workspace/projectDecodeClient.ts`
- `src/shell/project/useProjectPersistence.ts`

# Electron Masaüstü Katmanı

`desktop/electron/` renderer ile işletim sistemi arasındaki güvenlik sınırıdır. Bu katman yalnız istinat proje dosyasının native yaşam döngüsünü ve pencere davranışlarını taşır.

## Güvenlik prensibi

`BrowserWindow` `nodeIntegration: false` ve `contextIsolation: true` ile açılır. Renderer yalnız `desktop/electron/preload.ts` tarafından yayınlanan `DesktopApi` fonksiyonlarına erişebilir. Ortak tipler `src/core/desktop/desktopContracts.ts` içindedir.

## `main.ts`

Sorumlulukları:

- single-instance lock,
- işletim sistemi üzerinden `.sfl` açma,
- BrowserWindow oluşturma,
- development URL veya production `out/index.html` yükleme,
- proje open/save dialogları,
- project capability doğrulama,
- recent projects,
- atomik save koordinasyonu,
- güvenli uygulama kapanışı,
- pencere minimize/maximize/titlebar davranışı.

## `preload.ts`

`window.electronAPI` üzerinden yalnız şu grupları açar:

- pencere/splash kontrolleri,
- startup/open/recent proje okuma,
- save path seçimi ve save,
- recent project yönetimi,
- OS proje-açma ve close-request listener'ları.

## IPC sender doğrulama

`ipcSecurity.ts` privileged IPC çağrısının beklenen BrowserWindow/webContents kaynağından geldiğini doğrular.

## File capability

`fileCapabilities.ts` native dialogdan alınan proje yolunu süreli bir capability kimliğine bağlar. Renderer sonradan mutlak path üzerinde serbest işlem yapmaz; main process capability'yi yeniden doğrular.

Dosya boyut sınırları da burada uygulanır.

## Atomik save

`atomicFileWriter.ts` geçici dosyaya yazıp güvenli replace akışı kullanır. `ProjectSaveToken` içindeki `documentSessionId + requestSequence`, eski async save'in daha yeni kaydı ezmesini önler.

Renderer karşılığı `projectTabTransition.ts` ve `useProjectPersistence.ts` içindedir.

## Recent projects

`recentProjectStore.ts` descriptorları Electron `userData` alanında saklar. Açma işlemi recent ID ile tekrar main process üzerinden yapılır.

## Kapanış

`quitCoordinator.ts` native close isteği ile React dirty state kararını senkronize eder:

1. native close gelir,
2. renderer dirty sekmeleri kontrol eder,
3. kullanıcı save/discard/cancel seçer,
4. renderer confirm veya cancel gönderir,
5. main process kapanır veya pencereyi açık tutar.

## Build

- Kaynak: `desktop/electron/`
- TS config: `tsconfig.electron.json`
- Çıktı: `dist-electron/desktop/electron/`
- Package entry: `package.json` → `main`
- Builder resource: `desktop/assets/`

Yeni privileged IPC eklenirse contract → preload → main üçlüsü birlikte güncellenmeli, sender doğrulaması ve gerekirse capability sınırı uygulanmalıdır.

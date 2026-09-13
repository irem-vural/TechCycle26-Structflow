# Proje Verisi, `.sfl` Formatı ve Persistence

StructFlow'un tek proje türü **istinat duvarı**dır. Proje dosyası yaşam döngüsü `src/core/workspace/` ve `src/shell/project/` altında tutulur.

## Payload

`src/core/workspace/projectTypes.ts` güncel sözleşmeyi tanımlar:

- `projectType: 'retaining-wall'`
- `schemaVersion: 2 | 3` runtime okuma tipi; yazılan güncel dosya v3'tür.
- `name`
- `updatedAt`
- `data.wallInput`
- `data.logistics`
- `data.customCoefficients`
- isteğe bağlı beton reçetesi ve sürdürülebilir beton verisi.

## `.sfl` v3

`src/core/workspace/sflowFormat.ts` ZIP tabanlı kapsayıcıyı yönetir:

- `project.json`
- `metadata.json`

Güvenlik sınırları `sflowLimits.ts` içindedir; tehlikeli archive path, aşırı entry/expanded size, bozuk UTF-8 ve geçersiz JSON reddedilir.

## Migration

`projectSchemas.ts`:

- v3 istinat payloadını doğrular,
- v2 istinat payloadını v3'e yükseltir,
- eski v1/root biçimindeki istinat JSON'unu v3'e taşır,
- tanınmayan proje tipini reddeder.

`projectPersistence.ts` normalize sınırıdır.

## Decode pipeline

1. `useProjectPersistence.ts` byte'ları alır.
2. `projectDecodeClient.ts` worker isteğini oluşturur.
3. `projectDecode.worker.ts` parse/migration yapar.
4. `projectDecodeError.ts` kullanıcıya çevrilebilen hata üretir.
5. `ProjectShell.tsx` sonucu `useRetainingWallStore` içine hydrate eder.

## Yeni proje

`projectPayloadFactory.ts` `createDefaultRetainingWallData()` üzerinden varsayılan istinat verisini oluşturur ve yeni document session kimliği üretir.

## Dirty state ve sekmeler

Her açık sekme `WorkspaceTab` olarak tutulur. Aktif store payloadı sekmenin kayıtlı payloadıyla karşılaştırılır. Değişiklik varsa sekme dirty olur.

`projectTabTransition.ts`, sekme değişimi ve async save completion'ın doğru `documentSessionId + requestSequence` çiftine uygulanmasını sağlar.

## Save / Save As

1. Store'dan güncel `ProjectPayload` oluşturulur.
2. `writeSflow` byte üretir.
3. Preload üzerinden native save path/capability alınır.
4. `desktop/electron/main.ts` capability'yi doğrular.
5. `atomicFileWriter.ts` atomik yazım yapar.
6. Renderer completion ownership'i kontrol edip dirty flag'i temizler.

## File capability

`desktop/electron/fileCapabilities.ts`, renderer'ın keyfi filesystem path kullanması yerine süreli bir proje capability kimliği verir. Main process her işlemde kimliği ve boyut sınırını tekrar doğrular.

## Recent projects

`desktop/electron/recentProjectStore.ts` recent descriptorlarını Electron `userData` altında saklar. Renderer `useProjectPersistence.ts` üzerinden recent ID ile dosyayı yeniden açar.

## Ana referanslar

| Sorumluluk | Dosya |
|---|---|
| Payload/schema sabitleri | `src/core/workspace/projectTypes.ts` |
| Şema/migration | `src/core/workspace/projectSchemas.ts` |
| ZIP encode/decode | `src/core/workspace/sflowFormat.ts` |
| Decode worker | `src/core/workspace/projectDecode.worker.ts` |
| Renderer I/O | `src/shell/project/useProjectPersistence.ts` |
| Save ownership | `src/shell/project/projectTabTransition.ts` |
| Native I/O | `desktop/electron/main.ts` |
| Capability | `desktop/electron/fileCapabilities.ts` |
| Atomik yazım | `desktop/electron/atomicFileWriter.ts` |

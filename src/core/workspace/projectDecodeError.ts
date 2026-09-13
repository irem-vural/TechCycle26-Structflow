export type ProjectDecodeErrorCode =
  | 'INVALID_PROJECT'
  | 'UNSUPPORTED_VERSION'
  | 'INVALID_ARCHIVE'
  | 'INVALID_UTF8'
  | 'INVALID_JSON'
  | 'TOO_LARGE'
  | 'CANCELLED';

const DEFAULT_MESSAGES: Record<ProjectDecodeErrorCode, string> = {
  INVALID_PROJECT: 'Proje verisi geçersiz.',
  UNSUPPORTED_VERSION: 'Proje sürümü bu StructFlow sürümü tarafından desteklenmiyor.',
  INVALID_ARCHIVE: 'Proje arşivi geçersiz.',
  INVALID_UTF8: 'Proje metni geçerli UTF-8 değil.',
  INVALID_JSON: 'Proje JSON verisi geçersiz.',
  TOO_LARGE: 'Proje dosyası izin verilen boyutu aşıyor.',
  CANCELLED: 'Proje açma işlemi iptal edildi.',
};

export class ProjectDecodeError extends Error {
  readonly code: ProjectDecodeErrorCode;
  readonly path: string;

  constructor(
    code: ProjectDecodeErrorCode,
    options: {
      path?: string;
      message?: string;
      cause?: unknown;
    } = {},
  ) {
    super(options.message ?? DEFAULT_MESSAGES[code], options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'ProjectDecodeError';
    this.code = code;
    this.path = options.path ?? '';
  }
}

export function isProjectDecodeError(error: unknown): error is ProjectDecodeError {
  return error instanceof ProjectDecodeError;
}

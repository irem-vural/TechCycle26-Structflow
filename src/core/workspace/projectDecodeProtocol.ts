import type { ProjectDecodeErrorCode } from './projectDecodeError';
import type { ProjectPayload } from './projectTypes';

export type ProjectDecodeWorkerRequest = {
  id: number;
  buffer: ArrayBuffer;
};

export type ProjectDecodeWorkerResponse =
  | {
      id: number;
      ok: true;
      payload: ProjectPayload;
    }
  | {
      id: number;
      ok: false;
      error: {
        code: ProjectDecodeErrorCode;
        path: string;
        message: string;
      };
    };

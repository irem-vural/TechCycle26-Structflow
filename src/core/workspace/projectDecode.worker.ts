import { readSflow } from './sflowFormat';
import { isProjectDecodeError } from './projectDecodeError';
import type { ProjectDecodeWorkerRequest, ProjectDecodeWorkerResponse } from './projectDecodeProtocol';

type ProjectDecodeWorkerScope = {
  onmessage: ((event: MessageEvent<ProjectDecodeWorkerRequest>) => void) | null;
  postMessage(message: ProjectDecodeWorkerResponse): void;
};

const workerScope = self as unknown as ProjectDecodeWorkerScope;

workerScope.onmessage = (event) => {
  const { id, buffer } = event.data;
  let response: ProjectDecodeWorkerResponse;
  try {
    response = {
      id,
      ok: true,
      payload: readSflow(buffer),
    };
  } catch (error) {
    response = {
      id,
      ok: false,
      error: isProjectDecodeError(error)
        ? { code: error.code, path: error.path, message: error.message }
        : {
            code: 'INVALID_PROJECT',
            path: '',
            message: 'Proje dosyası çözümlenemedi.',
          },
    };
  }
  workerScope.postMessage(response);
};

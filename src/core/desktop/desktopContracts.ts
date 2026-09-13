export type ProjectType = 'retaining-wall';
export type DesktopBinary = Uint8Array;

export type ProjectSaveToken = {
  documentSessionId: string;
  requestSequence: number;
};

export type ProjectOpenResult =
  | { canceled: true }
  | {
      canceled: false;
      capabilityId: string;
      filePath: string;
      fileName: string;
      bytes: DesktopBinary;
    }
  | { canceled: false; errorCode: string; error: string };

export type ProjectSavePathResult =
  | { canceled: true }
  | {
      canceled: false;
      capabilityId: string;
      filePath: string;
      fileName: string;
    };

export type ProjectSaveResult =
  | { ok: true }
  | { ok: false; errorCode: string; message: string };

export type RecentProjectDescriptor = {
  id: string;
  name: string;
  filePath: string;
  at: string;
  projectType?: ProjectType;
};

export type PdfReportExportRequest = {
  html: string;
  defaultName: string;
};

export type PdfReportExportResult =
  | { canceled: true }
  | { canceled: false; filePath: string }
  | { canceled: false; errorCode: string; error: string };

export type DesktopApi = {
  setWindowTheme: (colors: { titlebar: string; symbol: string }) => void;
  minimizeWindow: () => void;
  toggleMaximizeWindow: () => void;
  requestWindowClose: () => void;
  confirmWindowClose: () => void;
  cancelWindowClose: () => void;
  splashReady: () => void;
  splashFinished: () => void;
  getStartupProject: () => Promise<ProjectOpenResult | null>;
  openProjectDialog: () => Promise<ProjectOpenResult>;
  openProjectCapability: (capabilityId: string) => Promise<ProjectOpenResult>;
  openRecentProject: (recentId: string) => Promise<ProjectOpenResult>;
  selectProjectSavePath: (defaultName?: string) => Promise<ProjectSavePathResult>;
  saveProject: (
    capabilityId: string,
    bytes: DesktopBinary,
    token: ProjectSaveToken,
  ) => Promise<ProjectSaveResult>;
  listRecentProjects: () => Promise<RecentProjectDescriptor[]>;
  rememberRecentProject: (
    capabilityId: string,
    name: string,
    at: string,
    projectType?: ProjectType,
  ) => Promise<RecentProjectDescriptor | null>;
  forgetRecentProject: (id: string) => Promise<void>;
  exportPdfReport: (request: PdfReportExportRequest) => Promise<PdfReportExportResult>;
  onProjectOpenRequest: (callback: (capabilityId: string) => void) => () => void;
  onCloseRequest: (callback: () => void) => () => void;
};

export {};

import type { DesktopApi } from '@/core/desktop/desktopContracts';

declare global {
  interface Window {
    electronAPI?: DesktopApi;
  }
}

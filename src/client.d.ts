declare global {
  interface Window {
    ssv: {
      availableStyles: Record<string, string>;
      langs: Record<string, string>;
      backupurl: string | null;
      contactAddress: string;
      apiUrl: string | null;
      basename: string;
      lang: string;
      // canvases: localizedCanvases;
      defaultCanvas: string;
      // availableTp: AVAILABLE_TP,
    }
  }
}

export {}
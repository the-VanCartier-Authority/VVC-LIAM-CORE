import { getAccessToken } from './googleAuth';

export interface PickedGoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  url: string;
  iconUrl?: string;
  lastEditedUtc?: number;
  sizeBytes?: number;
}

declare const gapi: any;
declare const google: any;

let isGapiPickerLoaded = false;

/**
 * Ensure the Google API client library and Picker script are loaded
 */
export async function loadPickerLibrary(): Promise<void> {
  if (typeof google !== 'undefined' && google.picker) {
    isGapiPickerLoaded = true;
    return;
  }

  return new Promise((resolve, reject) => {
    const globalGapi = (window as any).gapi;
    if (!globalGapi) {
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        (window as any).gapi?.load('picker', {
          callback: () => {
            isGapiPickerLoaded = true;
            resolve();
          },
          onerror: () => reject(new Error('Fallo al cargar Google Picker API')),
        });
      };
      script.onerror = () => reject(new Error('Fallo al cargar gapi script'));
      document.body.appendChild(script);
    } else {
      globalGapi.load('picker', {
        callback: () => {
          isGapiPickerLoaded = true;
          resolve();
        },
        onerror: () => reject(new Error('Fallo al inicializar gapi picker')),
      });
    }
  });
}

/**
 * Open the Google Picker UI modal to select files or upload to Drive
 */
export async function openGooglePicker(callbacks: {
  onPicked: (file: PickedGoogleDriveFile) => void;
  onCancel?: () => void;
  onError?: (err: Error) => void;
}): Promise<void> {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      throw new Error('AUTH_REQUIRED: Inicia sesión con Google para acceder a tus archivos.');
    }

    await loadPickerLibrary();

    if (typeof google === 'undefined' || !google.picker) {
      throw new Error('Google Picker API no disponible en este entorno.');
    }

    const pickerOrigin =
      window.location.ancestorOrigins && window.location.ancestorOrigins.length > 0
        ? window.location.ancestorOrigins[window.location.ancestorOrigins.length - 1]
        : window.location.origin;

    const docsView = new google.picker.DocsView(google.picker.ViewId.DOCS)
      .setIncludeFolders(true)
      .setSelectFolderEnabled(false);

    const uploadView = new google.picker.DocsUploadView();

    const picker = new google.picker.PickerBuilder()
      .addView(docsView)
      .addView(uploadView)
      .setOAuthToken(accessToken)
      .setCallback((data: any) => {
        if (data.action === google.picker.Action.PICKED) {
          const doc = data.docs?.[0];
          if (doc) {
            callbacks.onPicked({
              id: doc.id,
              name: doc.name,
              mimeType: doc.mimeType,
              url: doc.url,
              iconUrl: doc.iconUrl,
              lastEditedUtc: doc.lastEditedUtc,
              sizeBytes: doc.sizeBytes,
            });
          }
        } else if (data.action === google.picker.Action.CANCEL) {
          if (callbacks.onCancel) callbacks.onCancel();
        }
      })
      .setOrigin(pickerOrigin)
      .setTitle('VVC-ACIA // Explorador de Google Drive')
      .build();

    picker.setVisible(true);
  } catch (error: any) {
    console.error('Error opening Google Picker:', error);
    if (callbacks.onError) {
      callbacks.onError(error);
    } else {
      throw error;
    }
  }
}

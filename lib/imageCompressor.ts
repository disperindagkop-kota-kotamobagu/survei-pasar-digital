// Image Compression — compress before upload/store
// Keeps images under 500KB

export async function compressImage(
  file: File | Blob,
  maxSizeMB = 0.5,
  maxWidthOrHeight = 1280
): Promise<Blob> {
  // Dynamic import to avoid SSR issues
  const imageCompression = (await import('browser-image-compression')).default;
  
  const options = {
    maxSizeMB,
    maxWidthOrHeight,
    useWebWorker: true,
    fileType: 'image/jpeg',
  };

  return imageCompression(file as File, options);
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function base64ToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(';base64,');
  const mimeType = parts[0].split(':')[1];
  const raw = window.atob(parts[1]);
  const rawLen = raw.length;
  const uInt8Array = new Uint8Array(rawLen);
  for (let i = 0; i < rawLen; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }
  return new Blob([uInt8Array], { type: mimeType });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

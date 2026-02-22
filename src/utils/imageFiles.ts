/**
 * function relating image and files
 */

export function imageToCanvas(img: HTMLImageElement) {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const context = canvas.getContext('2d')!;
  context.drawImage(img, 0, 0);
  return canvas;
}

export function fileToCanvas(file: File | Blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => {
      if(!fr.result) {
        return reject(new Error('result is null'));
      }

      const img = new Image();
      img.onload = () => {
        resolve(imageToCanvas(img));
      };
      img.onerror = (error) => reject(error);
      img.src = typeof fr.result === 'string' ? fr.result : arrayBufferToBase64(fr.result);
    };
    fr.onerror = (error) => reject(error);
    fr.readAsDataURL(file);
  });
}

/*
 * read fimage file from arraybuffer into canvas
 * @param Buffer
 * @param type mimetype
 * @return HTMLCanvas
 */
export function bufferToCanvas(buffer: ArrayBuffer, type: string) {
  const blob = new Blob([buffer], { type });
  return fileToCanvas(blob);
}

export function canvasToBuffer(canvas: HTMLCanvasElement, type = 'image/png') {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      blob!.arrayBuffer().then(resolve).catch(reject);
    }, type);
  });
}

export function fileToImage(file: File | Blob) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = async () => {
      if(!fr.result) {
        return reject(new Error('result is null'));
      }

      resolve(await base64ToImage(fr.result));
    }
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

export function base64ToImage(value: string | ArrayBuffer) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    if(typeof value !== 'string') {
      value = arrayBufferToBase64(value);
    }

    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = value;
  });
}

export function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for(let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}
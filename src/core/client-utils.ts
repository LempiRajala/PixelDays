

export const getFilesFromUser = (accept?: string): Promise<File[]> => {
  return new Promise(resolve => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    if(accept) {
      input.accept = accept;
    }
    input.addEventListener("change", () => resolve(Array.from(input.files ?? [])));
    input.click();
  });
}

export const getFileFromUser = (accept?: string): Promise<File | null> => {
  return new Promise(resolve => {
    const input = document.createElement("input");
    input.type = "file";
    if(accept) {
      input.accept = accept;
    }
    input.addEventListener("change", () => resolve(
      input.files?.length ? input.files[0] : null));
    input.click();
  });
}

export const getImageInputAccept = () => "image/*";

export const getImageFromUser = (): Promise<File | null> => (
  getFileFromUser(getImageInputAccept()));

export async function fileToImage(file: File): Promise<{
  image: HTMLImageElement;
  revoke: () => void;
}> {
  if(!file.type.startsWith('image/')) {
    throw new Error('file must be image');
  }

  return new Promise((resolve, reject) => {
    const imageUrl = URL.createObjectURL(file);
    const img = new Image();
    
    img.onload = () => {
      resolve({
        image: img,
        revoke: () => URL.revokeObjectURL(imageUrl),
      });
    }
    
    img.onerror = e => {
      URL.revokeObjectURL(imageUrl);
      reject(e);
    }
    
    img.src = imageUrl;
  });
}

export const getFileUrl = (id: string) => `${process.env.FILE_STORAGE_ORIGIN}/${id}`;
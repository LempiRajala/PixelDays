import sharp, { type WebpOptions } from 'sharp';
import path from 'node:path';

export const defaultWebpCompressionOptions: WebpOptions = {
  quality: 90,
  alphaQuality: 90,
  lossless: false,
  effort: 5,
  nearLossless: false,
};

export async function compressAndResizeImage({
  buffer,
  width,
  height,
}: {
  buffer: Parameters<typeof sharp>[0];
  width: number;
  height: number;
}) {
  return await sharp(buffer)
    .resize({ width, height })
    .webp(defaultWebpCompressionOptions)
    .toBuffer();
}

export async function compressImage({
  buffer,
  options
}: {
  buffer: Parameters<typeof sharp>[0],
  options?: WebpOptions,
}) {
  return await sharp(buffer)
    .webp(options ?? defaultWebpCompressionOptions)
    .toBuffer();
}

export const changeFilenameExtension = (filename: string, newExt: string) => {
  const currentExtenstion = path.extname(filename);
  if(!newExt.startsWith('.')) newExt = '.' + newExt;
  return filename.slice(0, -currentExtenstion.length) + newExt;
}
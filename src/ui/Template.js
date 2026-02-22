/*
 * Template for the minimap / overlay
 */

import {
  fileToCanvas,
  imageToCanvas,
  bufferToCanvas,
  canvasToBuffer,
} from '../utils/imageFiles.ts';

class Template {
  // HTMLCanvasElement of image
  image;
  // id to hold in indexedDB, in store as imageId
  id;
  // dimensions
  width;
  height;
  // if image is loaded
  ready = false;
  // small pixels image
  #imageSmall;

  constructor(imageId) {
    this.id = imageId;
  }

  get imageSmall() {
    if (!this.#imageSmall) {
      const imgData = this.image.getContext('2d').getImageData(
        0, 0, this.width, this.height,
      );
      const imageSmall = document.createElement('canvas');
      imageSmall.width = this.width * 3;
      imageSmall.height = this.height * 3;
      const targetContext = imageSmall.getContext('2d');
      const targetData = targetContext.getImageData(
        0, 0, imageSmall.width, imageSmall.height,
      );

      let c = 0;
      let o = targetData.width * 4 + 4;
      while (c < imgData.data.length) {
        for (let r = 0; r < imgData.width; r += 1) {
          targetData.data[o] = imgData.data[c];
          targetData.data[++o] = imgData.data[++c];
          targetData.data[++o] = imgData.data[++c];
          targetData.data[++o] = imgData.data[++c];
          o += 1 + 2 * 4;
          c += 1;
        }
        o += targetData.width * 4 * 2;
      }
      targetContext.putImageData(targetData, 0, 0);
      this.#imageSmall = imageSmall;
    }

    return this.#imageSmall;
  }

  async arrayBuffer() {
    return canvasToBuffer(this.image);
  }

  setDimensionFromCanvas() {
    const { width, height } = this.image;
    this.width = width;
    this.height = height;
    this.read = true;
    return [width, height];
  }

  fromImage(img) {
    this.image = imageToCanvas(img);
    return this.setDimensionFromCanvas();
  }

  async fromFile(file) {
    this.image = await fileToCanvas(file);
    return this.setDimensionFromCanvas();
  }

  async fromBuffer(buffer, type = 'image/png') {
    this.image = await bufferToCanvas(buffer, type);
    return this.setDimensionFromCanvas();
  }
}

export default Template;

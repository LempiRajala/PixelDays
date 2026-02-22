/*
 * class for storing templates for minimap / overlay
 */

import { t } from 'ttag';

import FileStorage from '../utils/FileStorage.js';
import {
  removeTemplate,
  listTemplate,
  updatedTemplateImage,
  changeTemplate,
  templatesReady,
  receivedTemplate,
} from '../store/actions/templates.js';
import { pAlert } from '../store/actions/index.js';
import { bufferToBase64, base64ToBuffer } from '../core/utils.js';
import Template from './Template.js';

const STORE_NAME = 'templates';

class TemplateLoader {
  #store;
  #fileStorage = new FileStorage(STORE_NAME);
  // Map of templates
  #templates = new Map();
  // if loader is ready
  ready = false;

  async initialize(store) {
    try {
      this.#store = store;
      await this.#fileStorage.initialize();
      this.ready = true;
      this.#store.dispatch(templatesReady());
      await this.syncDB();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`Couldn't initialize Templates: ${err.message}`);
    }
  }

  /**
   * @return {HTMLCanvasElement}
   */
  async getTemplate(id) {
    if (!this.ready) {
      return null;
    }
    let template = this.#templates.get(id);
    if (template) {
      return template.image;
    }
    template = await this.loadExistingTemplate(id);
    if (template) {
      return template.image;
    }
    return null;
  }

  getTemplateSync(id) {
    if (!this.ready) {
      return null;
    }
    const template = this.#templates.get(id);
    if (template) {
      return template.image;
    }
    this.loadExistingTemplate(id);
    return null;
  }

  getSmallTemplateSync(id) {
    if (!this.ready) {
      return null;
    }
    const template = this.#templates.get(id);
    if (template) {
      return template.imageSmall;
    }
    this.loadExistingTemplate(id);
    return null;
  }

  getColorOfPixel(canvasId, x, y) {
    const templatesInView = this.#store.getState().templates.list
      .filter((template) => (
        template.enabled && template.canvasId === canvasId
      && template.x <= x && template.y <= y
      && template.x + template.width > x
      && template.y + template.height > y
      ));

    for (const tData of templatesInView) {
      const image = this.getTemplateSync(tData.imageId);
      if (!image) {
        continue;
      }
      const ctx = image.getContext('2d');
      const rgb = ctx.getImageData(x - tData.x, y - tData.y, 1, 1).data;
      if (rgb[3] > 200) {
        return [rgb[0], rgb[1], rgb[2]];
      }
    }
    return null;
  }

  getTemplatesInView(canvasId, x, y, horizontalRadius, verticalRadius) {
    const topX = x - horizontalRadius;
    const topY = y - verticalRadius;
    const bottomX = x + horizontalRadius;
    const bottomY = y + verticalRadius;

    return this.#store.getState().templates.list.filter((template) => (
      template.enabled && template.canvasId === canvasId
      && template.x <= bottomX && template.y <= bottomY
      && template.x + template.width > topX
      && template.y + template.height > topY
    ));
  }

  /*
   * sync database to store,
   * remove templates with images that aren't present in both
   */
  async syncDB() {
    try {
      const { list } = this.#store.getState().templates;
      const ids = list.map((z) => z.imageId);
      const deadIds = await this.#fileStorage.sync(ids);
      list.filter((z) => deadIds.includes(z.imageId)).forEach((z) => {
        this.#store.dispatch(removeTemplate(z.title));
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(
        `Error on syncing templates store and indexedDB: ${err.message}`,
      );
    }
  }

  /*
   * load all missing template from store
   */
  async loadAllMissing() {
    const { templates } = this.#store.getState();
    const ids = templates.list.map((z) => z.imageId);
    const toLoad = ids.filter((i) => !this.#templates.has(i));
    for (const id of toLoad) {
      // eslint-disable-next-line no-await-in-loop
      await this.loadExistingTemplate(id);
    }
  }

  /*
   * load a template from db
   * @param imageId
   */
  async loadExistingTemplate(imageId) {
    try {
      const fileData = await this.#fileStorage.loadFile(imageId);
      if (!fileData) {
        throw new Error('File does not exist in indexedDB');
      }
      const { mimetype, buffer } = fileData;
      const template = new Template(imageId);
      await template.fromBuffer(buffer, mimetype);
      this.#templates.set(imageId, template);
      this.#store.dispatch(receivedTemplate());
      return template;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`Error loading template ${imageId}: ${err.message}`);
      return null;
    }
  }

  /*
   * add template from File or Blob
   * @param file, title, canvasId, x, y self explenatory
   * @param element optional image or canvas element where file is already loaded,
   *                can be used to avoid having to load it multiple times
   */
  async addFile(file, title, canvasId, x, y) {
    try {
      const imageId = await this.#fileStorage.saveFile(file);
      const template = new Template(imageId);
      const dimensions = await template.fromFile(file);
      this.#templates.set(imageId, template);
      this.#store.dispatch(listTemplate(
        imageId, title, canvasId, x, y, ...dimensions,
      ));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`Error saving template ${title}: ${err.message}`);
    }
  }

  async updateFile(imageId, file) {
    try {
      await this.#fileStorage.updateFile(imageId, file);
      const template = new Template(imageId);
      const dimensions = await template.fromFile(file);
      this.#templates.set(imageId, template);
      this.#store.dispatch(updatedTemplateImage(imageId, ...dimensions));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`Error updating file ${imageId}: ${err.message}`);
    }
  }

  changeTemplate(title, props) {
    this.#store.dispatch(changeTemplate(title, props));
  }

  deleteTemplate(title) {
    const { list } = this.#store.getState().templates;
    const tData = list.find((z) => z.title === title);
    if (!tData) {
      return;
    }
    const { imageId } = tData;
    this.#store.dispatch(removeTemplate(title));
    this.#fileStorage.deleteFile(imageId);
    this.#templates.delete(imageId);
  }

  async exportEnabledTemplates() {
    const { list } = this.#store.getState().templates;
    const tDataList = list.filter((z) => z.enabled);
    if (!tDataList.length || tDataList.length > 20) {
      this.#store.dispatch(pAlert(
        t`Error :(`,
        t`Can not export more than 20 or no template!`,
        'error',
      ));
      return null;
    }
    const temps = await this.#fileStorage.loadFile(
      tDataList.map((z) => z.imageId),
    );
    const serilizableObj = [];
    for (let i = 0; i < tDataList.length; i += 1) {
      const { buffer, mimetype } = temps[i];
      serilizableObj.push({
        ...tDataList[i],
        // eslint-disable-next-line no-await-in-loop
        buffer: await bufferToBase64(buffer),
        mimetype,
      });
    }
    return serilizableObj;
  }

  async importTemplates(file) {
    const tDataList = JSON.parse(await file.text());
    if (!tDataList.length || tDataList.length > 20) {
      this.#store.dispatch(pAlert(
        t`Error :(`,
        t`Can not import more than 20 or no template!`,
        'error',
      ));
      return;
    }
    const bufferList = await Promise.all(
      tDataList.map((z) => base64ToBuffer(z.buffer)),
    );
    const fileList = [];
    for (let i = 0; i < tDataList.length; i += 1) {
      const { mimetype } = tDataList[i];
      fileList.push(new Blob([bufferList[i]], { type: mimetype }));
    }
    const { list } = this.#store.getState().templates;
    const imageIdList = await this.#fileStorage.saveFile(fileList);
    const idsToDelete = [];
    for (let i = 0; i < tDataList.length; i += 1) {
      const {
        x, y, width, height, canvasId, title,
      } = tDataList[i];
      const imageId = imageIdList[i];
      const existing = list.find((z) => z.title === title);
      if (existing) {
        idsToDelete.push(existing.imageId);
        this.changeTemplate(title, {
          imageId, title, canvasId, x, y, width, height,
        });
      } else {
        this.#store.dispatch(listTemplate(
          imageId, title, canvasId, x, y, width, height,
        ));
      }
    }
    if (idsToDelete.length) {
      this.#fileStorage.deleteFile(idsToDelete);
    }
  }
}

const templateLoader = new TemplateLoader();
window.templateLoader = templateLoader;

export default templateLoader;

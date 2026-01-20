/*
 * parent class for Renderer
 */

/* eslint-disable no-underscore-dangle */

import {
  VIEW_UPDATE_DELAY,
  CANVAS_TYPES,
} from '../core/constants.ts';
import { updateView } from '../store/actions/index.js';

/* eslint-disable class-methods-use-this */

class Renderer {
  store;
  // object for user controls
  controls = {
    update() {},
  };

  // chunk loader
  chunkLoader = null;
  // 'THREED', 'TWOD' or 'DUMMY'
  type = CANVAS_TYPES.DUMMY;
  // force renderer to rebuild whole view or
  // to "subrender" known view next tick
  forceNextRender = true;
  forceNextSubrender = true;
  // current position
  // third value can be scale (2d) or z axis (3d)
  _view = [0, 0, 0];
  //
  #storeViewTimeout = null;

  constructor(store) {
    this.store = store;
    // this.loadViewFromState();
  }

  get view() {
    return [...this._view];
  }

  get chunks() {
    return this.chunkLoader.chunks;
  }

  get recChunkIds() {
    if (!this.chunkLoader) return [];
    return this.chunkLoader.recChunkIds;
  }

  destructor() {
    this.chunkLoader?.destructor();
    this.cancelStoreViewInState();
  }

  updateView(view) {
    for (let i = 0; i < view.length; i += 1) {
      this._view[i] = view[i];
    }
  }

  /*
   * view is in both storea and renderer,
   * the one in store is for UI elements and not
   * updated in real time for performance reasons
   */
  loadViewFromState() {
    if (!this.store) return;
    this.updateView(this.store.getState().canvas.view);
  }

  cancelStoreViewInState() {
    if (this.#storeViewTimeout) {
      clearTimeout(this.#storeViewTimeout);
      this.#storeViewTimeout = null;
    }
  }

  storeViewInState() {
    if (!this.store) return;
    this.cancelStoreViewInState();
    this.#storeViewTimeout = setTimeout(() => {
      this.#storeViewTimeout = null;
      this.store.dispatch(updateView(this.view));
    }, VIEW_UPDATE_DELAY);
  }

  render() {
    return this.controls.update(this.forceNextRender);
  }

  renderPixel() {}

  updateCanvasData() {}

  getPointedColor() {
    return null;
  }

  isChunkInView() {
    return true;
  }

  gc() {
    this.chunkLoader?.gc(this);
  }
}

export default Renderer;

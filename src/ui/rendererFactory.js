/*
 * Manage renderers and switch between them
 * A renderer will create it's own viewport and append it
 * to document.body.
 *
 */

import { t } from 'ttag';

import Renderer from './Renderer.js';
import Renderer2D from './Renderer2D.js';
import { pAlert } from '../store/actions/index.js';
import { isWebGL2Available } from '../core/utils.js';
import { GC_INTERVAL, CANVAS_TYPES } from '../core/constants.ts';

const dummyRenderer = new Renderer();

let renderer = dummyRenderer;

function animationLoop() {
  renderer.render();
  window.requestAnimationFrame(animationLoop);
}
animationLoop();

/**
 * create a renderer that adds and draws on a canvas
 * @param store redux store
 * @param type THREED, TWOD, DUMMY
 */
export async function initRenderer(store, type) {
  renderer.destructor();
  switch (type) {
    case CANVAS_TYPES.THREED: {
      if (!isWebGL2Available()) {
        store.dispatch(pAlert(
          t`Canvas Error`,
          t`Can't render 3D canvas, do you have WebGL2 disabled?`,
          'error',
          'OK',
        ));
        renderer = dummyRenderer;
      } else {
        /* eslint-disable-next-line max-len */
        const module = await import(/* webpackChunkName: "voxel" */ './Renderer3D.js');
        const Renderer3D = module.default;
        renderer = new Renderer3D(store);
      }
      break;
    }
    case CANVAS_TYPES.TWOD:
      renderer = new Renderer2D(store);
      break;
    default:
      renderer = dummyRenderer;
  }
  return renderer;
}

export function getRenderer() {
  return renderer;
}

// garbage collection
setInterval(() => {
  renderer.gc();
}, GC_INTERVAL);

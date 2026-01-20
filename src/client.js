/*
 * Entrypoint for main client script
 */
import { persistStore } from 'redux-persist';

import {
  createKeyDownHandler,
  createKeyUpHandler,
} from './controls/keypress.js';
import {
  urlChange,
  setMobile,
  windowResize,
  parseCanvases,
} from './store/actions/index.js';
import { fetchMe, initTimer } from './store/actions/thunks.js';
import pixelTransferController from './ui/PixelTransferController.js';
import store from './store/store.ts';
import renderApp from './components/App.jsx';
import { getRenderer } from './ui/rendererFactory.js';
import templateLoader from './ui/templateLoader.js';
import socketClient from './socket/SocketClient.js';

// eslint-disable-next-line
__webpack_public_path__ = `${window.ssv?.basename || ''}/assets/`;

persistStore(store, {}, () => {
  window.addEventListener('message', store.dispatch);

  store.dispatch({ type: 'HYDRATED' });

  pixelTransferController.initialize(store, socketClient, getRenderer);

  // TODO should be in middleware
  templateLoader.initialize(store);

  window.addEventListener('hashchange', () => {
    store.dispatch(urlChange());
  });

  // check if on mobile
  window.imMobile = function checkMobile() {
    delete window.imMobile;
    store.dispatch(setMobile(true));
  };
  document.addEventListener('touchstart', window.imMobile, { once: true });

  // listen for resize
  function onWindowResize() {
    store.dispatch(windowResize());
  }
  window.addEventListener('resize', onWindowResize);
  onWindowResize();

  store.dispatch(initTimer());

  store.dispatch(parseCanvases());
  store.dispatch(fetchMe());

  socketClient.initialize(store, pixelTransferController, getRenderer);
});

(function load() {
  const onLoad = () => {
    window.name = 'main';
    renderApp(document.getElementById('app'), store);

    const onKeyDown = createKeyDownHandler(store);
    const onKeyUp = createKeyUpHandler(store);
    document.addEventListener('keydown', onKeyDown, false);
    document.addEventListener('keyup', onKeyUp, false);

    document.removeEventListener('DOMContentLoaded', onLoad);
  };
  document.addEventListener('DOMContentLoaded', onLoad, false);
}());

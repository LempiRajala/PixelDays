/*
 * reducers that are shared between pages
 */

/* eslint-disable no-console */

import { persistReducer } from 'redux-persist';
import storage from 'redux-persist/es/storage/index.js';

import gui from './reducers/gui.ts';
import ranks from './reducers/ranks.js';
import chatRead from './reducers/chatRead.js';
import user from './reducers/user.ts';
import canvas from './reducers/canvas.js';
import templates from './reducers/templates.js';
import chat from './reducers/chat.ts';
import fetching from './reducers/fetching.js';
import profile from './reducers/profile.js';


export const migrate = (state, version) => {
  // eslint-disable-next-line no-underscore-dangle
  if (!state || !state._persist || state._persist.version !== version) {
    console.log('Newer version run, resetting store.');
    return Promise.resolve({});
  }
  console.log(`Store version: ${version}`);
  return Promise.resolve(state);
};

const guiPersist = persistReducer({
  key: 'gui',
  storage,
  version: 21,
  migrate,
}, gui);

const ranksPersist = persistReducer({
  key: 'ranks',
  storage,
  version: 19,
  migrate,
}, ranks);

const chatReadPersist = persistReducer({
  key: 'cr',
  storage,
  version: 17,
  migrate,
}, chatRead);

const templatesPersist = persistReducer({
  key: 'tem',
  storage,
  version: 17,
  migrate,
}, templates);

const canvasPersist = persistReducer({
  key: 'can',
  storage,
  version: 2,
  migrate,
  whitelist: ['prevCanvasState'],
}, canvas);

export default {
  gui: guiPersist,
  ranks: ranksPersist,
  chatRead: chatReadPersist,
  templates: templatesPersist,
  canvas: canvasPersist,
  user,
  chat,
  fetching,
  profile,
};

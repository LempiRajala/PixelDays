/*
 * redux store
 */

import {
  /*
   * redux wants us to use the redux-toolkit really hard,
   * we do not want that, it abstracts too much away,
   * if there should ever arise a necessity to use the redux toolkit,
   * we shall switch to a different librry or make our own
   */
  applyMiddleware, combineReducers, legacy_createStore as createStore,
} from 'redux';
import { thunk } from 'redux-thunk';
import { persistReducer } from 'redux-persist';
// @ts-expect-error
import storage from 'redux-persist/es/storage/index.js';

import sharedReducers, {
  migrate,
} from './sharedReducers.js';

/*
 * reducers
 */
import windows from './reducers/windows.js';
import alert from './reducers/alert.js';

/*
 * middleware
 */
import audio from './middleware/audio.js';
import socketClientHook from './middleware/socketClientHook.js';
import rendererHook from './middleware/rendererHook.js';
import array from './middleware/array.js';
import notifications from './middleware/notifications.js';
import title from './middleware/title.js';
import popUps from './middleware/popUps.js';
import extensions from './middleware/extensions.js';
import type { GuiState } from './reducers/gui.ts';
import type { ChatState } from './reducers/chat.ts';
import type { UserState } from './reducers/user.ts';

const windowsPersist = persistReducer({
  key: 'wind',
  storage,
  version: 17,
  migrate,
}, windows);

const reducers = combineReducers({
  ...sharedReducers,
  windows: windowsPersist,
  alert,
});

// @ts-expect-error
const store = createStore(
  reducers,
  applyMiddleware(
    thunk,
    array,
    popUps,
    audio,
    notifications,
    title,
    socketClientHook,
    extensions,
    rendererHook,
  ),
);

export type State = (
  Required<Omit<ReturnType<typeof store.getState>, 'gui' | 'chat' | 'user'>> & {
    gui: GuiState;
    chat: ChatState;
    user: UserState;
  }
);

/*
 * persistStore of redux-persist is called in client.js
 */

export default store;

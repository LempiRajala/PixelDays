/*
 * Hooks for websocket client for popup window
 *
 */

import SocketClient from '../../socket/SocketClient.js';
import { POPUPS_NEEDING_WS } from '../../core/constants.ts';
import { parentExists } from '../../core/utils.js';

export default (store) => (next) => (action) => {
  const ret = next(action);

  if (SocketClient.readyState === WebSocket.CLOSED) {
    if ((
      action.type === 't/PARENT_CLOSED'
      || action.type === 'CHANGE_WIN_TYPE'
      || action.type === 'HYDRATED'
    ) && !parentExists()
      && POPUPS_NEEDING_WS.includes(store.getState().popup.windowType)
    ) {
      SocketClient.initialize(store);
    }
  } else {
    switch (action.type) {
      case 's/SET_NAME':
      case 's/LOGIN':
      case 's/LOGOUT': {
        SocketClient.reconnect();
        break;
      }

      case 's/REQ_CHAT_MESSAGE': {
        const {
          text,
          channel,
        } = action;
        SocketClient.sendChatMessage(text, channel);
        break;
      }

      default:
      // nothing
    }
  }

  return ret;
};

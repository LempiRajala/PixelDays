import { MAX_CHAT_MESSAGES } from '../../core/constants.ts';

type ChannelChat = [string, number, null];
type DirectChat = [string, number, null, number];

const initialState = {
  /*
   * {
   *   cid: [
   *     name,
   *     type,
   *     lastTs,
   *   ],
   *   cid2: [
   *     name,
   *     type,
   *     lastTs,
   *     dmUserId,
   *   ],
   *   ...
   * }
   */
  channels: {} as Record<string, ChannelChat | DirectChat>,
  // [[uId, userName], [userId2, userName2],...]
  blocked: [] as [number][],
  // { cid: [message1,message2,message3,...]}
  messages: {} as Record<string, [string, string, string, number, number][]>,
  userIdToAvatarId: {} as Record<number, string>,
};

export type ChatState = typeof initialState;

export enum ChatActionsType {
  REC_ME = 's/REC_ME',
  LOGIN = 's/LOGIN',
  LOGOUT = 's/LOGOUT',
  BLOCK_USER = 's/BLOCK_USER',
  UNBLOCK_USER = 's/UNBLOCK_USER',
  ADD_CHAT_CHANNEL = 's/ADD_CHAT_CHANNEL',
  REMOVE_CHAT_CHANNEL = 's/REMOVE_CHAT_CHANNEL',
  REC_CHAT_MESSAGE = 's/REC_CHAT_MESSAGE',
  REC_CHAT_HISTORY = 's/REC_CHAT_HISTORY',
  ADD_AVATAR_IDS = 'ADD_AVATAR_IDS',
}

// TODO дописать типы
export type ChatAction =
  | { type: ChatActionsType.REC_ME | ChatActionsType.LOGIN; channels: ChatState['channels']; blocked: [number][] }
  | { type: ChatActionsType.LOGOUT }
  | { type: ChatActionsType.BLOCK_USER; userId: number; userName: string }
  | { type: ChatActionsType.UNBLOCK_USER; userId: number }
  | { type: ChatActionsType.ADD_CHAT_CHANNEL; channel: any }
  | { type: ChatActionsType.REMOVE_CHAT_CHANNEL; cid: string }
  | { type: ChatActionsType.REC_CHAT_MESSAGE; name: any; text: any; country: any; channel: string; user: any }
  | { type: ChatActionsType.REC_CHAT_HISTORY; cid: string; history: any }
  | { type: ChatActionsType.ADD_AVATAR_IDS; userIdToAvatarId: Record<number, string> };

// used to give every message a unique incrementing key
let msgId = 0;

export default function chat(
  state = initialState,
  action: ChatAction,
) {
  switch (action.type) {
    case ChatActionsType.REC_ME:
    case ChatActionsType.LOGIN: {
      // making sure object keys are numbers
      const channels: ChatState['channels'] = {};
      const channelsJson = action.channels;
      const cids = Object.keys(channelsJson);
      for (let i = 0; i < cids.length; i += 1) {
        const cid = cids[i];
        channels[cid] = channelsJson[cid];
      }
      return {
        ...state,
        channels,
        blocked: action.blocked,
      };
    }

    case ChatActionsType.LOGOUT: {
      const channels = { ...state.channels };
      const messages = { ...state.messages };
      const keys = Object.keys(channels);
      for (let i = 0; i < keys.length; i += 1) {
        const cid = keys[i];
        if (channels[cid][1] !== 0) {
          delete messages[cid];
          delete channels[cid];
        }
      }
      return {
        ...state,
        channels,
        blocked: [],
        messages,
      };
    }

    case ChatActionsType.BLOCK_USER: {
      const { userId, userName } = action;
      const blocked = [
        ...state.blocked,
        [userId, userName],
      ];
      /*
       * remove DM channel if exists
       */
      const channels = { ...state.channels };
      const chanKeys = Object.keys(channels);
      for (let i = 0; i < chanKeys.length; i += 1) {
        const cid = chanKeys[i];
        if (channels[cid][1] === 1 && channels[cid][3] === userId) {
          delete channels[cid];
          return {
            ...state,
            channels,
            blocked,
          };
        }
      }
      return {
        ...state,
        blocked,
      };
    }

    case ChatActionsType.UNBLOCK_USER: {
      const { userId } = action;
      const blocked = state.blocked.filter(bl => bl[0] !== userId);
      return {
        ...state,
        blocked,
      };
    }

    case ChatActionsType.ADD_CHAT_CHANNEL: {
      const { channel } = action;
      const cid = Number(Object.keys(channel)[0]);
      if (state.channels[cid]) {
        return state;
      }
      return {
        ...state,
        channels: {
          ...state.channels,
          ...channel,
        },
      };
    }

    case ChatActionsType.REMOVE_CHAT_CHANNEL: {
      const { cid } = action;
      if (!state.channels[cid]) {
        return state;
      }
      const channels = { ...state.channels };
      const messages = { ...state.messages };
      delete messages[cid];
      delete channels[cid];
      return {
        ...state,
        channels,
        messages,
      };
    }

    case ChatActionsType.REC_CHAT_MESSAGE: {
      const {
        name, text, country, channel, user,
      } = action;
      if (!state.messages[channel] || !state.channels[channel]) {
        return state;
      }
      const ts = Math.round(Date.now() / 1000);
      msgId += 1;
      const messages = {
        ...state.messages,
        [channel]: [
          ...state.messages[channel],
          [name, text, country, user, ts, msgId],
        ],
      };
      if (messages[channel].length > MAX_CHAT_MESSAGES) {
        messages[channel].splice(0, 2);
      }

      /*
       * update timestamp of last message
       */
      const channelArray = [...state.channels[channel]];
      channelArray[2] = Date.now();

      return {
        ...state,
        channels: {
          ...state.channels,
          [channel]: channelArray,
        },
        messages,
      };
    }

    case ChatActionsType.REC_CHAT_HISTORY: {
      const { cid, history } = action;
      for (let i = 0; i < history.length; i += 1) {
        msgId += 1;
        history[i].push(msgId);
      }
      return {
        ...state,
        messages: {
          ...state.messages,
          [cid]: history,
        },
      };
    }

    case ChatActionsType.ADD_AVATAR_IDS: {
      return {
        ...state,
        userIdToAvatarId: Object.assign({}, state.userIdToAvatarId, action.userIdToAvatarId),
      }
    }

    default:
      return state;
  }
}

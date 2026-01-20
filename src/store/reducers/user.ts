import { USERLVL } from '../../core/constants.ts';
import { ChatAction, ChatActionsType } from './chat.ts';

// TODO

const initialState = {
  id: null as number | null,
  name: null as string | null,
  avatarId: null as string | null,
  bannerId: null as string | null,
  username: null as string | null,
  wait: null,
  coolDown: null, // ms
  lastCoolDownEnd: null  as number | null,
  // TODO какого хуя у хф тут типы разные
  userlvl: USERLVL.ANONYM as string | number,
  // messages are sent by api/me, like not_verified status
  messages: [] as any[],
  /*
   * whether or not the user has a password set (third party login might not
   * have one)
   */
  havePassword: false,
  // blocking all Dms
  blockDm: false,
  // profile is private
  priv: false,
  // if user is using touchscreen
  isOnMobile: false,
  // small notifications for received cooldown
  notification: null,
  /*
   * can be: {
   *   type, size,
   *   screenSize, screenPosX, screenPosY, screenRotation,
   * }
   */
  fish: {},
};

export type UserState = typeof initialState;

export enum UserActionsType {
  COOLDOWN_SET = 'COOLDOWN_SET',
  COOLDOWN_END = 'COOLDOWN_END',
  REC_SET_PXLS = 'REC_SET_PXLS',
  REC_COOLDOWN = 'REC_COOLDOWN',
  SET_MOBILE = 'SET_MOBILE',
  REC_ME = 's/REC_ME',
  LOGIN = 's/LOGIN',
  LOGOUT = 's/LOGOUT',
  SET_NAME = 's/SET_NAME',
  SET_BLOCKING_DM = 's/SET_BLOCKING_DM',
  SET_PRIVATE = 's/SET_PRIVATE',
  SET_NOTIFICATION = 'SET_NOTIFICATION',
  UNSET_NOTIFICATION = 'UNSET_NOTIFICATION',
  REM_FROM_MESSAGES = 's/REM_FROM_MESSAGES',
  SET_HAVE_PASSWORD = 's/SET_HAVE_PASSWORD',
  FISH_APPEARS = 'FISH_APPEARS',
  FISH_CATCHED = 'FISH_CATCHED',
  FISH_VANISHES = 'FISH_VANISHES',
  SET_AVATAR_ID = 'SET_AVATAR_ID',
  SET_BANNER_ID = 'SET_BANNER_ID',
}

export type UserAction =
  | { type: UserActionsType.COOLDOWN_SET; coolDown: any }
  | { type: UserActionsType.COOLDOWN_END }
  | { type: UserActionsType.REC_SET_PXLS; wait: any }
  | { type: UserActionsType.REC_COOLDOWN; wait: any }
  | { type: UserActionsType.SET_MOBILE; mobile: boolean }
  | {
      type: UserActionsType.REC_ME | UserActionsType.LOGIN;
      id: number;
      avatarId: string | null;
      bannerId: string | null;
      name: string;
      username: string;
      havePassword: boolean;
      blockDm: boolean;
      priv: boolean;
      userlvl: keyof typeof USERLVL;
      messages?: any[]
    }
  | { type: UserActionsType.LOGOUT }
  | { type: UserActionsType.SET_NAME; name?: any; username?: any }
  | { type: UserActionsType.SET_BLOCKING_DM; blockDm: boolean }
  | { type: UserActionsType.SET_PRIVATE; priv: boolean }
  | { type: UserActionsType.SET_NOTIFICATION; notification: any }
  | { type: UserActionsType.UNSET_NOTIFICATION }
  | { type: UserActionsType.REM_FROM_MESSAGES; message: any }
  | { type: UserActionsType.SET_HAVE_PASSWORD; havePassword: boolean }
  | { type: UserActionsType.FISH_APPEARS; fishType: any; size: any }
  | { type: UserActionsType.FISH_CATCHED | UserActionsType.FISH_VANISHES }
  | { type: UserActionsType.SET_AVATAR_ID; avatarId: string | null }
  | { type: UserActionsType.SET_BANNER_ID; bannerId: string | null }
  | Extract<ChatAction, { type: ChatActionsType.ADD_AVATAR_IDS }>;

export default function user(
  state = initialState,
  action: UserAction,
): UserState {
  switch (action.type) {
    case UserActionsType.COOLDOWN_SET: {
      const { coolDown } = action;
      return {
        ...state,
        coolDown: coolDown || null,
      };
    }

    case UserActionsType.COOLDOWN_END: {
      return {
        ...state,
        coolDown: null,
        lastCoolDownEnd: Date.now(),
        wait: null,
      };
    }

    case UserActionsType.REC_SET_PXLS: {
      const {
        wait: duration,
      } = action;
      return {
        ...state,
        wait: (duration) ? Date.now() + duration : state.wait,
      };
    }

    case UserActionsType.REC_COOLDOWN: {
      const { wait: duration } = action;
      const wait = duration
        ? Date.now() + duration
        : null;
      return {
        ...state,
        wait,
        coolDown: null,
      };
    }

    case UserActionsType.SET_MOBILE: {
      const { mobile: isOnMobile } = action;
      return {
        ...state,
        isOnMobile,
      };
    }

    case UserActionsType.REC_ME:
    case UserActionsType.LOGIN: {
      const {
        id,
        name,
        avatarId,
        bannerId,
        username,
        havePassword,
        blockDm,
        priv,
        userlvl,
      } = action;

      return {
        ...state,
        id,
        avatarId,
        bannerId,
        name,
        username,
        messages: action.messages || [],
        havePassword,
        blockDm,
        priv,
        userlvl,
      };
    }

    case UserActionsType.LOGOUT: {
      return {
        ...state,
        id: null,
        name: null,
        username: null,
        messages: [],
        havePassword: false,
        blockDm: false,
        priv: false,
        userlvl: USERLVL.ANONYM,
      };
    }

    case UserActionsType.SET_NAME: {
      return {
        ...state,
        name: action.name || state.name,
        username: action.username || state.username,
      };
    }

    case UserActionsType.SET_BLOCKING_DM: {
      const { blockDm } = action;
      return {
        ...state,
        blockDm,
      };
    }

    case UserActionsType.SET_PRIVATE: {
      const { priv } = action;
      return {
        ...state,
        priv,
      };
    }

    case UserActionsType.SET_NOTIFICATION: {
      return {
        ...state,
        notification: action.notification,
      };
    }

    case UserActionsType.UNSET_NOTIFICATION: {
      return {
        ...state,
        notification: null,
      };
    }

    case UserActionsType.REM_FROM_MESSAGES: {
      const { message } = action;
      const messages = [...state.messages];
      const index = messages.indexOf(message);
      if (index > -1) {
        messages.splice(index);
      }
      return {
        ...state,
        messages,
      };
    }

    case UserActionsType.SET_HAVE_PASSWORD: {
      const { havePassword } = action;
      return {
        ...state,
        havePassword,
      };
    }

    case UserActionsType.FISH_APPEARS: {
      const { fishType: type, size } = action;
      // 10 - 40 depending on size
      const screenSize = Math.ceil(10 + size / 25 * 30);
      const fish = {
        type,
        size,
        screenSize,
        screenPosX: Math.floor(Math.random() * (100 - screenSize)),
        screenPosY: Math.floor(Math.random() * (100 - screenSize)),
        screenRotation: Math.floor(Math.random() * 360),
      };
      return {
        ...state,
        fish,
      };
    }

    case UserActionsType.FISH_CATCHED:
    case UserActionsType.FISH_VANISHES:
      return {
        ...state,
        fish: {},
      };

    case UserActionsType.SET_AVATAR_ID:
      return {
        ...state,
        avatarId: action.avatarId,
      }

    case UserActionsType.SET_BANNER_ID:
      return {
        ...state,
        bannerId: action.bannerId,
      }

    case ChatActionsType.ADD_AVATAR_IDS:
      if(state.id !== null && state.id in action.userIdToAvatarId) {
        return {
          ...state,
          avatarId: action.userIdToAvatarId[state.id],
        };
      } else {
        return state;
      }

    default:
      return state;
  }
}

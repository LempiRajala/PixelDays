/*
 * state for single-window page (popup)
 */

import { POPUP_ARGS } from '../../core/constants.ts';

function getWinDataFromURL() {
  // eslint-disable-next-line max-len
  const path = window.location.pathname.substring(window.ssv?.basename?.length || 0).split('/').slice(1);
  /*
   * first part of path is windowType
   */
  const windowType = path[0].toUpperCase();
  /*
   * get args from path
   */
  const argsArr = path.slice(1);
  const args = {};
  const typeArr = POPUP_ARGS[windowType];
  if (typeArr) {
    let i = Math.min(typeArr.length, argsArr.length);
    while (i > 0) {
      i -= 1;
      /*
       * if it is an array, the first element is the name, the second one
       * the type
       */
      let keyName = typeArr[i];
      let type;
      if (Array.isArray(keyName)) {
        [keyName, type] = keyName;
      }
      const rawValue = argsArr[i];
      /*
       * currently we only support 'int' for number
       */
      args[keyName] = (type === 'int')
        ? parseInt(rawValue, 10) : decodeURIComponent(rawValue);
    }
  }
  /*
   * get args from query
   */
  const urlSearchParams = new URLSearchParams(window.location.search);
  const params = Object.fromEntries(urlSearchParams.entries());

  return {
    windowType,
    args: {
      ...args,
      ...params,
    },
  };
}

const initialState = {
  windowType: 'SETTINGS',
  title: '',
  args: {},
  ...getWinDataFromURL(),
};

export default function popup(
  state = initialState,
  action,
) {
  switch (action.type) {
    case 'RELOAD_URL': {
      return {
        ...state,
        ...getWinDataFromURL(),
      };
    }

    case 'SET_WIN_ARGS': {
      return {
        ...state,
        args: {
          ...action.args,
        },
      };
    }

    case 'SET_WIN_TITLE': {
      const { title } = action;
      return {
        ...state,
        title,
      };
    }

    case 'CHANGE_WIN_TYPE': {
      const {
        windowType,
        title,
        args,
      } = action;
      return {
        ...state,
        windowType,
        title,
        args: {
          ...args,
        },
      };
    }

    default:
      return state;
  }
}

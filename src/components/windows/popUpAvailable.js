/*
 * windows that can be opened as pop-up
 */
import { u } from '../../utils/utag.js';
import { POPUP_ARGS, AVAILABLE_POPUPS } from '../../core/constants.ts';

export default AVAILABLE_POPUPS;

export function isPopUp() {
  // eslint-disable-next-line max-len
  const fPath = window.location.pathname.substring(window.ssv?.basename?.length || 0).split('/')[1];
  return fPath && AVAILABLE_POPUPS.includes(fPath.toUpperCase());
}

export function buildPopUpUrl(windowType, argsIn) {
  const args = { ...argsIn };
  let path = u`/${windowType.toLowerCase()}`;
  const typeArr = POPUP_ARGS[windowType];
  if (typeArr) {
    for (let i = 0; i < typeArr.length; i += 1) {
      let key = typeArr[i];
      /*
       * if it is an array, the first element is the name, the second one
       * the type
       */
      if (Array.isArray(key)) {
        [key] = key;
      }
      if (args[key]) {
        path += `/${encodeURIComponent(args[key])}`;
        delete args[key];
      }
    }
  }
  let searchParams = new URLSearchParams();
  const keys = Object.keys(args);
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    searchParams.append(key, args[key]);
  }
  searchParams = searchParams.toString();
  if (searchParams) {
    path += `?${searchParams}`;
  }
  return path;
}


/*
 * function to link to window
 */

import { useCallback, useContext } from 'react';
import { useDispatch } from 'react-redux';

import { updateExistingPopUp } from '../../core/popUps.js';
import availablePopups, {
  isPopUp, buildPopUpUrl,
} from '../windows/popUpAvailable.js';
import { openWindow } from '../../store/actions/windows.js';
import WindowContext from '../context/window.ts';

function openPopUp(url, xPos, yPos, width, height) {
  let left;
  let top;
  try {
    if (window.innerWidth <= 604) {
      width = window.innerWidth;
      height = window.innerHeight;
      left = window.top.screenX;
      top = window.top.screenY;
    } else {
      left = Math.round(window.top.screenX + xPos);
      top = Math.round(window.top.screenY + yPos);
    }
    if (Number.isNaN(left) || Number.isNaN(top)) {
      throw new Error('NaN');
    }
  } catch {
    left = 0;
    top = 0;
  }
  try {
    return window.open(
      url,
      url,
      // eslint-disable-next-line max-len
      `popup=yes,width=${width},height=${height},left=${left},top=${top},toolbar=no,status=no,directories=no,menubar=no`,
    );
  } catch {
    return null;
  }
}

export function openWindowPopUp(windowType, args, xPos, yPos, width, height) {
  openPopUp(buildPopUpUrl(windowType, args), xPos, yPos, width, height);
}

function useLink() {
  const dispatch = useDispatch();

  const contextData = useContext(WindowContext);

  return useCallback((windowType, options = {}) => {
    const {
      xPos = null,
      yPos = null,
      width = null,
      height = null,
      args = null,
    } = options;

    const isMain = !isPopUp();
    const { target } = options;

    // if reusing existing windows, first try popups
    if (options.reuse && updateExistingPopUp(windowType, args)) {
      return;
    }

    // open new popup if target is popup or target
    // is new window and we are in a popup already
    if (options.target === 'popup'
      || (
        !isMain && target === 'blank' && availablePopups.includes(windowType)
      )) {
      // open as popup
      openWindowPopUp(
        windowType,
        args,
        xPos,
        yPos,
        width,
        height,
      );
      return;
    }

    const { title = '' } = options;

    if (isMain && (
      target === 'parent' || target === 'fullscreen' || target === 'blank'
    )) {
      dispatch(openWindow(
        windowType.toUpperCase(),
        !!options.reuse,
        title,
        args,
        (target === 'fullscreen'),
        options.cloneable || !options.reuse,
        xPos,
        yPos,
        width,
        height,
      ));
      return;
    }

    if (!contextData) {
      // open within browser window
      window.location.href = buildPopUpUrl(windowType, args);
      return;
    }

    // open within window
    contextData.changeType(windowType, title, args);
  }, [contextData, dispatch]);
}

export default useLink;

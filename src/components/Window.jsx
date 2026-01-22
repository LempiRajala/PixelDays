/*
 * draw window
 */

import React, {
  useState, useCallback, useRef, useEffect, useMemo,
} from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { BiChalkboard } from 'react-icons/bi';
import { t } from 'ttag';

import { openWindowPopUp } from './hooks/link.js';
import {
  moveWindow,
  removeWindow,
  resizeWindow,
  closeWindow,
  toggleMaximizeWindow,
  cloneWindow,
  focusWindow,
  setWindowTitle,
  setWindowArgs,
  changeWindowType,
  setWindowPosition,
} from '../store/actions/windows.js';
import {
  makeSelectWindowById,
  makeSelectWindowPosById,
  makeSelectWindowArgs,
  selectShowWindows,
} from '../store/selectors/windows.js';
import useDrag from './hooks/drag.js';
import WindowContext from './context/window.ts';
import COMPONENTS from './windows/index.js';
import popUpTypes from './windows/popUpAvailable.js';

/*
 * disabled for id and dispatch
 */
/* eslint-disable react-hooks/exhaustive-deps */

const Window = ({ id }) => {
  const [render, setRender] = useState(false);
  /* only for adding transitions when toggling fullscreen */
  const [resizing, setResizing] = useState(false);

  const titleBarRef = useRef();
  const resizeRef = useRef();

  const selectWindowById = useMemo(() => makeSelectWindowById(id), []);
  const selectWindowPosById = useMemo(() => makeSelectWindowPosById(id), []);
  const selectWindowArgs = useMemo(() => makeSelectWindowArgs(id), []);
  const win = useSelector(selectWindowById);
  const position = useSelector(selectWindowPosById);
  const showWindows = useSelector(selectShowWindows);
  const args = useSelector(selectWindowArgs);

  const dispatch = useDispatch();

  const contextData = useMemo(() => ({
    args,
    params: {},
    setArgs: (newArgs) => dispatch(setWindowArgs(id, newArgs)),
    setTitle: (title) => dispatch(setWindowTitle(id, title)),
    // eslint-disable-next-line max-len
    changeType: (newType, newTitle, newArgs) => dispatch(changeWindowType(id, newType, newTitle, newArgs)),
  }), [id, args]);

  const { open, hidden, cloneable } = win;
  /* if no windows are supposed to be shown, go fullscreen */
  const fullscreen = !showWindows || win.fullscreen;

  const focus = useCallback(() => {
    dispatch(focusWindow(id));
  }, []);

  const clone = useCallback((evt) => {
    evt.stopPropagation();
    dispatch(cloneWindow(id));
  }, []);

  const toggleMaximize = useCallback(() => {
    setResizing(true);
    dispatch(toggleMaximizeWindow(id));
  }, []);

  const close = useCallback((evt) => {
    evt.stopPropagation();
    dispatch(closeWindow(id));
  }, []);

  const { xPos, yPos, width, height } = position;

  const shown = !render && hidden;

  useDrag(
    titleBarRef,
    /* on click */
    focus,
    /* on drag */
    useCallback((xDiff, yDiff, x, y) => {
      if (!showWindows) {
        return true;
      }
      /*
       * if the titlebar is dragged on a fullscreen window, restore it after a
       * threshold
       */
      if (fullscreen && (xDiff ** 2 + yDiff ** 2 > 144)) {
        dispatch(toggleMaximizeWindow(id, false));
        dispatch(setWindowPosition(
          id,
          x - Math.floor(width / 2) + xDiff,
          y - 11 + yDiff,
        ));
        return true;
      }
      dispatch(moveWindow(id, xDiff, yDiff));
      return false;
    }, [shown, fullscreen, resizing, showWindows]),
    /* on double click */
    useCallback(() => {
      if (showWindows) {
        toggleMaximize();
      }
    }, [showWindows]),
  );

  useDrag(
    resizeRef,
    focus,
    useCallback((xDiff, yDiff) => {
      if (!fullscreen) {
        dispatch(resizeWindow(id, xDiff, yDiff));
      }
    }, [fullscreen, shown]),
  );

  const onTransitionEnd = useCallback(() => {
    if (hidden) {
      setRender(false);
    }
    if (!open) {
      dispatch(removeWindow(id));
    }
    if (resizing) {
      setResizing(false);
    }
  }, [hidden, open, resizing]);

  useEffect(() => {
    if (open && !hidden && !render) {
      window.setTimeout(() => {
        setRender(true);
      }, 10);
    }
  }, [open, hidden, render]);

  if (!render && (hidden || !open)) {
    return null;
  }

  const { title, windowType } = win;
  const { z } = position;

  const [Content, name] = COMPONENTS[windowType];

  const windowTitle = (title) ? `${name} - ${title}` : name;

  let classes = `window ${windowType}`;
  if (open && !hidden && render) {
    classes += ' show';
  }
  if (resizing) {
    classes += ' resizing';
  }

  let style;
  if (fullscreen) {
    classes += ' fullscreen';
    style = {
      left: 0,
      top: 0,
      width: '100%',
      height: '100%',
      zIndex: z,
    };
  } else {
    style = {
      left: xPos,
      top: yPos,
      width,
      height,
      zIndex: z,
    };
  }

  return (
    <div
      className={classes}
      onTransitionEnd={onTransitionEnd}
      onClick={focus}
      style={style}
    >
      <div
        className="win-topbar"
        key="topbar"
      >
        {(!fullscreen && cloneable) && (
          <span
            className="win-topbtn"
            key="clonebtn"
            onClick={clone}
            title={t`Clone`}
          >
            +
          </span>
        )}
        <span
          className="win-title"
          key="title"
          ref={titleBarRef}
          title={t`Move`}
        >
          {windowTitle}
        </span>
        {popUpTypes.includes(windowType) && (
          <span
            className="win-topbtn"
            key="pobtnm"
            onClick={(evt) => {
              openWindowPopUp(
                windowType, args,
                xPos, yPos, width, height,
              );
              close(evt);
            }}
          >
            <BiChalkboard />
          </span>
        )}
        {(showWindows) && (
          <span
            className="win-topbtn"
            key="maxbtn"
            onClick={toggleMaximize}
            title={(fullscreen) ? t`Restore` : t`Maximize`}
          >
            {(fullscreen) ? '↓' : '↑'}
          </span>
        )}
        <span
          className="win-topbtn close"
          key="closebtn"
          onClick={close}
          title={t`Close`}
        >
          X
        </span>
      </div>
      {(!fullscreen) && (
        <div
          className="win-resize"
          key="winres"
          title={t`Resize`}
          ref={resizeRef}
        >
          ▨
        </div>
      )}
      <div
        className="win-content"
        key="content"
      >
        <WindowContext.Provider value={contextData}>
          <Content />
        </WindowContext.Provider>
      </div>
    </div>
  );
};

export default React.memo(Window);

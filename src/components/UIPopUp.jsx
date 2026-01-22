/*
 * UI for single-window popUp
 */

import React, { useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';

import {
  selectWindowType, selectWindowArgs,
} from '../store/selectors/popup.js';
import {
  setWindowArgs,
  setWindowTitle,
  changeWindowType,
  togglePopUpfs,
} from '../store/actions/popup.js';
import WindowContext from './context/window.ts';
import COMPONENTS from './windows/index.js';

const UIPopUp = () => {
  const windowType = useSelector(selectWindowType);
  const args = useSelector(selectWindowArgs);
  const fsPopUps = useSelector((state) => state.gui.fsPopUps);

  const [Content] = COMPONENTS[windowType];

  const dispatch = useDispatch();

  const contextData = useMemo(() => ({
    args,
    params: window.ssv?.params || {},
    setArgs: (newArgs) => dispatch(setWindowArgs(newArgs)),
    setTitle: (title) => dispatch(setWindowTitle(title)),
    // eslint-disable-next-line max-len
    changeType: (newType, newTitle, newArgs) => dispatch(changeWindowType(newType, newTitle, newArgs)),
  }), [args, dispatch]);

  const isFullscreen = fsPopUps.includes(windowType);

  return (
    <div
      className={`popup-modal${(isFullscreen) ? ' fs' : ''}`}
    >
      <div className="popup-fsbtn-wrapper">
        <div
          className="popup-fsbtn"
          onClick={() => dispatch(togglePopUpfs(windowType))}
        ><span>{(isFullscreen) ? '⇙' : '⇗'}</span></div>
      </div>
      <div className="popup-content">
        <WindowContext.Provider value={contextData}>
          {(windowType)
            ? <Content />
            : <h1>Loading</h1>}
        </WindowContext.Provider>
      </div>
    </div>
  );
};

export default React.memo(UIPopUp);

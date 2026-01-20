/**
 *
 */

import React from 'react';
import { useSelector, shallowEqual, useDispatch } from 'react-redux';
import { t } from 'ttag';
import { CANVAS_TYPES } from '../core/constants.ts';

import copy from '../utils/clipboard.js';
import { notify } from '../store/actions/thunks.js';


function renderCoordinates(cell) {
  return `(${cell.join(', ')})`;
}


const CoordinatesBox = () => {
  const [view, hover, rendererType] = useSelector((state) => [
    state.canvas.view,
    state.canvas.hover,
    state.canvas.rendererType,
  ], shallowEqual);
  const dispatch = useDispatch();

  let coords;
  if (hover) {
    coords = hover;
  } else if (rendererType === CANVAS_TYPES.DUMMY) {
    coords = [];
  } else {
    const [x, y, z] = view;
    // eslint-disable-next-line max-len
    coords = (rendererType === CANVAS_TYPES.THREED ? [x, y, z] : [x, y]).map(Math.floor);
  }

  return (
    <div
      className="coorbox"
      onClick={() => {
        copy(window.location.hash);
        dispatch(notify(t`Copied`));
      }}
      role="button"
      title={t`Copy to Clipboard`}
      tabIndex="0"
    >{
      renderCoordinates(coords)
    }</div>
  );
};

export default React.memo(CoordinatesBox);

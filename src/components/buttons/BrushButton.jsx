/**
 *
 * Button to open/close brush size
 */

import React from 'react';
import { useSelector, useDispatch, shallowEqual } from 'react-redux';
import { RiPaintBrushFill } from "react-icons/ri";
import { t } from 'ttag';

import { toggleOpenBrush } from '../../store/actions/index.js';

const BrushButton = () => {
  const brushOpen = useSelector((state) => state.gui.brushOpen);
  // const [palette, selectedColor] = useSelector((state) => [
  //   state.canvas.palette,
  //   state.canvas.selectedColor,
  // ], shallowEqual);
  const dispatch = useDispatch();

  return (
    <div
      id="brushbutton"
      className="actionbuttons"
      role="button"
      title={(brushOpen) ? t`Close Brush` : t`Open Brush`}
      tabIndex={0}
      onClick={() => dispatch(toggleOpenBrush())}
    >
      <RiPaintBrushFill />
    </div>
  );
};

export default React.memo(BrushButton);
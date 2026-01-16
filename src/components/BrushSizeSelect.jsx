/**
 *
 */

import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector, shallowEqual } from 'react-redux';

import { setBrushSize } from '../store/actions/index.js';
import useWindowSize from './hooks/resize.js';

const brushSizeOptions = [1, 3, 5].reverse();

/*
 * defines the style of the brush size select
 * based on windowSize
 */
function getStylesByWindowSize(
  brushOpen,
  windowSize,
) {
  const {
    width: windowWidth,
    height: windowHeight,
  } = windowSize;
  const numCal = brushSizeOptions.length;

  let flexDirection;
  let spanSize;
  let paletteCols;
  if (windowWidth <= 300 || windowHeight <= 432) {
    // tiny compact palette
    spanSize = 24;
    paletteCols = 5;
    flexDirection = 'row';
  } else if (numCal > 30) {
    // compact palette
    spanSize = 28;
    paletteCols = 5;
    flexDirection = 'row';
  } else {
    // ordinary palette (one or two columns)
    spanSize = 24;
    paletteCols = (windowHeight < 801) ? 2 : 1;
    flexDirection = 'column';
  }
  const height = Math.ceil(numCal / paletteCols) * spanSize;
  const width = spanSize * paletteCols;

  if (!brushOpen) {
    return [{
      display: 'flex',
      flexWrap: 'wrap',
      textAlign: 'center',
      lineHeight: 0,
      height: 0,
      width,
      flexDirection,
      visibility: 'hidden',
    }, {
      display: 'block',
      height: 0,
      width: spanSize,
      margin: 0,
      padding: 0,
      visibility: 'hidden',
    }];
  }

  return [{
    display: 'flex',
    flexWrap: 'wrap',
    textAlign: 'center',
    lineHeight: 0,
    height,
    width,
    flexDirection,
    visibility: 'visible',
  }, {
    display: 'block',
    width: spanSize,
    height: spanSize,
    margin: 0,
    padding: 0,
    cursor: 'pointer',
    visibility: 'visible',
  }];
}

const BrushSizeSelect = () => {
  const [render, setRender] = useState(false);
  const [
    brushOpen,
    selectedBrushSize,
  ] = useSelector((state) => [
    state.gui.brushOpen,
    state.gui.brushSize,
  ], shallowEqual);
  const dispatch = useDispatch();

  useEffect(() => {
    window.setTimeout(() => {
      if (brushOpen) setRender(true);
    }, 10);
  }, [brushOpen]);

  const onTransitionEnd = () => {
    if (!brushOpen) setRender(false);
  };

  const [brushSelectStyle, spanStyle] = getStylesByWindowSize(
    render && brushOpen,
    useWindowSize(),
  );

  return (
    (render || brushOpen) && (
      <div
        id="brushsizebox"
        style={brushSelectStyle}
        onTransitionEnd={onTransitionEnd}
      >
        {brushSizeOptions.map((brushSize, index) => (
          <span
            style={{
              backgroundColor: brushSize,
              ...spanStyle,
            }}
            role="button"
            tabIndex={0}
            aria-label={`brush-size ${index}`}
            key={`${brushSize}-${index}`}
            className={selectedBrushSize === brushSize
              ? 'selected'
              : 'unselected'}
            onClick={() => dispatch(setBrushSize(brushSize))}
          >
            {brushSize}
          </span>
        ))}
      </div>
    )
  );
};

export default React.memo(BrushSizeSelect);

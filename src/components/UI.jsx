/**
 *
 */

import React from 'react';
import { useSelector, shallowEqual } from 'react-redux';

import CoolDownBox from './CoolDownBox.jsx';
import NotifyBox from './NotifyBox.jsx';
import ReplacementMessage from './ReplacementMessage.jsx';
import GlobeButton from './buttons/GlobeButton.jsx';
import PalselButton from './buttons/PalselButton.jsx';
import PencilButton from './buttons/PencilButton.jsx';
import MovementControls from './buttons/MovementControls.jsx';
import Palette from './Palette.jsx';
import Alert from './Alert.jsx';
import HistorySelect from './HistorySelect.jsx';
import VDay from './VDay.jsx';
import Fish from './Fish.jsx';
import useDate from './hooks/useDate.js';
import { CANVAS_TYPES } from '../core/constants.js';
import BrushSizeSelect from './BrushSizeSelect.jsx';

const UI = () => {
  const [
    isHistoricalView,
    rendererType,
    replacementActive,
    isOnMobile,
    hasFish,
  ] = useSelector((state) => [
    state.canvas.isHistoricalView,
    state.canvas.rendererType,
    state.canvas.replacementActive,
    state.user.isOnMobile,
    state.user.fish.size,
  ], shallowEqual);

  const [day, month] = useDate();
  const is3D = rendererType === CANVAS_TYPES.THREED;

  return (
    <>
      <Alert />
      <MovementControls />
      {(isHistoricalView) ? (
        <HistorySelect id="historyselectfloat" />
      ) : (
        <>
          <PalselButton />
          <Palette />
          <BrushSizeSelect />
          {(!is3D) && <GlobeButton />}
          {(!is3D && isOnMobile) && <PencilButton />}
          <CoolDownBox />
        </>
      )}
      {(day === 9 && month === 5) && <VDay />}
      <NotifyBox />
      {(replacementActive) && <ReplacementMessage />}
      {(hasFish && <Fish />)}
    </>
  );
};

export default React.memo(UI);

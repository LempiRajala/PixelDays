/*
 * selectors related to gui
 */
import { CANVAS_TYPES } from '../../core/constants.ts';
import type { State } from '../store.ts';

export const selectIsDarkMode = (state: State) => (
  state.gui.style.indexOf('dark') !== -1
);

export const selectMovementControlProps = (state: State) => [
  state.canvas!.rendererType === CANVAS_TYPES.THREED,
  state.canvas!.rendererType !== CANVAS_TYPES.DUMMY && (
    state.gui.showMvmCtrls || (
      state!.user!.isOnMobile && (
        state!.canvas!.rendererType === CANVAS_TYPES.THREED
        || state.gui.holdPaint
        && !state!.canvas!.isHistoricalView
      )
    )
  ),
];

import Palette from '../../core/Palette.js';
import {
  getIdFromObject,
  getHistoricalCanvasSize,
  getMaxTiledZoom,
  getToday,
  dateToString,
  isIntervalActive,
} from '../../core/utils.js';
import {
  DEFAULT_SCALE,
  DEFAULT_CANVAS_ID,
  PENCIL_MODE,
  CANVAS_TYPES,
} from '../../core/constants.ts';

/**
 * checks if toggling historical view is neccessary
 * in given state or if properties have to change.
 * Changes the state inplace.
 * @param state
 * @return same state with fixed historical view
 */
function fixHistoryIfNeccessary(state) {
  const { canvasEndDate, rendererType } = state;
  let { isHistoricalView, historicalDate } = state;

  if (rendererType !== CANVAS_TYPES.TWOD) {
    isHistoricalView = false;
  } else if (canvasEndDate) {
    isHistoricalView = true;
  }
  state.isHistoricalView = isHistoricalView;
  if (isHistoricalView) {
    if (!historicalDate) {
      historicalDate = dateToString(getToday());
    }
    if (canvasEndDate && Number(historicalDate) > Number(canvasEndDate)) {
      historicalDate = dateToString(canvasEndDate);
    }
    state.historicalDate = historicalDate;
    if (!state.historicalTime) {
      state.historicalTime = '0000';
    }
    const {
      canvasId,
      canvasSize,
      canvases,
    } = state;
    state.historicalCanvasSize = getHistoricalCanvasSize(
      historicalDate,
      canvasSize,
      canvases[canvasId]?.historicalSizes,
    );
  }
  return state;
}

/**
 * set renderer type
 * @param state
 * @return new state with rendererType set correctly
 */
function setRendererTypeIfNeccessary(state) {
  const canvas = state.canvases[state.canvasId];
  if (!canvas || (
    state.replacementMessage && isIntervalActive(state.replacementInterval))
  ) {
    state.replacementActive = true;
    state.rendererType = CANVAS_TYPES.DUMMY;
  } else {
    state.replacementActive = false;
    state.rendererType = canvas.v ? CANVAS_TYPES.THREED : CANVAS_TYPES.TWOD;
  }
  return state;
}


/**
 * parse canvas data
 * @param canvas object from api/me
 * @param thisPreviousCanvasState from state
 * @return partial canvas specific state
 */
function getCanvasArgs(canvas, thisPreviousCanvasState) {
  const clrIgnore = canvas.cli || 0;
  const {
    size: canvasSize,
    sd: canvasStartDate = null,
    ed: canvasEndDate = null,
    ident: canvasIdent,
    colors,
  } = canvas;

  const palette = new Palette(colors, 0);
  return {
    clrIgnore,
    canvasSize,
    canvasStartDate,
    canvasEndDate,
    canvasIdent,
    palette,
    view: thisPreviousCanvasState?.view || [0, 0, DEFAULT_SCALE],
    selectedColor: thisPreviousCanvasState?.selectedColor || clrIgnore,
    pencilMode: thisPreviousCanvasState?.pencilMode || PENCIL_MODE.COLOR,
  };
}

/**
 * parse url hash and sets view to coordinates
 * @param canvases Object with all canvas information
 * @return incomplete state based on URL, null if failed
 */
function getViewFromURL(canvases, defaultCanvas) {
  const { hash } = window.location;
  const almost = decodeURIComponent(hash).substring(1)
    .split(',');

  let canvasIdent = almost[0];
  let canvasId = getIdFromObject(canvases, canvasIdent);
  if (!canvasId && defaultCanvas) {
    canvasId = defaultCanvas;
  }
  if (!canvasId || (!window.ssv?.backupurl && canvases[canvasId].ed)) {
    canvasId = DEFAULT_CANVAS_ID;
    const canvas = canvases[DEFAULT_CANVAS_ID];
    if (!canvas) {
      return null;
    }
    canvasIdent = canvas.ident;
  }
  const is3D = !!canvases[canvasId].v;

  const x = parseInt(almost[1], 10) || 0;
  const y = parseInt(almost[2], 10) || 0;
  let z = parseInt(almost[3], 10);
  /*
    * third number in 3D is z coordinate
    * in 2D it is logarithmic scale
    */
  if (Number.isNaN(z)) {
    z = (is3D) ? 0 : DEFAULT_SCALE;
  } else if (!is3D) {
    z = 2 ** (z / 10);
  }

  return {
    canvasId,
    canvasIdent,
    view: [x, y, z],
  };
}

const initialState = {
  // canvasId will be a string or null, it can not be a number,
  // because of Object.keys in canvases
  canvasId: null,
  canvasIdent: 'xx',
  canvases: {},
  canvasSize: 65536,
  historicalCanvasSize: 65536,
  rendererType: CANVAS_TYPES.DUMMY,
  canvasStartDate: null,
  defaultCanvas: DEFAULT_CANVAS_ID,
  canvasEndDate: null,
  canvasMaxTiledZoom: getMaxTiledZoom(65536),
  palette: new Palette([[0, 0, 0]]),
  clrIgnore: 0,
  selectedColor: 0,
  /*
   * replacementMessage replaces the canvas, for a school block or similar,
   * String | null
   */
  replacementMessage: null,
  /*
   * interval when the replacementMessage is displayed
   * string HHmm-HHmm | null
   */
  replacementInterval: null,
  /*
   * wheter or not we are currecntly withint eh interval
   */
  replacementActive: false,
  // from where the pencil takes its color from
  pencilMode: PENCIL_MODE.COLOR,
  // view is not up-to-date, changes are delayed compared to renderer.view
  view: [0, 0, DEFAULT_SCALE],
  isHistoricalView: false,
  historicalDate: dateToString(getToday()),
  historicalTime: '0000',
  hover: null,
  // last canvas view and selectedColor
  // just used to get back to the previous state when switching canvases
  // { [canvasId]: { view: [x, y, z], selectedColor: c }, ... }
  prevCanvasState: {},
};

export default function canvasReducer(
  state = initialState,
  action,
) {
  switch (action.type) {
    case 'SET_HISTORICAL_TIME': {
      const {
        date,
        time,
      } = action;
      return fixHistoryIfNeccessary({
        ...state,
        historicalDate: date,
        historicalTime: time,
      });
    }

    case 's/TGL_HISTORICAL_VIEW': {
      if (state.rendererType !== CANVAS_TYPES.TWOD || state.canvasEndDate) {
        return state;
      }
      return fixHistoryIfNeccessary({
        ...state,
        isHistoricalView: !state.isHistoricalView,
      });
    }

    case 'UPDATE_VIEW': {
      const { view } = action;
      const { canvasId } = state;
      return {
        ...state,
        view: [...view],
        prevCanvasState: {
          ...state.prevCanvasState,
          [canvasId]: {
            ...state.prevCanvasState[canvasId],
            view: [...view],
          },
        },
      };
    }

    case 'RELOAD_URL': {
      const { canvases } = state;
      const urlState = getViewFromURL(canvases);
      if (!urlState) {
        return state;
      }
      if (urlState.canvasId !== state.canvasId) {
        const { canvasId } = urlState;
        const canvas = canvases[canvasId];
        const canvasState = getCanvasArgs(
          canvas, state.prevCanvasState[canvasId],
        );
        return setRendererTypeIfNeccessary({
          ...state,
          ...canvasState,
          ...urlState,
        });
      }
      return {
        ...state,
        ...urlState,
      };
    }

    case 'SELECT_COLOR': {
      const { color: selectedColor } = action;
      const { canvasId } = state;
      return {
        ...state,
        selectedColor,
        prevCanvasState: {
          ...state.prevCanvasState,
          [canvasId]: {
            ...state.prevCanvasState[canvasId],
            selectedColor,
          },
        },
      };
    }

    case 'SET_HOVER': {
      const { hover } = action;
      return {
        ...state,
        hover,
      };
    }

    case 'UNSET_HOVER': {
      return {
        ...state,
        hover: null,
      };
    }

    case 's/SELECT_PENCIL_MODE': {
      const pencilMode = action.value;
      const { canvasId } = state;
      return {
        ...state,
        pencilMode,
        prevCanvasState: {
          ...state.prevCanvasState,
          [canvasId]: {
            ...state.prevCanvasState[canvasId],
            pencilMode,
          },
        },
      };
    }

    case 's/SELECT_CANVAS': {
      let { canvasId } = action;
      const {
        canvases,
        prevCanvasState,
        canvasId: prevCanvasId,
      } = state;
      let canvas = canvases[canvasId];
      if (!canvas) {
        canvasId = DEFAULT_CANVAS_ID;
        canvas = canvases[DEFAULT_CANVAS_ID];
      }
      const canvasState = getCanvasArgs(canvas, prevCanvasState[canvasId]);

      return setRendererTypeIfNeccessary(fixHistoryIfNeccessary({
        ...state,
        ...canvasState,
        canvasId,
        // reset if last canvas was retired
        isHistoricalView: (!state.canvasEndDate && state.isHistoricalView),
        // remember canvas specific settings
        prevCanvasState: {
          ...state.prevCanvasState,
          [prevCanvasId]: {
            view: state.view,
            selectedColor: state.selectedColor,
            pencilMode: state.pencilMode,
          },
        },
      }));
    }


    case 's/REC_ME':
    case 's/LOGIN': {
      return setRendererTypeIfNeccessary({
        ...state,
        replacementMessage: action.replacementMessage || null,
        replacementInterval: action.replacementInterval || null,
      });
    }

    case 'UPDATE_INTERVAL_ACTIVE': {
      return setRendererTypeIfNeccessary({ ...state });
    }

    case 's/REC_CANVASES': {
      const { canvases, defaultCanvas } = action;
      let {
        canvasId,
        view,
      } = state;

      if (canvasId === null) {
        ({ canvasId, view } = getViewFromURL(canvases, defaultCanvas));
      }
      const canvas = canvases[canvasId];
      const canvasState = getCanvasArgs(
        canvas, state.prevCanvasState[canvasId],
      );

      return setRendererTypeIfNeccessary(fixHistoryIfNeccessary({
        ...state,
        ...canvasState,
        canvasId,
        canvases,
        defaultCanvas,
        view,
      }));
    }

    default:
      return state;
  }
}

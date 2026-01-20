const initialState = {
  showGrid: false,
  showPixelNotify: false,
  showMvmCtrls: false,
  autoZoomIn: false,
  isPotato: false,
  isLightGrid: false,
  compactPalette: false,
  paletteOpen: true,
  brushOpen: false,
  mute: false,
  chatNotify: true,
  cursor: true,
  // popups that are set to show fullscreen
  fsPopUps: [] as string[],
  // top-left button menu
  menuOpen: false,
  // show online users per canvas instead of total
  onlineCanvas: false,
  // show daily pixels instead o total pixels
  dailyPxls: false,
  // show full pixel number, instead of rounded
  noRound: false,
  // selected theme
  style: 'default',
  // properties that aren't saved
  holdPaint: false,
  brushSize: 1,
  easterEgg: false,
  moveU: 0,
  moveV: 0,
  moveW: 0,
};

export type GuiState = typeof initialState;

export default function gui(
  state = initialState,
  action: {
    // TODO
    type: string;
    value: any;
    style: any;
    windowType: any;
  },
) {
  switch (action.type) {
    case 's/TGL_GRID': {
      return {
        ...state,
        showGrid: !state.showGrid,
      };
    }

    case 's/TGL_PXL_NOTIFY': {
      return {
        ...state,
        showPixelNotify: !state.showPixelNotify,
      };
    }

    case 's/TGL_MVM_CTRLS': {
      return {
        ...state,
        showMvmCtrls: !state.showMvmCtrls,
      };
    }

    case 's/TGL_AUTO_ZOOM_IN': {
      return {
        ...state,
        autoZoomIn: !state.autoZoomIn,
      };
    }

    case 's/TGL_ONLINE_CANVAS': {
      return {
        ...state,
        onlineCanvas: !state.onlineCanvas,
      };
    }

    case 's/TGL_DAILY_PXLS': {
      return {
        ...state,
        dailyPxls: !state.dailyPxls,
      };
    }

    case 's/TGL_NO_ROUND': {
      return {
        ...state,
        noRound: !state.noRound,
      };
    }

    case 's/TGL_POTATO_MODE': {
      return {
        ...state,
        isPotato: !state.isPotato,
      };
    }

    case 's/TGL_LIGHT_GRID': {
      return {
        ...state,
        isLightGrid: !state.isLightGrid,
      };
    }

    case 's/TGL_COMPACT_PALETTE': {
      return {
        ...state,
        compactPalette: !state.compactPalette,
      };
    }

    case 's/TGL_OPEN_PALETTE': {
      return {
        ...state,
        paletteOpen: !state.paletteOpen,
      };
    }

    case 's/TGL_OPEN_BRUSH': {
      return {
        ...state,
        brushOpen: !state.brushOpen,
      };
    }

    case 's/TGL_OPEN_MENU': {
      return {
        ...state,
        menuOpen: !state.menuOpen,
      };
    }

    case 's/TGL_MUTE':
      return {
        ...state,
        mute: !state.mute,
      };

    case 's/TGL_CHAT_NOTIFY':
      return {
        ...state,
        chatNotify: !state.chatNotify,
      };

    case 's/TGL_EASTER_EGG': {
      return {
        ...state,
        easterEgg: !state.easterEgg,
      };
    }

    case 's/TGL_CURSOR': {
      return {
        ...state,
        cursor: !state.cursor,
      };
    }

    case 's/SET_HOLD_PAINT': {
      return {
        ...state,
        holdPaint: action.value,
      };
    }

    case 's/SET_BRUSH_SIZE': {
      return {
        ...state,
        brushSize: action.value,
      };
    }

    case 's/SELECT_STYLE': {
      const { style } = action;
      return {
        ...state,
        style,
      };
    }

    case 'TOGGLE_POPUP_FS': {
      const { windowType } = action;
      const fsPopUps = [...state.fsPopUps];
      const pos = fsPopUps.indexOf(windowType);
      if (pos !== -1) {
        fsPopUps.splice(pos, 1);
      } else {
        fsPopUps.push(windowType);
      }
      return {
        ...state,
        fsPopUps,
      };
    }

    case 'SELECT_COLOR': {
      const {
        compactPalette,
      } = state;
      let {
        paletteOpen,
      } = state;
      if (compactPalette || window.innerWidth < 300) {
        paletteOpen = false;
      }
      return {
        ...state,
        paletteOpen,
      };
    }

    case 's/SELECT_CANVAS': {
      if (!state.holdPaint) {
        return state;
      }
      return {
        ...state,
        holdPaint: false,
      };
    }

    case 's/SET_MOVE_U': {
      const { value } = action;
      const moveU = value;
      return {
        ...state,
        moveU,
      };
    }

    case 's/SET_MOVE_V': {
      const { value } = action;
      const moveV = value;
      return {
        ...state,
        moveV,
      };
    }

    case 's/SET_MOVE_W': {
      const { value } = action;
      const moveW = value;
      return {
        ...state,
        moveW,
      };
    }

    case 's/CANCEL_MOVE': {
      return {
        ...state,
        moveU: 0,
        moveV: 0,
        moveW: 0,
      };
    }

    case 'persist/REHYDRATE':
      return {
        ...state,
        easterEgg: false,
        holdPaint: false,
        moveU: 0,
        moveV: 0,
        moveW: 0,
      };

    default:
      return state;
  }
}

import { t } from 'ttag';

import { FISH_TYPES } from '../../core/constants.ts';

/**
 * @param {{type: string, title: string, message: string, alertType: string, btn: string, retcode?: number }} args
 */
export function pAlert(args) {
  if(typeof arguments[0] === 'object') {
    // новая логика
    return {
      type: 'ALERT',
      btn: t`OK`,
      ...args,
    }
  } else {
    // старая логика для обратной совместимости
    const [
      title,
      message,
      alertType,
      btn = t`OK`,
    ] = Array.from(arguments);

    return {
      type: 'ALERT',
      title,
      message,
      alertType,
      btn,
    };
  }
}

export function pRefresh() {
  return pAlert(t`Change Happened`, t`Please refresh the website`, 'refresh');
}

export function closeAlert() {
  return {
    type: 'CLOSE_ALERT',
  };
}

export function toggleHistoricalView() {
  return {
    type: 's/TGL_HISTORICAL_VIEW',
  };
}

export function toggleEasterEgg() {
  return {
    type: 's/TGL_EASTER_EGG',
  };
}

export function toggleGrid() {
  return {
    type: 's/TGL_GRID',
  };
}

export function togglePixelNotify() {
  return {
    type: 's/TGL_PXL_NOTIFY',
  };
}

export function toggleMvmCtrls() {
  return {
    type: 's/TGL_MVM_CTRLS',
  };
}

export function toggleAutoZoomIn() {
  return {
    type: 's/TGL_AUTO_ZOOM_IN',
  };
}

export function toggleOnlineCanvas() {
  return {
    type: 's/TGL_ONLINE_CANVAS',
  };
}

export function toggleDailyPxls() {
  return {
    type: 's/TGL_DAILY_PXLS',
  };
}

export function toggleNoRound() {
  return {
    type: 's/TGL_NO_ROUND',
  };
}

export function toggleMute() {
  return {
    type: 's/TGL_MUTE',
  };
}

export function toggleCompactPalette() {
  return {
    type: 's/TGL_COMPACT_PALETTE',
  };
}

export function toggleChatNotify() {
  return {
    type: 's/TGL_CHAT_NOTIFY',
  };
}

export function togglePotatoMode() {
  return {
    type: 's/TGL_POTATO_MODE',
  };
}

export function toggleLightGrid() {
  return {
    type: 's/TGL_LIGHT_GRID',
  };
}

export function toggleOpenPalette() {
  return {
    type: 's/TGL_OPEN_PALETTE',
  };
}

export function toggleOpenBrush() {
  return {
    type: 's/TGL_OPEN_BRUSH',
  }
}

export function toggleCursor() {
  return {
    type: 's/TGL_CURSOR',
  };
}

export function setHoldPaint(value, immediate) {
  return {
    type: 's/SET_HOLD_PAINT',
    value,
    immediate,
  };
}

export function setBrushSize(value) {
  return {
    type: 's/SET_BRUSH_SIZE',
    value,
  }
}

export function selectPencilMode(value) {
  return {
    type: 's/SELECT_PENCIL_MODE',
    value,
  };
}

export function selectHoverColor() {
  return {
    type: 'SELECT_HOVER_COLOR',
  };
}

export function selectStyle(style) {
  return {
    type: 's/SELECT_STYLE',
    style,
  };
}

export function toggleOpenMenu() {
  return {
    type: 's/TGL_OPEN_MENU',
  };
}

export function setHover(hover) {
  return {
    type: 'SET_HOVER',
    hover,
  };
}

export function unsetHover() {
  return {
    type: 'UNSET_HOVER',
  };
}

export function setMobile(mobile) {
  return {
    type: 'SET_MOBILE',
    mobile,
  };
}

export function windowResize() {
  return {
    type: 'WIN_RESIZE',
  };
}

export function selectColor(color) {
  return {
    type: 'SELECT_COLOR',
    color,
  };
}

export function selectCanvas(canvasId) {
  // key in javascript objects is always a string
  const canvasIdString = String(canvasId);
  return (dispatch, getState) => {
    if (canvasIdString !== getState().canvas.canvasId) {
      dispatch({
        type: 's/SELECT_CANVAS',
        canvasId: canvasIdString,
      });
    }
  };
}

export function updateView(view) {
  return {
    type: 'UPDATE_VIEW',
    view,
  };
}

export function setViewCoordinates(view) {
  return {
    type: 'SET_VIEW_COORDINATES',
    view,
  };
}

export function setScale(scale, zoompoint) {
  return {
    type: 'SET_SCALE',
    scale,
    zoompoint,
  };
}

export function setMoveU(value) {
  return {
    type: 's/SET_MOVE_U',
    value,
  };
}

export function setMoveV(value) {
  return {
    type: 's/SET_MOVE_V',
    value,
  };
}

export function setMoveW(value) {
  return {
    type: 's/SET_MOVE_W',
    value,
  };
}

export function cancelMove(value) {
  return {
    type: 's/CANCEL_MOVE',
    value,
  };
}

export function requestBigChunk(center) {
  return {
    type: 'REQ_BIG_CHUNK',
    center,
  };
}

export function removeChunks(chunks) {
  return {
    type: 'REMOVE_CHUNKS',
    chunks,
  };
}

export function preLoadedBigChunk(center) {
  return {
    type: 'PRE_LOADED_BIG_CHUNK',
    center,
  };
}

export function receiveBigChunk(chunk) {
  return {
    type: 'REC_BIG_CHUNK',
    chunk,
  };
}

export function receiveBigChunkFailure(chunk, error) {
  return {
    type: 'REC_BIG_CHUNK_FAILURE',
    chunk,
    error,
  };
}

export function parseCanvases() {
  /*
   * can only do this once and requires winsoe.ssv
   */
  const { canvases, defaultCanvas } = window.ssv;
  delete window.ssv.canvases;
  delete window.ssv.defaultCanvas;
  return {
    type: 's/REC_CANVASES',
    canvases,
    defaultCanvas,
  };
}

export function receiveMe(me) {
  return {
    type: 's/REC_ME',
    ...me,
  };
}

export function receiveStats(rankings) {
  const {
    ranking: totalRanking,
    dailyRanking: totalDailyRanking,
    dailyCRanking,
    prevTop,
    onlineStats,
    cHistStats,
    cHourlyStats: cHourlyStatsOrdered,
    histStats,
    pDailyStats,
    pHourlyStats,
    cooldownChanges,
  } = rankings;
  return {
    type: 'REC_STATS',
    totalRanking,
    totalDailyRanking,
    dailyCRanking,
    prevTop,
    onlineStats,
    cHistStats,
    cHourlyStatsOrdered,
    histStats,
    pDailyStats,
    pHourlyStats,
    cooldownChanges,
  };
}

export function sendChatMessage(
  text,
  channel,
) {
  return {
    type: 's/REQ_CHAT_MESSAGE',
    text,
    channel,
  };
}

export function logoutUser(
) {
  return {
    type: 's/LOGOUT',
  };
}

export function loginUser(
  me,
) {
  return {
    type: 's/LOGIN',
    ...me,
  };
}

export function setName(name, username) {
  return {
    type: 's/SET_NAME',
    name,
    username,
  };
}

export function setHavePassword(
  havePassword,
) {
  return {
    type: 's/SET_HAVE_PASSWORD',
    havePassword,
  };
}

export function remFromMessages(
  message,
) {
  return {
    type: 's/REM_FROM_MESSAGES',
    message,
  };
}

export function markChannelAsRead(
  cid,
) {
  return {
    type: 'MARK_CHANNEL_AS_READ',
    cid,
  };
}

export function catchedFish(success, type, size) {
  return (dispatch, getState) => {
    if (getState().user.fish.size) {
      if (success) {
        dispatch(pAlert(
          t`Phish!`,
          // eslint-disable-next-line max-len
          t`You caught a Phish! It is a ${FISH_TYPES[type].name} with ${size}kg! As a bonus, your cooldown is reduced.`,
          'info',
        ));
      } else {
        dispatch(pAlert(
          t`No Phish!`,
          t`Oh no, the phish escaped. Better luck next time!`,
          'error',
        ));
      }
    }
    dispatch({
      type: 'FISH_CATCHED', success, fishType: type, size,
    });
  };
}

export function fishAppears(type, size) {
  return (dispatch) => {
    dispatch({
      type: 'FISH_APPEARS', fishType: type, size,
    });
    setTimeout(() => {
      dispatch({
        type: 'FISH_VANISHES',
      });
    }, 22000);
  };
}

export function blockUser(userId, userName) {
  return {
    type: 's/BLOCK_USER',
    userId,
    userName,
  };
}

export function unblockUser(userId, userName) {
  return {
    type: 's/UNBLOCK_USER',
    userId,
    userName,
  };
}

export function blockingDm(blockDm) {
  return {
    type: 's/SET_BLOCKING_DM',
    blockDm,
  };
}

export function privatize(priv) {
  return {
    type: 's/SET_PRIVATE',
    priv,
  };
}

export function muteChatChannel(cid) {
  return {
    type: 's/MUTE_CHAT_CHANNEL',
    cid,
  };
}

export function unmuteChatChannel(cid) {
  return {
    type: 's/UNMUTE_CHAT_CHANNEL',
    cid,
  };
}

export function selectHistoricalTime(date, time) {
  return {
    type: 'SET_HISTORICAL_TIME',
    date,
    time,
  };
}

export function urlChange() {
  return {
    type: 'RELOAD_URL',
  };
}

export function unload() {
  return {
    type: 't/UNLOAD',
  };
}

export function load() {
  return {
    type: 't/LOAD',
  };
}

export function propagateMe(state) {
  const {
    id,
    name,
    username,
    havePassword,
    blockDm,
    userlvl,
  } = state.user;
  const {
    blocked,
    channels,
  } = state.chat;
  const {
    ranking,
    dailyRanking,
    totalPixels,
    dailyTotalPixels,
  } = state.ranks;
  return {
    type: 's/REC_ME',
    blockDm,
    blocked,
    channels,
    dailyRanking,
    dailyTotalPixels,
    id,
    havePassword,
    name,
    username,
    ranking,
    totalPixels,
    userlvl,
  };
}

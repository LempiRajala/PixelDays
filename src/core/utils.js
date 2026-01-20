
import {
  TILE_SIZE,
  THREE_TILE_SIZE,
  TILE_ZOOM_LEVEL,
  FISH_BONUS_MAX_DURATION,
} from './constants.ts';

/**
 * http://stackoverflow.com/questions/4467539/javascript-modulo-not-behaving
 * @param n
 * @param m
 * @returns {number} remainder
 */
export function mod(n, m) {
  return ((n % m) + m) % m;
}

/*
 * returns random integer
 * @param min Minimum of random integer
 * @param max Maximum of random integer
 * @return random integer between min and max (min <= ret <= max)
 */
export function getRandomInt(min, max) {
  const range = max - min + 1;
  return min + (Math.floor(Math.random() * range));
}

/*
 * generates random string with a-z,0-9
 * 11 chars length
 */
export function getRandomString() {
  return Math.random().toString(36).substring(2, 15);
}

/*
 * generate random string with a-zz
 * 6 chars length
 */
export function getRandomShortId(length = 6) {
  let output = '';
  while (length) {
    length -= 1;
    output += String.fromCharCode(97 + Math.floor(Math.random() * 26));
  }
  return output;
}

export function distMax([x1, y1], [x2, y2]) {
  return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
}

export function clamp(n, min, max) {
  return Math.max(min, Math.min(n, max));
}

/*
 * convert YYYY-MM-DD to YYYYMMDD
 */
export function dateToString(date) {
  return date.substring(0, 4) + date.substring(5, 7) + date.substring(8);
}

/*
 * convert YYYYMMDD to YYYY-MM-DD
 */
export function stringToDate(dateString) {
  if (!dateString) return '';
  // eslint-disable-next-line max-len
  return `${dateString.substring(0, 4)}-${dateString.substring(4, 6)}-${dateString.substring(6)}`;
}

/*
 * convert hhmm to hh:mm
 */
export function stringToTime(timeString) {
  if (!timeString) return '00:00';
  return `${timeString.substring(0, 2)}:${timeString.substring(2)}`;
}

/*
 * get current UTC date in YYYY-MM-DD
 */
export function getToday() {
  const date = new Date();
  let day = date.getUTCDate();
  let month = date.getUTCMonth() + 1;
  if (month < 10) month = `0${month}`;
  if (day < 10) day = `0${day}`;
  return `${date.getUTCFullYear()}-${month}-${day}`;
}

// z is assumed to be height here
// in ui and renderer, y is height
export function getChunkOfPixel(
  canvasSize,
  x,
  y,
  z = null,
) {
  const tileSize = (z === null) ? TILE_SIZE : THREE_TILE_SIZE;
  const width = (z == null) ? y : z;
  const cx = Math.floor((x + (canvasSize / 2)) / tileSize);
  const cy = Math.floor((width + (canvasSize / 2)) / tileSize);
  return [cx, cy];
}

// get coordinates of top-left corner of chunk
export function getCornerOfChunk(
  canvasSize,
  i,
  j,
  is3d = false,
) {
  const tileSize = (is3d) ? THREE_TILE_SIZE : TILE_SIZE;
  const x = (i * tileSize) - (canvasSize / 2);
  const y = (j * tileSize) - (canvasSize / 2);
  return [x, y, 0];
}

export function getTileOfPixel(
  tileScale,
  pixel,
  canvasSize = null,
) {
  return pixel.map(
    (x) => Math.floor((x + canvasSize / 2) / TILE_SIZE * tileScale),
  );
}

export function getMaxTiledZoom(canvasSize) {
  if (!canvasSize) return 0;
  return Math.log2(canvasSize / TILE_SIZE) / Math.log2(TILE_ZOOM_LEVEL);
}

export function getHistoricalCanvasSize(
  historicalDate,
  canvasSize,
  historicalSizes,
) {
  if (historicalDate && historicalSizes) {
    let i = historicalSizes.length;
    let chosenSize = canvasSize;
    let chosenDate = Infinity;
    while (i > 0) {
      i -= 1;
      const [cutoffDate, size] = historicalSizes[i];
      if (historicalDate <= cutoffDate && cutoffDate < chosenDate) {
        chosenSize = size;
        chosenDate = cutoffDate;
      }
    }
    return chosenSize;
  }
  return canvasSize;
}

export function getCanvasBoundaries(canvasSize) {
  const canvasMinXY = -canvasSize / 2;
  const canvasMaxXY = canvasSize / 2 - 1;
  return [canvasMinXY, canvasMaxXY];
}

// z is assumed to be height here
// in ui and renderer, y is height
export function getOffsetOfPixel(
  canvasSize,
  x,
  y,
  z = null,
) {
  const tileSize = (z === null) ? TILE_SIZE : THREE_TILE_SIZE;
  const width = (z == null) ? y : z;
  let offset = (z === null) ? 0 : (y * tileSize * tileSize);
  const modOffset = mod((canvasSize / 2), tileSize);
  const cx = mod(x + modOffset, tileSize);
  const cy = mod(width + modOffset, tileSize);
  offset += (cy * tileSize) + cx;
  return offset;
}

/*
 * Searches Object for element with ident string and returns its key
 * Used for getting canvas id from given ident-string (see canvases.json)
 * @param obj Object
 * @param ident ident string
 * @return key
 */
export function getIdFromObject(obj, ident) {
  const ids = Object.keys(obj);
  for (let i = 0; i < ids.length; i += 1) {
    const key = ids[i];
    if (obj[key].ident === ident) {
      return key;
    }
  }
  return null;
}

// z is returned as height here
// in ui and renderer, y is height
export function getPixelFromChunkOffset(
  i,
  j,
  offset,
  canvasSize,
  is3d = false,
) {
  const tileSize = (is3d) ? THREE_TILE_SIZE : TILE_SIZE;
  const cx = offset % tileSize;
  const off = offset - cx;
  let cy = off % (tileSize * tileSize);
  const z = (is3d) ? (off - cy) / tileSize / tileSize : null;
  cy /= tileSize;

  const devOffset = canvasSize / 2 / tileSize;
  const x = ((i - devOffset) * tileSize) + cx;
  const y = ((j - devOffset) * tileSize) + cy;
  return [x, y, z];
}

export function getCellInsideChunk(
  canvasSize,
  pixel,
) {
  return pixel.map((x) => mod(x + canvasSize / 2, TILE_SIZE));
}

export function screenToWorld(
  view,
  scale,
  $viewport,
  [x, y],
) {
  const [viewX, viewY] = view;
  const { width, height } = $viewport;
  return [
    ((x - (width / 2)) / scale) + viewX,
    ((y - (height / 2)) / scale) + viewY,
  ];
}

export function worldToScreen(
  view,
  scale,
  $viewport,
  [x, y],
) {
  const [viewX, viewY] = view;
  const { width, height } = $viewport;
  return [
    ((x - viewX) * scale) + (width / 2),
    ((y - viewY) * scale) + (height / 2),
  ];
}

/*
 * parses duration to string
 * in xx:xx format with min:sec
 */
export function durationToString(
  ms,
  smallest = false,
) {
  const seconds = Math.ceil(ms / 1000);
  let timestring;
  if (seconds < 60 && smallest) {
    timestring = seconds;
  } else {
    // eslint-disable-next-line max-len
    timestring = `${Math.floor(seconds / 60)}:${(`0${seconds % 60}`).slice(-2)}`;
  }
  return timestring;
}

/*
 * parses a large duration to
 * [x]h [y]min [z]sec format
 */
export function largeDurationToString(
  ts,
) {
  const seconds = ts % 60;
  let durs = (ts - seconds) / 60;
  const minutes = durs % 60;
  durs = (durs - minutes) / 60;
  const hours = durs % 24;
  durs = (durs - hours) / 24;
  const days = durs;
  let out = '';
  if (days) {
    out += ` ${days}d`;
  }
  if (hours) {
    out += ` ${hours}h`;
  }
  if (minutes) {
    out += ` ${minutes}min`;
  }
  if (seconds) {
    out += ` ${seconds}s`;
  }
  return out;
}

const postfix = ['k', 'M', 'B'];
export function numberToString(num, zero = '0') {
  if (!num) {
    return zero;
  }
  if (num < 1000) {
    return num;
  }
  let postfixNum = 0;
  while (postfixNum < postfix.length) {
    if (num < 10000) {
      // eslint-disable-next-line max-len
      return `${Math.floor(num / 1000)}.${(`0${Math.floor((num % 1000) / 10)}`).slice(-2)}${postfix[postfixNum]}`;
    } if (num < 100000) {
      // eslint-disable-next-line max-len
      return `${Math.floor(num / 1000)}.${Math.floor((num % 1000) / 100)}${postfix[postfixNum]}`;
    } if (num < 1000000) {
      return Math.floor(num / 1000) + postfix[postfixNum];
    }
    postfixNum += 1;
    num = Math.round(num / 1000);
  }
  return '';
}

export function numberToStringFull(num, zero = '0') {
  if (!num) {
    return zero;
  }
  const isNegative = (num < 0);
  const numStr = String(Math.abs(num));
  const posDecimal = numStr.indexOf('.');
  let final = '';
  let i = numStr.length;
  if (posDecimal !== -1) {
    final = numStr.substring(posDecimal);
    i = posDecimal;
  }
  let s = i - 3;
  final = numStr.substring(s, i) + final;
  i = s;
  while (i > 0) {
    s = i - 3;
    final = `${numStr.substring(s, i)} ${final}`;
    i = s;
  }
  if (isNegative) {
    final = `-${final}`;
  }
  return final;
}

/*
 * create a simple hash from a string
 */
export function simpleHash(str) {
  if (!str) return '0';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  if (hash < 0) hash >>>= 0;
  return hash.toString(16).toUpperCase();
}

/*
 * generates a color based on a given string
 */
export function colorFromText(str) {
  return `#${`00000${simpleHash(str)}`.slice(-6)}`;
}

/*
 * sets a color into bright or dark mode
 */
export function setBrightness(hex, dark = false) {
  hex = hex.replace(/^\s*#|\s*$/g, '');

  if (hex.length === 3) {
    hex = hex.replace(/(.)/g, '$1$1');
  }

  let r = Math.floor(parseInt(hex.substring(0, 2), 16) / 2);
  let g = Math.floor(parseInt(hex.substring(2, 4), 16) / 2);
  let b = Math.floor(parseInt(hex.substring(4, 6), 16) / 2);
  if (dark) {
    r += 128;
    g += 128;
    b += 128;
  }
  r = `0${r.toString(16)}`.slice(-2);
  g = `0${g.toString(16)}`.slice(-2);
  b = `0${b.toString(16)}`.slice(-2);
  return `#${r}${g}${b}`;
}

/*
 * escape string for use in markdown
 */
export function escapeMd(string) {
  const toEscape = ['\\', '[', ']', '(', ')', '*', '~', '+', '_', '\n'];
  let result = '';
  let ss = 0;
  for (let c = 0; c < string.length; c += 1) {
    const chr = string[c];
    if (toEscape.includes(chr)) {
      result += `${string.slice(ss, c)}\\`;
      ss = c;
    }
  }
  if (ss === 0) {
    return string;
  }
  result += string.slice(ss);
  return result;
}

/*
 * escape string for use in regexp
 * @param string input string
 * @return escaped string
 */
export function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

/*
 * check if webGL2 is available
 * @return boolean true if available
 */
export function isWebGL2Available() {
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && canvas.getContext('webgl2'));
  } catch {
    return false;
  }
}

/*
 * gets a descriptive text of the domain of the link
 * Example:
 *  https://www.youtube.com/watch?v=G8APgeFfkAk returns 'youtube'
 *  http://www.google.at returns 'google.at'
 *  (www. and .com are split)
 */
export function getLinkDesc(link) {
  let domainStart = link.indexOf('://') + 3;
  if (domainStart < 3) {
    domainStart = 0;
  }
  if (link.startsWith('www.', domainStart)) {
    domainStart += 4;
  }
  let domainEnd = link.indexOf('/', domainStart);
  if (domainEnd === -1) {
    domainEnd = link.length;
  }
  if (link.endsWith('.com', domainEnd)) {
    domainEnd -= 4;
  }
  if (domainEnd <= domainStart) {
    return link;
  }
  return link.slice(domainStart, domainEnd);
}

/*
 * try to get extension out of link
 * @param link url
 * @return extension or null if not available
 */
export function getExt(link) {
  let paramStart = link.indexOf('&');
  if (paramStart === -1) {
    paramStart = link.length;
  }
  let posDot = paramStart - 1;
  for (;posDot >= 0 && link[posDot] !== '.'; posDot -= 1) {
    if (link[posDot] === '/') {
      return null;
    }
  }
  posDot += 1;
  if (paramStart - posDot > 4) {
    return null;
  }
  return link.slice(posDot, paramStart);
}

/*
 * Split query part from link
 * @param link url
 * @return link without query
 */
export function stripQuery(link) {
  let posAnd = link.indexOf('?');
  if (posAnd === -1) posAnd = link.indexOf('#');
  return (posAnd === -1) ? link : link.substring(0, posAnd);
}

/*
 * convert timestamp to human readable date/time string
 * @param timestamp Unix timestamp in seconds
 * @return descriptive string of time
 */
export function getDateTimeString(timestamp) {
  const curDate = new Date();
  const date = new Date(timestamp * 1000);
  if (date.getDate() !== curDate.getDate()) {
    return date.toLocaleString();
  }
  return date.toLocaleTimeString();
}

/*
 * get X_Y coordinates out of url or x_y or x,y string
 * @param url url ending with #canas,x,y,z coords
 * @return coordinates in [x,y] array or null
 */
export function coordsFromString(url) {
  let splitInd = url.lastIndexOf('#');
  let coords = [];
  if (splitInd !== -1) {
    let part = url.slice(splitInd + 1);
    splitInd = part.indexOf('?');
    if (splitInd !== -1) {
      part = part.slice(0, splitInd);
    }
    coords = part.split(',').map((z) => parseInt(z, 10)).slice(1, 3);
  }
  if (coords.length !== 2 || coords.some(Number.isNaN)) {
    coords = url.split('_').map((z) => parseInt(z, 10));
  }
  if (coords.length !== 2 || coords.some(Number.isNaN)) {
    coords = url.split(',').map((z) => parseInt(z, 10));
  }
  if (coords.length !== 2 || coords.some(Number.isNaN)) {
    coords = null;
  }
  return coords;
}

/**
 * parse interval in s/m/h form to timestamp
 * @param interval string like "2d"
 * @return duration in ms
 */
export function parseInterval(interval) {
  if (!interval) {
    return 0;
  }
  const lastChar = interval.slice(-1).toLowerCase();
  const num = parseInt(interval.slice(0, -1), 10);
  if (Number.isNaN(num) || num <= 0 || num > 600
    || !['s', 'm', 'h', 'd'].includes(lastChar)) {
    return 0;
  }
  let factor = 1000;
  if (lastChar === 'm') {
    factor *= 60;
  } else if (lastChar === 'h') {
    factor *= 3600;
  } else if (lastChar === 'd') {
    factor *= 3600 * 24;
  }
  return (num * factor);
}

/*
 * combines tables
 * a tables is an object with {
 *   columns: Array,
 *   types: Array,
 *   rows: Array,
 * }
 */
export function combineTables(a, b) {
  let bTable;
  if (a.columns.length === b.columns.length) {
    a.rows = a.rows.concat(b.rows);
    bTable = a;
  } else {
    let sTable;
    if (a.columns.length < b.columns.length) {
      bTable = b;
      sTable = a;
    } else {
      bTable = a;
      sTable = b;
    }
    if (!sTable.rows.length) {
      return bTable;
    }
    const newRows = [];
    for (let i = 0; i < sTable.rows.length; i += 1) {
      newRows.push([]);
    }
    for (let i = 0; i < bTable.columns.length; i += 1) {
      const colInd = sTable.columns.indexOf(bTable.columns[i]);
      if (~colInd) {
        for (let u = 0; u < sTable.rows.length; u += 1) {
          newRows[u].push(sTable.rows[u][colInd]);
        }
      } else {
        for (let u = 0; u < sTable.rows.length; u += 1) {
          newRows[u].push(null);
        }
      }
    }
    bTable.rows = bTable.rows.concat(newRows);
  }
  if (bTable.columns[0] === 'rid') {
    // make sure that row-ids are unique
    bTable.rows.forEach((row, i) => { row[0] = i; });
  }
  const amountCol = bTable.columns.indexOf('#');
  if (~amountCol) {
    // sum amounts of duplicates if possible
    let sumCol = bTable.columns.indexOf('canvas');
    if (sumCol === -1) sumCol = bTable.columns.indexOf('ipString');
    if (~sumCol) {
      const timeCol = bTable.columns.indexOf('time');
      for (let i = 0; i < bTable.rows.length; i += 1) {
        const aCol = bTable.rows[i];
        const val = aCol[sumCol];
        if (val && val !== 'N/A') {
          for (let u = i + 1; u < bTable.rows.length; u += 1) {
            const bCol = bTable.rows[u];
            if (bCol[sumCol] === val) {
              const amount = aCol[amountCol] + bCol[amountCol];
              if (~timeCol && aCol[timeCol] < bCol[timeCol]) {
                bTable.rows[i] = bCol;
              }
              bTable.rows.splice(u, 1);
              bTable.rows[i][amountCol] = amount;
              u -= 1;
            }
          }
        }
      }
    }
  }
  return bTable;
}

/*
 * combine two similar objects
 */
export function combineObjects(a, b) {
  if (!b) {
    return a;
  }
  if (!a) {
    return b;
  }
  if (Array.isArray(a)) {
    return a.concat(b);
  }
  if (typeof a === 'object') {
    const keys = Object.keys(a);
    if (keys.includes('columns')) {
      return combineTables(a, b);
    }
    keys.forEach((key) => {
      const u = a[key];
      const v = b[key];
      a[key] = combineObjects(u, v);
    });
    return a;
  }
  return a + b;
}

/*
 * combine two similar objects, replacing values, prefering b
 */
export function shallowCombineObjects(a, b) {
  if (typeof b === 'undefined') {
    return a;
  }
  if (typeof a === 'undefined') {
    return b;
  }
  if (!Array.isArray(a) && typeof a === 'object' && typeof a === typeof b) {
    Object.keys(a).forEach((key) => {
      const u = a[key];
      const v = b[key];
      a[key] = shallowCombineObjects(u, v);
    });
    Object.keys(b).forEach((key) => {
      if (!a[key]) {
        a[key] = b[key];
      }
    });
    return a;
  }
  return b;
}

/*
 * get YYYYMMDD of timestamp
 */
export function getDateKeyOfTs(ts) {
  const date = new Date(ts);
  let day = date.getUTCDate();
  if (day < 10) day = `0${day}`;
  let month = date.getUTCMonth() + 1;
  if (month < 10) month = `0${month}`;
  const year = date.getUTCFullYear();
  return `${year}${month}${day}`;
}

/*
 * get largest distance between axes of array
 */
export function getDiff(arr1, arr2) {
  let largest = 0;
  for (let i = 0; i < arr1.length; i += 1) {
    const length = Math.abs(arr1[i] - arr2[i]);
    if (length > largest) {
      largest = length;
    }
  }
  return largest;
}

/*
 * get screen coords of touch / mouse event
 * @param event MouseEvent or TouchEvent
 * @return [x, y] in screen coordinates
 */
export function getTapOrClickCenter(event) {
  if (event instanceof TouchEvent) {
    const touches = (event.touches.length)
      ? event.touches : event.changedTouches;
    let x = 0;
    let y = 0;
    for (const { pageX, pageY } of touches) {
      x += pageX;
      y += pageY;
    }
    const { length } = touches;
    return [x / length, y / length];
  }
  return [
    event.clientX,
    event.clientY,
  ];
}

/*
 * convert rgb to grayscale
 * @param rgb [r, g, b]
 * @return [g, g, g]
 */
export function rgbToGray(rgb) {
  const gray = Math.round(rgb.reduce((a, b) => a + b) / 3);
  const [r, g, b] = rgb;
  let lastG = gray;
  if (r < g) {
    if (gray < 255) lastG += 1;
  } else if (r > g) {
    if (gray > 0) lastG -= 1;
  }
  let secondG = gray;
  if (r < b) {
    if (gray < 255) secondG += 1;
  } else if (r > b) {
    if (gray > 0) secondG -= 1;
  }
  let firstG = gray;
  if (g < b) {
    if (gray < 255) firstG += 1;
  } else if (g > b) {
    if (gray > 0) firstG -= 1;
  }
  return [firstG, secondG, lastG];
}

/**
 * check if parent window exists and
 * is accessible
 */
export function parentExists() {
  try {
    return !(!window.opener
      || window.opener.closed
      || !window.opener.location
      || window.opener.location.origin !== window.location.origin);
  } catch {
    return false;
  }
}

/**
 * check if current time is in interval
 * @param interval string describing an interval | null
 * @param gracePeriode grace periode in minutes
 * @return boolean
 */
export function isIntervalActive(interval, gracePeriode = 0) {
  if (!interval || interval.length !== 9) {
    return false;
  }
  const currentDate = new Date();
  const currentDay = currentDate.getUTCDay();
  if (currentDay === 0 || currentDay === 6) {
    return false;
  }
  /* eslint-disable max-len */
  const currentMinutes = currentDate.getUTCHours() * 60 + currentDate.getUTCMinutes();

  const startMinutes = parseInt(interval.substring(0, 2), 10) * 60 + parseInt(interval.substring(2, 4), 10);
  if (currentMinutes < startMinutes + gracePeriode) {
    return false;
  }

  const endMinutes = parseInt(interval.substring(5, 7), 10) * 60 + parseInt(interval.substring(7), 10);
  if (currentMinutes + gracePeriode > endMinutes) {
    return false;
  }
  /* eslint-enable max-len */

  return true;
}

/**
 * calculate duration of reduced cooldown for fish caught
 */
export function calculateFishBonusDuration(size) {
  return Math.floor(size / 25 * FISH_BONUS_MAX_DURATION);
}

/**
 * take an email or other identifier string and censor it
 * @param identifier string of email or third party id or whatever
 * @return censored identifier with most characters replaced by x
 */
export function censorIdentifier(identifier) {
  if (!identifier?.length) {
    return identifier;
  }
  const atIndex = identifier.indexOf('@');
  const dotIndex = identifier.lastIndexOf('.');
  if (atIndex === -1 || atIndex < 3
    || atIndex > identifier.length - 2 || dotIndex < atIndex + 3
  ) {
    const i = Math.ceil(identifier.length / 4);
    return identifier.substring(0, i + 1) + 'x'.repeat(identifier.length - i);
  }
  return identifier.charAt(0)
    + 'x'.repeat(atIndex - 2)
    + identifier.substring(atIndex - 1, atIndex + 2)
    + 'x'.repeat(dotIndex - atIndex - 3)
    + identifier.substring(dotIndex - 1);
}

/**
 * base64 operations
 */

export function bufferToBase64(array) {
  return new Promise((resolve) => {
    const blob = new Blob([array]);
    const reader = new FileReader();

    reader.onload = (event) => {
      const dataUrl = event.target.result;
      const [, base64] = dataUrl.split(',');

      resolve(base64);
    };

    reader.readAsDataURL(blob);
  });
}

export async function base64ToBuffer(base64) {
  const dataUrl = `data:application/octet-binary;base64,${base64}`;
  const res = await fetch(dataUrl);
  return res.arrayBuffer();
}

/*
 * create url to media file by shortid and extension
 */
export function constructMediaUrl(shortId, extension, filename) {
  const name = filename.substring(0, filename.lastIndexOf('.'));
  return `/m/${shortId}/${name}.${extension}`;
}
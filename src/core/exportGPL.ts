/*
 * export palette in gimp format
 */

import type { Vec3 } from "../types";

function appendNumberText(value: number) {
  let appendStr = `${value} `;
  if (value < 10) appendStr += '  ';
  else if (value < 100) appendStr += ' ';
  return appendStr;
}
function appendHexColorText(clr: Vec3<number>) {
  let appendStr = ' #';
  clr.forEach((z) => {
    if (z < 16) appendStr += '0';
    appendStr += z.toString(16);
  });
  return appendStr;
}


function printGIMPPalette(title: string, description: string, colors: Vec3<number>[]) {
  let text = `GIMP Palette
#Palette Name: Pixelplanet${title}
#Description: ${description}
#Colors: ${colors.length}`;
  colors.forEach((clr) => {
    text += '\n';
    clr.forEach((z) => {
      text += appendNumberText(z);
    });
    text += appendHexColorText(clr);
  });
  return text;
}

export default printGIMPPalette;

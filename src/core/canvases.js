import path from 'path';
import { existsSync, readFileSync } from 'fs';

const bundlePath = path.resolve(__dirname, './canvases.json');
const devPath = path.join(__dirname, '../canvases.json');

let canvases;
if(existsSync(bundlePath)) {
  canvases = JSON.parse(readFileSync(bundlePath));
} else {
  canvases = JSON.parse(readFileSync(devPath));
}

export const defaultCanvasForCountry = {};
(function populateDefaultCanvases() {
  for (const [canvasId, canvas] of Object.entries(canvases)) {
    canvas.dcc?.forEach(
      (country) => {
        defaultCanvasForCountry[country.toLowerCase()] = canvasId;
      },
    );
  }
}());

export default canvases;

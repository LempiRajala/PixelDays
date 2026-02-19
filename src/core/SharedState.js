/*
 * A game-wide state shared between shards and saved to disk, must be
 * serializable.
 * It should be used for settings or similar. Don't pound it too hard.
 */
import fs from 'fs';
import path from 'path';

import socketEvents from '../socket/socketEvents.js';
import { shallowCombineObjects } from './utils.js';

/** @type any */
let state = {};

function loadStateFromFile() {
  const file = path.resolve('state.json');
  if (!fs.existsSync(file)) {
    return;
  }
  let fileState;
  try {
    fileState = JSON.parse(fs.readFileSync(file));
  } catch (error) {
    console.error(`SharedState loadStateFromFile: Error ${error.message}`);
    return;
  }
  state = shallowCombineObjects(state, fileState);
}

loadStateFromFile();

function writeStateToFile() {
  const file = path.resolve('state.json');
  try {
    fs.writeFileSync(file, JSON.stringify(state));
  } catch (error) {
    console.error(`SharedState writeStateToFile: Error ${error.message}`);
  }
}

export function setState(stateUpdate) {
  socketEvents.updateSharedState(stateUpdate);
}

export function getState() {
  return state;
}

socketEvents.on('sharedstate', (stateUpdate) => {
  console.log('SharedState received update');
  state = shallowCombineObjects(state, stateUpdate);
  if (socketEvents.important) {
    writeStateToFile();
  }
});

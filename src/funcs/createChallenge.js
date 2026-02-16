/* eslint-disable max-len */
const i32Max = 0xFFFFFFFF;

function createChallenge(randomInt, randomStr, compileWat) {
  const solution = randomInt(i32Max);
  const wat = `(module (func (export "run") (result i32) i32.const ${solution}))`;
  const buffer = compileWat(wat);

  const data = `/* @license magnet:?xt=urn:btih:0b31508aeb0634b347b8270c7bee4d411b5d4109&dn=agpl-3.0.txt AGPL-3.0-or-later */
w = new Uint8Array([${buffer.toString()}]);
WebAssembly.instantiate(w).then(wasmModule => {
  postMessage(wasmModule.instance.exports.run());
});
/* @license-end */`;

  return {
    solution: solution & i32Max,
    data,
  };
}

export default createChallenge;
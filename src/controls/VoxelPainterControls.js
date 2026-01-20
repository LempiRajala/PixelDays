/**
 * Original from OrbitControl of the three.js package from
 *
 * @author qiao / https://github.com/qiao
 * @author mrdoob / http://mrdoob.com
 * @author alteredq / http://alteredqualia.com/
 * @author WestLangley / http://github.com/WestLangley
 * @author erich666 / http://erichaines.com
 * @author ScieCode / http://github.com/sciecode
 *
 * Changed for pixelplanet by
 *
 * @author hf / http://git.pixelplanet.fun/hf
 */

/* eslint-disable no-console */

import {
  MOUSE,
  Quaternion,
  Spherical,
  TOUCH,
  Vector2,
  Vector3,
} from 'three';
import {
  THREE_CANVAS_HEIGHT,
  VIEW_UPDATE_DELAY,
} from '../core/constants.ts';
import {
  getDiff,
  getTapOrClickCenter,
} from '../core/utils.js';
import {
  selectHoverColor,
} from '../store/actions/index.js';

const STORE_UPDATE_DELAY = VIEW_UPDATE_DELAY / 2;
// Mouse buttons
const MOUSE_BUTTONS = {
  LEFT: MOUSE.ROTATE,
  MIDDLE: MOUSE.DOLLY,
  RIGHT: MOUSE.PAN,
};
// Touch fingers
const TOUCHES = {
  ONE: TOUCH.ROTATE,
  TWO: TOUCH.DOLLY_PAN,
};
//
const STATE = {
  NONE: -1,
  ROTATE: 0,
  DOLLY: 1,
  PAN: 2,
  TOUCH_ROTATE: 3,
  TOUCH_PAN: 4,
  TOUCH_DOLLY_PAN: 5,
  TOUCH_DOLLY_ROTATE: 6,
};

/*
 * configuration
 */

// How far you can dolly in and out
const minDistance = 0;
const maxDistance = Infinity;
// How far you can orbit vertically, upper and lower limits.
// Range is 0 to Math.PI radians.
const minPolarAngle = 0; // radians
// const maxPolarAngle = Math.PI / 2; // don't allow going underground
const maxPolarAngle = Math.PI; // radians
// How far you can orbit horizontally, upper and lower limits.
// If set, must be a sub-interval of the interval [ - Math.PI, Math.PI ].
const minAzimuthAngle = -Infinity; // radians
const maxAzimuthAngle = Infinity; // radians
// This option actually enables dollying in and out; left as "zoom" for backwards compatibility.
// Set to false to disable zooming
const enableZoom = true;
const zoomSpeed = 1.0;
// Set to false to disable rotating
const enableRotate = true;
const rotateSpeed = 1.0;
// Set to false to disable panning
const enablePan = true;
const panSpeed = 1.0;
const screenSpacePanning = true; // if true, pan in screen-space

// This set of controls performs orbiting, dollying (zooming),
// and panning and smooth moving by keys.
//
//    Orbit - left mouse / touch: one-finger move
//    Zoom - middle mouse, or mousewheel / touch: two-finger spread or squish
//    Pan - right mouse, or left mouse + ctrl/meta/shiftKey,
//          or arrow keys / touch: two-finger move

class VoxelPainterControls {
  store;
  camera;
  renderer;
  domElement;
  state;
  // "target" sets the location of focus, where the object orbits around
  target;
  //
  // internals
  //
  // current position in spherical coordinates
  spherical = new Spherical();
  sphericalDelta = new Spherical();
  //
  scale = 1;
  panOffset = new Vector3();
  rotateStart = new Vector2();
  rotateEnd = new Vector2();
  rotateDelta = new Vector2();
  panStart = new Vector2();
  panEnd = new Vector2();
  panDelta = new Vector2();
  dollyStart = new Vector2();
  dollyEnd = new Vector2();
  dollyDelta = new Vector2();
  // temp
  v = new Vector3();
  // temp for update
  quat;
  quatInverse;
  storeViewInStateTime = Date.now();
  prevTime = Date.now();
  offset = new Vector3();
  velocity = new Vector3();
  vec = new Vector3();
  // forcing next update
  forceNextUpdate = false;
  // start of touch or click
  clickTapStartTime = 0;
  // on touch: true if current tab was ever more than one figher at any time
  wasEverMultiTap = false;
  // screen coords of where a tap/click started
  clickTapStartCoords = [0, 0];
  // on touch: timeout to detect long-press
  tapTimeout = null;

  constructor(renderer, camera, target, domElement, store) {
    this.renderer = renderer;
    this.camera = camera;
    this.domElement = domElement;
    this.store = store;
    //
    this.target = target;
    //
    this.state = STATE.NONE;

    this.onContextMenu = this.onContextMenu.bind(this);
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
    this.onMouseWheel = this.onMouseWheel.bind(this);
    this.onTouchStart = this.onTouchStart.bind(this);
    this.onTouchEnd = this.onTouchEnd.bind(this);
    this.onTouchMove = this.onTouchMove.bind(this);

    this.domElement.addEventListener('contextmenu', this.onContextMenu, false);
    this.domElement.addEventListener('mousedown', this.onMouseDown, false);
    this.domElement.addEventListener('wheel', this.onMouseWheel, false);
    this.domElement.addEventListener('touchstart', this.onTouchStart, false);
    this.domElement.addEventListener('touchend', this.onTouchEnd, false);
    this.domElement.addEventListener('touchmove', this.onTouchMove, false);

    // make sure element can receive keys.
    if (this.domElement.tabIndex === -1) {
      this.domElement.tabIndex = 0;
    }

    // so camera.up is the orbit axis
    this.quat = new Quaternion()
      .setFromUnitVectors(camera.up, new Vector3(0, 1, 0));
    this.quatInverse = this.quat.clone().invert();
  }

  dispose() {
    const { domElement } = this;
    domElement.removeEventListener('contextmenu', this.onContextMenu, false);
    domElement.removeEventListener('mousedown', this.onMouseDown, false);
    domElement.removeEventListener('wheel', this.onMouseWheel, false);
    domElement.removeEventListener('touchstart', this.onTouchStart, false);
    domElement.removeEventListener('touchend', this.onTouchEnd, false);
    domElement.removeEventListener('touchmove', this.onTouchMove, false);
    document.removeEventListener('mousemove', this.onMouseMove, false);
    document.removeEventListener('mouseup', this.onMouseUp, false);
  }

  rotateLeft(angle) {
    this.sphericalDelta.theta -= angle;
  }

  rotateUp(angle) {
    this.sphericalDelta.phi -= angle;
  }

  // deltaX and deltaY are in pixels; right and down are positive
  pan(deltaX, deltaY) {
    const { camera, domElement: element, v } = this;
    const { position, matrix } = camera;
    v.copy(position).sub(this.target);
    let targetDistance = v.length();

    // half of the fov is center to top of screen
    targetDistance *= Math.tan((camera.fov / 2) * Math.PI / 180.0);

    // we use only clientHeight here so aspect ratio does not distort speed
    // panLeft
    let distance = 2 * deltaX * targetDistance / element.clientHeight;
    v.setFromMatrixColumn(matrix, 0); // get X column of objectMatrix
    v.multiplyScalar(-distance);
    this.panOffset.add(v);
    // panUp
    distance = 2 * deltaY * targetDistance / element.clientHeight;
    if (screenSpacePanning) {
      v.setFromMatrixColumn(matrix, 1);
    } else {
      v.setFromMatrixColumn(matrix, 0);
      v.crossVectors(camera.up, v);
    }
    v.multiplyScalar(distance);
    this.panOffset.add(v);
  }

  //
  // event callbacks - update the object state
  //

  handleMouseDownRotate(event) {
    this.rotateStart.set(event.clientX, event.clientY);
  }

  handleMouseDownDolly(event) {
    this.dollyStart.set(event.clientX, event.clientY);
  }

  handleMouseDownPan(event) {
    this.panStart.set(event.clientX, event.clientY);
  }

  handleMouseMoveRotate(event) {
    const {
      rotateStart,
      rotateEnd,
      rotateDelta,
      domElement: element,
    } = this;
    rotateEnd.set(event.clientX, event.clientY);

    this.rotateDelta
      .subVectors(rotateEnd, rotateStart)
      .multiplyScalar(rotateSpeed);
    this.rotateLeft(Math.PI * rotateDelta.x / element.clientHeight); // yes, height
    this.rotateUp(Math.PI * rotateDelta.y / element.clientHeight);
    this.rotateStart.copy(rotateEnd);
  }

  handleMouseMoveDolly(event) {
    const {
      dollyStart,
      dollyEnd,
      dollyDelta,
    } = this;
    dollyEnd.set(event.clientX, event.clientY);

    dollyDelta.subVectors(dollyEnd, dollyStart);
    const scaleDelta = 0.95 ** zoomSpeed;
    if (dollyDelta.y > 0) {
      this.scale /= scaleDelta;
    } else if (dollyDelta.y < 0) {
      this.scale *= scaleDelta;
    }
    dollyStart.copy(this.dollyEnd);
  }

  handleMouseMovePan(event) {
    const {
      panStart,
      panEnd,
      panDelta,
    } = this;
    panEnd.set(event.clientX, event.clientY);

    panDelta.subVectors(panEnd, panStart).multiplyScalar(panSpeed);
    this.pan(panDelta.x, panDelta.y);
    panStart.copy(panEnd);
  }

  handleMouseWheel(event) {
    const scaleDelta = 0.95 ** zoomSpeed;
    if (event.deltaY < 0) {
      this.scale *= scaleDelta;
    } else if (event.deltaY > 0) {
      this.scale /= scaleDelta;
    }
    this.forceNextUpdate = true;
  }

  handleTouchStartRotate(event) {
    if (event.touches.length === 1) {
      this.rotateStart.set(event.touches[0].pageX, event.touches[0].pageY);
    } else {
      const x = 0.5 * (event.touches[0].pageX + event.touches[1].pageX);
      const y = 0.5 * (event.touches[0].pageY + event.touches[1].pageY);
      this.rotateStart.set(x, y);
    }
  }

  handleTouchStartPan(event) {
    if (event.touches.length === 1) {
      this.panStart.set(event.touches[0].pageX, event.touches[0].pageY);
    } else {
      const x = 0.5 * (event.touches[0].pageX + event.touches[1].pageX);
      const y = 0.5 * (event.touches[0].pageY + event.touches[1].pageY);

      this.panStart.set(x, y);
    }
  }

  handleTouchStartDolly(event) {
    const dx = event.touches[0].pageX - event.touches[1].pageX;
    const dy = event.touches[0].pageY - event.touches[1].pageY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    this.dollyStart.set(0, distance);
  }

  handleTouchStartDollyPan(event) {
    if (enableZoom) this.handleTouchStartDolly(event);
    if (enablePan) this.handleTouchStartPan(event);
  }

  handleTouchStartDollyRotate(event) {
    if (enableZoom) this.handleTouchStartDolly(event);
    if (enableRotate) this.handleTouchStartRotate(event);
  }

  handleTouchMoveRotate(event) {
    const {
      rotateStart,
      rotateEnd,
      rotateDelta,
      domElement: element,
    } = this;
    if (event.touches.length === 1) {
      rotateEnd.set(event.touches[0].pageX, event.touches[0].pageY);
    } else {
      const x = 0.5 * (event.touches[0].pageX + event.touches[1].pageX);
      const y = 0.5 * (event.touches[0].pageY + event.touches[1].pageY);
      rotateEnd.set(x, y);
    }

    rotateDelta.subVectors(rotateEnd, rotateStart)
      .multiplyScalar(rotateSpeed);
    this.rotateLeft(2 * Math.PI * rotateDelta.x / element.clientHeight);
    this.rotateUp(2 * Math.PI * rotateDelta.y / element.clientHeight);
    rotateStart.copy(rotateEnd);
  }

  handleTouchMovePan(event) {
    const {
      panStart,
      panEnd,
      panDelta,
    } = this;
    if (event.touches.length === 1) {
      panEnd.set(event.touches[0].pageX, event.touches[0].pageY);
    } else {
      const x = 0.5 * (event.touches[0].pageX + event.touches[1].pageX);
      const y = 0.5 * (event.touches[0].pageY + event.touches[1].pageY);
      panEnd.set(x, y);
    }
    panDelta.subVectors(panEnd, panStart).multiplyScalar(panSpeed);
    this.pan(panDelta.x, panDelta.y);
    panStart.copy(panEnd);
  }

  handleTouchMoveDolly(event) {
    const {
      dollyStart,
      dollyEnd,
      dollyDelta,
    } = this;
    const dx = event.touches[0].pageX - event.touches[1].pageX;
    const dy = event.touches[0].pageY - event.touches[1].pageY;

    const distance = Math.sqrt(dx * dx + dy * dy);
    dollyEnd.set(0, distance);
    dollyDelta.set(0, (dollyEnd.y / dollyStart.y) ** zoomSpeed);
    this.scale /= dollyDelta.y;
    dollyStart.copy(dollyEnd);
  }

  handleTouchMoveDollyPan(event) {
    if (enableZoom) this.handleTouchMoveDolly(event);
    if (enablePan) this.handleTouchMovePan(event);
  }

  handleTouchMoveDollyRotate(event) {
    if (enableZoom) this.handleTouchMoveDolly(event);
    if (enableRotate) this.handleTouchMoveRotate(event);
  }

  placeVoxelOnScreen(screenCoords, allowedDistance) {
    const intersect = this.renderer.castRay(screenCoords);
    if (!intersect) {
      return;
    }
    const target = intersect.point.clone()
      .add(intersect.face.normal.multiplyScalar(0.5))
      .floor()
      .addScalar(0.5)
      .floor();
    if (target.clone().sub(this.camera.position).length() < allowedDistance) {
      const [x, y, z] = target.toArray();
      this.renderer.placeVoxel(x, y, z);
    }
  }

  deleteVoxelOnScreen(screenCoords, allowedDistance) {
    const intersect = this.renderer.castRay(screenCoords);
    if (!intersect) {
      return;
    }
    const target = intersect.point.clone()
      .add(intersect.face.normal.multiplyScalar(-0.5))
      .floor()
      .addScalar(0.5)
      .floor();
    if (target.y < 0) {
      return;
    }
    if (target.clone().sub(this.camera.position).length() < allowedDistance) {
      const [x, y, z] = target.toArray();
      this.renderer.placeVoxel(x, y, z, 0);
    }
  }

  selectColorOnScreen(screenCoords) {
    // selectHoverColor doesn't actually do anything with the coords
    this.store.dispatch(selectHoverColor(screenCoords));
  }

  handleMouseUp(event) {
    if (!this.clickTapStartTime
      || Date.now() - this.clickTapStartTime > 300
      || this.store.getState().fetching.fetchingPixel
    ) {
      return;
    }
    const screenCoords = getTapOrClickCenter(event);
    if (getDiff(screenCoords, this.clickTapStartCoords) > 6) {
      return;
    }

    switch (event.button) {
      case 0:
        // left
        this.placeVoxelOnScreen(screenCoords, 120);
        break;
      case 1:
        // middle
        this.selectColorOnScreen(screenCoords);
        break;
      case 2:
        // right
        this.deleteVoxelOnScreen(screenCoords, 120);
        break;
      default:
    }
  }

  handleTouchEnd(event) {
    if (event.touches.length
      || !this.clickTapStartTime
      || Date.now() - this.clickTapStartTime > 300
      || this.store.getState().fetching.fetchingPixel
    ) {
      return;
    }
    const screenCoords = getTapOrClickCenter(event);
    if (getDiff(screenCoords, this.clickTapStartCoords) > 6) {
      return;
    }
    this.placeVoxelOnScreen(screenCoords, 90);
  }

  onLongTap(event) {
    if (!this.clickTapStartTime
      || this.store.getState().fetching.fetchingPixel
    ) {
      return;
    }
    const screenCoords = getTapOrClickCenter(event);
    if (getDiff(screenCoords, this.clickTapStartCoords) > 6) {
      return;
    }
    this.deleteVoxelOnScreen(screenCoords, 90);
  }

  onMouseMove(event) {
    event.preventDefault();

    switch (this.state) {
      case STATE.ROTATE:
        this.handleMouseMoveRotate(event);
        break;
      case STATE.DOLLY:
        this.handleMouseMoveDolly(event);
        break;
      case STATE.PAN:
        this.handleMouseMovePan(event);
        break;
      default:
        break;
    }
  }

  onMouseUp(event) {
    this.handleMouseUp(event);
    this.clickTapStartTime = 0;
    document.removeEventListener('mousemove', this.onMouseMove, false);
    document.removeEventListener('mouseup', this.onMouseUp, false);
    this.state = STATE.NONE;
  }

  onMouseWheel(event) {
    if (!enableZoom
      || (this.state !== STATE.NONE
        && this.state !== STATE.ROTATE)
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    this.handleMouseWheel(event);
  }

  onTouchStart(event) {
    event.preventDefault();

    if (event.touches.length === 1) {
      this.clickTapStartTime = Date.now();
      this.clickTapStartCoords = getTapOrClickCenter(event);
      this.tapTimeout = setTimeout(() => {
        this.onLongTap(event);
      }, 600);
    } else {
      this.clickTapStartTime = 0;
      clearTimeout(this.tapTimeout);
    }

    switch (event.touches.length) {
      case 1:
        switch (TOUCHES.ONE) {
          case TOUCH.ROTATE:
            if (!enableRotate) {
              return;
            }
            this.handleTouchStartRotate(event);
            this.state = STATE.TOUCH_ROTATE;
            break;
          case TOUCH.PAN:
            if (!enablePan) {
              return;
            }
            this.handleTouchStartPan(event);
            this.state = STATE.TOUCH_PAN;
            break;
          default:
            this.state = STATE.NONE;
        }
        break;
      case 2:
        switch (TOUCHES.TWO) {
          case TOUCH.DOLLY_PAN:
            if (!enableZoom && !enablePan) {
              return;
            }
            this.handleTouchStartDollyPan(event);
            this.state = STATE.TOUCH_DOLLY_PAN;
            break;
          case TOUCH.DOLLY_ROTATE:
            if (!enableZoom && !enableRotate) {
              return;
            }
            this.handleTouchStartDollyRotate(event);
            this.state = STATE.TOUCH_DOLLY_ROTATE;
            break;
          default:
            this.state = STATE.NONE;
        }
        break;
      default:
        this.state = STATE.NONE;
    }
  }

  onTouchMove(event) {
    event.preventDefault();
    event.stopPropagation();

    const screenCoords = getTapOrClickCenter(event);
    if (getDiff(screenCoords, this.clickTapStartCoords) > 6) {
      clearTimeout(this.tapTimeout);
      this.clickTapStartTime = 0;
    }

    switch (this.state) {
      case STATE.TOUCH_ROTATE:
        if (!enableRotate) {
          return;
        }
        this.handleTouchMoveRotate(event);
        break;
      case STATE.TOUCH_PAN:
        if (!enablePan) {
          return;
        }
        this.handleTouchMovePan(event);
        break;
      case STATE.TOUCH_DOLLY_PAN:
        if (!enableZoom && !enablePan) {
          return;
        }
        this.handleTouchMoveDollyPan(event);
        break;
      case STATE.TOUCH_DOLLY_ROTATE:
        if (!enableZoom && !enableRotate) {
          return;
        }
        this.handleTouchMoveDollyRotate(event);
        break;
      default:
        this.state = STATE.NONE;
    }
  }

  onTouchEnd(event) {
    event.preventDefault();
    if (!event.touches.length) {
      clearTimeout(this.tapTimeout);
      this.handleTouchEnd(event);
      this.clickTapStartTime = 0;
    }
    this.state = STATE.NONE;
  }

  // eslint-disable-next-line class-methods-use-this
  onContextMenu(event) {
    event.preventDefault();
  }

  onMouseDown(event) {
    // Prevent the browser from scrolling.
    event.preventDefault();
    this.clickTapStartTime = Date.now();
    this.clickTapStartCoords = getTapOrClickCenter(event);

    // Manually set the focus since calling preventDefault above
    // prevents the browser from setting it automatically.
    if (this.domElement.focus) {
      this.domElement.focus();
    } else {
      window.focus();
    }

    let mouseAction;

    switch (event.button) {
      case 0:
        mouseAction = MOUSE_BUTTONS.LEFT;
        break;
      case 1:
        mouseAction = MOUSE_BUTTONS.MIDDLE;
        break;
      case 2:
        mouseAction = MOUSE_BUTTONS.RIGHT;
        break;
      default:
        mouseAction = -1;
    }

    switch (mouseAction) {
      case MOUSE.DOLLY:
        this.handleMouseDownDolly(event);
        this.state = STATE.DOLLY;
        break;
      case MOUSE.ROTATE:
        if (event.ctrlKey || event.metaKey) {
          this.handleMouseDownPan(event);
          this.state = STATE.PAN;
        } else {
          this.handleMouseDownRotate(event);
          this.state = STATE.ROTATE;
        }
        break;
      case MOUSE.PAN:
        if (event.ctrlKey || event.metaKey) {
          this.handleMouseDownRotate(event);
          this.state = STATE.ROTATE;
        } else {
          this.handleMouseDownPan(event);
          this.state = STATE.PAN;
        }
        break;
      default:
        this.state = STATE.NONE;
    }

    if (this.state !== STATE.NONE) {
      document.addEventListener('mousemove', this.onMouseMove, false);
      document.addEventListener('mouseup', this.onMouseUp, false);
    }
  }

  getPolarAngle() {
    return this.spherical.phi;
  }

  getAzimuthalAngle() {
    return this.spherical.theta;
  }

  update(force) {
    const time = Date.now();
    const state = this.store.getState();
    const { moveU, moveV, moveW } = state.gui;
    const isMoving = (moveU || moveV || moveW);

    if (!(force
      || this.state !== STATE.NONE
      || this.forceNextUpdate
      || isMoving
    )) {
      this.prevTime = time;
      return false;
    }
    this.forceNextUpdate = false;

    const delta = (time - this.prevTime) / 1000.0;
    this.prevTime = time;

    const {
      camera,
      target,
      velocity,
      offset,
      vec,
      spherical,
      panOffset,
      sphericalDelta,
    } = this;

    if (isMoving) {
      velocity.set(-moveU, moveW, moveV)
        .normalize()
        .multiplyScalar(1000.0 * delta);

      vec.setFromMatrixColumn(camera.matrix, 0);
      vec.crossVectors(camera.up, vec);
      vec.multiplyScalar(-velocity.z * delta);
      vec.y += -velocity.y * delta;
      panOffset.add(vec);
      vec.setFromMatrixColumn(camera.matrix, 0);
      vec.multiplyScalar(-velocity.x * delta);
      panOffset.add(vec);
    }

    offset.copy(camera.position).sub(target);

    // rotate offset to "y-axis-is-up" space
    offset.applyQuaternion(this.quat);

    // angle from z-axis around y-axis
    spherical.setFromVector3(offset);

    spherical.theta += sphericalDelta.theta;
    spherical.phi += sphericalDelta.phi;

    // restrict theta to be between desired limits
    spherical.theta = Math.max(
      minAzimuthAngle,
      Math.min(maxAzimuthAngle, spherical.theta),
    );

    // restrict phi to be between desired limits
    spherical.phi = Math.max(
      minPolarAngle,
      Math.min(maxPolarAngle, spherical.phi),
    );
    spherical.makeSafe();

    spherical.radius *= this.scale;

    // restrict radius to be between desired limits
    spherical.radius = Math.max(
      minDistance,
      Math.min(maxDistance, spherical.radius),
    );

    // move target to panned location
    if (panOffset.length() > 1000) {
      panOffset.set(0, 0, 0);
    }
    target.add(panOffset);

    // clamp to boundaries
    const bound = state.canvas.canvasSize / 2;
    target.clamp(
      { x: -bound, y: 0, z: -bound },
      { x: bound, y: THREE_CANVAS_HEIGHT, z: bound },
    );

    offset.setFromSpherical(spherical);

    // rotate offset back to "camera-up-vector-is-up" space
    offset.applyQuaternion(this.quatInverse);
    this.camera.position.copy(target).add(offset);
    camera.lookAt(target);

    sphericalDelta.set(0, 0, 0);
    panOffset.set(0, 0, 0);
    this.scale = 1;

    if (this.storeViewInStateTime + STORE_UPDATE_DELAY < time) {
      this.storeViewInStateTime = time;
      this.renderer.storeViewInState();
    }

    return true;
  }
}

export default VoxelPainterControls;

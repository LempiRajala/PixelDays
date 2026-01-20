/*
 * 3D Renderer for VoxelCanvas
 *
 */

import {
  Vector2,
  Vector3,
  PerspectiveCamera,
  Scene,
  AmbientLight,
  DirectionalLight,
  FogExp2,
  BoxGeometry,
  MeshBasicMaterial,
  Mesh,
  Raycaster,
  PlaneGeometry,
  MeshLambertMaterial,
  WebGLRenderer,
} from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky';
import { CANVAS_TYPES,
  THREE_TILE_SIZE,
  BACKGROUND_CLR_HEX,
} from '../core/constants.ts';


import InfiniteGridHelper from './InfiniteGridHelper.js';
import VoxelPainterControls from '../controls/VoxelPainterControls.js';
import Renderer from './Renderer.js';
import ChunkLoader from './ChunkLoader3D.js';
import {
  getChunkOfPixel,
  getOffsetOfPixel,
} from '../core/utils.js';
import {
  setHover,
  unsetHover,
} from '../store/actions/index.js';
import pixelTransferController from './PixelTransferController.js';

const renderDistance = 150;

class Renderer3D extends Renderer {
  scene;
  camera;
  // current chunk in center of view
  centerChunk = [null, null];
  // position camera is looking at
  target = new Vector3();
  // red voxel cursor cube
  rollOverMesh;
  // loaded objects in scene
  objects = [];
  // map of chunkId to chunk mesh
  loadedChunks = new Map();
  // plane object
  plane;
  oobGeometry;
  oobMaterial;
  //--
  threeRenderer;
  // temp variables for mouse events
  mouse = new Vector2();
  raycaster = new Raycaster();
  lastIntersect = 0;

  constructor(store) {
    super(store);
    this.type = CANVAS_TYPES.THREED;
    const state = store.getState();

    // camera
    const camera = new PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      5,
      600,
    );
    this.camera = camera;
    // make camera look at target (defaults to 0,0,0) from the sky
    camera.position.set(0, 150, 190);
    camera.lookAt(this.target);

    this.loadViewFromState();

    // scene
    const scene = new Scene();
    // scene.background = new Color(0xf0f0f0);
    this.scene = scene;

    // lights
    const ambientLight = new AmbientLight(0x222222);
    scene.add(ambientLight);

    // const directionalLight = new DirectionalLight(0xffffff);
    // directionalLight.position.set(1, 1.2, 0.8).normalize();
    const directionalLight = new DirectionalLight(0xffffff, 1);
    directionalLight.position.set(80, 80, 75);
    const contourLight = new DirectionalLight(0xffffff, 0.4);
    contourLight.position.set(-80, 80, -75);
    scene.add(directionalLight);
    scene.add(contourLight);

    const sky = new Sky();
    sky.scale.setScalar(450000);
    scene.add(sky);
    scene.fog = new FogExp2(0xffffff, 0.003);

    const effectController = {
      turbidity: 10,
      rayleigh: 2,
      mieCoefficient: 0.005,
      mieDirectionalG: 0.8,
      inclination: 0.49, // elevation / inclination
      azimuth: 0.25, // Facing front,
      sun: !true,
    };
    const { uniforms } = sky.material;
    uniforms.turbidity.value = effectController.turbidity;
    uniforms.rayleigh.value = effectController.rayleigh;
    uniforms.mieCoefficient.value = effectController.mieCoefficient;
    uniforms.mieDirectionalG.value = effectController.mieDirectionalG;
    uniforms.sunPosition.value.set(400000, 400000, 400000);

    // hover helper
    const rollOverGeo = new BoxGeometry(1, 1, 1);
    const rollOverMaterial = new MeshBasicMaterial({
      color: 0xff0000,
      opacity: 0.5,
      transparent: true,
    });
    this.rollOverMesh = new Mesh(rollOverGeo, rollOverMaterial);
    scene.add(this.rollOverMesh);

    // grid
    // const gridHelper = new GridHelper(100, 10, 0x555555, 0x555555);
    const gridHelper = new InfiniteGridHelper(1, 10);
    scene.add(gridHelper);

    // Plane Floor
    const geometry = new PlaneGeometry(1024, 1024);
    geometry.rotateX(-Math.PI / 2);
    const plane = new Mesh(
      geometry,
      new MeshLambertMaterial({ color: 0xcae3ff }),
    );
    scene.add(plane);
    this.plane = plane;
    this.objects.push(plane);
    this.plane.position.y = -0.1;

    // Out of bounds plane
    const oobGeometry = new PlaneGeometry(
      THREE_TILE_SIZE,
      THREE_TILE_SIZE,
    );
    oobGeometry.rotateX(-Math.PI / 2);
    oobGeometry.translate(THREE_TILE_SIZE / 2, 0.2, THREE_TILE_SIZE / 2);
    const oobMaterial = new MeshLambertMaterial({
      color: BACKGROUND_CLR_HEX,
    });
    this.oobGeometry = oobGeometry;
    this.oobMaterial = oobMaterial;

    // renderer
    const threeRenderer = new WebGLRenderer({
      preserveDrawingBuffer: true,
    });
    threeRenderer.setPixelRatio(window.devicePixelRatio);
    threeRenderer.setSize(window.innerWidth, window.innerHeight);
    const { domElement } = threeRenderer;
    domElement.className = 'viewport';
    document.body.appendChild(domElement);
    this.threeRenderer = threeRenderer;

    // controls
    const controls = new VoxelPainterControls(
      this,
      camera,
      this.target,
      domElement,
      store,
    );
    this.controls = controls;

    this.onDocumentMouseMove = this.onDocumentMouseMove.bind(this);
    this.onDocumentTouchMove = this.onDocumentTouchMove.bind(this);
    this.onWindowResize = this.onWindowResize.bind(this);
    domElement.addEventListener('mousemove', this.onDocumentMouseMove, false);
    domElement.addEventListener('touchmove', this.onDocumentTouchMove, false);
    window.addEventListener('resize', this.onWindowResize, false);

    this.updateCanvasData(state);
  }

  get view() {
    return this.target.toArray();
  }

  destructor() {
    // TODO is still leaking memory
    // eslint-disable-next-line max-len
    // https://threejs.org/docs/#manual/en/introduction/How-to-dispose-of-objects
    window.removeEventListener('resize', this.onWindowResize, false);
    this.controls.dispose();
    this.oobGeometry.dispose();
    this.oobMaterial.dispose();
    delete this.controls;
    delete this.scene;
    delete this.camera;
    delete this.target;
    delete this.rollOverMesh;
    delete this.plane;
    delete this.oobGeometry;
    delete this.oobMaterial;
    delete this.mouse;
    delete this.raycaster;
    //
    delete this.loadedChunks;
    delete this.objects;
    const { domElement } = this.threeRenderer;
    domElement.remove();
    this.threeRenderer.renderLists.dispose();
    this.threeRenderer.dispose();
    delete this.threeRenderer;
    super.destructor();
  }

  updateView(view) {
    if (view.length !== 3) {
      return;
    }
    const { target } = this;
    // camera has to look from the same angle and distance
    const offset = target.clone();
    target.set(...view);
    offset.sub(target);
    this.camera.position.sub(offset);
    this.forceNextRender = true;
  }

  getViewport() {
    return this.threeRenderer.domElement;
  }

  updateCanvasData(state) {
    const {
      canvasId,
      view,
    } = state.canvas;
    if (canvasId !== this.canvasId) {
      this.canvasId = canvasId;
      if (canvasId !== null) {
        // destroy old chunks,
        // meshes need to get disposed
        if (this.loadedChunks.length) {
          this.loadedChunks.forEach((chunk) => {
            this.scene.remove(chunk);
          });
          this.loadedChunks = new Map();
        }
        if (this.chunkLoader) {
          this.chunkLoader.destructor();
        }
        this.objects = [this.plane];
        const {
          palette,
          canvasSize,
        } = state.canvas;
        this.chunkLoader = new ChunkLoader(
          this.store,
          canvasId,
          palette,
          canvasSize,
        );
      }
      this.updateView(view);
      this.forceNextRender = true;
    }
  }

  renderPixel(
    i,
    j,
    offset,
    color,
  ) {
    const { chunkLoader } = this;
    if (chunkLoader) {
      chunkLoader.getVoxelUpdate(i, j, offset, color);
    }
    this.forceNextSubrender = true;
  }

  isChunkInView(yc, xc, zc) {
    const chunkKey = `${xc}:${zc}`;
    if (this.loadedChunks.has(chunkKey)) {
      return true;
    }
    return false;
  }

  reloadChunks() {
    if (!this.chunkLoader) {
      return;
    }
    const { canvasSize } = this.store.getState().canvas;
    const {
      scene,
      loadedChunks,
      chunkLoader,
    } = this;
    const { x, z } = this.target;
    const [xcMin, zcMin] = getChunkOfPixel(
      canvasSize,
      x - renderDistance,
      0,
      z - renderDistance,
    );
    const [xcMax, zcMax] = getChunkOfPixel(
      canvasSize,
      x + renderDistance,
      0,
      z + renderDistance,
    );
    const chunkMaxXY = canvasSize / THREE_TILE_SIZE;
    const curLoadedChunks = [];
    for (let zc = zcMin; zc <= zcMax; ++zc) {
      for (let xc = xcMin; xc <= xcMax; ++xc) {
        const chunkKey = `${xc}:${zc}`;
        curLoadedChunks.push(chunkKey);
        if (!loadedChunks.has(chunkKey)) {
          let chunk = null;
          if (xc < 0 || zc < 0 || xc >= chunkMaxXY || zc >= chunkMaxXY) {
            // if out of bounds
            chunk = new Mesh(this.oobGeometry, this.oobMaterial);
          } else {
            chunk = chunkLoader.getChunk(xc, zc, true);
          }
          if (chunk) {
            loadedChunks.set(chunkKey, chunk);
            chunk.position.fromArray([
              xc * THREE_TILE_SIZE - canvasSize / 2,
              0,
              zc * THREE_TILE_SIZE - canvasSize / 2,
            ]);
            scene.add(chunk);
          }
        }
      }
    }
    const newObjects = [this.plane];
    loadedChunks.forEach((chunk, chunkKey) => {
      if (curLoadedChunks.includes(chunkKey)) {
        newObjects.push(chunk);
      } else {
        scene.remove(chunk);
        loadedChunks.delete(chunkKey);
      }
    });
    this.plane.position.x = x;
    this.plane.position.z = z;
    this.objects = newObjects;
  }

  debug(ident) {
    if (process?.env.NODE_ENV !== 'development') {
      return;
    }
    if (this.lol !== ident) {
      // eslint-disable-next-line no-console
      console.log(this.lol, this.lola);
      this.lol = ident;
      this.lola = 0;
    }
    this.lola += 1;
  }

  render() {
    if (!this.threeRenderer) {
      return;
    }
    const controlUpdate = super.render();

    // check if we enter new chunk
    if (controlUpdate) {
      const { canvasSize } = this.store.getState().canvas;
      const prevCenterChunk = this.centerChunk;
      const { x, z } = this.target;
      const centerChunk = getChunkOfPixel(canvasSize, x, 0, z);
      if (!prevCenterChunk
        || prevCenterChunk[0] !== centerChunk[0]
        || prevCenterChunk[1] !== centerChunk[1]
      ) {
        this.centerChunk = centerChunk;
        this.forceNextRender = true;
      }
    }

    if (this.forceNextRender
      || this.forceNextSubrender
      || controlUpdate
    ) {
      if (this.forceNextRender) {
        this.reloadChunks();
      }

      if (process?.env.NODE_ENV === 'development') {
        if (this.forceNextRender) {
          this.debug('force');
        } else if (this.forceNextSubrender) {
          this.debug('sub');
        } else if (controlUpdate) {
          this.debug('upd');
        }
      }

      this.threeRenderer.render(this.scene, this.camera);
      this.forceNextRender = false;
      this.forceNextSubrender = false;
    } else if (process?.env.NODE_ENV === 'development') {
      this.debug('skip');
    }
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.threeRenderer.setSize(window.innerWidth, window.innerHeight);
    this.forceNextSubrender = true;
  }

  updateRollOverMesh(sx, sy) {
    // 25ms break between intersects
    const time = Date.now();
    if (this.lastIntersect + 25 > time) {
      return;
    }
    this.lastIntersect = time;

    const {
      store,
      rollOverMesh,
      raycaster,
      objects,
      mouse,
      camera,
    } = this;
    const state = store.getState();
    const {
      fetchingPixel,
    } = state.fetching;

    mouse.set(sx, sy);
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(objects);
    if (intersects.length > 0) {
      const intersect = intersects[0];
      const target = intersect.point.clone()
        .add(intersect.face.normal.multiplyScalar(0.5))
        .floor()
        .addScalar(0.5);
      if (fetchingPixel
        || target.clone().sub(camera.position).length() > 120
      ) {
        if (rollOverMesh.position.y !== -10) {
          this.store.dispatch(unsetHover());
          rollOverMesh.position.y = -10;
          this.forceNextSubrender = true;
        }
      } else {
        const { hover: prevHover } = state.canvas;
        rollOverMesh.position.copy(target);
        const hover = target.toArray().map((u) => Math.floor(u));
        if (!prevHover
          || (prevHover[0] !== hover[0]
          || prevHover[1] !== hover[1]
          || prevHover[2] !== hover[2])
        ) {
          this.store.dispatch(setHover(hover));
          this.forceNextSubrender = true;
        }
      }
    }
  }

  onDocumentMouseMove(event) {
    this.updateRollOverMesh(
      (event.clientX / window.innerWidth) * 2 - 1,
      -(event.clientY / window.innerHeight) * 2 + 1,
    );
  }

  onDocumentTouchMove() {
    if (this.rollOverMesh.position.y !== -10) {
      this.store.dispatch(unsetHover());
      this.rollOverMesh.position.y = -10;
    }
  }

  castRay([clientX, clientY]) {
    const {
      mouse, camera, raycaster, objects,
    } = this;
    mouse.set(
      (clientX / window.innerWidth) * 2 - 1,
      -(clientY / window.innerHeight) * 2 + 1,
    );
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(objects);
    if (intersects.length > 0) {
      return intersects[0];
    }
    return null;
  }

  getPointedColor() {
    const {
      objects,
      raycaster,
      mouse,
      camera,
    } = this;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(objects);
    if (intersects.length <= 0) {
      return null;
    }
    const intersect = intersects[0];
    const target = intersect.point.clone()
      .add(intersect.face.normal.multiplyScalar(-0.5))
      .floor()
      .addScalar(0.5)
      .floor();
    if (target.y < 0) {
      return null;
    }
    if (target.clone().sub(camera.position).length() < 120) {
      const cell = target.toArray();
      if (this.chunkLoader) {
        const clr = this.chunkLoader.getVoxel(...cell);
        if (clr) {
          return clr;
        }
      }
    }
    return null;
  }

  placeVoxel(x, y, z, color = null) {
    const {
      store,
    } = this;
    const state = store.getState();
    const {
      canvasSize,
      selectedColor,
    } = state.canvas;
    const chClr = (color === null) ? selectedColor : color;
    const curColor = (chClr === 0) ? this.chunkLoader.getVoxel(x, y, z) : 0;
    const [i, j] = getChunkOfPixel(canvasSize, x, y, z);
    const offset = getOffsetOfPixel(canvasSize, x, y, z);
    pixelTransferController.tryPlacePixel(
      i, j,
      offset,
      chClr,
      curColor,
    );
  }
}

export default Renderer3D;

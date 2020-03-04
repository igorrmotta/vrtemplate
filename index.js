import * as THREE from "https://threejsfundamentals.org/threejs/resources/threejs/r113/build/three.module.js";
import { OrbitControls } from "https://threejsfundamentals.org/threejs/resources/threejs/r113/examples/jsm/controls/OrbitControls.js";
import { OBJLoader2 } from "https://threejsfundamentals.org/threejs/resources/threejs/r113/examples/jsm/loaders/OBJLoader2.js";
import { MTLLoader } from "https://threejsfundamentals.org/threejs/resources/threejs/r113/examples/jsm/loaders/MTLLoader.js";
import { GLTFLoader } from "https://threejsfundamentals.org/threejs/resources/threejs/r113/examples/jsm/loaders/GLTFLoader.js";
import { MtlObjBridge } from "https://threejsfundamentals.org/threejs/resources/threejs/r113/examples/jsm/loaders/obj2/bridge/MtlObjBridge.js";
import { VRButton } from "https://threejsfundamentals.org/threejs/resources/threejs/r113/examples/jsm/webxr/VRButton.js";
import { XRControllerModelFactory } from 'https://threejsfundamentals.org/threejs/resources/threejs/r113/examples/jsm/webxr/XRControllerModelFactory.js';

function main() {
  const canvas = document.querySelector("#c");
  const renderer = new THREE.WebGLRenderer({ canvas });
  window.renderer = renderer;

  const fov = 45;
  const aspect = 2; // the canvas default
  const near = 0.1;
  const far = 1000;
  const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 5, 0);
  controls.update();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("black");

  {
    document.body.appendChild(VRButton.createButton(renderer));
    renderer.xr.enabled = true;
  }

  // controllers
  let controller1, controller2;
  {
    controller1 = renderer.xr.getController( 0 );
    controller1.addEventListener( 'selectstart', onSelectStart );
    controller1.addEventListener( 'selectend', onSelectEnd );
    scene.add( controller1 );

    controller2 = renderer.xr.getController( 1 );
    controller2.addEventListener( 'selectstart', onSelectStart );
    controller2.addEventListener( 'selectend', onSelectEnd );
    scene.add( controller2 );

    var controllerModelFactory = new XRControllerModelFactory();

    var controllerGrip1 = renderer.xr.getControllerGrip( 0 );
    controllerGrip1.add( controllerModelFactory.createControllerModel( controllerGrip1 ) );
    scene.add( controllerGrip1 );

    var controllerGrip2 = renderer.xr.getControllerGrip( 1 );
    controllerGrip2.add( controllerModelFactory.createControllerModel( controllerGrip2 ) );
    scene.add( controllerGrip2 );

    var geometry = new THREE.CylinderBufferGeometry( 0.01, 0.02, 0.08, 5 );
    geometry.rotateX( - Math.PI / 2 );
    var material = new THREE.MeshStandardMaterial( { flatShading: true } );
    var mesh = new THREE.Mesh( geometry, material );
    
    var pivot = new THREE.Mesh( new THREE.IcosahedronBufferGeometry( 0.01, 2 ) );
    pivot.name = 'pivot';
    pivot.position.z = - 0.05;
    mesh.add( pivot );
    
    controller1.add( mesh.clone() );
    controller2.add( mesh.clone() );
  }

  // this is the floor
  {
    const planeSize = 4000;

    const loader = new THREE.TextureLoader();
    const texture = loader.load(
      "https://threejsfundamentals.org/threejs/resources/images/checker.png"
    );
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.NearestFilter;
    const repeats = planeSize / 200;
    texture.repeat.set(repeats, repeats);

    const planeGeo = new THREE.PlaneBufferGeometry(planeSize, planeSize);
    const planeMat = new THREE.MeshPhongMaterial({
      map: texture,
      side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(planeGeo, planeMat);
    mesh.rotation.x = Math.PI * -0.5;
    scene.add(mesh);
  }

  // light
  {
    const skyColor = 0xb1e1ff; // light blue
    const groundColor = 0xb97a20; // brownish orange
    const intensity = 1;
    const light = new THREE.HemisphereLight(skyColor, groundColor, intensity);
    scene.add(light);
  }

  // light
  {
    const color = 0xffffff;
    const intensity = 1;
    const light = new THREE.DirectionalLight(color, intensity);
    light.position.set(5, 10, 2);
    scene.add(light);
    scene.add(light.target);
  }

  function frameArea(sizeToFitOnScreen, boxSize, boxCenter, camera) {
    const halfSizeToFitOnScreen = sizeToFitOnScreen * 0.5;
    const halfFovY = THREE.MathUtils.degToRad(camera.fov * 0.5);
    let distance = halfSizeToFitOnScreen / Math.tan(halfFovY);
    distance = 2000;
    // compute a unit vector that points in the direction the camera is now
    // in the xz plane from the center of the box
    const direction = new THREE.Vector3()
      .subVectors(camera.position, boxCenter)
      .multiply(new THREE.Vector3(1, 0, 1))
      .normalize();

    // move the camera to a position distance units way from the center
    // in whatever direction the camera was from the center already
    ////camera.position.copy(direction.multiplyScalar(distance).add(boxCenter));
    //camera.position.set(1000,0,0);

    // pick some near and far values for the frustum that
    // will contain the box.
    camera.near = boxSize / 100;
    camera.far = boxSize * 100;

    camera.updateProjectionMatrix();

    // point the camera to look at the center of the box
    camera.lookAt(boxCenter.x, boxCenter.y, boxCenter.z);
  }

  // loads the model
  {
    const mtlLoader = new MTLLoader();
    mtlLoader.load("3d-model.mtl", mtlParseResult => {
      const objLoader = new OBJLoader2();
      const loader = new GLTFLoader();
      const materials = MtlObjBridge.addMaterialsFromMtlLoader(mtlParseResult);
      objLoader.addMaterials(materials);
      //loader.load("object.glb", root => {
      objLoader.load("3d-model.obj", root => {
        scene.add(root);

        // compute the box that contains all the stuff
        // from root and below
        const box = new THREE.Box3().setFromObject(root);
        window.box = box;

        const boxSize = box.getSize(new THREE.Vector3()).length();
        const boxCenter = box.getCenter(new THREE.Vector3());

        // set the camera to frame the box
        frameArea(boxSize * 1.2, boxSize, boxCenter, camera);

        // update the Trackball controls to handle the new size
        controls.maxDistance = boxSize * 10;
        controls.target.copy(boxCenter);
        controls.update();
      });
    });
  }

  function resizeRendererToDisplaySize(renderer) {
    const canvas = renderer.domElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const needResize = canvas.width !== width || canvas.height !== height;
    if (needResize) {
      renderer.setSize(width, height, false);
    }
    return needResize;
  }

  function render() {
    if (resizeRendererToDisplaySize(renderer)) {
      const canvas = renderer.domElement;
      camera.aspect = canvas.clientWidth / canvas.clientHeight;
      camera.updateProjectionMatrix();
    }

    renderer.render(scene, camera);

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);

  renderer.setAnimationLoop(() => {
    renderer.render(scene, camera);
  });
}

function onSelectStart() {

}

function onSelectEnd() {

}

main();

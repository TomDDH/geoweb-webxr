import * as THREE from "three";
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import "./index.css"
import * as geolib from 'geolib';
import sceneFile from "./assets/hot_air_balloon.glb"


// google map variables
let map

// three js variables
let camera
let scene
let renderer
let canvas
let offsetPosition = new THREE.Vector3()
const gltfloader = new GLTFLoader();
let sceneObject
// webxr variable
let session
let gl

// geolib variable
let compassAngle
let needNorth = true
let thumBearing
let headingAngle
let distanceGeo
let targetLon
let targetLat
let isInRange = false
let targetMarket
let currentLat
let currentLon


// init google map
function initMap(position) {
  console.log({ map: position })
  map = new google.maps.Map(document.getElementById("map"), {
    mapId: "70c2ef9ec87e5f1",
    center: { lat: -34.397, lng: 150.644 },
    zoom: 17,
    styles: [
      {
        featureType: "poi",
        elementType: "labels",
        stylers: [{ visibility: "off" }]
      },
      {
        featureType: "transit",
        elementType: "labels.icon",
        stylers: [{ visibility: "off" }],
      },
      {
        featureType: "administrative",
        stylers: [{ visibility: "off" }]
      }
    ]

  });


}


// start google map and access current location and set a target location
function init() {
  // get cuurent location from device location API
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((position) => {
      const pos = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
      const currentLoc = position.coords
      currentLon = position.coords.longitude
      currentLat = position.coords.latitude
      document.querySelector("#debug-data").innerHTML = `current Location: lon:${currentLon},lat ${currentLat} <br>target Location: lon:${targetLon},lat ${targetLat} `
      
      // active google map for current location
      initMap(currentLoc)
      
      // set google center to current location
      map.setCenter(pos);
      // add current location marker
      const marker = new google.maps.Marker({
        position: pos,
        map: map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillOpacity: 1,
          strokeWeight: 2,
          fillColor: '#5384ED',
          strokeColor: '#ffffff',
        },
      });

      // click event for set target location marker and update variables
      map.addListener("click", (e) => {
        if (targetMarket) {
          targetMarket.setPosition(e.latLng);
        } else {
          targetMarket = new google.maps.Marker({
            position: e.latLng,
            map: map,
            label: "G",
            draggable: true
          });
        }
        targetLat = Number(e.latLng.lat())
        targetLon = Number(e.latLng.lng())
        document.querySelector("#debug-data").innerHTML = `current Location: lon:${currentLon},lat ${currentLat} <br>target Location: lon:${targetLon},lat ${targetLat} `
      });
    });
  } else {
    console.log("geolocation IS NOT available")
  }
}

// check target and current location, distance, direction, and is in 100 meter range. if the range is too far, the AR object will too small.
const calculateInitData = () => {
  distanceGeo = geolib.getDistance({
    latitude: targetLat,
    longitude: targetLon,
  }, {
    latitude: currentLat,
    longitude: currentLon,
  })

  thumBearing = geolib.getRhumbLineBearing(
    {
      latitude: targetLat,
      longitude: targetLon,
    },
    {
      latitude: currentLat,
      longitude: currentLon,
    }
  )
  isInRange = geolib.isPointWithinRadius(
    {
      latitude: targetLat,
      longitude: targetLon,
    },
    {
      latitude: currentLat,
      longitude: currentLon,
    },
    100
  );
}

// event when page load
window.addEventListener('load', (event) => {
  init();
});

// start AR button
document.querySelector("#start-ar").addEventListener("click", () => {
  calculateInitData()
  // console.log({ isInRange, distanceGeo, thumBearing })
  if (isInRange) {
    enternXR()
  } else {
    document.querySelector("#info-data").innerHTML = "Target is not in 100 metter range, please move closer"
  }
})

// device orientation direction to set rotation offset in AR scene.
window.addEventListener('deviceorientationabsolute', (e) => {
  if (needNorth) {
    compassAngle = e.alpha
  }
}, true);



// enter AR function. check if support "immersive-ar" if true then start webXR session
const enternXR = async () => {
  if (window.location.protocol === "https:") {
    const isARSupported = await window.navigator.xr.isSessionSupported(
      "immersive-ar"
    );
    if (isARSupported && !session) {
      startAr()
    } else {
      console.log("AR Not Support");
    }
  } else {
    console.log("Use HTTPS");
  }
};

// start AR  and get the current heading orientation, the data will used for rotation offset in AR secen
const startAr = () => {
  navigator.geolocation.getCurrentPosition((position) => {
    headingAngle = position.coords.heading
    // console.log({ headingAngle })
    sessionStart();
  })
}

// start AR session
const sessionStart = async () => {
  // three js variables
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(
    85,
    window.innerWidth / window.innerHeight,
    0.01,
    100
  );
  canvas = document.createElement("canvas");
  gl = canvas.getContext("webgl", {
    xrCompatible: true,
  });

  renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);

  // set three js realistic rendering
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap; // default THREE.PCFShadowMap
  renderer.xr.enabled = true; // need set xr to true for webxr api
  renderer.outputEncoding = THREE.sRGBEncoding;

  // three js enviroment light 
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();
  scene.environment = pmremGenerator.fromScene(
    new RoomEnvironment(),
    0.04
  ).texture;

  // add three js group, it will contain all ar objects
  const arScene = new THREE.Group()
  scene.add(arScene)

  // calculate variables for ar scene rotation offsets
  const offsetAn = THREE.MathUtils.degToRad(compassAngle)
  const radians = THREE.MathUtils.degToRad(thumBearing)
  const angle = new THREE.Vector3(0, 0, 1)
  angle.applyAxisAngle(new THREE.Vector3(0, 1, 0), -radians)
  // set offsets position and rotation
  offsetPosition.addScaledVector(angle, distanceGeo)
  arScene.rotation.set(0, -offsetAn, 0)

  // load ar 3d object: glb gltf fomat: this will take a bit time
  gltfloader.load(
    sceneFile,
    (gltf) => {
      sceneObject = gltf.scene
      const scale = 0.1
      gltf.scene.scale.set(scale, scale, scale)
      gltf.scene.position.copy(offsetPosition)
      arScene.add(gltf.scene);
      gltf.scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.material.side = THREE.DoubleSide
        }
      });
    },
    function (xhr) {
      // called when loading 3d files
      console.log(xhr)
    },
    function (error) {
      // called when loading has errors
      console.log("An error happened when load glb");
    }
  );



  // debug helpers
  const gridHelper = new THREE.GridHelper();
  const axesHelper = new THREE.AxesHelper(5);
  // arScene.add(axesHelper);

  // webxr ar session
  session = await navigator.xr.requestSession("immersive-ar", {
    optionalFeatures: ["dom-overlay"],
    domOverlay: { root: document.querySelector("#overlay") },
    requiredFeatures: ["local-floor"],

  });
  session.updateRenderState({ baseLayer: new XRWebGLLayer(session, gl) });
  renderer.xr.setReferenceSpaceType("local-floor");
  await renderer.xr.setSession(session);
  session.requestAnimationFrame(onXRFrame);

  // render animation for XR session
  function onXRFrame(t, frame) {
    let session = frame.session;
    session.requestAnimationFrame(onXRFrame);
    // 3d object auto rotation
    if (sceneObject) sceneObject.rotateY(0.01);
    renderer.render(scene, camera);
  }
}



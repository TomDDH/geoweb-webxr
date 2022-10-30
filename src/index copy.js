import * as THREE from "three";
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";


// map api AIzaSyBTThV2Jeqo6Gy7nkXSuK58tByNZcBTWHU


import "./index.css"
import * as geolib from 'geolib';

import sceneFile from "./assets/hot_air_balloon.glb"

let map;

let camera, scene, renderer, controls, canvas;
let session, gl
let compassAngle
let needNorth = true
let thumBearing
let offsetPosition = new THREE.Vector3()
const gltfloader = new GLTFLoader();
let headingAngle
let distanceGeo
let targetLon
let targetLat
let sceneObject
let isInRange = false
let geoPosition
let targetMarket


document.getElementById("input-form").addEventListener('submit', handleForm);


function initMap(position) {
  console.log({map:position})
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
        stylers: [ { visibility: "off" } ] 
    }
  ]

  });

  
}

init()

// window.initMap = initMap;


function handleForm(event) {
  event.preventDefault();
  console.log(event)
  targetLat = Number(event.target[0].value)
  targetLon = Number(event.target[1].value)
  document.getElementById("input-form").style.display = "none"
  // init()
}

function init() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((position) => {

      const pos = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };

      const currentLoc = position.coords
      console.log({currentLocation:currentLoc})
      document.querySelector("#debug-data").innerHTML = `currentLocation: lon:${currentLoc.longitude},lat ${currentLoc.latitude} `


      initMap(currentLoc)

      console.log(map)

      map.setCenter(pos);

      map.addListener("click", (e) => {
        console.log(e)
        if(targetMarket){
        console.log("target set")
        targetMarket.setPosition(e.latLng);
        }else{
          targetMarket = new google.maps.Marker({
            position: e.latLng,
            map: map,
            label: "G",
            draggable: true
          });

        }


      });


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

      const currentLon = position.coords.longitude
      const currentLat = position.coords.latitude

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


      // console.log({ distanceGeo, isInRange, position, thumBearing })

      document.getElementById("start-ar").style.display = "block"
      document.querySelector("#start-ar").addEventListener("click", () => {
        if (isInRange) {
          enternXR()
        } else {
          document.querySelector("#info-data").innerHTML = "Target is not in 100 metter range, please move closer"
        }
      })
    });

  } else {
    console.log("geolocation IS NOT available")
  }
}




window.addEventListener('deviceorientationabsolute', (e) => {
  if (needNorth) {
    compassAngle = e.alpha
  }
}, true);




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

const startAr = () => {
  navigator.geolocation.getCurrentPosition((position) => {
    headingAngle = position.coords.heading
    console.log({ headingAngle })
    sessionStart();

  })
}


const sessionStart = async () => {
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
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap; // default THREE.PCFShadowMap
  renderer.xr.enabled = true;
  renderer.outputEncoding = THREE.sRGBEncoding;

  // enviroment light
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();
  scene.environment = pmremGenerator.fromScene(
    new RoomEnvironment(),
    0.04
  ).texture;


  const arScene = new THREE.Group()
  scene.add(arScene)
  const offsetAn = THREE.MathUtils.degToRad(compassAngle)

  // // test cube
  // const geometry = new THREE.BoxGeometry(1, 1, 1);
  // const material = new THREE.MeshBasicMaterial({ color: 0x0000ff });
  // const cube = new THREE.Mesh(geometry, material);
  // arScene.add(cube);
  // cube.position.set(0, 0, 3)


  const radians = THREE.MathUtils.degToRad(thumBearing)
  const angle = new THREE.Vector3(0, 0, 1)
  angle.applyAxisAngle(new THREE.Vector3(0, 1, 0), -radians)
  offsetPosition.addScaledVector(angle, distanceGeo)
  
  // cube.position.copy(offsetPosition)

  arScene.rotation.set(0, -offsetAn, 0)

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
      const data = JSON.stringify({ targetDistance: distanceGeo, heading: compassAngle, bearing: thumBearing });
      document.querySelector("#debug-data").innerHTML = "data data"
    },
    function (xhr) {

   // called when loading has errors
    console.log(xhr)
     },
    function (error) {
      console.log("An error happened");
    }
  );



  // debug helpers
  const gridHelper = new THREE.GridHelper();
  // scene.add(gridHelper);
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
    if(sceneObject) sceneObject.rotateY(0.01);
    renderer.render(scene, camera);
  }
}



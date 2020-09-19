import React, {useEffect, useState, useRef} from 'react';
import * as handtrack from '@tensorflow-models/handpose';
import '@tensorflow/tfjs-backend-webgl';
import '@tensorflow/tfjs-backend-cpu';
import * as tf from '@tensorflow/tfjs';
import './App.css';

import imgCiscoLogo from './img/cisco-logo.png';
import imgHandOne from './img/hand-one.png';
import imgHandTwo from './img/hand-two.png';
import imgHandThree from './img/hand-three.png';
import imgHandFour from './img/hand-four.png';
import imgHandFive from './img/hand-five.png';
import imgHandThumbsUp from './img/hand-thumbsup.png';
import imgHandThumbsDown from './img/hand-thumbsdown.png';
import imgHandNone from './img/hand-blank.png';

window.model = null;
window.iterator = 0;
window.fps = 0;
window.prevTime = 0;

window.fingers = ['thumb', 'indexFinger', 'middleFinger', 'ringFinger', 'pinky'];
window.FINGER_LANDMARK_POINTS = 4;

/**
 * geometric functions
 */
const D2 = (v1, v2) => {
  return Math.sqrt((v1[0] - v2[0]) ** 2 + (v1[1] - v2[1]) ** 2).toFixed(1);
}
const larger = (d1, d2) => {
  return d1 - d2 > 30;
}
const angel = (A1, A2, B1, B2) => {
  var dAx = A2[0] - A1[0];
  var dAy = A2[1] - A1[1];
  var dBx = B2[0] - B1[0];
  var dBy = B2[1] - B1[1];
  var angle = Math.atan2(dAx * dBy - dAy * dBx, dAx * dBx + dAy * dBy);
  if(angle < 0) {angle = angle * -1;}
  var degree_angle = angle * (180 / Math.PI);
  return Math.floor(degree_angle);
}
const straight = (angel) => {
  return angel > 100;
}
const straightThumb = (angel) => {
  return angel > 130;  // my thumb is fat and short, so sad
}

/**
 * Helper functions
 */
const isThumbOpen = (landmarks) => {
  const d4 = D2(landmarks[4], landmarks[0]);
  const d3 = D2(landmarks[3], landmarks[0]);

  const d46 = D2(landmarks[4], landmarks[6]);
  const isFist = d46 < 60;

  const angel1 = angel(landmarks[4], landmarks[3], landmarks[2], landmarks[3]);
  const angel2 = angel(landmarks[3], landmarks[2], landmarks[1], landmarks[2]);
  const angel3 = angel(landmarks[2], landmarks[1], landmarks[0], landmarks[1]);
  const isStraight = straightThumb(angel1) && straightThumb(angel2) && straightThumb(angel3);
  return !isFist && (larger(d4, d3) || isStraight);
};

const isFirstOpen = (landmarks) => {
  const d8 = D2(landmarks[8], landmarks[0]);
  const d7 = D2(landmarks[7], landmarks[0]);
  const d6 = D2(landmarks[6], landmarks[0]);

  const angel1 = angel(landmarks[8], landmarks[7], landmarks[6], landmarks[7]);
  const angel2 = angel(landmarks[7], landmarks[6], landmarks[5], landmarks[6]);
  const angel3 = angel(landmarks[6], landmarks[5], landmarks[0], landmarks[5]);
  const isStraight = straight(angel1) && straight(angel2) && straight(angel3);
  return larger(d8, d7) || larger(d8, d6) || isStraight ;
};

const isSecondOpen = (landmarks) => {
  const d12 = D2(landmarks[12], landmarks[0]);
  const d11 = D2(landmarks[11], landmarks[0]);
  const d10 = D2(landmarks[10], landmarks[0]);
  const angel1 = angel(landmarks[12], landmarks[11], landmarks[10], landmarks[11]);
  const angel2 = angel(landmarks[11], landmarks[10], landmarks[9], landmarks[10]);
  const angel3 = angel(landmarks[10], landmarks[9], landmarks[0], landmarks[9]);
  const isStraight = straight(angel1) && straight(angel2) && straight(angel3);
  return larger(d12, d11) || larger(d12, d10) || isStraight ;
};

const isThirdOpen = (landmarks) => {
  const d16 = D2(landmarks[16], landmarks[0]);
  const d15 = D2(landmarks[15], landmarks[0]);
  const d14 = D2(landmarks[14], landmarks[0]);
  const angel1 = angel(landmarks[16], landmarks[15], landmarks[14], landmarks[15]);
  const angel2 = angel(landmarks[15], landmarks[14], landmarks[13], landmarks[14]);
  const angel3 = angel(landmarks[14], landmarks[13], landmarks[0], landmarks[13]);
  const isStraight = straight(angel1) && straight(angel2) && straight(angel3);
  return larger(d16, d15) || larger(d16, d14) || isStraight;
};

const isFourthOpen = (landmarks) => {
  const d20 = D2(landmarks[20], landmarks[0]);
  const d19 = D2(landmarks[19], landmarks[0]);
  const d18 = D2(landmarks[18], landmarks[0]);
  const angel1 = angel(landmarks[20], landmarks[19], landmarks[18], landmarks[19]);
  const angel2 = angel(landmarks[19], landmarks[18], landmarks[17], landmarks[18]);
  const angel3 = angel(landmarks[18], landmarks[17], landmarks[0], landmarks[17]);
  const isStraight = straight(angel1) && straight(angel2) && straight(angel3);
  return larger(d20, d19) || larger(d20, d18) || isStraight;
};

const isThumbUp = (landmarks) => {
  const d = landmarks[3][1] - landmarks[1][1];
  return d < -50 ;
};

const isThumbDown = (landmarks) => {
  const d = landmarks[3][1] - landmarks[1][1];
  return d > 0;
};


function App() {
  const localVideoRef = useRef(null);
  const canvasRef = useRef(null)
  const layerRef = useRef(null)
  const [uiFPS, setUiFPS] = useState(0);

  const [thumbUp, setThumbUp] = useState(false);
  const [thumbDown, setThumbDown] = useState(false);

  const [thumbOpen, setThumbOpen] = useState(false);
  const [firstOpen, setFirstOpen] = useState(false);
  const [secondOpen, setSecondOpen] = useState(false);
  const [thirdOpen, setThirdOpen] = useState(false);
  const [fourthOpen, setFourthOpen] = useState(false);

  const [poseThumbUp, setPoseThumbUp] = useState(false);
  const [poseThumbDown, setPoseThumbDown] = useState(false);

  const [predictedImage, setPredictedImage] = useState(false);

  const canvasWidth = 640;
  const canvasHeight = 360;

  /**
   * Setup model and cam video
   */
  useEffect(() => {
    async function setup() {
      await tf.setBackend('webgl');

      const startLoadTime = new Date().getTime();
      window.model = await handtrack.load();
      console.log("ML model loaded. Elapsed time: ", new Date().getTime() - startLoadTime);

      const constraints = {audio: false, video: {width: canvasWidth, height: canvasHeight}};
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log("Get user media success!", stream);

      // for react
      localVideoRef.current.srcObject = stream;
      localVideoRef.current.play();
    }

    setup();
  }, []);

  /**
   * Setup Canvas and Prediction
   */
  useEffect(() => {
    const video = localVideoRef.current;
    const canvas = canvasRef.current;
    const layer = layerRef.current;
    const ctx = canvas.getContext('2d');
    const ltx = layer.getContext('2d');

    // Assign css size to be screen size
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    layer.width = canvasWidth;
    layer.height = canvasHeight;

    const computeHandpose = async function(target) {
      const predictions = await window.model.estimateHands(target);

      return predictions;
    }

    const drawPrediction = function(predictedPoints) {
      // draw points
      ltx.fillStyle = 'lime';
      for (let i = 0; i < predictedPoints.length; i++) {
        const y = predictedPoints[i][0];
        const x = predictedPoints[i][1];
        ltx.beginPath();
        ltx.arc(y, x, 3, 0, 2 * Math.PI);
        ltx.fill();
      }

      // draw lines
      ltx.strokeStyle = 'lime';
      for (let i = 0; i < window.fingers.length; i++) {
        const region = new Path2D();
        const basePoint = predictedPoints[0];
        region.moveTo(basePoint[0], basePoint[1]);

        // draw line of 4 landmark points for each finger
        for (let j = 1; j <= window.FINGER_LANDMARK_POINTS; j++) {
          region.lineTo(predictedPoints[i * window.FINGER_LANDMARK_POINTS + j][0],
            predictedPoints[i * window.FINGER_LANDMARK_POINTS + j][1]);
        }

        ltx.stroke(region);
      }
    }

    async function draw(tm) {
      if (video.paused || video.ended) return false;

      // FPS calculation
      const dt = tm - window.prevTime;
      window.prevTime = tm;
      window.fps = window.fps * 0.85 + (1000 / dt) * 0.15;
      setUiFPS(window.fps.toFixed(2));

      // Draw video to canvas
      ctx.drawImage(video, 0, 0, canvasWidth, canvasHeight);

      // Clear prediction layer
      ltx.clearRect(0, 0, canvasWidth, canvasHeight);

      // Hand prediction
      const predictions = await computeHandpose(canvas);
      if (predictions.length > 0) {

        drawPrediction(predictions[0].landmarks);

        // refer to this pic (this is left hand, right hand is similar): https://gist.github.com/TheJLifeX/74958cc59db477a91837244ff598ef4a#file-02-landmarks-jpg
        const landmarks = predictions[0].landmarks;

        // TODO: add both x axis and y axis check
        // right hand, palm facing the screen
        setThumbOpen(isThumbOpen(landmarks));
        setFirstOpen(isFirstOpen(landmarks));
        setSecondOpen(isSecondOpen(landmarks));
        setThirdOpen(isThirdOpen(landmarks));
        setFourthOpen(isFourthOpen(landmarks));
        setThumbUp(isThumbUp(landmarks));
        setThumbDown(isThumbDown(landmarks));
      }else{
        setThumbOpen(false);
        setFirstOpen(false);
        setSecondOpen(false);
        setThirdOpen(false);
        setFourthOpen(false);
        setThumbUp(false);
        setThumbDown(false);
      }

      window.requestAnimationFrame(draw);
    }

    video.addEventListener('play', function() {
      window.requestAnimationFrame(draw);
      console.log('Ready', canvas.width, canvas.height, video.paused, video.ended)
    });

  }, []);

  /**
   * Pose Logic
   */
  useEffect(()=>{
    setPoseThumbUp(thumbUp && thumbOpen && !firstOpen && !secondOpen && !thirdOpen && !fourthOpen);
    setPoseThumbDown(thumbDown && thumbOpen && !firstOpen && !secondOpen && !thirdOpen && !fourthOpen);
  }, [thumbUp, thumbDown, thumbOpen, firstOpen, secondOpen, thirdOpen, fourthOpen]);

  /**
   * Image Logic
   */
  useEffect(()=>{
    if (poseThumbUp) {
      setPredictedImage(imgHandThumbsUp);
    } else if (poseThumbDown) {
      setPredictedImage(imgHandThumbsDown);
    } else if (thumbOpen && firstOpen && secondOpen && thirdOpen && fourthOpen) {
      setPredictedImage(imgHandFive);
    } else if (!thumbOpen && firstOpen && secondOpen && thirdOpen && fourthOpen) {
      setPredictedImage(imgHandFour);
    } else if (!thumbOpen && firstOpen && secondOpen && thirdOpen && !fourthOpen) {
      setPredictedImage(imgHandThree);
    } else if (!thumbOpen && firstOpen && secondOpen && !thirdOpen && !fourthOpen) {
      setPredictedImage(imgHandTwo);
    } else if (!thumbOpen && firstOpen && !secondOpen && !thirdOpen && !fourthOpen) {
      setPredictedImage(imgHandOne);
    }else {
      setPredictedImage(imgHandNone);
    }
  }, [poseThumbUp, poseThumbDown, thumbOpen, firstOpen, secondOpen, thirdOpen, fourthOpen]);

  return (
    <div className="app">

      <div className="app-header">
        <h1><img className="cisco-logo" src={imgCiscoLogo} />Webex GestureUI Demo</h1>
      </div>

      <div>
        <div className="inline-block-lg">
          <p><strong>User View</strong></p>
          <video autoPlay ref={localVideoRef} />
        </div>
        <div className="inline-block-lg">
          <p><strong>Computer Vision View</strong></p>
          <div className="canvas-container">
            <canvas ref={canvasRef} className="grayscale" />
            <canvas ref={layerRef} />
          </div>
        </div>
      </div>

      <div>
        <div className="inline-block-sm">
          <strong>Statistics</strong><br />
          <span>Average FPS: {uiFPS}</span>
        </div>

        <div className="inline-block-sm">
          <strong>Fingers</strong><br />
          <div>{`Thumb: ${poseThumbUp ? 'open & up' : poseThumbDown ? 'open & down' : thumbOpen ? 'open' : 'closed'}`}</div>
          <div>{`Index: ${firstOpen ? 'open' : 'closed'}`}</div>
          <div>{`Middle: ${secondOpen ? 'open' : 'closed'}`}</div>
          <div>{`Ring: ${thirdOpen ? 'open' : 'closed'}`}</div>
          <div>{`Pinkie: ${fourthOpen ? 'open' : 'closed'}`}</div>
        </div>

        <div className="inline-block-sm">
          <strong>Predicted Gesture</strong><br />
          <img className="predicted-gesture" src={predictedImage} />
        </div>

      </div>

    </div>
  );
}

export default App;

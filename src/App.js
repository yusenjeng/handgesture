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
window.HAND_THRESHOLD = 0.96;

/**
 * geometric functions
 */
const D2 = (v1, v2) => {
  return Math.sqrt((v1[0] - v2[0]) ** 2 + (v1[1] - v2[1]) ** 2).toFixed(1);
}
const larger = (d1, d2) => {
  return d1 - d2 > 15;
}
const largerForThumb = (d1, d2) => {
  return d1 - d2 > 10;
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
  return !isFist && largerForThumb(d4, d3) && isStraight;
};

const isFirstOpen = (landmarks) => {
  const d8 = D2(landmarks[8], landmarks[0]);
  const d7 = D2(landmarks[7], landmarks[0]);
  const d6 = D2(landmarks[6], landmarks[0]);

  const angel1 = angel(landmarks[8], landmarks[7], landmarks[6], landmarks[7]);
  const angel2 = angel(landmarks[7], landmarks[6], landmarks[5], landmarks[6]);
  const angel3 = angel(landmarks[6], landmarks[5], landmarks[0], landmarks[5]);
  const isStraight = straight(angel1) && straight(angel2) && straight(angel3);
  // console.log("larger d8d7: ", larger(d8, d7), "larger d8d6: ", larger(d8, d6), "isStraight: ", isStraight);
  return isStraight && larger(d8, d7) && larger(d8, d6);
};

const isSecondOpen = (landmarks) => {
  const d12 = D2(landmarks[12], landmarks[0]);
  const d11 = D2(landmarks[11], landmarks[0]);
  const d10 = D2(landmarks[10], landmarks[0]);
  const angel1 = angel(landmarks[12], landmarks[11], landmarks[10], landmarks[11]);
  const angel2 = angel(landmarks[11], landmarks[10], landmarks[9], landmarks[10]);
  const angel3 = angel(landmarks[10], landmarks[9], landmarks[0], landmarks[9]);
  const isStraight = straight(angel1) && straight(angel2) && straight(angel3);
  return isStraight && larger(d12, d11) && larger(d12, d10);
};

const isThirdOpen = (landmarks) => {
  const d16 = D2(landmarks[16], landmarks[0]);
  const d15 = D2(landmarks[15], landmarks[0]);
  const d14 = D2(landmarks[14], landmarks[0]);
  const angel1 = angel(landmarks[16], landmarks[15], landmarks[14], landmarks[15]);
  const angel2 = angel(landmarks[15], landmarks[14], landmarks[13], landmarks[14]);
  const angel3 = angel(landmarks[14], landmarks[13], landmarks[0], landmarks[13]);
  const isStraight = straight(angel1) && straight(angel2) && straight(angel3);
  return isStraight && larger(d16, d15) && larger(d16, d14);
};

const isFourthOpen = (landmarks) => {
  const d20 = D2(landmarks[20], landmarks[0]);
  const d19 = D2(landmarks[19], landmarks[0]);
  const d18 = D2(landmarks[18], landmarks[0]);
  const angel1 = angel(landmarks[20], landmarks[19], landmarks[18], landmarks[19]);
  const angel2 = angel(landmarks[19], landmarks[18], landmarks[17], landmarks[18]);
  const angel3 = angel(landmarks[18], landmarks[17], landmarks[0], landmarks[17]);
  const isStraight = straight(angel1) && straight(angel2) && straight(angel3);
  return isStraight && larger(d20, d19) && larger(d20, d18);
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

  const [picWidth, setPicWidth] = useState(640);
  const [picHeight, setPicHeight] = useState(360);

  const [thumbUp, setThumbUp] = useState(false);
  const [thumbDown, setThumbDown] = useState(false);

  const [thumbOpen, setThumbOpen] = useState(false);
  const [firstOpen, setFirstOpen] = useState(false);
  const [secondOpen, setSecondOpen] = useState(false);
  const [thirdOpen, setThirdOpen] = useState(false);
  const [fourthOpen, setFourthOpen] = useState(false);

  const [poseThumbUp, setPoseThumbUp] = useState(false);
  const [poseThumbDown, setPoseThumbDown] = useState(false);
  const [poseOne, setPoseOne] = useState(false);
  const [poseTwo, setPoseTwo] = useState(false);
  const [poseThree, setPoseThree] = useState(false);
  const [poseFour, setPoseFour] = useState(false);
  const [poseFive, setPoseFive] = useState(false);

  const [predictedImage, setPredictedImage] = useState(null);

  /**
   * Setup model and cam video
   */
  useEffect(() => {
    async function setup() {
      await tf.setBackend('webgl');

      const startLoadTime = new Date().getTime();
      window.model = await handtrack.load();
      console.log("ML model loaded. Elapsed time: ", new Date().getTime() - startLoadTime);

      const constraints = {audio: false, video: {width: 480, height: 360}};
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log("Get user media success!", stream);

      // for react
      localVideoRef.current.srcObject = stream;
      localVideoRef.current.play();

      // Update css size to be video size
      setPicWidth(stream.getVideoTracks()[0].getSettings().width);
      setPicHeight(stream.getVideoTracks()[0].getSettings().height);
      canvasRef.current.width = picWidth;
      canvasRef.current.height = picHeight;
      layerRef.current.width = picWidth;
      layerRef.current.height = picHeight;
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
      ctx.drawImage(video, 0, 0, picWidth, picHeight);

      // Clear prediction layer
      ltx.clearRect(0, 0, picWidth, picHeight);

      // Hand prediction
      const predictions = await computeHandpose(canvas);
      if (predictions.length > 0 && predictions[0].handInViewConfidence > window.HAND_THRESHOLD) {

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
    setPoseOne(!thumbOpen && firstOpen && !secondOpen && !thirdOpen && !fourthOpen);
    setPoseTwo(!thumbOpen && firstOpen && secondOpen && !thirdOpen && !fourthOpen);
    setPoseThree(!thumbOpen && firstOpen && secondOpen && thirdOpen && !fourthOpen);
    setPoseFour(!thumbOpen && firstOpen && secondOpen && thirdOpen && fourthOpen);
    setPoseFive(thumbOpen && firstOpen && secondOpen && thirdOpen && fourthOpen);
  }, [thumbUp, thumbDown, thumbOpen, firstOpen, secondOpen, thirdOpen, fourthOpen]);

  /**
   * Image Logic
   */
  useEffect(()=>{
    if (poseThumbUp) {
      setPredictedImage(imgHandThumbsUp);
    } else if (poseThumbDown) {
      setPredictedImage(imgHandThumbsDown);
    } else if (poseFive) {
      setPredictedImage(imgHandFive);
    } else if (poseFour) {
      setPredictedImage(imgHandFour);
    } else if (poseThree) {
      setPredictedImage(imgHandThree);
    } else if (poseTwo) {
      setPredictedImage(imgHandTwo);
    } else if (poseOne) {
      setPredictedImage(imgHandOne);
    }else {
      setPredictedImage(imgHandNone);
    }
  }, [poseThumbUp, poseThumbDown, poseFive, poseFour, poseThree, poseTwo, poseOne]);

  return (
    <div className="app">

      <div className="app-header">
        <h1><img className="cisco-logo" src={imgCiscoLogo} />Webex GestureUI Demo</h1>
      </div>

      <div>
        <div className="inline-block-lg">
          <p><strong>User View</strong></p>
          <video autoPlay ref={localVideoRef} style={{width: picWidth, height: picHeight}} />
        </div>
        <div className="inline-block-lg">
          <p><strong>Computer Vision View</strong></p>
          <div className="canvas-container">
            <canvas ref={canvasRef} style={{width: picWidth, height: picHeight, filter: "grayscale(100%)"}} />
            <canvas ref={layerRef} style={{width: picWidth, height: picHeight}} />
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
          <div>{`Pinky: ${fourthOpen ? 'open' : 'closed'}`}</div>
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

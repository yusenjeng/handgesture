import React, {useEffect, useState, useRef} from 'react';
import * as handtrack from '@tensorflow-models/handpose';
import '@tensorflow/tfjs-backend-webgl';
import '@tensorflow/tfjs-backend-cpu';
import * as tf from '@tensorflow/tfjs';
import './App.css';

import imgCiscoLogo from './img/cisco-logo.png';
import Gesture from './Gesture';

window.model = null;
window.iterator = 0;
window.fps = 0;
window.prevTime = 0;

window.fingers = ['thumb', 'indexFinger', 'middleFinger', 'ringFinger', 'pinky'];
window.FINGER_LANDMARK_POINTS = 4;
window.HAND_THRESHOLD = 0.96;

function App() {
  const localVideoRef = useRef(null);
  const canvasRef = useRef(null)
  const layerRef = useRef(null)
  const [uiFPS, setUiFPS] = useState(0);

  const [picWidth, setPicWidth] = useState(640);
  const [picHeight, setPicHeight] = useState(360);

  const [landmarks, setLandmarks] = useState([]);

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

    const drawPrediction = function(prediction) {
      var predictedPoints = prediction.landmarks;

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

      // draw bounding box
      ltx.strokeStyle = 'aqua';
      const bb_x = prediction.boundingBox.topLeft[0];
      const bb_y = prediction.boundingBox.topLeft[1];
      const bb_width = prediction.boundingBox.bottomRight[0] - bb_x;
      const bb_height = prediction.boundingBox.bottomRight[1] - bb_y;
      ltx.rect(bb_x, bb_y, bb_width, bb_height);
      console.log(bb_x, bb_y, bb_width, bb_height);
      ltx.stroke();

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
      let landmarks = [];
      if (predictions.length > 0 && predictions[0].handInViewConfidence > window.HAND_THRESHOLD) {
        drawPrediction(predictions[0]);

        // refer to this pic (this is left hand, right hand is similar): https://gist.github.com/TheJLifeX/74958cc59db477a91837244ff598ef4a#file-02-landmarks-jpg
        landmarks = predictions[0].landmarks;   
      }
      setLandmarks(landmarks);

      window.requestAnimationFrame(draw);
    }

    video.addEventListener('play', function() {
      window.requestAnimationFrame(draw);
      console.log('Ready', canvas.width, canvas.height, video.paused, video.ended)
    });

  }, []);

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

        <Gesture landmarks={landmarks} />
      </div>

    </div>
  );
}

export default App;

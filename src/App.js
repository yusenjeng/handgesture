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
window.displayText = '';

// const requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame ||
//                             window.webkitRequestAnimationFrame || window.msRequestAnimationFrame;

// const cancelAnimationFrame = window.cancelAnimationFrame || window.mozCancelAnimationFrame;

function App() {
  const videoRef = useRef(null);
  const videoLayerRef = useRef(null)
  const canvasRef = useRef(null)
  const canvasLayerRef = useRef(null)
  const [uiFPS, setUiFPS] = useState(0);
  const [videoReady, setVideoReady] = useState(false);
  const [animationOn, setAnimationOn] = useState(false);

  const [picWidth, setPicWidth] = useState(480);
  const [picHeight, setPicHeight] = useState(360);

  const [landmarks, setLandmarks] = useState([]);
  const [requestId, setRequestId] = useState(null);

  /**
   * Setup model and cam video
   */
  useEffect(() => {
    async function setup() {
      await tf.setBackend('webgl');

      const startLoadTime = new Date().getTime();
      window.model = await handtrack.load();
      console.log("ML model loaded. Elapsed time: ", new Date().getTime() - startLoadTime);

      const constraints = {audio: false, video: {width: picWidth, height: picHeight}};
      const devices = await navigator.mediaDevices.enumerateDevices();
      const deviceFacetime = devices.filter(device => /FaceTime/i.test(device.label));
      constraints.video.deviceId = deviceFacetime[0].deviceId;
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log("Get user media success!", stream);

      // for react
      videoRef.current.srcObject = stream;
      videoRef.current.play();

      // Update css size to be video size
      setPicWidth(stream.getVideoTracks()[0].getSettings().width);
      setPicHeight(stream.getVideoTracks()[0].getSettings().height);
      videoLayerRef.current.width = picWidth;
      videoLayerRef.current.height = picHeight;
      canvasRef.current.width = picWidth;
      canvasRef.current.height = picHeight;
      canvasLayerRef.current.width = picWidth;
      canvasLayerRef.current.height = picHeight;
    }

    setup();
  }, []);

  /**
   * Setup Canvas and Prediction
   */
  useEffect(() => {
    const video = videoRef.current;
    const videoLayer = videoLayerRef.current;
    const vltx = videoLayer.getContext('2d');
    const canvas = canvasRef.current;
    const canvasLayer = canvasLayerRef.current;
    const ctx = canvas.getContext('2d');
    const cltx = canvasLayer.getContext('2d');

    video.addEventListener('play', function() {
      setVideoReady(true);
      console.log('Ready', canvas.width, canvas.height, video.paused, video.ended)
    });

    const computeHandpose = async function(target) {
      const predictions = await window.model.estimateHands(target);

      return predictions;
    }

    const drawPrediction = function(prediction) {
      var predictedPoints = prediction.landmarks;

      // draw points
      cltx.fillStyle = 'lime';
      for (let i = 0; i < predictedPoints.length; i++) {
        const y = predictedPoints[i][0];
        const x = predictedPoints[i][1];
        cltx.beginPath();
        cltx.arc(y, x, 3, 0, 2 * Math.PI);
        cltx.fill();
      }

      // draw lines
      cltx.strokeStyle = 'lime';
      for (let i = 0; i < window.fingers.length; i++) {
        const region = new Path2D();
        const basePoint = predictedPoints[0];
        region.moveTo(basePoint[0], basePoint[1]);

        // draw line of 4 landmark points for each finger
        for (let j = 1; j <= window.FINGER_LANDMARK_POINTS; j++) {
          region.lineTo(predictedPoints[i * window.FINGER_LANDMARK_POINTS + j][0],
            predictedPoints[i * window.FINGER_LANDMARK_POINTS + j][1]);
        }

        cltx.stroke(region);
      }

      // draw bounding box
      cltx.strokeStyle = 'aqua';
      const bb_x = prediction.boundingBox.topLeft[0];
      const bb_y = prediction.boundingBox.topLeft[1];
      const bb_width = prediction.boundingBox.bottomRight[0] - bb_x;
      const bb_height = prediction.boundingBox.bottomRight[1] - bb_y;
      cltx.rect(bb_x, bb_y, bb_width, bb_height);
      cltx.stroke();

      // draw display text
      const posText = [...predictedPoints[9]];  // clone position array
      posText[1] -= 30;
      if (window.displayText.trim()) {
        vltx.beginPath();
        vltx.fillStyle = 'white';
        vltx.fillRect(posText[0] - bb_width/4, posText[1] - bb_height/6, bb_width/2, bb_height/3);
        vltx.fillStyle = 'black';
        vltx.rect(posText[0] - bb_width/4, posText[1] - bb_height/6, bb_width/2, bb_height/3);
        vltx.textAlign = 'center';
        vltx.textBaseline = 'middle';
        vltx.font = (bb_width / 12) + 'px Arial';
        vltx.fillText(window.displayText.trim(), posText[0], posText[1], bb_width/2 - 10);
        vltx.stroke();
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
      vltx.clearRect(0, 0, picWidth, picHeight);
      cltx.clearRect(0, 0, picWidth, picHeight);

      // Hand prediction
      const predictions = await computeHandpose(canvas);
      let landmarks = [];
      if (predictions.length > 0 && predictions[0].handInViewConfidence > window.HAND_THRESHOLD) {
        drawPrediction(predictions[0]);

        // refer to this pic (this is left hand, right hand is similar): https://gist.github.com/TheJLifeX/74958cc59db477a91837244ff598ef4a#file-02-landmarks-jpg
        landmarks = predictions[0].landmarks;
      }
      setLandmarks(landmarks);

      setRequestId(window.requestAnimationFrame(draw));
    }

    if (animationOn && videoReady) {
      setRequestId(window.requestAnimationFrame(draw));
    } else {
      ctx.clearRect(0, 0, picWidth, picHeight);
      cancelAnimationFrame(requestId);
    }
  }, [animationOn, videoReady]);

  const handleStartStop = (e) => {
    setAnimationOn(!animationOn);
    console.log("animationOn: ", animationOn);
  }

  const onGestureEvent = (msg) => {
    window.displayText = msg;
  };

  return (
    <div className="app">

      <div className="app-header">
        <h1><img className="cisco-logo" src={imgCiscoLogo} />Webex GestureUI Demo</h1>
      </div>

      <div>
        <div className="inline-block-lg">
          <p><strong>User View</strong></p>
          <div className="canvas-container">
            <video autoPlay ref={videoRef} style={{width: picWidth, height: picHeight}} />
            <canvas ref={videoLayerRef} style={{width: picWidth, height: picHeight}} />
          </div>
        </div>
        <div className="inline-block-lg">
          <p><strong>Computer Vision View</strong></p>
          <div className="canvas-container">
            <canvas ref={canvasRef} style={{width: picWidth, height: picHeight, filter: "grayscale(100%)"}} />
            <canvas ref={canvasLayerRef} style={{width: picWidth, height: picHeight}} />
          </div>
        </div>
        
      </div>

      <div>
        <div className="inline-block-sm">
          <strong>Statistics</strong><br />
          <span>Average FPS: {uiFPS}</span>
        </div>

        <div className="inline-block-sm">
          <strong>Display Text</strong><br />
          <input type="text" onChange={e => {window.displayText = e.target.value}}/>
          <small>{window.displayText.trim() ? "hold hand up to display" : "enter text to enable"}</small>
        </div>

        <div className="inline-block-sm">
          <button id="startStop" onClick={handleStartStop} enabled={videoReady.toString()}>
            {animationOn ? "Stop Animation" : "Start Animation"}
          </button>
        </div>

        <Gesture landmarks={landmarks} onEvent={onGestureEvent} />
      </div>

    </div>
  );
}

export default App;

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

window.stickyNotes = {action: null, saved: []};
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

      // draw new sticky note
      const posText = [...predictedPoints[9]];  // clone position array
      if (window.stickyNotes.action) {
        var r_x = posText[0];
        var r_y = posText[1];
        var r_width = bb_width;
        var r_height = bb_height;
        var r_text = window.displayText.trim();
        createStickyNote(r_x, r_y, r_width, r_height, r_text);
        if (window.stickyNotes.action === "save") {
          window.stickyNotes.saved.push({x: r_x, y: r_y, width: r_width, height: r_height, text: r_text});
          window.stickyNotes.action = null;
        }
      }

    }

    function createStickyNote(x, y, width, height, text) {
      vltx.translate(picWidth, 0); // flip horizontally
      vltx.scale(-1, 1);
      vltx.beginPath();
      vltx.fillStyle = '#FFFF99';
      vltx.fillRect(picWidth - x - width/4, y - height/6, width/2, height/3);
      vltx.fillStyle = '#0B0B0B';
      vltx.textAlign = 'center';
      vltx.textBaseline = 'middle';
      var lines = text.split('\n');
      var fontSize = Math.min(width/18, (height/3) / lines.length);
      vltx.font = fontSize + 'px Helvetica';
      for (var i = 0; i < lines.length; i++) {
        vltx.fillText(lines[i], picWidth - x, y + (i * fontSize) - ((lines.length-1) * fontSize/2), width/2 - 10);
      }
      vltx.stroke();
      vltx.translate(picWidth, 0); // flip back
      vltx.scale(-1, 1);
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

      // Draw saved sticky notes first
      for (const r of window.stickyNotes.saved) {
        createStickyNote(r.x, r.y, r.width, r.height, r.text);
      }

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
      ctx.fillRect(0, 0, picWidth, picHeight);
      cancelAnimationFrame(requestId);
    }
  }, [animationOn, videoReady]);

  const handleStartStop = (e) => {
    setAnimationOn(!animationOn);
    setUiFPS(0);
    handleDeleteNotes();
    videoLayerRef.current.getContext('2d').clearRect(0, 0, picWidth, picHeight);
    canvasLayerRef.current.getContext('2d').clearRect(0, 0, picWidth, picHeight);
    console.log("animationOn: ", animationOn);
  }

  const handleStickyNotes = (e) => {
    if (window.stickyNotes.action === null) {
      window.stickyNotes.action = 'draw';
    } else if (window.stickyNotes.action === 'draw') {
      window.stickyNotes.action = 'save';
    }
  }

  const handleDeleteNotes = (e) => {
    window.stickyNotes.action = null;
    window.stickyNotes.saved = [];
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
          <strong>Demo Statistics</strong>
          <p>
            <span>Average FPS: {uiFPS}</span><br />
            <button onClick={handleStartStop} enabled={videoReady.toString()} style={{backgroundColor: animationOn ? "red" : "green", color: "white"}}>
              {animationOn ? "Stop Demo" : "Start Demo"}
            </button>
            <span><small>{animationOn && uiFPS < 1 ? "loading cv view..." : ""}</small></span>
          </p>
        </div>

        <Gesture landmarks={landmarks} onEvent={onGestureEvent} />

        <div className="inline-block-sm">
          <strong>AR Sticky Notes</strong>
          <p>
            <textarea placeholder="Enter text..." onChange={e => {window.displayText = e.target.value}}></textarea>
            <button onClick={handleStickyNotes} enabled={animationOn.toString()} style={{backgroundColor: "yellow"}}>
              {window.stickyNotes.action ? "Post Note" : "Add Note"}
            </button>
            <button onClick={handleDeleteNotes} enabled={animationOn.toString()} style={{backgroundColor: "lightgray"}}>
              Delete Notes
            </button>
          </p>
        </div>

      </div>

    </div>
  );
}

export default App;

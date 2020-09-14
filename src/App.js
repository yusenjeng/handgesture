import React, {useEffect, useState, useRef} from 'react';
import * as handtrack from '@tensorflow-models/handpose';
import '@tensorflow/tfjs-backend-webgl';
import '@tensorflow/tfjs-backend-cpu';
import * as tf from '@tensorflow/tfjs';
import './App.css';

window.model = null;
window.iterator = 0;
window.fps = 0;
window.prevTime = 0;

// look up indices for predictions[0].landmarks
window.fingerIndices = {
  thumb: [0, 1, 2, 3, 4],
  indexFinger: [0, 5, 6, 7, 8],
  middleFinger: [0, 9, 10, 11, 12],
  ringFinger: [0, 13, 14, 15, 16],
  pinky: [0, 17, 18, 19, 20]
};

function App() {
  const localVideoRef = useRef(null);
  const canvasRef = useRef(null)
  const [uiFPS, setUiFPS] = useState(0);

  /**
   * Setup model and cam video
   */
  useEffect(() => {
    async function setup() {
      await tf.setBackend('webgl');

      const startLoadTime = new Date().getTime();
      window.model = await handtrack.load();
      console.log("ML model loaded. Elapsed time: ", new Date().getTime() - startLoadTime);

      const stream = await navigator.mediaDevices.getUserMedia({video: true, audio: false});
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
  useEffect(()=>{
    const video = localVideoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    ctx.strokeStyle = 'red';
    ctx.fillStyle = 'red';

    // Assign css size to be screen size
    canvas.width = canvas.clientWidth;
    canvas.height= canvas.clientHeight;

    const computeHandpose = async function(target) {
      const predictions = await window.model.estimateHands(target);
      
      return predictions;
    }

    const drawPrediction = function(predictedPoints) {
      // draw points
      for (let i = 0; i < predictedPoints.length; i++) {
        const y = predictedPoints[i][0];
        const x = predictedPoints[i][1];
        ctx.beginPath();
        ctx.arc(y, x, 3, 0, 2 * Math.PI);
        ctx.fill();
      }

      // draw lines
      const fingers = Object.keys(window.fingerIndices);
      for (let i = 0; i < fingers.length; i++) {
        const fingerPoints = window.fingerIndices[fingers[i]].map(idx => predictedPoints[idx]);

        // draw line for each finger (5 points)
        const region = new Path2D();
        region.moveTo(fingerPoints[0][0], fingerPoints[0][1]); // move to base point
        for (let j = 1; j < fingerPoints.length; j++) {
          region.lineTo(fingerPoints[j][0], fingerPoints[j][1]);
        }

        ctx.stroke(region);
      }
    }

    async function draw(tm) {
      if(video.paused || video.ended) return false;

      // FPS calculation
      const dt = tm - window.prevTime;
      window.prevTime = tm;
      window.fps = window.fps * 0.85 + (1000/dt) * 0.15;
      setUiFPS(window.fps.toFixed(2));

      // Draw video to canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Hand prediction
      const predictions = await computeHandpose(canvas);

      if (predictions.length > 0) {
        console.log("Iteration: ", window.iterator++, ", predictions: ", predictions);
        const result = predictions[0].landmarks;
        drawPrediction(result);
      }

      window.requestAnimationFrame(draw);
    }

    video.addEventListener('play', function() {
      window.requestAnimationFrame(draw);
      console.log('Ready', canvas.width, canvas.height, video.paused , video.ended)
    });

  }, []);

  return (
    <div className="App">
      <video autoPlay ref={localVideoRef} />
      <canvas ref={canvasRef} />
      <div>
        Average FPS: {uiFPS}
      </div>
    </div>
  );
}

export default App;

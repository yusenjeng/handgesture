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

window.fingers = ['thumb', 'indexFinger', 'middleFinger', 'ringFinger', 'pinky'];
window.FINGER_LANDMARK_POINTS = 4;

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
      for (let i = 0; i < window.fingers.length; i++) {
        const region = new Path2D();
        const basePoint = predictedPoints[0];
        region.moveTo(basePoint[0], basePoint[1]);

        // draw line of 4 landmark points for each finger
        for (let j = 1; j <= window.FINGER_LANDMARK_POINTS; j++) {
          region.lineTo(predictedPoints[i * window.FINGER_LANDMARK_POINTS + j][0], 
                        predictedPoints[i * window.FINGER_LANDMARK_POINTS + j][1]);
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
        drawPrediction(predictions[0].landmarks);
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

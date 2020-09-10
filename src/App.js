import React, {useEffect, useRef} from 'react';
import * as handtrack from '@tensorflow-models/handpose';
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';
import '@tensorflow/tfjs-backend-cpu';

let model;

function App() {
  const localVideo = useRef(null);

  useEffect(()=>{
    async function setup(){
      await tf.setBackend('webgl');
      console.log(new Date());
      model = await handtrack.load();
      console.log(new Date());
      
      const stream = await navigator.mediaDevices.getUserMedia({video:true});
      console.log("Get user media success!", stream);

      // for react
      localVideo.current.srcObject = stream;

      // for ML model
      let videoElem = document.createElement("video");
      videoElem.srcObject = stream;

      return new Promise((resolve) => {
        videoElem.onloadedmetadata = () => {
          resolve(videoElem);
        };
      });
    }

    async function main() {
      const localVideoElem = await setup();
      localVideoElem.play();

      // TODO: use hardcoded 3s interval
      setInterval(
        async () => {await computeHandpose(localVideoElem)}, 
        3000
      );
    }

    const computeHandpose = async function(videoElem) {
      console.log("Loaded data, start computing...");
      let i = 0;
      // while (i < 100) {
        const predictions = await model.estimateHands(videoElem);
        // console.log("Finished: ", predictions);
        // console.log(localVideoElem.srcObject);
        console.log("Iteration: ", i);
        if (predictions.length > 0) {
          /*
          `predictions` is an array of objects describing each detected hand, for example:
          [
            {
              handInViewConfidence: 1, // The probability of a hand being present.
              boundingBox: { // The bounding box surrounding the hand.
                topLeft: [162.91, -17.42],
                bottomRight: [548.56, 368.23],
              },
              landmarks: [ // The 3D coordinates of each hand landmark.
                [472.52, 298.59, 0.00],
                [412.80, 315.64, -6.18],
                ...
              ],
              annotations: { // Semantic groupings of the `landmarks` coordinates.
                thumb: [
                  [412.80, 315.64, -6.18]
                  [350.02, 298.38, -7.14],
                  ...
                ],
                ...
              }
            }
          ]
          */
  
          for (let i = 0; i < predictions.length; i++) {
            const keypoints = predictions[i].landmarks;
  
            // Log hand keypoints.
            for (let i = 0; i < keypoints.length; i++) {
              const [x, y, z] = keypoints[i];
              console.log(`Keypoint ${i}: [${x}, ${y}, ${z}]`);
            }
          }
        }
        // i++;
      // }
    }
    
    main();

  }, []);

  return (
    <div className="App">
      yes we can
      <video autoPlay ref={localVideo}></video>
    </div>
  );
}

export default App;

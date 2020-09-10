import React, {useEffect, useRef} from 'react';
import * as handtrack from '@tensorflow-models/handpose';
import '@tensorflow/tfjs-backend-webgl';
import '@tensorflow/tfjs-backend-cpu';

let localVideoElem = document.createElement("video");
let model;

function App() {
  const localVideo = useRef(null);

  localVideoElem.onloadeddata = async function() {
    console.log("Loaded data, start computing...");
    let i = 0;
    while (i < 100) {
      const predictions = await model.estimateHands(localVideoElem);
      console.log("Finished: ", predictions);
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
      i++;
    }
  }

  useEffect(()=>{
    async function init(){
      console.log(new Date());
      model = await handtrack.load();
      console.log(new Date());
      
      await navigator.getUserMedia({video:true}, 
        
          processVideo, 
        (e) => {console.log(e)});
    }

    async function processVideo(stream) {
      console.log(stream);
      localVideo.current.srcObject = stream;
      localVideoElem.srcObject = stream;
      // localVideoElem.src = "./bunny.mp4";
    }

    init();

  }, []);

  return (
    <div className="App">
      yes we can
      <video autoPlay ref={localVideo}></video>
    </div>
  );
}

export default App;

import React, {useEffect, useState, useRef} from 'react';
import ParamSlider from './ParamSlider';
import './App.css';

import imgHandOne from './img/hand-one.png';
import imgHandTwo from './img/hand-two.png';
import imgHandThree from './img/hand-three.png';
import imgHandFour from './img/hand-four.png';
import imgHandFive from './img/hand-five.png';
import imgHandThumbsUp from './img/hand-thumbsup.png';
import imgHandThumbsDown from './img/hand-thumbsdown.png';
import imgHandNone from './img/hand-blank.png';

function Gesture(props) {
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

  const [thumbDist, setParameter1] = useState(10);
  const [parameter2, setParameter2] = useState(100);

  const updateParam = (id, value) => {
    if (id === "thumbDist") {
      console.log(value);
      setParameter1(value);
    } else if (id === "parameter2") {
      setParameter2(value);
    }
  };

  /**
    *  geometric functions
  */
  const D2 = (v1, v2) => {
    return Math.sqrt((v1[0] - v2[0]) ** 2 + (v1[1] - v2[1]) ** 2).toFixed(1);
  }
  const larger = (d1, d2) => {
    return d1 - d2 > thumbDist * 1.5;
  }
  const largerForThumb = (d1, d2) => {
    return d1 - d2 > thumbDist;
  }
  const straight = (angle) => {
    return angle > 100;
  }
  const straightThumb = (angle) => {
    return angle > 130;  // my thumb is fat and short, so sad
  }

  const angle = (A1, A2, B1, B2) => {
    var dAx = A2[0] - A1[0];
    var dAy = A2[1] - A1[1];
    var dBx = B2[0] - B1[0];
    var dBy = B2[1] - B1[1];
    var angle = Math.atan2(dAx * dBy - dAy * dBx, dAx * dBx + dAy * dBy);
    if(angle < 0) {angle = angle * -1;}
    var degree_angle = angle * (180 / Math.PI);
    return Math.floor(degree_angle);
  }

  /**
   * Helper functions
   */
  const isThumbOpen = (landmarks) => {
    const d4 = D2(landmarks[4], landmarks[0]);
    const d3 = D2(landmarks[3], landmarks[0]);

    const d46 = D2(landmarks[4], landmarks[6]);
    const isFist = d46 < 60;

    const angle1 = angle(landmarks[4], landmarks[3], landmarks[2], landmarks[3]);
    const angle2 = angle(landmarks[3], landmarks[2], landmarks[1], landmarks[2]);
    const angle3 = angle(landmarks[2], landmarks[1], landmarks[0], landmarks[1]);
    const isStraight = straightThumb(angle1) && straightThumb(angle2) && straightThumb(angle3);
    return !isFist && largerForThumb(d4, d3) && isStraight;
  };

  const isFirstOpen = (landmarks) => {
    const d8 = D2(landmarks[8], landmarks[0]);
    const d7 = D2(landmarks[7], landmarks[0]);
    const d6 = D2(landmarks[6], landmarks[0]);

    const angle1 = angle(landmarks[8], landmarks[7], landmarks[6], landmarks[7]);
    const angle2 = angle(landmarks[7], landmarks[6], landmarks[5], landmarks[6]);
    const angle3 = angle(landmarks[6], landmarks[5], landmarks[0], landmarks[5]);
    const isStraight = straight(angle1) && straight(angle2) && straight(angle3);
    // console.log("larger d8d7: ", larger(d8, d7), "larger d8d6: ", larger(d8, d6), "isStraight: ", isStraight);
    return isStraight && larger(d8, d7) && larger(d8, d6);
  };

  const isSecondOpen = (landmarks) => {
    const d12 = D2(landmarks[12], landmarks[0]);
    const d11 = D2(landmarks[11], landmarks[0]);
    const d10 = D2(landmarks[10], landmarks[0]);
    const angle1 = angle(landmarks[12], landmarks[11], landmarks[10], landmarks[11]);
    const angle2 = angle(landmarks[11], landmarks[10], landmarks[9], landmarks[10]);
    const angle3 = angle(landmarks[10], landmarks[9], landmarks[0], landmarks[9]);
    const isStraight = straight(angle1) && straight(angle2) && straight(angle3);
    return isStraight && larger(d12, d11) && larger(d12, d10);
  };

  const isThirdOpen = (landmarks) => {
    const d16 = D2(landmarks[16], landmarks[0]);
    const d15 = D2(landmarks[15], landmarks[0]);
    const d14 = D2(landmarks[14], landmarks[0]);
    const angle1 = angle(landmarks[16], landmarks[15], landmarks[14], landmarks[15]);
    const angle2 = angle(landmarks[15], landmarks[14], landmarks[13], landmarks[14]);
    const angle3 = angle(landmarks[14], landmarks[13], landmarks[0], landmarks[13]);
    const isStraight = straight(angle1) && straight(angle2) && straight(angle3);
    return isStraight && larger(d16, d15) && larger(d16, d14);
  };

  const isFourthOpen = (landmarks) => {
    const d20 = D2(landmarks[20], landmarks[0]);
    const d19 = D2(landmarks[19], landmarks[0]);
    const d18 = D2(landmarks[18], landmarks[0]);
    const angle1 = angle(landmarks[20], landmarks[19], landmarks[18], landmarks[19]);
    const angle2 = angle(landmarks[19], landmarks[18], landmarks[17], landmarks[18]);
    const angle3 = angle(landmarks[18], landmarks[17], landmarks[0], landmarks[17]);
    const isStraight = straight(angle1) && straight(angle2) && straight(angle3);
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

  

  useEffect(() => {
    if (props.landmarks.length > 0) {
      setThumbOpen(isThumbOpen(props.landmarks));
      setFirstOpen(isFirstOpen(props.landmarks));
      setSecondOpen(isSecondOpen(props.landmarks));
      setThirdOpen(isThirdOpen(props.landmarks));
      setFourthOpen(isFourthOpen(props.landmarks));
      setThumbUp(isThumbUp(props.landmarks));
      setThumbDown(isThumbDown(props.landmarks));
    } else {
      setThumbOpen(false);
      setFirstOpen(false);
      setSecondOpen(false);
      setThirdOpen(false);
      setFourthOpen(false);
      setThumbUp(false);
      setThumbDown(false);
    }
    
  }, [props.landmarks]);

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
    <div>
      <div className="inline-block-sm">
        <strong>Finger Data</strong><br />
        <div>{`Thumb: ${poseThumbUp ? 'open & up' : poseThumbDown ? 'open & down' : thumbOpen ? 'open' : 'closed'}`}</div>
        <div>{`Index: ${firstOpen ? 'open' : 'closed'}`}</div>
        <div>{`Middle: ${secondOpen ? 'open' : 'closed'}`}</div>
        <div>{`Ring: ${thirdOpen ? 'open' : 'closed'}`}</div>
        <div>{`Pinky: ${fourthOpen ? 'open' : 'closed'}`}</div>
      </div>

      <div className="inline-block-sm">
        <strong>Predicted Pose</strong><br />
        <img className="predicted-gesture" src={predictedImage} />
      </div>

      <div className="inline-block-sm">
        <ParamSlider param1={thumbDist} param2={parameter2} updateParam={updateParam}/>
      </div>
    </div>
  )
}

export default Gesture;
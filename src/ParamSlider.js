import React from 'react';

function ParamSlider(props) {

  const updateParameter = (event) => {
    props.updateParam(event.target.id, event.target.value);

  };

  return (
    <div>
      <strong>Parameters</strong><br />
          <p>
            ThumbDist: {`${props.thumbDist}`} <input type="range" min="1" max="60" value={props.thumbDist} onChange={updateParameter} id="thumbDist" />
          </p>
          <p>
            ThumbAngle: {`${props.thumbAngle}`} <input type="range" min="50" max="150" value={props.thumbAngle} onChange={updateParameter} id="thumbAngle" />
          </p>
    </div>
  )
}

export default ParamSlider;

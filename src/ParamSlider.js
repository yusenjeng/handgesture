import React, {useEffect, useState, useRef} from 'react';

function ParamSlider(props) {

  const updateParameter = (event) => {
    props.updateParam(event.target.id, event.target.value);
    
  };

  return (
    <div>
      <strong>Settings</strong><br />
          <p>
            Parameter 1: {`${props.param1}`} <input type="range" min="1" max="100" value={props.param1} onChange={updateParameter} id="parameter1" />
          </p>
          <p>
            Parameter 2: {`${props.param2}`} <input type="range" min="1" max="100" value={props.param2} onChange={updateParameter} id="parameter2" />
          </p>
    </div>
  )
}

export default ParamSlider;
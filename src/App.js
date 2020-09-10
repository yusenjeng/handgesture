import React, {useEffect} from 'react';
import * as handtrack from '@tensorflow-models/handpose';

function App() {

  useEffect(()=>{
    async function init(){
      console.log(new Date());
      const model = await handtrack.load();
      console.log(new Date());
    }

    init();

  }, []);

  return (
    <div className="App">
      yes we can
    </div>
  );
}

export default App;

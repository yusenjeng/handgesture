Handgesture (or GestureUI) is a React.js project for recognizing hand gestures to be used in the Webex Meeting Web App. 

## Interactive Emotional Collaboration

Based on a tuned deep learning [model](https://github.com/tensorflow/tfjs-models/tree/master/handpose), we used our own algorithms to recognize over 10 different poses and gestures. This allows us to create all-new meeting experiences that weren’t possible before. Some highlighted gestures include:

* Sending Emojis in a virtual meeting by making hand gestures (:thumbsup:, :v:, :point_up: and so on)
* Waving hands to leave a virtual meeting
* Showing sticky notes when you want to response in a virtual meeting

## Run locally

```yarn install``` to install the required packages.

Specifically, we need the packages for handpose DL model:
```
@tensorflow-models/handpose
@tensorflow/tfjs-core, @tensorflow/tfjs-converter
@tensorflow/tfjs-backend-webgl # or @tensorflow/tfjs-backend-wasm
```

```yarn start``` to run the app, then open [http://localhost:3000](http://localhost:3000) to view it in the browser.

You will be able to see the demo page like this:

![Image of Demo Page](https://github.com/yusenjeng/handgesture/blob/master/src/img/DemoPage.png)

Click the ```Start Demo``` button to load the model and see how your hand gesture is recognized.

You could also tune the parameters for your thumb, or add texts for the sticky notes.

## Integration to Webex Meeting Web App

The integration is not open-sourced. If you are interested, please contact us through Github :stuck_out_tongue_closed_eyes:

## References

The gesture icons we used is downloaded from [here](https://www.flaticon.com/packs/hands).

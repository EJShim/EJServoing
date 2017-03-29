var E_SocketManager = require('./E_SocketManager.js');
var E_MLManager = require('./E_MLManager.js');
var E_ImageManager = require('./E_ImageManager.js');

//Interactor
var E_Interactor = require('./E_Interactor.js');

var E_Image = require('../Core/E_Image.js');
var E_Axis = require('../Core/E_Axis.js');
var E_Tracker = require('../Core/E_Tracker.js')


//
// //STL Loader
// var STLLoader = require('three-stl-loader')(THREE);



function E_Manager()
{
  var m_socketMgr = new E_SocketManager(this);
  var m_imgMgr = new E_ImageManager(this);
  var m_tracker = new E_Tracker(this);

  this.mlMgr = null;
  this.renderer = [];

  this.SocketMgr = function()
  {
    return m_socketMgr;
  }

  this.ImageMgr = function()
  {
    return m_imgMgr;
  }

  this.Tracker = function()
  {
    return m_tracker;
  }

  this.m_bRunTrainning = false;
  this.m_bCalibration = false;
  this.m_bNNCalibration = false;

  this.prevTransform = new THREE.Matrix4();



  //Ground-Truth of Calibration
  //Get Global Annotation Matrix
  var globalmax = "[0.99999998211860657, 0.0005886557628400624, 0.0000024272976588690653, 0, -2.329772001985475e-7, 0.004519194730209017, 0.9999898076057434, 0,-0.00058866071049124, 0.9999896287918091, 0.0045191943645477295, 0,-0.052400823682546616, 48.713191986083984, 0.02711086571216583, 1]"
  this.groundMat = new THREE.Matrix4();
  this.groundMat.elements = JSON.parse(globalmax)

}

E_Manager.prototype.Initialize = function()
{
  $$("ID_LOG").getNode().style.background = "black"
  $$("ID_LOG").getNode().style.color = "green"
  $$("ID_LOG").getNode().style.fontSize = "9px"
  // $$("ID_LOG").getNode().style.marginLeft = "50px";
  // $$("ID_LOG").getNode().style.marginTop = "15px";


  //Initialzie Render Window
  var renWin = [];
  renWin[0] = $$("ID_VIEW_LEFT");
  renWin[1] = $$("ID_VIEW_RIGHT");

  //Initialize Renderer
  for(var i=0 ; i<2 ; i++){
    this.renderer[i] = new THREE.WebGLRenderer({preserveDrawingBuffer:true, alpha:true});
    this.renderer[i].scene = new THREE.Scene();
    this.renderer[i].camera = new THREE.PerspectiveCamera( 45, renWin[i].$width/renWin[i].$height, 0.1, 10000000000 );

    //Set Init Camera Position
    this.renderer[i].camera.position.z = -20;

    //Add Renderer to The Render Window
    renWin[i].getNode().replaceChild(this.renderer[i].domElement, renWin[i].$view.childNodes[0] );

    // console.log(this.renderer[i].domElement);
    this.renderer[i].renderWindow = renWin[i];
    this.renderer[i].setClearColor(0x000015);


    //Set Interactor
    this.renderer[i].interactor = new E_Interactor(this, this.renderer[i]);
  }

  this.renderer[0].pointLight = new THREE.PointLight(0xffffff);
  this.renderer[0].scene.add(this.renderer[0].pointLight);

  var camera1 = this.renderer[0].camera;
  var camera2 = this.renderer[1].camera;


  camera2.userData.axis = new E_Axis();
  this.renderer[1].scene.add(camera2.userData.axis);

  camera2.userData.helper = new THREE.CameraHelper(camera1);
  // var dist = 90 / 1200;
  // camera2.userData.helper.geometry.scale(dist, dist, dist);
  this.renderer[1].scene.add(camera2.userData.helper);

  this.UpdateWindowSize();
  this.Redraw();


  this.Animate();

  //Initialize Objects
  this.InitObject();
}

E_Manager.prototype.OnInitialize = function(data)
{
  this.actions = data.action;

  this.mlMgr = new E_MLManager(this, data.network);

  this.Initialize();
}

E_Manager.prototype.InitObject = function()
{
  var scene = this.renderer[0].scene;
  var scene2 = this.renderer[1].scene;

  var camera = this.renderer[0].camera;
  var camera2 = this.renderer[1].camera;

  var ambient = new THREE.AmbientLight(0x000000);

  this.tempImage = new E_Image();
  this.tempImage2 = new E_Image();

  this.tempImage.ImportImage('/images/four.png', scene);
  this.tempImage2.ImportImage('/images/four.png', scene2);



  camera.position.setFromMatrixPosition(new THREE.Matrix4().makeTranslation(4, 50, 40));
  camera.rotation.setFromRotationMatrix(new THREE.Matrix4().makeRotationX(-Math.PI/2));

  camera2.position.x = -150;
  camera2.position.z = 150;
  camera2.position.y = 65;
  camera2.lookAt(new THREE.Vector3(0, 45, 0));
}


E_Manager.prototype.UpdateWindowSize = function()
{
  for(var i=0 ; i<2 ; i++){
    this.renderer[i].setSize(this.renderer[i].renderWindow.$width, this.renderer[i].renderWindow.$height);
    this.renderer[i].camera.aspect = this.renderer[i].renderWindow.$width/this.renderer[i].renderWindow.$height;
    this.renderer[i].camera.updateProjectionMatrix();
  }

  this.ImageMgr().UpdateSize()
}

E_Manager.prototype.Redraw = function()
{

  camera1 = this.renderer[0].camera;
  camera2 = this.renderer[1].camera;


  // camera2.userData.axis.matrix.copy(camera2.matrixWorld.clone());
  var lookAt =  camera1.position.clone().sub( new THREE.Vector3(0, 0, 0)).multiplyScalar(0.5);
  camera2.lookAt( lookAt );
  camera2.userData.axis.position.setFromMatrixPosition(camera1.matrix.clone());
  camera2.userData.axis.rotation.setFromRotationMatrix(camera1.matrix.clone());
  var vec1 = camera1.position.clone().sub(camera2.position);
  var vec2 = lookAt.clone().sub(camera2.position);
  var eFov = Math.acos(vec1.clone().normalize().dot(vec2.clone().normalize())) * 3 ;
  camera2.fov =   eFov * ( 180 / Math.PI);
  camera2.updateProjectionMatrix();



  //Redraw
  for(var i=0 ; i<2 ; i++){
    this.renderer[i].render(this.renderer[i].scene, this.renderer[i].camera);
  }



  //Update 2d Canvas
  if(!this.m_bCalibration) {this.ImageMgr().ClearCanvas();}
  this.ImageMgr().RenderFakeFeatures(camera1);
  this.ImageMgr().DrawInitPoints();


}

E_Manager.prototype.Animate = function()
{

  this.renderer[0].interactor.Update();

  if(this.m_bCalibration){
    this.RunCalibration();
  }

  if(this.m_bRunTrainning){
    this.RunTraining();
  }

  if(this.m_bNNCalibration){
    this.NNCalibration();
  }

  requestAnimationFrame( this.Animate.bind(this) );
}

E_Manager.prototype.RunTraining = function()
{
  var camera = this.renderer[0].camera;
  var currMat = camera.matrix.clone();
  var log = "FeatureError : ";

  //Get 2D Feature Error
  var featureError = this.Tracker().GetError();
  var prevScore = 0.0;

  var inputData = [];
  for(var i in featureError){
    log +=  featureError[i].x + "," + featureError[i].y + "//";
    inputData.push(featureError[i].x);
    inputData.push(featureError[i].y);

    prevScore += featureError[i].length()
  }

  prevScore /= featureError.length;

  // console.log(curScore);

  //Get Camera Matrix
  var currentMat = camera.matrix.clone();
  var invCur = new THREE.Matrix4().getInverse(currentMat, true);
  //Annotation is a transformation matrix to the ground-truth matrix
  var annotation = invCur.clone().multiply(this.groundMat);

  // log += "<br><br> Annotation(Transformation) : <br>"
  // for(var i in annotation.elements){
  //   log += annotation.elements[i] + ",";
  //   if(i % 4 === 3) log += "<br>";
  // }



  var features = this.Tracker().calFeature;
  if(features[0].x < -270 || features[1].x < -270) {
    this.ReturnCamera(camera)
    return;
  }
  if(features[2].x > 270 || features[3].x > 270) {
    this.ReturnCamera(camera)
    return;
  }
  if(features[0].y < -270 || features[2].y < -270) {
    this.ReturnCamera(camera)
    return;
  }
  if(features[1].y > 270 || features[3].y > 270) {
    this.ReturnCamera(camera)
    return;
  }

  var volume = {data:inputData, class:annotation.elements};

  var idx = this.mlMgr.ForwardBrain(volume);

  //Get Action Transformation
  var action = this.actions[idx];
  actionArr = [];
  $.each(action, function(i, n){
    actionArr.push(n);
  });
  var actionMat = new THREE.Matrix4();
  actionMat.elements = actionArr;


  //Transform
  currMat.multiply(actionMat);


  this.prevTransform = camera.matrix.clone();
  camera.position.setFromMatrixPosition(currMat);
  camera.rotation.setFromRotationMatrix(currMat);

  this.Redraw();




  //Get Reward After actionMat
  //Get 2D Feature Error
  var featureError = this.Tracker().GetError();
  var curScore = 0.0;
  for(var i in featureError){
    curScore += featureError[i].length()
  }

  curScore /= featureError.length;

  var reward = Math.tanh(curScore - prevScore);

  if(reward >= 0) reward = -1;
  else reward = 1;

  this.mlMgr.BackwardBrain(reward);

  log += "<br><br>Reward : " + reward;
  // this.SetLog(log);
}

E_Manager.prototype.RunCalibration = function()
{
  this.ImageMgr().ClearCanvas();
  var camera = this.renderer[0].camera;
  var camera2 = this.renderer[1].camera;
  var trans = camera.matrix.clone();
  var rot = camera.matrix.clone();
  var velocity = this.Tracker().CalculateVelocity(camera);


  var scalefactor = 200000;
  rot.multiply(new THREE.Matrix4().makeRotationX(velocity.wx ));
  rot.multiply(new THREE.Matrix4().makeRotationY(velocity.wy ));
  rot.multiply(new THREE.Matrix4().makeRotationZ(velocity.wz ));
  camera.rotation.setFromRotationMatrix(rot);


  trans.multiply(new THREE.Matrix4().makeTranslation(velocity.vx, velocity.vy, velocity.vz ));
  camera.position.setFromMatrixPosition(trans);

  this.Redraw();
}

E_Manager.prototype.ReturnCamera = function(camera)
{

  camera.position.setFromMatrixPosition(this.prevTransform);
  camera.rotation.setFromRotationMatrix(this.prevTransform);
  this.Redraw();
}


E_Manager.prototype.Frand = function(min, max)
{
  var range = max - min;
  var value = Math.random();

  value *= range;
  value += min;

  return value;
}

E_Manager.prototype.OnNNCalibration = function(value)
{
  this.m_bNNCalibration = value;
}

E_Manager.prototype.NNCalibration = function()
{
  var camera = this.renderer[0].camera;

  //Get Camera Matrix
  var currentMat = camera.matrix.clone();
  var invCur = new THREE.Matrix4().getInverse(currentMat, true);
  //Annotation is a transformation matrix to the ground-truth matrix
  var annotation = invCur.clone().multiply(this.groundMat);

  //Get 2D Feature Error
  var featureError = this.Tracker().GetError();

  var inputData = [];
  for(var i in featureError){
    inputData.push(featureError[i].x);
    inputData.push(featureError[i].y);
  }



  var features = this.Tracker().calFeature;
  if(features[0].x < -270 || features[1].x < -270) {
    this.ReturnCamera(camera)
    return;
  }
  if(features[2].x > 270 || features[3].x > 270) {
    this.ReturnCamera(camera)
    return;
  }
  if(features[0].y < -270 || features[2].y < -270) {
    this.ReturnCamera(camera)
    return;
  }
  if(features[1].y > 270 || features[3].y > 270) {
    this.ReturnCamera(camera)
    return;
  }

  var volume = {data:inputData, class:annotation.elements};



  var idx = this.mlMgr.ForwardBrain(volume);
  //No Reward

  //Get Action Transformation
  var action = this.actions[idx];
  actionArr = [];
  $.each(action, function(i, n){
    actionArr.push(n);
  });
  var actionMat = new THREE.Matrix4();
  actionMat.elements = actionArr;

  //Transform
  currentMat.multiply(actionMat);

  //Update Camear Transformation
  this.prevTransform = camera.matrix.clone();
  camera.position.setFromMatrixPosition(currentMat);
  camera.rotation.setFromRotationMatrix(currentMat);

  this.Redraw();
}



E_Manager.prototype.CalibrateGround = function()
{
  var camera = this.renderer[0].camera;
  var currentMat = camera.matrix.clone();
  var invCur = new THREE.Matrix4().getInverse(currentMat, true);

  // This Translation Matrix will be the Annotation of Deep Learning
  var trans = invCur.clone().multiply(this.groundMat);

  // Predicted Matrix will be Applied like this way
  currentMat.multiply(trans);

  //Update Camear Transformation
  camera.position.setFromMatrixPosition(currentMat);
  camera.rotation.setFromRotationMatrix(currentMat);

  this.Redraw();
}

E_Manager.prototype.SetLog = function(text)
{
  $$("ID_LOG").getNode().innerHTML = text
}

E_Manager.prototype.AppendLog = function(text)
{
  $$("ID_LOG").getNode().innerHTML += text;
}

E_Manager.prototype.OnRunTrainning = function(value)
{
  if(value === 1){
    this.m_bRunTrainning = true;
  }else{
    this.m_bRunTrainning = false;
  }
}

E_Manager.prototype.OnRunCalibration = function(value)
{
  this.m_bCalibration = value;
}

module.exports = E_Manager;

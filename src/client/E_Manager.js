var E_SocketManager = require('./E_SocketManager.js');
var E_MLManager = require('./E_MLManager.js');
var E_ImageManager = require('./E_ImageManager.js');

//Interactor
var E_Interactor = require('./E_Interactor.js');

var E_Image = require('../Core/E_Image.js');
var E_Axis = require('../Core/E_Axis.js');


//
// //STL Loader
// var STLLoader = require('three-stl-loader')(THREE);



function E_Manager()
{
  var m_socketMgr = new E_SocketManager(this);
  var m_imgMgr = new E_ImageManager(this);

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

  this.m_bRunTrainning = false;
  this.m_bCalibration = false;

}

E_Manager.prototype.Initialize = function()
{
  $$("ID_LOG").getNode().style.marginLeft = "50px";
  $$("ID_LOG").getNode().style.marginTop = "15px";


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

    console.log(this.renderer[i].domElement);
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
  camera2.userData.helper = new THREE.CameraHelper(camera1);
  var dist = 90 / 1200;
  camera2.userData.helper.geometry.scale(dist, dist, dist);
  camera2.userData.axis.matrixAutoUpdate = false;

  this.renderer[1].scene.add(camera2.userData.axis);
  this.renderer[1].scene.add(camera2.userData.helper);

  this.UpdateWindowSize();
  this.Redraw();


  this.Animate();

  //Initialize Objects
  this.InitObject();
}

E_Manager.prototype.OnInitialize = function(network)
{
  this.mlMgr = new E_MLManager(this, network);

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
  camera.rotation.setFromRotationMatrix(new THREE.Matrix4().makeRotationX(-Math.PI/3));


  //camera2.position.y = 100;
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
  //Redraw
  for(var i=0 ; i<2 ; i++){
    this.renderer[i].render(this.renderer[i].scene, this.renderer[i].camera);
  }

  camera1 = this.renderer[0].camera;
  camera2 = this.renderer[1].camera;

  // camera2.userData.axis.matrix.copy(camera2.matrixWorld.clone());
  var lookAt =  camera1.position.clone().sub( new THREE.Vector3(0, 0, 0)).multiplyScalar(0.5);
  camera2.lookAt( lookAt );
  var vec1 = camera1.position.clone().sub(camera2.position);
  var vec2 = lookAt.clone().sub(camera2.position);
  var eFov = Math.acos(vec1.clone().normalize().dot(vec2.clone().normalize())) * 3 ;
  camera2.fov =   eFov * ( 180 / Math.PI);
  camera2.updateProjectionMatrix();


  if(!this.m_bCalibration){
    this.ImageMgr().ClearCanvas();
  }else{
    this.ImageMgr().RenderFakeFeatures(camera1);

    this.ImageMgr().DrawInitPoints();
  }
}

E_Manager.prototype.Animate = function()
{

  this.renderer[0].interactor.Update();

  if(this.m_bCalibration){
    this.RunCalibration();
  }
  requestAnimationFrame( this.Animate.bind(this) );
}


E_Manager.prototype.Frand = function(min, max)
{
  var range = max - min;
  var value = Math.random();

  value *= range;
  value += min;

  return value;
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

module.exports = E_Manager;
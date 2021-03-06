var convnetjs = require('convnetjs');
var deepqlearn = require('../libs/E_Brain.js')


//Machine Learning Manager
function E_MLManager(Mgr, network)
{
  this.Mgr = Mgr;

  this.network = new convnetjs.Net();
  this.brain = null;

  ///Initialize
  this.Initialize(network);
}

E_MLManager.prototype.Initialize = function(network)
{
  //4 error 2-diimensional vector
  var num_inputs = 8;
  //Random Position and Rotation
  var num_actions = 6;
  var temporal_window = 1;
  var network_size = num_inputs * temporal_window + num_actions * temporal_window + num_inputs;
  // this.MakeActions(num_actions);

  layer_defs = [];
  layer_defs.push({type:'input', out_sx:1, out_sy:1, out_depth:network_size});
  layer_defs.push({type:'fc', num_neurons: 50, activation:'relu'});
  layer_defs.push({type:'fc', num_neurons: 50, activation:'relu'});
  layer_defs.push({type:'regression', num_neurons:num_actions});


  // options for the Temporal Difference learner that trains the above net
  // by backpropping the temporal difference learning rule.
  tdtrainer_options = {learning_rate:0.0001, momentum:0.0, batch_size:64, l2_decay:0.01};
  var opt = {};
  opt.temporal_window = temporal_window;
  opt.experience_size = 30000;
  opt.start_learn_threshold = 100;
  opt.gamma = 0.7;
  opt.learning_steps_total = 200000;
  opt.learning_steps_burnin = 3000;
  opt.epsilon_min = 0.005;
  opt.epsilon_test_time = 0.05;
  opt.layer_defs = layer_defs;
  opt.tdtrainer_options = tdtrainer_options;



  //DeepQLearn Brain
  this.brain = new deepqlearn.Brain(num_inputs, num_actions, opt)

  //Load Saved Network
  //this.brain.value_net.fromJSON( JSON.parse(network) );
  this.Mgr.SetLog(network);


  //Initialize Network
  this.network.makeLayers(layer_defs);
  // this.network.fromJSON( JSON.parse(network) );
}

E_MLManager.prototype.ForwardBrain = function(volume)
{
  var action = this.brain.forward(volume.data);
  return action;
}

E_MLManager.prototype.BackwardBrain = function(reward)
{
  this.brain.backward(reward);



  log = this.brain.getLog() + '# of episodes : ' + this.Mgr.episode;
  log += '<br> iterations : ' + this.Mgr.iterations;

  if(this.Mgr.startTime !== null){
    var elapsedTime = new Date() - this.Mgr.startTime;
    log += '<br> elapsed time : ' + elapsedTime / 1000;
  }

  this.Mgr.SetLog(log);
  this.SaveBrain();
}

E_MLManager.prototype.PutVolume = function( volume )
{
  var inputVol = new convnetjs.Vol(volume.data);


  trainer = new convnetjs.SGDTrainer(this.network, {learning_rate:0.01, momentum:0.0, batch_size:1, l2_decay:0.001});
  trainer.train(inputVol, volume.class);


  //Save Netwrok
  this.SaveNetwork();
}

E_MLManager.prototype.Predict = function(volume)
{
  var action = this.brain.predict(volume.data);
  return action;
}

E_MLManager.prototype.SaveNetwork = function()
{
  ///Save Network
  var jsonNetwork = JSON.stringify( this.network.toJSON() );
  this.Mgr.SocketMgr().EmitData("SAVE_NETWORK", jsonNetwork);
}

E_MLManager.prototype.SaveBrain = function()
{
  //Save Brain
  var jsonBrain = JSON.stringify( this.brain.value_net.toJSON() );
  this.Mgr.SocketMgr().EmitData("SAVE_BRAIN", jsonBrain);
}


E_MLManager.prototype.MakeActions = function(numActions)
{
  if(numActions === 6){
    this.MakeSixActions();
    return;
  }
  var results = [];
  var trV = 1.0;
  var rotV = 0.01;

  for(var i=0 ; i<numActions ; i++){
    var mat = new THREE.Matrix4();

    mat.multiply(new THREE.Matrix4().makeTranslation(this.Mgr.Frand(trV * -1.0, trV), this.Mgr.Frand(trV * -1.0, trV), this.Mgr.Frand(trV * -1.0, trV) ));
    mat.multiply(new THREE.Matrix4().makeRotationX(this.Mgr.Frand(rotV * -1.0, rotV)));
    mat.multiply(new THREE.Matrix4().makeRotationY(this.Mgr.Frand(rotV * -1.0, rotV)));
    mat.multiply(new THREE.Matrix4().makeRotationZ(this.Mgr.Frand(rotV * -1.0, rotV)));

    results.push(mat.elements);
  }

  this.Mgr.SocketMgr().EmitData("SAVE_ACTIONS", results );
}

E_MLManager.prototype.MakeSixActions = function()
{
  var results = [];
  var trV = 0.2;



  //forward
  var mat = new THREE.Matrix4();
  mat.multiply(new THREE.Matrix4().makeTranslation(0, 0, trV * -1.0));
  results.push(mat.elements)


  //backward
  mat = new THREE.Matrix4();
  mat.multiply(new THREE.Matrix4().makeTranslation(0, 0, trV));
  results.push(mat.elements)

  //right
  mat = new THREE.Matrix4();
  mat.multiply(new THREE.Matrix4().makeTranslation(trV, 0, 0));
  results.push(mat.elements)

  //left
  mat = new THREE.Matrix4();
  mat.multiply(new THREE.Matrix4().makeTranslation(trV * -1.0, 0, 0));
  results.push(mat.elements)

  //top
  mat = new THREE.Matrix4();
  mat.multiply(new THREE.Matrix4().makeTranslation(0, trV, 0));
  results.push(mat.elements)

  //bottom
  mat = new THREE.Matrix4();
  mat.multiply(new THREE.Matrix4().makeTranslation(0, trV * -1.0, 0));
  results.push(mat.elements)



  // console.log(results);
  this.Mgr.SocketMgr().EmitData("SAVE_ACTIONS", results );
}

module.exports = E_MLManager;

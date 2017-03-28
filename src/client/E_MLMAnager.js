var convnetjs = require('convnetjs');


//Machine Learning Manager
function E_MLManager(Mgr, network)
{
  this.Mgr = Mgr;


  layer_defs = [];
  layer_defs.push({type:'input', out_sx:1, out_sy:1, out_depth:8});
  layer_defs.push({type:'fc', num_neurons:20, activation:'relu'});
  layer_defs.push({type:'fc', num_neurons:20, activation:'sigmoid'});
  layer_defs.push({type:'regression', num_neurons:16});

  this.network = new convnetjs.Net();
  this.network.makeLayers(layer_defs);
  //this.SaveNetwork();

  // this.network.fromJSON( JSON.parse(network) );

  ///Initialize
  this.Initialize();
}

E_MLManager.prototype.Initialize = function()
{

}

E_MLManager.prototype.PutVolume = function( volume )
{
  var inputVol = new convnetjs.Vol(volume.data);


  trainer = new convnetjs.SGDTrainer(this.network, {learning_rate:0.01, momentum:0.0, batch_size:1, l2_decay:0.001});
  trainer.train(inputVol, volume.class);


  //Save Netwrok
  this.SaveNetwork();
}

E_MLManager.prototype.Predict = function(input)
{
  var inputVol = new convnetjs.Vol(input);
  var pred = this.network.forward(inputVol);
  return pred.w;
}

E_MLManager.prototype.SaveNetwork = function()
{
  ///Save Network
  var jsonNetwork = JSON.stringify( this.network.toJSON() );
  this.Mgr.SocketMgr().EmitData("SAVE_NETWORK", jsonNetwork);
}

module.exports = E_MLManager;

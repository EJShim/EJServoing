var convnetjs = require('convnetjs');


//Machine Learning Manager
function E_MLManager(Mgr, network)
{
  this.Mgr = Mgr;


  // var layer_defs = [];
  // // input layer of size 1x1x2 (all volumes are 3D)
  // layer_defs.push({type:'input', out_sx:30, out_sy:30, out_depth:30});
  // // some fully connected layers
  // layer_defs.push({type:'fc', num_neurons:20, activation:'relu'});
  // layer_defs.push({type:'fc', num_neurons:20, activation:'relu'});
  // // a softmax classifier predicting probabilities for two classes: 0,1
  // layer_defs.push({type:'softmax', num_classes:12});

  this.network = new convnetjs.Net();
  //this.network.makeLayers(layer_defs);
  //this.SaveNetwork();
  this.network.fromJSON( JSON.parse(network) );

  ///Initialize
  this.Initialize();
}

E_MLManager.prototype.Initialize = function()
{

}

E_MLManager.prototype.PutVolume = function( volume )
{

  var className = ["Bathub", "Bed", "Bench", "Chair", "Cup", "Desk", "Dresser", "Monitor", "NightStand", "Sofa", "Table", "Toilet"];
  var num_class = className.length;
  var length = volume.data.length;
  var convVol = new convnetjs.Vol(length, length, length, 0.0);

  for(var i=0 ; i<length; i++){
    for(var j=0 ; j<length; j++){
      for(var k=0 ; k<length; k++){
        if( volume.data[i][j][k] === 1 ){
          convVol.set(i, j, k, volume.data[i][j][k]);
        }
      }
    }
  }

  if(volume.class === null){
    this.Mgr.SetLog("<b style='color:red'> Unknown Input </b><br>");
  }else{
    this.Mgr.SetLog("<b style='color:red'>Input :" + className[volume.class] + "</b><br>");
  }

  //Calculate Possibility
  var probability = this.network.forward(convVol);


  //Get The Maximum
  var max = 0;
  var maxIdx = 0;

  for(var i=0 ; i<num_class ; i++){
    if(probability.w[i] > max){
      max = probability.w[i];
      maxIdx = i;
    }
  }

  //Show Probability
  for(var i=0 ; i<num_class ; i++){
    var prob = probability.w[i] * 100
    this.Mgr.AppendLog("<br>");

    if(i === maxIdx){
        if(i === volume.class){
          this.Mgr.AppendLog("<b style='color:green'>" + className[i] + " : " + prob.toFixed(4) + " %</b>");
        }else{
          this.Mgr.AppendLog("<b>" + className[i] + " : " + prob.toFixed(4) + " %</b>");
        }
    }else{
      if(i === volume.class){
        this.Mgr.AppendLog("<div style='color:green'>" + className[i] + " : " + prob.toFixed(4) + " %</div>");
      }else{
        this.Mgr.AppendLog("<div>" + className[i] + " : " + prob.toFixed(4) + " %</div>");
      }
    }
  }

  //Max Class Name
  this.Mgr.AppendLog("<br><br>");
  this.Mgr.AppendLog("<b style='color:blue'> Predicted : " + className[maxIdx] + "</b>")



  //Train Data
  if(volume.class !== null){
    var trainer = new convnetjs.Trainer(this.network, {learning_rate:0.01, l2_decay:0.001});
    trainer.train(convVol, volume.class);

    this.SaveNetwork();
  }
}

E_MLManager.prototype.SaveNetwork = function()
{
  ///Save Network
  var jsonNetwork = JSON.stringify( this.network.toJSON() );
  this.Mgr.SocketMgr().EmitData("SAVE_NETWORK", jsonNetwork);
}

module.exports = E_MLManager;

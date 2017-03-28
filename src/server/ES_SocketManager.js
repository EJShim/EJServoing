var jsonfile = require('jsonfile')

function ES_SocketManager(Mgr, server)
{
  this.Mgr = Mgr;
  this.io = require('socket.io').listen(server, {'forceNew':true });

  //Initialize
  this.Initialize();
}

ES_SocketManager.prototype.Initialize = function()
{
  this.HandleSignal();
}

ES_SocketManager.prototype.HandleSignal = function()
{

  var io = this.io;
  Mgr = this.Mgr

  io.sockets.on('connection', function(socket){
    //Initialize Chat
    console.log("New Connection!!");
    console.log(socket.handshake.address);


    //Read Network and Emit to the socket
    var file = './data/network_obj.json'
    jsonfile.readFile(file, function(err, obj) {

      var trans = './data/transform.json';
      jsonfile.readFile(trans, function(err, obj2){
          var data = {network:obj, action:obj2}
          socket.emit("INITIALIZE_NETOWORK", data);

      })
    });


    socket.on("SAVE_NETWORK", function(data){
      console.log("network saved");
      Mgr.SaveJson("./data/network_obj.json", data);

      socket.emit("SIGNAL_RESTART");
    })

    socket.on("SAVE_ACTIONS", function(data){
      Mgr.SaveJson("./data/transform.json", data);
    })

  });
}

module.exports = ES_SocketManager;

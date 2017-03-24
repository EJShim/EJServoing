function E_SocketManager(Mgr)
{
  this.Mgr = Mgr;
  this.io = io();


  this.Initialize()

}

E_SocketManager.prototype.Initialize = function()
{
  this.HandleSignal();
}

E_SocketManager.prototype.HandleSignal = function()
{
  var socket = this.io;
  var Mgr = this.Mgr;

  socket.on("INITIALIZE_NETOWORK", function(data){
    Mgr.OnInitialize(data)
  });

  socket.on("SIGNAL_RESTART", function(data){
    //clear scene
    if(Mgr.m_bRunTrainning){
      Mgr.ClearScene();
    }


  })

}

E_SocketManager.prototype.EmitData = function(signal, data)
{
  this.io.emit(signal, data);
}

module.exports = E_SocketManager;

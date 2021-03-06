var express = require("express");

var ES_SocketManager = require("./ES_SocketManager.js");

var jsonfile = require('jsonfile');
var csvWriter = require('csv-write-stream')
var fs = require('fs');


function ES_Manager()
{
  //Initialize Server.set('views', __dirname + '/../views');
  this.app = express();
  this.server = null;

  //initialize Managers
  var m_socketMgr = null;

  ///Set Getters
  this.SocketMgr = function()
  {
    return m_socketMgr;
  }


  ///Recorder
  this.episode_time_table = [['episodes', 'time']];

  ////Initialize
  this.Initialize();
  this.InitRouter();
}

ES_Manager.prototype.Initialize = function()
{
  this.app.set('view engine', 'ejs');
  this.app.engine('html', require('ejs').renderFile);
  this.app.use(express.static('public'));

  var port = process.env.PORT || 8080;

  //Create Server
  this.server = require('http').createServer(this.app);

  //Open Server
  this.server.listen(port, function(){
    console.log("server opened : " + port);
  });



  //Init Socket Manager
  var socketMgr = this.SocketMgr();
   socketMgr = new ES_SocketManager(this, this.server);
}

ES_Manager.prototype.InitRouter = function()
{
  //Init Router
  this.app.get('/',function(req,res){
    res.render('index.html')
  });
}


ES_Manager.prototype.SaveJson = function(path, data)
{

  jsonfile.writeFile(path, data, function (err) {
    if(err)
    {console.error(err)}
  })
}


ES_Manager.prototype.SaveLearningProgress = function(data)
{
  this.episode_time_table.push(data);
  this.SaveCSV('./data/records/progress.csv', this.episode_time_table);

}

ES_Manager.prototype.SaveCSV = function(path, data)
{
  var writer = csvWriter({headers:data[0]});

  writer.pipe(fs.createWriteStream(path))

  for(var i=1 ; i<data.length ; i++){
      writer.write(data[i])
  }

  writer.end()

}
module.exports = ES_Manager;

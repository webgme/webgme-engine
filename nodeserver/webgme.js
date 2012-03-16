var httpserver = require('http').createServer(httpGet)
, io = require('socket.io').listen(httpserver)
, fs = require('fs')
, st = require('./storage.js')
, sh = require('./lib/sha1_2.js')


httpserver.listen(8081);
var storage = new st.Storage();
console.log("started");

function httpGet(req, res){
	console.log("httpGet - start - "+req.url);
	if(req.url==='/'){
		req.url = '/index.html';
	}
	fs.readFile(__dirname+req.url, function(err,data){
		if(err){
			res.writeHead(500);
			return res.end('Error loading ' + req.url);
		}
		if(req.url.indexOf('.js')>0){
			console.log("sending back js :"+req.url);
			res.writeHead(200, {
  				'Content-Length': data.length,
  				'Content-Type': 'application/x-javascript' });

		}
		else{
			res.writeHead(200);
		}
		res.end(data);
	});	
};

io.sockets.on('connection', function(socket){
	console.log("someone connected");
	socket.on('msg', function(data){
		console.log("got request"+data);
		var response = [];
		var commits = JSON.parse(data);
		for(var i in commits){
			if(commits[i].object===undefined){
				/*read request*/
				storage.get(commits[i].hash, function(result){
					if(result!=undefined){
						var resobj = {}; resobj.hash = commits[i].hash;resobj.object=result;
						response.push(resobj);
					}
				});
			}
			else{
				/*write operation*/
				console.log("calculated hash: "+sh.SHA1(commits[i].object));
				console.log("received hash: "+commits[i].hash);
				storage.put(commits[i].hash,commits[i].object,function(){});					
			}
		}
		socket.emit('msg', response);
	});
	socket.on('close',function(){
		console.log("connection closed");
	});
});

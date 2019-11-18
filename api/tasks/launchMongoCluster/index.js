const  exec  = require('child_process').exec;

exec("mongod --replSet rs0 --port 27018 --bind_ip localhost  --dbpath C:/mongoClusterData/rs0-0", { cwd: "C:/Program Files/MongoDB/Server/4.0/bin/" } );

//A little bit wait to 27018 will become a master
setTimeout(function() 
{ 
	exec("mongod --replSet rs0 --port 27019 --bind_ip localhost  --dbpath C:/mongoClusterData/rs0-1", { cwd: "C:/Program Files/MongoDB/Server/4.0/bin/" } );

	exec("mongod --replSet rs0 --port 27020 --bind_ip localhost  --dbpath C:/mongoClusterData/rs0-2", { cwd: "C:/Program Files/MongoDB/Server/4.0/bin/" } );		
}, 5000);
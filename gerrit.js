var request = require('http').request,
  spawn = require('child_process').spawn,
  config = require('./config.js'),
  gerrit = spawn('ssh', [
          '-o',
          'ServerAliveInterval 10',
          '-p',
          config.gerrit.port,
          config.gerrit.username + '@' + config.gerrit.hostname,
          'gerrit',
          'stream-events']);

gerrit.stdout.on('data', function(data) {
  data = data.toString();
  console.log(Date() + ': ' + data);
  var options = {
    hostname: config.usdaServer.hostname,
    port: config.usdaServer.port,
    path: '/commit',
    method: 'POST',
    headers: {
     'Content-Type': 'application/json',
     'Content-Length': Buffer.byteLength(data)
    }
  };
  var req = request(options, function(res) {
    res.setEncoding('utf8');
    res.on('data', function(data) {
      console.log(data);
    });
  });

  req.on('error', function(e) {
    console.log('Error sending request, ' + e.message);
  });
  req.write(data);
  req.end();
});

gerrit.stdout.on('close', function(code) {
  console.log('closed with code ' + code);
});

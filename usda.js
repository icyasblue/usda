var request = require('http').request,
  mongoose = require('mongoose'),
  exec = require('child_process').exec,
  spawn = require('child_process').spawn,
  fs = require('fs'),
  async = require('async'),
  Utils = require('./utils.js'),
  Commit = require('./commit.js'),
  config = require('./config.js');


var USDASchema = mongoose.Schema({
  project: String,
  runners: [{
    app: String,
    command: String
  }],
  directory: String,
  logFile: String,
  running: Boolean
});

// static methods

// instance methods
USDASchema.methods.start = function () {
  setInterval(function () {
    if (this.running) {
      console.log('USDA busy running tests...');
      return;
    }
    // polling
    var options = {
      hostname: config.usdaServer.hostname,
      port: config.usdaServer.port,
      path: '/commit/' + this.project,
      method: 'GET'
    };
    var req = request(options, function (res) {
      res.setEncoding('utf8');
      res.on('data', function(data) {
        // commit got
        this.running = true;
        var commit = new Commit(JSON.parse(data));
        console.log(commit);
        if (!commit.wc.length) {
          commit.message = 'No change recognized.';
          return this.result(commit);
        }
        commit.checkout(this.directory, function (code) {
          if (code) {
            commit.verified = -1;
            commit.message = 'checkout failed';
            return this.result(commit);
          }
          var runners = [];
          for (var i = 0; i < this.runners.length; i++) {
            var obj = this.runners[i];
            if (commit.wc.indexOf(obj.app) >= 0) {
              runners.push({
                app: obj.app,
                command: Utils.format('{0}/{1} {2} {3} > {4}', [ __dirname, obj.command, commit.ref, commit.project, this.logFile ])
              });
            }
          }

          async.eachSeries(runners, function (runner, callback) {
            console.log(runner.command);
            var timer = Date.now();
            exec(runner.command, function (err, stdout, stderr) {
              console.log('stdout: ' + stdout);
              console.log('stderr: ' + stderr);
              this.sendPerf(runner.app, Date.now() - timer);
              if (err) {
                console.log(runner.app + 'exit with code ' + err.code);
                commit.msg = config.message[runner.app].fail + '  ';
                if (fs.existsSync(this.logFile))
                  commit.msg += fs.readFileSync(this.logFile);
                else
                  commit.msg += 'Unknown error';
                callback(err);
              } else {
                commit.msg += config.message[runner.app] ? config.message[runner.app].pass : runner.app + ' passed\n\n';
                callback(null);
              }
            }.bind(this));
          }.bind(this), function (err) {
            commit.verified = err ? -1 : 1;
            this.result(commit);
          }.bind(this));
        }.bind(this));
      }.bind(this));
    }.bind(this));
    req.on('error', function(e) {
      console.log('Error sending request, ' + e.message);
    });
    req.end();
  }.bind(this), 5 * 1000);
};

USDASchema.methods.result = function (commit) {
  // post result
  var buf = JSON.stringify(commit);
  var options = {
    hostname: config.usdaServer.hostname,
    port: config.usdaServer.port,
    path: '/result',
    method: 'POST',
    headers: {
     'Content-Type': 'application/json',
     'Content-Length': Buffer.byteLength(buf)
    }
  };
  var req = request(options, function (res) {
    res.setEncoding('utf8');
    res.on('data', function(data) {
      console.log(data);
    });
    this.running = false;
  }.bind(this));
  req.on('error', function(e) {
    console.log('Error sending request, ' + e.message);
  });
  req.write(buf);
  req.end();
  this.running = false;
};

USDASchema.methods.sendPerf = function (app, time) {
  // performance data
  var buf = JSON.stringify({ app: app, time: time });
  var options = {
    hostname: config.usdaServer.hostname,
    port: config.usdaServer.port,
    path: '/performance',
    method: 'PUT',
    headers: {
     'Content-Type': 'application/json',
     'Content-Length': Buffer.byteLength(buf)
    }
  };
  var req = request(options, function (res) {
    res.setEncoding('utf8');
    res.on('data', function(data) {
      console.log(data);
    });
  });
  req.on('error', function(e) {
    console.log('Error sending request, ' + e.message);
  });
  req.write(buf);
  req.end();
};

module.exports = mongoose.model('USDA', USDASchema);
var spawn = require('child_process').spawn;
var exec = require('child_process').exec;
var config = require('./config.js');
var Utils = require('./utils.js');
var mongoose = require('mongoose');
var ObjectId = mongoose.Schema.Types.ObjectId;

var commitSchema = mongoose.Schema({
  project: String,
  changeNumber: String,
  patchNumber: String,
  ref: String,
  revision: String,
  change_id: String,
  subject: String,
  url: String,
  commitMessage: String,
  owner: ObjectId,
  owner_name: String,
  comment: String,
  verified: Number,
  review: Number,
  wc: [String],
  msg: String,
  cost: Number,
  created: Date,
  updated: Date,
  merged: Date,
  priority: Number // enum { abandoned: -3, merged: -2, running: -1, recorded:0, waiting: 1, boosted: 2 }
});


// static methods


// instance methods
commitSchema.methods.verify = function (done) {
  this.verified |= 0;
  this.review |= 0;
  var str = Utils.format("echo '' | ssh -T -n -p {0} {1}@{2} gerrit approve --project {3} \\\'--message='{4}'\\\' --verified {5} --code-review {6} {7},{8}",
    [config.gerrit.port, config.gerrit.username, config.gerrit.hostname, this.project, Utils.shell_quote(this.msg), this.verified, this.review, this.changeNumber, this.patchNumber]);
  var cmd = exec(str, function (error, stdout, stderr) {
    if (error !== null) {
      console.log('exec error: ' + error);
    }
    done();
  });
};

commitSchema.methods.whatChanged = function(done) {
  var changes = spawn('ssh', [
              '-p',
              config.gerrit.port,
              config.gerrit.username + '@' + config.gerrit.hostname,
              'gerrit',
              'query',
              '--format=JSON',
              '--current-patch-set',
              '--commit-message',
              'change:' + this.change_id,
              'status:open',
              '--files']);
  changes.stdout.on('data', function(data) {
    var res = JSON.parse(data.toString().split('\n')[0]);
    this.commitMessage = res.commitMessage;
    var wc = [];
    if (res.currentPatchSet && res.currentPatchSet.files) {
      var files = res.currentPatchSet.files.map(function(x) {
        return x.file;
      });
      for (var app in config.projects[this.project]) {
        if (files.filter(function(x) {
            if (config.projects[this.project][app].some(function(el, i, arr) {
              return x.indexOf(el) == 0;
            })) return true;
            return false;
          }.bind(this)).length > 0) {
          this.wc.push(app);
        }
      }
      done(null);
    }
  }.bind(this));
  changes.stdout.on('closed', function(e) {
    console.log('Error checking whatChanged! ' + e.message);
    done(e);
  });
};

commitSchema.methods.checkout = function (dir, done) {
  var fetch_cmd = Utils.format('git fetch ssh://{0}@{1}:{2}/{3} {4}',
    [ config.gerrit.username
    , config.gerrit.hostname
    , config.gerrit.port
    , this.project
    , this.ref ]);
  exec('git reset --hard HEAD', { cwd: dir },
    exec('git checkout master', { cwd: dir },
      exec('git pull --rebase', { cwd: dir },
        exec(fetch_cmd, { cwd: dir },
          exec('git checkout FETCH_HEAD', { cwd: dir }, done)))));
};

commitSchema.methods.setPriority = function (priority, done) {
  this.priority = priority;
  this.save(function (err, commit) {
    if (err) done(err);
    else done(null);
  });
};

module.exports = mongoose.model('Commit', commitSchema);
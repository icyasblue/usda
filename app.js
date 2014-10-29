// Modules
var express = require('express'),
  favicon = require('serve-favicon'),
  bodyParser = require('body-parser'),
  async = require('async'),
  methodOverride = require('method-override');
  Commit = require('./commit.js'),
  User = require('./user.js'),
  History = require('./history'),
  Review = require('./review.js'),
  config = require('./config.js'),
  mongoose = require('mongoose');

var app = module.exports = express();

// DB
mongoose.connect('mongodb://localhost/usda');

// Configure common application variables
app.set('port', process.env.PORT || config.server.port);

// handle GET favicon
app.use(favicon(__dirname + '/app/img/favicon.ico'));

// enable CORS
app.use(function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'X-Requested-With');
  next();
});

// Route middleware
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())

// parse application/vnd.api+json as json
app.use(bodyParser.json({ type: 'application/vnd.api+json' }))
app.use(methodOverride());
app.use(express.static(__dirname + '/app'));

app.get('/ping', function (req, res) {
 res.json({ ping: 'pong' });
});

app.get('/projects', function(req, res) {
  Commit.distinct('project', function(err, result) {
    if (err) return res.json([]);
    return res.json(result);
  });
});

app.get('/queue/:project', function(req, res) {
  Commit.find({ project: req.params.project, priority: { $gt: 0 } }).sort({ priority: -1, updated: 1 }).
              exec(function(err, result) {
                if (err) return res.json([]);
                res.json(result);
              });
});

// 1 at a time
app.put('/performance', function(req, res) {
  var p = req.body;
  History.findOne({ app: p.app }).exec(function (err, history) {
    if (err) return res.json({ result: 'Reject' });
    if (!history) {
      // new app
      new History({
        app: p.app,
        time: [p.time]
      }).save(function (err2, newHistory) {
        if (err2) return res.json({ result: 'Reject'});
        return res.json({ result: 'Accept' });
      });
    } else {
      // update
      if (history.time.length >= 10) {
        history.time.shift();
      }
      history.time.push(parseFloat(p.time) / 1000);
      history.save(function (err2, newHistory) {
        if (err2) return res.json({ result: 'Reject'});
        return res.json({ result: 'Accept' });
      });
    }
  });
});

app.get('/performance', function(req, res) {
  History.getPerformance(function(result) {
    return res.json(result);
  });
});

var makeCommit = function (req, res, next) {
  var c = req.body;
  // new gerrit event
  if (!c.change) {
    return res.json({ result: 'Reject' });
  }
  var patchNumber = c.patchSet ? c.patchSet.number : '';
  var ref = c.patchSet ? c.patchSet.ref : '';
  var rev = c.patchSet ? c.patchSet.revision : '';
  User.getUser(c.change.owner, function(err, user) {
    if (err) return res.json({ result: 'Reject' });
    // commit basis
    req.commit = new Commit({
      project: c.change.project,
      changeNumber: c.change.number,
      patchNumber: patchNumber,
      ref: ref,
      revision: rev,
      change_id: c.change.id,
      subject: c.change.subject,
      url: c.change.url,
      owner: user._id,
      owner_name: user.name,
      comment: c.comment || '',
    });
    next();
  });
};

var makeReview = function (req, res, next) {
  var c = req.body;
  var commit = req.commit;
  if (!c.approvals) return next();
  // new review
  var v = 0;
  var r = 0;
  for (var i = 0; i < c.approvals.length; i++) {
    if (c.approvals[i].type == 'Code-Review') r = parseInt(c.approvals[i].value, 10);
    if (c.approvals[i].type == 'Verified') v = parseInt(c.approvals[i].value, 10);
  }
  User.getUser(c.author, function (err, user) {
    if (err) return next();
    new Review({
      project: commit.project,
      change_id: commit.change_id,
      author: user._id,
      verified: v,
      review: r,
      time: Date.now()
    }).save(function(err, review) {
      if (err) console.log('Error: ' + err);
      return next();
    });
  });
};

app.post('/commit', makeCommit, makeReview, function (req, res) {
  var c = req.body;
  var commit = req.commit;
  if (c.type == 'patchset-created') {
    Commit.findOne({ change_id: commit.change_id }).exec(function (err, oldCommit) {
      if (err || oldCommit) return res.json({ result: 'Reject' });
      // new record
      commit.priority = 0 // recorded
      commit.created = Date.now();
      commit.save(function (err2, commit2) {
        if (err2) return res.json({ result: 'Reject' });
        return res.json({ result: 'Recorded' });
      });
    });
  } else if (c.type == 'change-merged') {
    Commit.findOne({ change_id: commit.change_id }).exec(function (err, oldCommit) {
      if (err || !oldCommit) return res.json({ result: 'Reject' });
      // record merged
      oldCommit.priority = -2;
      oldCommit.merged = Date.now();
      oldCommit.revision = commit.revision; // update rev to the one get merged
      oldCommit.save(function (err2, commit2) {
        if (err2) return res.json({ result: 'Reject' });
        return res.json({ result: 'Merged' });
      });
    });
  } else if (c.type == 'comment-added' && c.comment.indexOf('#test') >= 0 && Object.keys(config.projects).indexOf(c.change.project) >= 0) {
    // need test
    commit.priority = 1; // waiting
    commit.updated = Date.now();
    commit.whatChanged(function(err) {
      if (err) return res.json({ result: 'Reject' });
      History.getEstimatesFor(commit.wc, function (err2, totalTime) {
        if (err2) return res.json({ result: 'Reject' });
        commit.cost = totalTime;
        Commit.findOne({ change_id: commit.change_id }).exec(function (err3, oldCommit) {
          if (err3) return res.json({ result: 'Reject' });
          if (oldCommit) {
            // if change id exists, replace commit, keep position in queue
            oldCommit.patchNumber = commit.patchNumber;
            oldCommit.ref = commit.ref;
            oldCommit.subject = commit.subject;
            oldCommit.url = commit.url;
            oldCommit.wc = commit.wc;
            oldCommit.cost = commit.cost;
            oldCommit.priority = 1; // if the commit is already running, reset to 0
            oldCommit.save(function(err4, updateCommit) {
              if (err4) return res.json({ result: 'Reject' });
              res.json({ result: 'Updated' });
            });
          } else {
            // new commit
            commit.save(function(err4, newCommit) {
              if (err4) return res.json({ result: 'Reject' });
              return res.json({ result: 'Accept' });
            });
          }
        });
      });
    });
  } else if (c.type == 'comment-added' && c.comment.indexOf('#boost') >= 0) {
    Commit.findOne({ change_id: c.change.id, priority: 0 }).exec(function (err, commit) {
      if (err || !commit) return res.json({ result: 'Reject' });
      User.findById(commit.owner).exec(function (err2, user) {
        if (err2) return res.json({ result: 'Reject' });
        if (user.boost_left == 0 && (Date.now() - user.last_boost_date) < 1000*60*60*24*7) {
          commit.msg += 'No boost left!';
          return res.json({ result: 'Reject' });
        }
        if (Date.now() - user.last_boost_date >= 1000*60*60*24*7) {
          user.boost_left = 5;
        }
        user.boost_left -= 1;
        user.last_boost_date = Date.now();
        user.save(function (err3, newUser) {
          if (err3) return res.json({ result: 'Reject' });
          commit.setPriority(1, function (err4) {
            if (err4) return res.json({ result: 'Reject' });
            return res.json({ result: 'Boosted' });
          });
        });
      });
    });
  } else if (c.type == 'change-abandoned' || (c.type == 'comment-added' && c.comment.indexOf('#skip') >= 0)) {
    // need abort
    Commit.findOne({ change_id: commit.change_id }).exec(function (err, oldCommit) {
      if (err || !oldCommit) return res.json({ result: 'Reject' });
      oldCommit.setPriority(0, function (err2) {
        if (err2) return res.json({ result: 'Reject' });
        return res.json({ result: 'Skipped' });
      });
    });
  } else {
    return res.json({result: 'Reject'});
  }
});

app.get('/commit/:project', function(req, res) {
  Commit.findOne({ project: req.params.project, priority: { $gt: 0 } }).
    sort({ priority: -1, updated: 1 }).exec(function (err, commit) {
      if (err || !commit) return res.json({});
      commit.priority = -1;
      commit.save(function (newErr, newCommit) {
        if (newErr) return res.json({});
        return res.json(newCommit);
      });
    });
});

var getUserId = function (req, res, next) {
  if (!req.params.user || req.params.user == 'all') return next();
  User.findOne({ username: req.params.user }).exec(function (err, user) {
    if (err || !user)
      return next();
    req.userId = user._id;
    next();
  });
};

var getPeriodInMs = function (req, res, next) {
  if (!req.params.period || req.params.period == 'all') return next();
  req.period = parseInt(req.params.period, 10) * 24 * 60 * 60 * 1000;
  next();
}

app.get('/merged/:project/:user/:period', getUserId, getPeriodInMs, function (req, res) { // period in days
  var opt = { priority: -2 }; // merged
  if (req.params.project != 'all')
    opt.project = req.params.project;
  if (req.userId)
    opt.owner = req.userId;
  if (req.period)
    opt.merged = { $gt: Date.now() - req.period };
  Commit.find(opt).exec(function (err, commits) {
    if (err) { console.log(err); return res.json([]); }
    return res.json(commits);
  });
});

app.get('/rank/merged/:project/:period', getPeriodInMs, function (req, res) { // period in days
  var opt = { priority: -2 }; //merged
  if (req.params.project != 'all')
    opt.project = req.params.project;
  if (req.period)
    opt.merged = { $gt: Date.now() - req.period };
  Commit.find(opt).exec(function (err, commits) {
    if (err) return res.json([]);
    var counts = {};
    for (var i = 0; i < commits.length; i++) {
      if (!counts[commits[i].owner_name])
        counts[commits[i].owner_name] = 0;
      counts[commits[i].owner_name]++;
    }
    var ranks = [];
    for (var key in counts)
      ranks.push({
        name: key,
        count: counts[key]
      });
    return res.json(ranks.sort(function (a, b) {
      return b.count - a.count;
    }).slice(0, 10)); // return 10
  });
});

app.get('/reviewed/:project/:user/:period/:review', getUserId, getPeriodInMs, function (req, res) {
  var opt = {};
  if (req.params.project != 'all')
    opt.project = req.params.project;
  if (req.userId)
    opt.author = req.userId;
  if (req.period)
    opt.time = { $gt: Date.now() - req.period };
  if (req.params.review != 'all')
    opt.review = parseInt(req.params.review, 10);
  Review.find(opt).exec(function (err, reviews) {
    if (err) return res.json([]);
    return res.json(reviews);
  });
});

app.get('/rank/reviews/:project/:period/:review', getPeriodInMs, function (req, res) {
  var opt = {};
  if (req.params.project != 'all')
    opt.project = req.params.project;
  if (req.period)
    opt.time = { $gt: Date.now() - req.period };
  if (req.params.review != 'all')
    opt.review = parseInt(req.params.review, 10);
  Review.find(opt).exec(function (err, reviews) {
    if (err) return res.json([]);
    // rank
    var counts = {};
    for (var i = 0; i < reviews.length; i++) {
      if (!counts[reviews[i].author])
        counts[reviews[i].author] = 0;
      counts[reviews[i].author]++;
    }
    var ranks = [];
    for (var key in counts)
      ranks.push({
        name: key,
        count: counts[key]
      });
    ranks = ranks.sort(function (a, b) {
      return b.count - a.count;
    }).slice(0, 10); // return 10
    async.each(ranks, function (rank, callback) {
      User.findById(rank.name).exec(function (userErr, user) {
        if (userErr) return callback(userErr);
        rank.name = user.name;
        callback(null);
      });
    }, function (asyncErr) {
      if (asyncErr) return res.json([]);
      return res.json(ranks);
    });
  });
});

app.get('/users', function (req, res) {
  User.find().exec(function (err, users) {
    if (err) return res.json([]);
    return res.json(users);
  });
});

app.get('/boost/:change_id', function (req, res) {
  // should only boost waiting commits
  Commit.findOne({ change_id: req.params.change_id, priority: 1 }).exec(function (err, commit) {
    if (err || !commit) return res.json({ result: 'Reject' });
    User.findById(commit.owner).exec(function (err2, user) {
      if (err2 || !user) return res.json({ result: 'Reject' });
      if (user.boost_left == 0 && (Date.now() - user.last_boost_date) < 1000*60*60*24*7)
        return res.json({ result: 'Reject' });
      if (Date.now() - user.last_boost_date >= 1000*60*60*24*7) {
        user.boost_left = 5;
      }
      user.boost_left -= 1;
      user.last_boost_date = Date.now();
      user.save(function (err3, newUser) {
        if (err3) return res.json({ result: 'Reject' });
        commit.priority = 1;
        commit.save(function (err4, newCommit) {
          if (err4) return res.json({ result: 'Reject' });
          return res.json({ result: 'Boosted' });
        });
      });
    });
  });
});

app.post('/result', function(req, res) {
  // notice, patchSetNumber may differ
  var commit_res = req.body;
  Commit.findOne({ change_id: commit_res.change_id }).exec(function (err, commit) {
    if (err || !commit) return res.json({ result: 'Reject' });
    commit.verified = commit_res.verified;
    commit.review = commit_res.review;
    commit.msg = commit_res.msg;
    commit.patchNumber = commit_res.patchNumber;
    commit.verify(function(err) {
      if (err) return res.json({ result: 'Reject' });
      if (commit_res.priority == -1) { // remove it only if it is running
        Commit.findOneAndRemove({ change_id: commit_res.change_id }, function (err2) {
          if (err2) return res.json({ result: 'Reject' });
          else return res.json({ result: 'Posted' });
        });
      } else {
        return res.json({ result: 'Posted' });
      }
    });
  });
});

if (!module.parent) {
  app.listen(app.get('port'), function() {
    console.log('Server now running on port ' + app.get('port'));
  });
}

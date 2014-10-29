var config = require('./config.js');
var mongoose = require('mongoose');

var historySchema = mongoose.Schema({
  app: String,
  time: [Number]
});

// static methods
historySchema.statics.getEstimatesFor = function (apps, done) {
  this.find().where('app').in(apps).exec(function (err, histories) {
    if (err) {
      console.error(err);
      return done(err, null);
    }
    var totalTime = (apps.length - histories.length) * 300; // if no history, default 300 seconds
    if (histories.length)
      totalTime += histories.map(function (x) { return x.time.reduce(function(a,b){return a+b;}) / x.time.length; }).reduce(function(a,b){return a+b;});
    return done(null, totalTime);
  });
};

historySchema.statics.getPerformance = function (done) {
  this.find().exec(function (err, result) {
    if (err) return done([]);
    return done(result.map(function (x) { return {
      app: x.app,
      time: Math.floor(x.time.reduce( function (a, b) { return a + b; }) / x.time.length)
    }; }));
  });
};

module.exports = mongoose.model('History', historySchema);
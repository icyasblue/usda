var mongoose = require('mongoose');
var ObjectId = mongoose.Schema.Types.ObjectId;


var userSchema = mongoose.Schema({
  name: String,
  email: String,
  username: String,
  boost_left: Number,
  last_boost_date: Date
});

// static methods
userSchema.statics.getUser = function (owner, done) {
  this.findOne({ name: owner.name }).exec(function (err, user) {
    if (err) {
      console.log(err);
      return done(err, null);
    }
    if (!user) {
      new this({ // magic!
        name: owner.name,
        email: owner.email,
        username: owner.username,
        boost_left: 5,
        last_boost_date: Date.now()
      }).save(function (newErr, newUser) {
        if (newErr) {
          console.log(newErr);
          done(newErr, null);
        }
        done(null, newUser);
      });
    } else {
      done(null, user);
    }
  }.bind(this));
};

module.exports = mongoose.model('User', userSchema);
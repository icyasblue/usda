var mongoose = require('mongoose');
var ObjectId = mongoose.Schema.Types.ObjectId;

var reviewSchema = mongoose.Schema({
  project: String,
  change_id: String,
  author: ObjectId,
  verified: Number,
  review: Number,
  time: Date
});

// static methods


// instance methods


module.exports = mongoose.model('Review', reviewSchema);
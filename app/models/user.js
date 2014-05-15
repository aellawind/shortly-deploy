var db = require('../config');
var bcrypt = require('bcrypt-nodejs');
var Promise = require('bluebird');
var mongoose = require('mongoose');

var userSchema = mongoose.Schema({
    username: String,
    password: String,
    timestamp: { type: Date, default: Date.now },
});


userSchema.methods.comparePassword = function(attemptedPassword, cb) {
  var self = this;
  bcrypt.compare(attemptedPassword, self.password, function(err, isMatch) {
    cb(err,isMatch);
  });
};

userSchema.pre('save',function(next) {
  var cipher = Promise.promisify(bcrypt.hash);
  return cipher(this.password, null,null).bind(this)
    .then(function(hash) {
      this.password = hash;
      next();
    });
});

module.exports = mongoose.model('User',userSchema);

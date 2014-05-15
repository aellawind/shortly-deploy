var db = require('../config');
var bcrypt = require('bcrypt-nodejs');
var Promise = require('bluebird');
var mongoose = require('mongoose');

var userSchema = mongoose.Schema({
    username: {type:String,unique:true},
    password: String,
    timestamp: { type: Date, default: Date.now }
});


userSchema.methods.comparePassword = function(attemptedPassword, cb) {
  bcrypt.compare(attemptedPassword, this.get('password'), function(err, isMatch) {
    cb(err,isMatch);
  });
};

userSchema.methods.hashPassword = function() {
  var cipher = Promise.promisify(bcrypt.hash);
  return cipher(this.password, null,null).bind(this)
    .then(function(hash) {
      this.password = hash;
      console.log("PW",this.password);
    });
}

userSchema.pre('save', function(next) {
  var user = this;
  user.hashPassword();
  next();
});

module.exports = mongoose.model('User',userSchema);

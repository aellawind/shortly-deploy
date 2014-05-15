var db = require('../config');
var crypto = require('crypto');
var mongoose = require('mongoose');

var urlSchema = mongoose.Schema({
  url: {type:String,unique:true},
  base_url: String,
  code: String,
  title: String,
  timestamp: { type : Date, default: Date.now },
  visits: {type: Number, default: 0}
});

urlSchema.methods.init = function() {
  var shasum = crypto.createHash('sha1');
  shasum.update(this.url);
  this.code = shasum.digest('hex').slice(0, 5);
};

// userSchema.pre('save', function(next) {
//   var user = this;
//   user.hashPassword();
//   next();
// });

var Link = mongoose.model('Link', urlSchema);

module.exports = mongoose.model('Link', urlSchema);


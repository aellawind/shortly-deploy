window.Shortly = Backbone.View.extend({
  template: Templates.layout,

  events: {
    'click li a.index':  'renderIndexView',
    'click li a.create': 'renderCreateView'
  },

  initialize: function(){
    console.log( 'Shortly is running' );
    $('body').append(this.render().el);

    this.router = new Shortly.Router({ el: this.$el.find('#container') });
    this.router.on('route', this.updateNav, this);

    Backbone.history.start({ pushState: true });
  },

  render: function(){
    this.$el.html( this.template() );
    return this;
  },

  renderIndexView: function(e){
    e && e.preventDefault();
    this.router.navigate('/', { trigger: true });
  },

  renderCreateView: function(e){
    e && e.preventDefault();
    this.router.navigate('/create', { trigger: true });
  },

  updateNav: function(routeName){
    this.$el.find('.navigation li a')
      .removeClass('selected')
      .filter('.' + routeName)
      .addClass('selected');
  }
});

Shortly.createLinkView = Backbone.View.extend({
  className: 'creator',

  template: Templates.create,

  events: {
    'submit': 'shortenUrl'
  },

  render: function() {
    this.$el.html( this.template() );
    return this;
  },

  shortenUrl: function(e) {
    e.preventDefault();
    var $form = this.$el.find('form .text');
    var link = new Shortly.Link({ url: $form.val() })
    link.on('request', this.startSpinner, this);
    link.on('sync', this.success, this);
    link.on('error', this.failure, this);
    link.save({});
    $form.val('');
  },

  success: function(link) {
    this.stopSpinner();
    var view = new Shortly.LinkView({ model: link });
    this.$el.find('.message').append(view.render().$el.hide().fadeIn());
  },

  failure: function(model, res) {
    this.stopSpinner();
    this.$el.find('.message')
      .html('Please enter a valid URL')
      .addClass('error');
    return this;
  },

  startSpinner: function() {
    this.$el.find('img').show();
    this.$el.find('form input[type=submit]').attr('disabled', 'true');
    this.$el.find('.message')
      .html('')
      .removeClass('error');
  },

  stopSpinner: function() {
    this.$el.find('img').fadeOut('fast');
    this.$el.find('form input[type=submit]').attr('disabled', null);
    this.$el.find('.message')
      .html('')
      .removeClass('error');
  }
});

Shortly.Link = Backbone.Model.extend({
  urlRoot: '/links'
});

Shortly.LinkView = Backbone.View.extend({
  className: 'link',

  template: Templates.link,

  render: function() {
    this.$el.html(this.template(this.model.attributes));
    console.log(this.model);
    return this;
  }
});

Shortly.Links = Backbone.Collection.extend({
  model: Shortly.Link,
  url: '/links'
});

Shortly.LinksView = Backbone.View.extend({
  className: 'links',

  initialize: function(){
    this.collection.on('sync', this.addAll, this);
    this.collection.fetch();
  },

  render: function() {
    this.$el.empty();
    return this;
  },

  addAll: function(){
    this.collection.forEach(this.addOne, this);
  },

  addOne: function(item){
    var view = new Shortly.LinkView({ model: item });
    this.$el.append(view.render().el);
  }
});

Shortly.Router = Backbone.Router.extend({
  initialize: function(options){
    this.$el = options.el;
  },

  routes: {
    '':       'index',
    'create': 'create'
  },

  swapView: function(view){
    this.$el.html(view.render().el);
  },

  index: function(){
    var links = new Shortly.Links();
    var linksView = new Shortly.LinksView({ collection: links });
    this.swapView(linksView);
  },

  create: function(){
    this.swapView(new Shortly.createLinkView());
  }
});

var Bookshelf = require('bookshelf');
var path = require('path');

var db = Bookshelf.initialize({
  client: 'sqlite3',
  connection: {
    host: '127.0.0.1',
    user: 'your_database_user',
    password: 'password',
    database: 'shortlydb',
    charset: 'utf8',
    filename: path.join(__dirname, '../db/shortly.sqlite')
  }
});

db.knex.schema.hasTable('urls').then(function(exists) {
  if (!exists) {
    db.knex.schema.createTable('urls', function (link) {
      link.increments('id').primary();
      link.string('url', 255);
      link.string('base_url', 255);
      link.string('code', 100);
      link.string('title', 255);
      link.integer('visits');
      link.timestamps();
    }).then(function (table) {
      console.log('Created Table', table);
    });
  }
});

db.knex.schema.hasTable('users').then(function(exists) {
  if (!exists) {
    db.knex.schema.createTable('users', function (user) {
      user.increments('id').primary();
      user.string('username', 100).unique();
      user.string('password', 100);
      user.timestamps();
    }).then(function (table) {
      console.log('Created Table', table);
    });
  }
});

module.exports = db;

var request = require('request');
var crypto = require('crypto');
var bcrypt = require('bcrypt-nodejs');
var util = require('../lib/utility');

var db = require('../app/config');
var User = require('../app/models/user');
var Link = require('../app/models/link');
var Users = require('../app/collections/users');
var Links = require('../app/collections/links');

exports.renderIndex = function(req, res) {
  res.render('index');
};

exports.signupUserForm = function(req, res) {
  res.render('signup');
};

exports.loginUserForm = function(req, res) {
  res.render('login');
};

exports.logoutUser = function(req, res) {
  req.session.destroy(function(){
    res.redirect('/login');
  });
};

exports.fetchLinks = function(req, res) {
  Links.reset().fetch().then(function(links) {
    res.send(200, links.models);
  })
};

exports.saveLink = function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        var link = new Link({
          url: uri,
          title: title,
          base_url: req.headers.origin
        });

        link.save().then(function(newLink) {
          Links.add(newLink);
          res.send(200, newLink);
        });
      });
    }
  });
};

exports.loginUser = function(req, res) {
  var username = req.body.username;
  var password = req.body.password;

  new User({ username: username })
    .fetch()
    .then(function(user) {
      if (!user) {
        res.redirect('/login');
      } else {
        user.comparePassword(password, function(match) {
          if (match) {
            util.createSession(req, res, user);
          } else {
            res.redirect('/login');
          }
        })
      }
  });
};

exports.signupUser = function(req, res) {
  var username = req.body.username;
  var password = req.body.password;

  new User({ username: username })
    .fetch()
    .then(function(user) {
      if (!user) {
        var newUser = new User({
          username: username,
          password: password
        });
        newUser.save()
          .then(function(newUser) {
            util.createSession(req, res, newUser);
            Users.add(newUser);
          });
      } else {
        console.log('Account already exists');
        res.redirect('/signup');
      }
    })
};

exports.navToLink = function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      link.set({ visits: link.get('visits') + 1 })
        .save()
        .then(function() {
          return res.redirect(link.get('url'));
        });
    }
  });
};
var request = require('request');

exports.getUrlTitle = function(url, cb) {
  request(url, function(err, res, html) {
    if (err) {
      console.log('Error reading url heading: ', err);
      return cb(err);
    } else {
      var tag = /<title>(.*)<\/title>/;
      var match = html.match(tag);
      var title = match ? match[1] : url;
      return cb(err, title);
    }
  });
};

var rValidUrl = /^(?!mailto:)(?:(?:https?|ftp):\/\/)?(?:\S+(?::\S*)?@)?(?:(?:(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[0-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]+-?)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]+-?)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,})))|localhost)(?::\d{2,5})?(?:\/[^\s]*)?$/i;

exports.isValidUrl = function(url) {
  return url.match(rValidUrl);
};

exports.isLoggedIn = function(req, res) {
  return req.session ? !!req.session.user : false;
};

exports.checkUser = function(req, res, next) {
  if (!exports.isLoggedIn(req)) {
    res.redirect('/login');
  } else {
    next();
  }
};

exports.createSession = function(req, res, newUser) {
  return req.session.regenerate(function() {
      req.session.user = newUser;
      res.redirect('/');
    });
};

var request = require('supertest');
var express = require('express');
var expect = require('chai').expect;
var app = require('../server-config.js');

var db = require('../app/config');
var User = require('../app/models/user');
var Link = require('../app/models/link');

/////////////////////////////////////////////////////
// NOTE: these tests are designed for mongo!
/////////////////////////////////////////////////////

xdescribe('', function() {

  beforeEach(function(done) {
    // Log out currently signed in user
    request(app)
      .get('/logout')
      .end(function(err, res) {

        // Delete objects from db so they can be created later for the test
        Link.remove({url : 'http://www.roflzoo.com/'}).exec();
        User.remove({username : 'Savannah'}).exec();
        User.remove({username : 'Phillip'}).exec();

        done();
      });
  });

  describe('Link creation: ', function() {

    it('Only shortens valid urls, returning a 404 - Not found for invalid urls', function(done) {
      request(app)
        .post('/links')
        .send({
          'url': 'definitely not a valid url'})
        .expect(404)
        .end(done);
    });

    describe('Shortening links:', function() {

      it('Responds with the short code', function(done) {
        request(app)
          .post('/links')
          .send({
            'url': 'http://www.roflzoo.com/'})
          .expect(200)
          .expect(function(res) {
            expect(res.body.url).to.equal('http://www.roflzoo.com/');
            expect(res.body.code).to.be.ok;
          })
          .end(done);
      });

      it('New links create a database entry', function(done) {
        request(app)
          .post('/links')
          .send({
            'url': 'http://www.roflzoo.com/'})
          .expect(200)
          .expect(function(res) {
            Link.findOne({'url' : 'http://www.roflzoo.com/'})
              .exec(function(err,link){
                if(err) console.log(err);
                expect(link.url).to.equal('http://www.roflzoo.com/');
              });
          })
          .end(done);
      });

      it('Fetches the link url title', function(done) {
        request(app)
          .post('/links')
          .send({
            'url': 'http://www.roflzoo.com/'})
          .expect(200)
          .expect(function(res) {
            Link.findOne({'url' : 'http://www.roflzoo.com/'})
              .exec(function(err,link){
                if(err) console.log(err);
                expect(link.title).to.equal('Rofl Zoo - Daily funny animal pictures');
              });
          })
          .end(done);
      });

    }); // 'Shortening Links'

    describe('With previously saved urls: ', function() {

      beforeEach(function(done) {
        link = new Link({
          url: 'http://www.roflzoo.com/',
          title: 'Rofl Zoo - Daily funny animal pictures',
          base_url: 'http://127.0.0.1:4568',
          visits: 0
        })

        link.save(function() {
          done();
        });
      });

      it('Returns the same shortened code if attempted to add the same URL twice', function(done) {
        var firstCode = link.code
        request(app)
          .post('/links')
          .send({
            'url': 'http://www.roflzoo.com/'})
          .expect(200)
          .expect(function(res) {
            var secondCode = res.body.code;
            expect(secondCode).to.equal(firstCode);
          })
          .end(done);
      });

      it('Shortcode redirects to correct url', function(done) {
        var sha = link.code;
        request(app)
          .get('/' + sha)
          .expect(302)
          .expect(function(res) {
            var redirect = res.headers.location;
            expect(redirect).to.equal('http://www.roflzoo.com/');
          })
          .end(done);
      });

    }); // 'With previously saved urls'

  }); // 'Link creation'

  describe('Priviledged Access:', function(){

    // /*  Authentication  */
    // // TODO: xit out authentication
    it('Redirects to login page if a user tries to access the main page and is not signed in', function(done) {
      request(app)
        .get('/')
        .expect(302)
        .expect(function(res) {
          expect(res.headers.location).to.equal('/login');
        })
        .end(done);
    });

    it('Redirects to login page if a user tries to create a link and is not signed in', function(done) {
      request(app)
        .get('/create')
        .expect(302)
        .expect(function(res) {
          expect(res.headers.location).to.equal('/login');
        })
        .end(done);
    });

    it('Redirects to login page if a user tries to see all of the links and is not signed in', function(done) {
      request(app)
        .get('/links')
        .expect(302)
        .expect(function(res) {
          expect(res.headers.location).to.equal('/login');
        })
        .end(done);
    });

  }); // 'Privileged Access'

  describe('Account Creation:', function(){

    it('Signup creates a new user', function(done) {
      request(app)
        .post('/signup')
        .send({
          'username': 'Svnh',
          'password': 'Svnh' })
        .expect(302)
        .expect(function() {
          User.findOne({'username': 'Svnh'})
            .exec(function(err,user) {
              expect(user.username).to.equal('Svnh');
            });
        })
        .end(done);
    });

    it('Successful signup logs in a new user', function(done) {
      request(app)
        .post('/signup')
        .send({
          'username': 'Phillip',
          'password': 'Phillip' })
        .expect(302)
        .expect(function(res) {
          expect(res.headers.location).to.equal('/');
          request(app)
            .get('/logout')
            .expect(200)
        })
        .end(done);
    });

  }); // 'Account Creation'

  describe('Account Login:', function(){

    beforeEach(function(done) {
      new User({
          'username': 'Phillip',
          'password': 'Phillip'
      }).save(function(){
        done();
      });
    });

    it('Logs in existing users', function(done) {
      request(app)
        .post('/login')
        .send({
          'username': 'Phillip',
          'password': 'Phillip' })
        .expect(302)
        .expect(function(res) {
          expect(res.headers.location).to.equal('/');
        })
        .end(done);
    });

    it('Users that do not exist are kept on login page', function(done) {
      request(app)
        .post('/login')
        .send({
          'username': 'Fred',
          'password': 'Fred' })
        .expect(302)
        .expect(function(res) {
          expect(res.headers.location).to.equal('/login');
        })
        .end(done)
      });

  }); // Account Login

});

'use strict';

const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const fccTesting = require('./freeCodeCamp/fcctesting.js');
const auth = require('./app/auth.js');
const routes = require('./app/routes.js');
const mongo = require('mongodb').MongoClient;
const passport = require('passport');
const cookieParser = require('cookie-parser');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const passportSocketIo = require('passport.socketio');

const cors = require('cors');

app.use(cors());
var currentUsers = 0;
const sessionStore = new session.MemoryStore();

fccTesting(app); //For FCC testing purposes

app.use('/public', express.static(process.cwd() + '/public'));
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'pug');

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: true,
    saveUninitialized: true,
    key: 'express.sid',
    store: sessionStore,
  })
);

mongo.connect(
  process.env.DATABASE,
  { useUnifiedTopology: true },
  (err, client) => {
    let db = client.db('chatproject');
    if (err) console.log('Database error: ' + err);

    auth(app, db);
    routes(app, db);

    http.listen(process.env.PORT || 3000);

    //start socket.io code
    io.use(
      passportSocketIo.authorize({
        cookieParser: cookieParser,
        key: 'express.sid',
        secret: process.env.SESSION_SECRET,
        store: sessionStore,
      })
    );

    io.on('connection', (socket) => {
      console.log('A user has connected');
      console.log('user ' + socket.request.user.name + ' connected');
      ++currentUsers;
      io.emit('user count', currentUsers);
      socket.on('user count', () => {
        console.log('users: ', currentUsers);
      });
      socket.on('disconnect', () => {
        console.log('A user has disconnected');
        --currentUsers;
        console.log('users: ', currentUsers);
      });
      io.emit('user', {
        name: socket.request.user.name,
        currentUsers: currentUsers,
        connected: true,
      });

      socket.on('chat message', ( message) => {
        io.emit('chat message', { user: socket.request.user.name, message: message });
      });
    });

    //end socket.io code
  }
);

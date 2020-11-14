require("dotenv").config();
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const { verify } = require('jsonwebtoken');
const { hash, compare } = require('bcryptjs');
const mongoose = require('mongoose')
const {
  createAccessToken,
  createRefreshToken,
  sendRefreshToken,
  sendAccessToken,
} = require('./tokens.js');
const { fakeDB } = require('./fakeDB.js');
const { isAuth } = require('./isAuth.js');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost/jwt', { useNewUrlParser: true, useUnifiedTopology: true });

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function () {
  console.log("connected to database")
});

const usersSchema = new mongoose.Schema({
  email: String,
  password: String,
  rftkn: String,
  followers: {
    Number_of_followers: Intl,
    list: []
  },
  following: {
    Number_of_following: Intl,
    list: []
  }
});

const tweetsdb = new mongoose.Schema({
  _id: String,
  tweet: []
});

const user = mongoose.model('user', usersSchema);
const usertweet = mongoose.model('usertweet', tweetsdb);
// 1. Register a user
// 2. Login a user
// 3. Logout a user
// 4. Setup a protected route
// 5. Get a new accesstoken with a refresh token

const server = express();

// Use express middleware for easier cookie handling
server.use(cookieParser());


// Needed to be able to read body data
server.use(express.json()); // to support JSON-encoded bodies
server.use(express.urlencoded({ extended: true })); // to support URL-encoded bodies

// 1. Register a user
server.post('/register', async (req, res) => {
  const { email, password } = req.body;

  try {
    // 1. Check if the user exist
    const reguser = user.where({ email: email });
    reguser.findOne(function (err, user) {
      if (err) console.log("Error");
      if (user) {
        res.send("User Already Exists")
        throw new Error()
      }
    });
    // 2. If not user exist already, hash the password
    const hashedPassword = await hash(password, 10);
    // 3. Insert the user in "database"
    const newuser = new user({ email: email, password: hashedPassword, rftkn: "", followers: { Number_of_followers: 0, list: {} }, following: { Number_of_following: 0, list: {} } })
    newuser.save(function (err) {
      if (err) return console.error(err)
      else return res.send("User Created")
    })
  } catch (err) {
    res.send({
      error: `${err.message}`,
    });
  }
});

// 2. Login a user
server.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // 1. Find user in array. If not exist send error

    const loguser = user.where({ email: email });
    loguser.findOne(function (err, user) {
      if (err) console.log("Error");
      if (user == null) {
        res.send("User does not exist....Please register first")
      }
      if (user) {
        async function comparepass() {
          const valid = await compare(password, user.password);
          if (!valid) {
            res.send("Incorrect password")
            throw new Error('Password not correct');
          }
          else {
            const accesstoken = createAccessToken(user.id);
            const refreshtoken = createRefreshToken(user.id);
            user.rftkn = refreshtoken
            user.save()
            console.log(accesstoken)
            sendRefreshToken(res, refreshtoken);
            sendAccessToken(res, req, accesstoken);
          }
        }
        comparepass()
      }
    });
  } catch (err) {
    res.send({
      error: `${err.message}`,
    });
  }
});

// 3. Logout a user
server.post('/logout', (_req, res) => {
  res.clearCookie('refreshtoken', { path: '/refresh_token' });
  return res.send("Logged out");
});

// 4. Protected route
server.post('/follow', async (req, res) => {
  try {
    const userId = isAuth(req);
    if (userId !== null) {
      const finduser = user.where({ _id: userId });
      finduser.findOne(function (err, user1) {
        if (err) console.log("Error");
        if (user1) {
          const { email } = req.body
          const user2 = user.where({ email: email });
          user2.findOne(function (err, user) {
            if (err) console.log("Error");
            if (user == null) res.send("User does not exist")
            if (user) {
              user.followers.Number_of_followers = user.followers.Number_of_followers + 1
              user.followers.list.push(user1.email)
              user.save()
            }
          });
          user1.following.list.push(email)
          user1.following.Number_of_following += 1
          user1.save()
        }
      });
    }
  } catch (err) {
    res.send({
      error: `${err.message}`,
    });
  }
});

server.post('/tweet', async (req, res) => {
  try {
    const userId = isAuth(req);
    if (userId !== null) {
      const reguser1 = usertweet.where({ _id: userId });
      reguser1.findOne(function (err, user) {
        if (err) console.log("Error");
        if (user == null) {
          const { tweet } = req.body
          const newusertweet = new usertweet({ _id: userId })
          newusertweet.tweet.push(tweet)
          newusertweet.save(function (err) {
            if (err) return console.error(err)
            else return res.send("Posted")
          })
        }
        if (user) {
          const { tweet } = req.body
          user.tweet.push(tweet)
          user.save()
          res.send("Posted")
        }
      });

    }
  } catch (err) {
    res.send({
      error: `${err.message}`,
    });
  }
});

server.post('/feed', async (req, res) => {
  try {
    const userId = isAuth(req);
    if (userId !== null) {
      const user6 = user.where({ _id: userId });
      user6.findOne(function (err, user7) {
        if (err) console.log("Error");
        if (user7) {
          let i = 1
          for (i = 1; i < user7.following.list.length; i++) {
            const feed = []
            // console.log(user7.following.list[i])
            const user3 = user.where({ email: user7.following.list[i] })
            user3.findOne(function (err, user9) {
              if (err) console.log("Error");
              if (user9) {
                const user4 = usertweet.where({ _id: user9._id });
                user4.findOne(function (err, user5) {
                  if (err) console.log("Error");
                  if (user5) {
                    const user8 = user.where({ _id: user5._id });
                    user8.findOne(function (err, user) {
                      if (err) console.log("Error");
                      if (user) {
                        feed.push(user.email)
                        feed.push(user5.tweet)
                        console.log(feed)
                      }
                    })
                  };
                });

              }
            }

            )
          }

        }})}
      } catch (err) {
        res.send({
          error: `${err.message}`,
        });
      }
    });


// 5. Get a new access token with a refresh token
server.post('/refresh_token', (req, res) => {
  const token = req.cookies.refreshtoken;
  // If we don't have a token in our request
  if (!token) return res.send({ accesstoken: '', message: "HII" });
  // We have a token, let's verify it!
  let payload = null;
  try {
    payload = verify(token, process.env.REFRESH_TOKEN_SECRET);
  } catch (err) {
    return res.send({ accesstoken: '' });
  }
  // token is valid, check if user exist

  const checkuser = user.where({ _id: payload.userId });
  checkuser.findOne(function (err, user) {
    if (err) console.log("Error");
    if (user == null) { return res.send({ accesstoken: '' }) }
    if (user) {
      if (user.rftkn !== token)
        return res.send({ accesstoken: '' });
      const accesstoken = createAccessToken(user._id);
      const refreshtoken = createRefreshToken(user._id);
      user.rftkn = refreshtoken;
      user.save()
      sendRefreshToken(res, refreshtoken);
      return res.send({ accesstoken }); //eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI1ZmFiZTIyMGY0ZTU4ZDA0OTQ3ODNjMjgiLCJpYXQiOjE2MDUxMDMxNDMsImV4cCI6MTYwNTcwNzk0M30.3Q6UPRCqrhid45FKtsOmgAEpLwzDPXQRax8L1nipSM4
    }
  })
});
// user exist, check if refreshtoken exist on user

// token exist, create new Refresh- and accesstoken
// update refreshtoken on user in db
// Could have different versions instead!
// All good to go, send new refreshtoken and accesstoken

server.listen(process.env.PORT || 80);

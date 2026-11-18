const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const path = require('path');
const SQLiteSessionStore = require('./session-store');
const registerPublicRoutes = require('./routes-public');
const registerAdminRoutes = require('./routes-admin');

module.exports = function createApp({ db, isProduction, sessionSecret }) {
  const app = express();
app.disable('x-powered-by');

if (isProduction) {
  app.set('trust proxy', 1);
}

app.use(helmet({ contentSecurityPolicy: false }));

app.use(express.json({ limit: '20kb' }));
app.use(express.urlencoded({ extended: false, limit: '20kb' }));

app.use(session({
  name: 'sr.sid',
  secret: sessionSecret,
  store: new SQLiteSessionStore(db),
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000
  }
}));

app.use('/api/admin/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'অনেকবার চেষ্টা করা হয়েছে। ১৫ মিনিট পরে আবার চেষ্টা করুন।'
  }
}));

app.use('/api/orders', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false
}));


  registerPublicRoutes(app);
  registerAdminRoutes(app);

app.use(express.static(
  path.join(__dirname, '..', 'public'),
  {
    extensions: ['html'],
    maxAge: isProduction ? '1h' : 0
  }
));

app.use((err, req, res, next) => {
  console.error(err);

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({
    error: 'সার্ভারে সমস্যা হয়েছে।'
  });
});


  return app;
};

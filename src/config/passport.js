const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/user');

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // أزلنا callbackURL الثابت من هنا لأنه سيُحدد ديناميكياً
      passReqToCallback: true, // مهم جداً لتمرير req للدالة أدناه
      proxy: true,
    },
    async (req, accessToken, refreshToken, profile, done) => { // أضفنا req في البداية
      try {
        // البحث عن المستخدم بـ googleId أو بالإيميل
        let user = await User.findOne({ email: profile.emails[0].value });

        if (!user) {
          // إنشاء حساب جديد إذا لم يكن موجوداً
          user = await User.create({
            fullName: profile.displayName,
            email: profile.emails[0].value,
            role: 'BRAND',
            googleId: profile.id,
            isVerified: true,
          });
        } else if (!user.googleId) {
          // ربط حساب Google بحساب محلي موجود سلفاً
          user.googleId = profile.id;
          await user.save();
        }

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);
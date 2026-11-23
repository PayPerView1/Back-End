const crypto = require('crypto');
const User = require('../models/user');
const { sendEmail } = require('../services/emailService');
const generateToken = require('../utils/generateTokens');

const GENERIC_RESEND_MESSAGE =
  'If the account exists and is not verified, an activation email will be sent.';
const GENERIC_PASSWORD_RESET_MESSAGE =
  'If an account exists for that address, password reset instructions will be sent.';

// تعبير نمطي لمراقبة تعقيد كلمة المرور
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
const PASSWORD_ERROR_MSG = 'Password must contain at least 8 characters, one uppercase letter, one lowercase letter, one number, and one special character.';

// @desc    Register a new user & Send activation email (US-AUTH-01 / R0.01, R0.03, R0.09)
// @route   POST /api/v1/auth/register
// @access  Public
exports.register = async (req, res) => {
  try {
    const { 
      fullName, 
      email, 
      password, 
      role, 
      phoneNumber, 
      phoneCountryCode,
      country, 
      city, 
      profilePicture 
    } = req.body;

    if (!password || !PASSWORD_REGEX.test(password)) {
      return res.status(400).json({
        success: false,
        message: PASSWORD_ERROR_MSG,
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'This email is already registered — log in or reset your password.',
      });
    }

    if (role && !['BRAND', 'CLIPPER'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role selected. Must be BRAND or CLIPPER.',
      });
    }

    let finalProfilePicture = '';
    let finalProfilePicturePublicId = null; // ⬅️ متغير جديد لحفظ الـ public_id

    if (req.file) {
      finalProfilePicture = req.file.path;             // ⬅️ رابط Cloudinary
      finalProfilePicturePublicId = req.file.filename; // ⬅️ الـ public_id من Cloudinary
    } else if (profilePicture) {
      finalProfilePicture = profilePicture;
    }

    const user = new User({
      fullName,
      email,
      password,
      role: role || 'BRAND',
      phoneNumber: phoneNumber || '',
      phoneCountryCode: phoneCountryCode || '',
      country: country || '',
      city: city || '',
      profilePicture: finalProfilePicture || '',
      profilePicturePublicId: finalProfilePicturePublicId || '',
    });

    const verificationToken = user.createEmailVerificationToken();
    await user.save();

    const clientUrl = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;
    const activationUrl = `${clientUrl}/register/verify/${verificationToken}`;

    // ✅ الانتظار حتى يتم إرسال الإيميل بنجاح قبل إرجاع الـ Response
    try {
      await sendEmail({
        email: user.email,
        subject: 'Account Activation - Pay Per View',
        message: `Welcome to our platform! Please activate your account by 
        clicking the link below: (This link will be expired in 24 hours) ${activationUrl}`,
      });

      return res.status(201).json({
        success: true,
        message: 'Registration successful! Please check your email to activate your account.',
      });
    } catch (emailError) {
      // إزالة التوكين وحفظ المستخدم أو حذف الحساب إذا فشل الإرسال
      user.emailVerificationToken = undefined;
      user.emailVerificationExpires = undefined;
      await user.save({ validateBeforeSave: false });

      console.error('[EMAIL ERROR]:', emailError.message);
      return res.status(500).json({
        success: false,
        message: 'User registered, but verification email could not be sent. Please request a new one.',
      });
    }

  } catch (error) {
    console.error('[AUTH] registration failed:', error.name || 'Error');
    const isClientError = error.name === 'ValidationError' || error.code === 11000;
    res.status(isClientError ? 400 : 500).json({
      success: false,
      message: isClientError
        ? 'Please check the submitted registration details.'
        : 'Unable to complete registration right now. Please try again later.',
    });
  }
};


// @desc    Resend Activation Email (US-AUTH-01 / R0.09)
// @route   POST /api/v1/auth/resend-verification
// @access  Public
exports.resendVerification = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user || user.isVerified) {
      return res.status(200).json({
        success: true,
        message: GENERIC_RESEND_MESSAGE,
      });
    }

    // Generate a new verification token and expiration
    const verificationToken = user.createEmailVerificationToken();
    await user.save({ validateBeforeSave: false });

    const clientUrl = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;
    const activationUrl = `${clientUrl}/register/verify/${verificationToken}`;

    try {
      await sendEmail({
        email: user.email,
        subject: 'Account Activation - Pay Per View',
        message: `Welcome to our platform! Please activate your account by
        clicking the link below: (This link will be expired in 24 hours) ${activationUrl}`,
      });

      return res.status(200).json({
        success: true,
        message: GENERIC_RESEND_MESSAGE,
      });
    } catch (emailError) {
      user.emailVerificationToken = undefined;
      user.emailVerificationExpires = undefined;
      await user.save({ validateBeforeSave: false });

      console.error('[EMAIL ERROR]:', emailError.message);
      return res.status(200).json({
        success: true,
        message: GENERIC_RESEND_MESSAGE,
      });
    }

  } catch (error) {
    console.error('[AUTH] resend verification failed:', error.name || 'Error');
    res.status(500).json({
      success: false,
      message: 'Unable to process the request. Please try again later.',
    });
  }
};

// @desc    Verify Email via Token (US-AUTH-01 / R0.09)
// @route   GET /api/v1/auth/verify-email/:token
// @access  Public
exports.verifyEmail = async (req, res) => {
  try {
    const hashedToken = crypto
      .createHash('sha256')
      .update(req.params.token)
      .digest('hex');

    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Link expired or invalid. Please request a new activation email.',
      });
    }

    user.isVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Account activated successfully! You can now log in.',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Unable to verify this account right now. Please try again later.',
    });
  }
};

// @desc    Login user & Return JWT token (US-AUTH-02 / R0.02)
// @route   POST /api/v1/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password +tokenVersion');

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email address before logging in.',
      });
    }

    const token = generateToken(user._id, user.role, user.tokenVersion);

    res.status(200).json({
      success: true,
      token,
      data: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        phoneNumber: user.phoneNumber,
        country: user.country,
        city: user.city,
        profilePicture: user.profilePicture
      },
    });
  } catch (error) {
    console.error('[AUTH] login failed:', error.name || 'Error');
    res.status(500).json({
      success: false,
      message: 'Unable to log in right now. Please try again later.',
    });
  }
};

// @desc    Forgot Password - Request reset link (US-AUTH-03 / R0.07)
// @route   POST /api/v1/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(200).json({
        success: true,
        message: GENERIC_PASSWORD_RESET_MESSAGE,
      });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');
    user.passwordResetExpires = Date.now() + 10 * 60 * 1000;

    await user.save({ validateBeforeSave: false });

    const clientUrl = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;
    const resetUrl = `${clientUrl}/reset-password/${resetToken}`;

    // ✅ الانتظار باستخدام await مع الإيميل ومعالجة الفشل
    try {
      await sendEmail({
        email: user.email,
        subject: 'Password Reset Request',
        message: `You requested a password reset. Click this link to set a new password: ${resetUrl}`,
      });

      return res.status(200).json({
        success: true,
        message: GENERIC_PASSWORD_RESET_MESSAGE,
      });
    } catch (emailError) {
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validateBeforeSave: false });

      console.error('[EMAIL ERROR]:', emailError.message);
      return res.status(200).json({
        success: true,
        message: GENERIC_PASSWORD_RESET_MESSAGE,
      });
    }

  } catch (error) {
    console.error('[AUTH] forgot password failed:', error.name || 'Error');
    res.status(500).json({
      success: false,
      message: 'Unable to process the request. Please try again later.',
    });
  }
};

// @desc    Reset Password via Token (US-AUTH-03 / R0.07)
// @route   POST /api/v1/auth/reset-password/:token
// @access  Public
exports.resetPassword = async (req, res) => {
  try {
    const { password, confirmPassword } = req.body;

    if (!password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both password and confirmPassword fields.',
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Password and confirm password do not match.',
      });
    }

    if (!PASSWORD_REGEX.test(password)) {
      return res.status(400).json({
        success: false,
        message: PASSWORD_ERROR_MSG,
      });
    }

    const hashedToken = crypto
      .createHash('sha256')
      .update(req.params.token)
      .digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    }).select('+tokenVersion');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Token is invalid or has expired.',
      });
    }

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password updated successfully! You can now log in.',
    });
  } catch (error) {
    console.error('[AUTH] reset password failed:', error.name || 'Error');
    res.status(500).json({
      success: false,
      message: 'Unable to reset the password right now. Please try again later.',
    });
  }
};

// @desc    Change Password for Logged-in User (US-AUTH-03 / R0.06)
// @route   PATCH /api/v1/auth/change-password
// @access  Private
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide currentPassword, newPassword, and confirmPassword.',
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'New password and confirmation do not match.' });
    }

    if (!PASSWORD_REGEX.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message: PASSWORD_ERROR_MSG,
      });
    }

    const user = await User.findById(req.user._id).select('+password +tokenVersion');

    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Incorrect current password.',
      });
    }

    user.password = newPassword;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully!',
    });
  } catch (error) {
    console.error('[AUTH] change password failed:', error.name || 'Error');
    res.status(500).json({
      success: false,
      message: 'Unable to change the password right now. Please try again later.',
    });
  }
};

// @desc    Logout User (US-AUTH-02 / R0.08)
// @route   POST /api/v1/auth/logout
// @access  Private
exports.logout = async (req, res) => {
  try {
    await User.updateOne({ _id: req.user._id }, { $inc: { tokenVersion: 1 } });

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully.',
    });
  } catch (error) {
    console.error('[AUTH] logout failed:', error.name || 'DatabaseError');
    return res.status(500).json({
      success: false,
      message: 'Unable to log out right now. Please try again later.',
    });
  }
};

// @desc    Update user interests (US-AUTH-01 / Onboarding Step 3)
// @route   PATCH /api/v1/auth/interests
// @access  Private
exports.updateInterests = async (req, res) => {
  try {
    const { interests } = req.body;

    // التحقق من أن المفهوم الممرر هو Array
    if (!interests || !Array.isArray(interests)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of interests.',
      });
    }

    // التحقق من أن جميع العناصر الممررة تنتمي للقائمة المسموحة
    const ALLOWED_INTERESTS = [
      'LIFESTYLE',
      'TECHNOLOGY',
      'EDUCATION',
      'ENTERTAINMENT',
      'FINANCE',
      'HEALTH',
    ];

    const isValid = interests.every((item) => ALLOWED_INTERESTS.includes(item));
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: `Invalid interest value. Allowed values are: ${ALLOWED_INTERESTS.join(', ')}`,
      });
    }

    // تحديث المستخدم الحالي (المأخوذ من protect middleware)
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { interests },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Interests updated successfully!',
      data: {
        id: user._id,
        interests: user.interests,
      },
    });
  } catch (error) {
    console.error('[AUTH] update interests failed:', error.name || 'Error');
    res.status(500).json({
      success: false,
      message: 'Unable to update interests right now. Please try again later.',
    });
  }
};

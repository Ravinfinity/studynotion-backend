// const { response } = require("express");
const User = require("../models/User");
const mailSender = require("../utils/mailSender");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

//resetPasswordToken
exports.resetPasswordToken = async (req, res) => {
  try {
    //get email from req body
    const email = req.body.email;

    //check user for this email and email validation
    const user = await User.findOne({ email: email });
    if (!user) {
      return res.json({
        success: false,
        message: "Your Email is not registered with us",
      });
    }

    //generate token
    const token = crypto.randomBytes(20).toString("hex");

    //update user by adding token and expiration time
    const updatedUser = await User.findOneAndUpdate(
      { email: email },
      {
        token: token,
        resetPasswordExpires: Date.now() + 5 * 60 * 1000,
      },
      { new: true } // by marking true, it will return updated user
    );

    //create url
    const url = `https://studynotion-ravinfinity.vercel.app/update-password/${token}`;

    //send mail containing the url
    await mailSender(
      email,
      "Password Reset Link",
      `Password Reset Link: ${url}`
    );

    //return response
    return res.status(200).json({
      success: true,
      message:
        "Email Sent Successfully, please check email and change password ",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong while sending reset password mail",
      error: error.message,
    });
  }
};

//resetPassword
exports.resetPassword = async (req, res) => {
  try {
    //fetch data
    const token =
      req.body?.token ||
      req.cookies?.token ||
      req.header("Authorisation")?.replace("Bearer ", "");

    const { password, confirmPassword } = req.body;

    // validation
    if (!token || !password || !confirmPassword) {
      return res.status(401).json({
        success: false,
        message: "All fiels are required...!",
      });
    }

    // validate both passwords
    if (password !== confirmPassword) {
      return res.status(401).json({
        success: false,
        message: "Password not matching",
      });
    }

    //get user details from db using token
    const userDetails = await User.findOne({ token: token });

    //if no entry -> invalid token
    // check ==> is this needed or not ==> for security
    if (token !== userDetails.token) {
      return res.status(401).json({
        success: false,
        message: "Password Reset token is not matched",
      });
    }

    // console.log('userDetails.resetPasswordExpires = ', userDetails.resetPasswordExpires);

    // check token is expire or not
    if (userDetails.resetPasswordTokenExpires < Date.now()) {
      return res.status(401).json({
        success: false,
        message: "Token is expired, please regenerate token",
      });
    }

    //hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    //update user with new password
    await User.findOneAndUpdate(
      { token: token },
      { password: hashedPassword },
      { new: true }
    );

    //return response
    return res.status(200).json({
      success: true,
      message: "Password reset successful",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong while resetting/updating the password",
      error: error.message,
    });
  }
};

// sendOtp , signup , login ,  changePassword
const User = require("../models/User");
const Profile = require("../models/Profile");
const OTP = require("../models/OTP");
const otpGenerator = require("otp-generator");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const cookie = require("cookie");
const mailSender = require("../utils/mailSender");
const otpTemplate = require("../mail/templates/emailVerificationTemplate");
const { passwordUpdated } = require("../mail/templates/passwordUpdate");

// ================ SEND OTP For Email Verification ================
exports.sendOTP = async (req, res) => {
  try {
    //fetch email from the body of request
    const { email } = req.body;

    //check if user already exists
    const checkUserPresent = await User.findOne({ email });

    //if user already exists, then return a response
    if (checkUserPresent) {
      return res.status(401).json({
        success: false,
        message: "User already registered",
      });
    }

    //generate OTP
    let otp = otpGenerator.generate(6, {
      upperCaseAlphabets: false,
      lowerCaseAlphabets: false,
      specialChars: false,
    });

    //check unique otp or not
    // const result = await OTP.findOne({ otp: otp });

    // while (result) {
    //   otp = otpGenerator.generate(6, {
    //     upperCaseAlphabets: false,
    //     lowerCaseAlphabets: false,
    //     specialChars: false,
    //   });
    //   result = await OTP.findOne({ otp: otp });
    // }

    const name = email
      .split("@")[0]
      .split(".")
      .map((part) => part.replace(/\d+/g, ""))
      .join(" ");
    // console.log(name);

    // send otp in mail
    await mailSender(
      email,
      "OTP Verification Email from StudyNotion",
      otpTemplate(otp, name)
    );

    const otpPayload = { email, otp };

    //create an entry for OTP in db
    const otpBody = await OTP.create(otpPayload);
    // console.log('otpBody - ', otpBody);

    //return response successful
    res.status(200).json({
      success: true,
      message: "OTP Sent Successfully",
      otp,
    });
  } catch (error) {
    console.log("Error while generating Otp - ", error);
    return res.status(500).json({
      success: false,
      message: "Error while generating Otp",
      error: error.message,
    });
  }
};

// ================ SIGNUP ================
exports.signup = async (req, res) => {
  try {
    //fetch data from the body of request
    const {
      firstName,
      lastName,
      email,
      password,
      confirmPassword,
      accountType,
      contactNumber,
      otp,
    } = req.body;

    //validate the data
    if (
      !firstName ||
      !lastName ||
      !email ||
      !password ||
      !confirmPassword ||
      !accountType ||
      !otp
    ) {
      return res.status(403).json({
        success: false,
        message: "All fields are required",
      });
    }

    //match the both passwords, password and confirmPassword
    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message:
          "Password and ConfirmPassword value didn't match , please try again",
      });
    }

    //check whether user already exists or not
    const existingUser = await User.findOne({ email });

    // if yes ,then say to login
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User is already registered, go to login page",
      });
    }

    //find the most recent OTP stored for the user
    const recentOtp = await OTP.findOne({ email })
      .sort({ createdAt: -1 })
      .limit(1);
    // console.log(recentOtp);

    // .sort({ createdAt: -1 }):
    // It's used to sort the results based on the createdAt field in descending order (-1 means descending).
    // This way, the most recently created OTP will be returned first.

    // .limit(1): It limits the number of documents returned to 1.

    //validate OTP
    if (!recentOtp || recentOtp.length == 0) {
      //OTP not found
      return res.status(400).json({
        success: false,
        message: "OTP not found in DB, please try again",
      });
    } else if (otp !== recentOtp.otp) {
      //Invalid OTP
      return res.status(400).json({
        success: false,
        message: "invalid OTP",
      });
    }

    //hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    //create entry for the user in the db
    const profileDetails = await Profile.create({
      gender: null,
      dateOfBirth: null,
      about: null,
      contactNumber: null,
    });

    let approved = "";
    approved === "Instructor" ? (approved = false) : (approved = true);

    // create entry in DB
    const userData = await User.create({
      firstName,
      lastName,
      email,
      contactNumber,
      password: hashedPassword,
      additionalDetails: profileDetails._id,
      accountType,
      // accountType: accountType,
      approved: approved,
      image: `https://api.dicebear.com/5.x/initials/svg?seed=${firstName} ${lastName}`,
      oldImage: `https://api.dicebear.com/5.x/initials/svg?seed=${firstName} ${lastName}`,
    });

    //return res
    return res.status(200).json({
      success: true,
      message: "User Registered Successfully",
      userData,
    });
  } catch (error) {
    console.log("Error while registering user (signup)");
    console.log(error);
    return res.status(500).json({
      success: false,
      error: error.message,
      message: "User cannot be registered. Please try again",
    });
  }
};

// ================ LOGIN ================
exports.login = async (req, res) => {
  try {
    //get data from the body of req
    const { email, password } = req.body;

    //validate date
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required, please try again",
      });
    }

    //check user exists or not
    let user = await User.findOne({ email }).populate("additionalDetails");
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User is not registered, please sign up first",
      });
    }

    //generate JWT after matching password
    if (await bcrypt.compare(password, user.password)) {
      const payload = {
        email: user.email,
        id: user._id,
        accountType: user.accountType,
        // This will help to check whether user have access to route, while authorisation
      };
      const token = jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: "24h",
      });

      user = user.toObject();
      user.token = token;
      user.password = undefined; //we have removed password from object, not DB

      //create cookie and send response
      const cookieOptions = {
        expires: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
        httpOnly: true,
      };
      res.cookie("token", token, cookieOptions).status(200).json({
        success: true,
        token,
        user,
        message: "User Logged In Successfully",
      });
    } else {
      return res.status(401).json({
        success: false,
        message: "Password is incorrect",
      });
    }
  } catch (error) {
    console.log("Error while Login user");
    console.log(error);
    return res.status(500).json({
      success: false,
      error: error.message,
      message: "Login Failure, please try again",
    });
  }
};

// ================ CHANGE PASSWORD ================
exports.changePassword = async (req, res) => {
  try {
    // extract data
    const { oldPassword, newPassword, confirmNewPassword } = req.body;

    // validation
    if (!oldPassword || !newPassword || !confirmNewPassword) {
      return res.status(403).json({
        success: false,
        message: "All fileds are required",
      });
    }

    // get user
    const userDetails = await User.findById(req.user.id);

    // validate old password entered correct or not
    const isPasswordMatch = await bcrypt.compare(
      oldPassword,
      userDetails.password
    );

    // if old password not match
    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: "Old password is Incorrect",
      });
    }

    // check both passwords are matched
    if (newPassword !== confirmNewPassword) {
      return res.status(403).json({
        success: false,
        message: "The password and confirm password do not match",
      });
    }

    // hash password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // update password in DB
    const updatedUserDetails = await User.findByIdAndUpdate(
      req.user.id,
      { password: hashedPassword },
      { new: true }
    );

    //send mail - password updated
    try {
      const emailResponse = await mailSender(
        updatedUserDetails.email,
        "Password for your account has been updated",
        passwordUpdated(
          updatedUserDetails.email,
          `Password updated successfully for ${updatedUserDetails.firstName} ${updatedUserDetails.lastName}`
        )
      );
      // console.log("Email sent successfully:", emailResponse);
    } catch (error) {
      console.error("Error occurred while sending email:", error);
      return res.status(500).json({
        success: false,
        message: "Error occurred while sending email",
        error: error.message,
      });
    }

    // return success response
    res.status(200).json({
      success: true,
      mesage: "Password changed successfully",
    });
  } catch (error) {
    console.log("Error while changing password");
    console.log(error);
    res.status(500).json({
      success: false,
      error: error.message,
      messgae: "Error while changing passowrd",
    });
  }
};

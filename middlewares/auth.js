// AUTH , IS STUDENT , IS INSTRUCTOR , IS ADMIN

const jwt = require("jsonwebtoken");
require("dotenv").config();
const User = require("../models/User");

// ================ AUTH ================
// user Authentication by checking token validating
exports.auth = async (req, res, next) => {
  try {
    // extract token by anyone from this 3 ways
    const token =
      req.cookies.token ||
      req.body?.token ||
      req.header("Authorisation").replace("Bearer ", "");

    //if token missing, then return response
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Token is missing",
      });
    }

    // console.log('Token ==> ', token);
    // console.log('From body -> ', req.body?.token);
    // console.log('from cookies -> ', req.cookies?.token);
    // console.log('from headers -> ', req.header('Authorization')?.replace('Bearer ', ''));

    //verify the token
    try {
      const decode = jwt.verify(token, process.env.JWT_SECRET);
      // console.log("verified decode token => ", decode);

      // *********** example from console ***********
      // verified decode token =>  {
      //     email: 'buydavumli@biyac.com',
      //     id: '650d6ae2914831142c702e4c',
      //     accountType: 'Student',
      //     iat: 1699452446,
      //     exp: 1699538846
      //   }

      req.user = decode;
    } catch (error) {
      //verification issue
      console.log("Error while decoding token");
      console.log(error);

      return res.status(401).json({
        success: false,
        error: error.message,
        message: "Error while decoding token (Token is invalid)",
      });
    }
    //go to next middleware
    next();
  } catch (error) {
    console.log("Error while token validating");
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong while validating the token",
    });
  }
};

// ================ IS STUDENT ================
exports.isStudent = async (req, res, next) => {
  try {
    // console.log('User data -> ', req.user)
    if (req.user?.accountType !== "Student") {
      return res.status(401).json({
        success: false,
        message: "This is a protected route for Students only",
      });
    }
    // go to next middleware
    next();
  } catch (error) {
    console.log("Error while cheching user validity with student accountType");
    console.log(error);
    return res.status(500).json({
      success: false,
      error: error.message,
      message: "User role cannot be verified, please try again",
    });
  }
};

// ================ IS INSTRUCTOR ================
exports.isInstructor = async (req, res, next) => {
  try {
    // console.log('User data -> ', req.user)
    if (req.user?.accountType !== "Instructor") {
      return res.status(401).json({
        success: false,
        message: "This is a protected route for Instructors only",
      });
    }
    // go to next middleware
    next();
  } catch (error) {
    console.log(
      "Error while cheching user validity with Instructor accountType"
    );
    console.log(error);
    return res.status(500).json({
      success: false,
      error: error.message,
      message: "User role cannot be verified, please try again",
    });
  }
};

// ================ IS ADMIN ================
exports.isAdmin = async (req, res, next) => {
  try {
    // console.log('User data -> ', req.user)
    if (req.user?.accountType !== "Admin") {
      return res.status(401).json({
        success: false,
        message: "This is a protected route for Admin only",
      });
    }
    // go to next middleware
    next();
  } catch (error) {
    console.log("Error while cheching user validity with Admin accountType");
    console.log(error);
    return res.status(500).json({
      success: false,
      error: error.message,
      message: "User role cannot be verified, please try again",
    });
  }
};

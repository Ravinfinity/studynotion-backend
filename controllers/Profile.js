const Profile = require("../models/Profile");
const User = require("../models/User");
const CourseProgress = require("../models/CourseProgress");
const Course = require("../models/Course");

require("dotenv").config();

const {
  uploadImageToCloudinary,
  deleteResourceFromCloudinary,
} = require("../utils/imageUploader");
const { convertSecondsToDuration } = require("../utils/secToDuration");

//handler function to update Profile
exports.updateProfile = async (req, res) => {
  try {
    //get data

    //get userId
    const userId = req.user.id;
    // console.log("userId->", userId);

    const {
      dateOfBirth = "",
      about = "",
      gender = "",
      contactNumber = "",
      firstName,
      lastName,
    } = req.body;

    //validation
    // if (!contactNumber || !gender || !userId) {
    //   return res.status(400).json({
    //     success: false,
    //     message: "All fields are required",
    //   });
    // }

    //find profile
    const userDetails = await User.findById(userId);
    // console.log("userDetaiils-> ", userDetails);
    const profileId = userDetails.additionalDetails;
    // console.log("profileId-> ", profileId);
    const profileDetails = await Profile.findById(profileId);
    // console.log("profileDetails-> ", profileDetails);

    // Update the profile fields
    userDetails.firstName = firstName;
    userDetails.lastName = lastName;
    await userDetails.save();

    profileDetails.gender = gender;
    profileDetails.dateOfBirth = dateOfBirth;
    profileDetails.about = about;
    profileDetails.contactNumber = contactNumber;

    // save data to DB
    await profileDetails.save();

    const updatedUserDetails = await User.findById(userId).populate({
      path: "additionalDetails",
    });
    // console.log("updatedUserDetails -> ", updatedUserDetails);

    // return response
    res.status(200).json({
      success: true,
      updatedUserDetails,
      message: "Profile updated successfully",
    });
  } catch (error) {
    console.log("Error while updating profile");
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Error while updating profile",
      error: error.message,
    });
  }
};

// ================ delete Account ================
exports.deleteAccount = async (req, res) => {
  try {
    // extract user id
    const userId = req.user.id;
    // console.log('userId = ', userId)

    // validation
    const userDetails = await User.findById(userId);
    if (!userDetails) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // delete user profile picture From Cloudinary
    await deleteResourceFromCloudinary(userDetails.image);

    // if any student delete their account && enrollded in any course then ,
    // students entrolled in particular course sholud be decreased by one
    // user - courses - studentsEnrolled
    const userEnrolledCoursesId = userDetails.courses;
    // console.log("userEnrolledCourses ids = ", userEnrolledCoursesId);

    for (const courseId of userEnrolledCoursesId) {
      await Course.findByIdAndUpdate(courseId, {
        $pull: { studentsEnrolled: userId },
      });
    }

    // first - delete profie (profileDetails)
    await Profile.findByIdAndDelete(userDetails.additionalDetails);

    // second - delete account
    await User.findByIdAndDelete(userId);

    // sheduale this deleting account , crone job

    // return response
    res.status(200).json({
      success: true,
      message: "Account deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: "Error while deleting profile",
    });
  }
};

//handler function for fetching all details of a user
exports.getUserDetails = async (req, res) => {
  try {
    //get userId
    const userId = req.user.id;

    //validation and get user details
    const userDetails = await User.findById(userId)
      .populate("additionalDetails")
      .exec();

    //return response
    return res.status(200).json({
      success: true,
      message: "User Data Fetched Successfully",
      data: userDetails,
      // userDetails
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error while fetching user details",
      error: error.message,
    });
  }
};

//Pending----------------------------------------

// ================ Update User profile Image ================
exports.updateUserProfileImage = async (req, res) => {
  try {
    const profileImage = req.files?.profileImage;
    const userId = req.user.id;
    // console.log("req body->", req.user.id);

    // validation
    // console.log("profileImage = ", profileImage);

    // upload image to cloudinary
    const image = await uploadImageToCloudinary(
      profileImage,
      process.env.FOLDER_NAME,
      1000,
      1000
    );

    // console.log("image url - ", image);

    // update in DB
    const updatedUserDetails = await User.findByIdAndUpdate(
      userId,
      { image: image.secure_url },
      { new: true }
    ).populate({
      path: "additionalDetails",
    });

    // success response
    res.status(200).json({
      success: true,
      message: `Image Updated successfully`,
      data: updatedUserDetails,
    });
  } catch (error) {
    console.log("Error while updating user profile image");
    console.log(error);
    return res.status(500).json({
      success: false,
      error: error.message,
      message: "Error while updating user profile image",
    });
  }
};

// ================ Get Enrolled Courses ================
exports.getEnrolledCourses = async (req, res) => {
  try {
    const userId = req.user.id;
    let userDetails = await User.findOne({ _id: userId })
      .populate({
        path: "courses",
        populate: {
          path: "courseContent",
          populate: {
            path: "SubSection",
          },
        },
      })
      .exec();

    userDetails = userDetails.toObject();

    var SubSectionLength = 0;
    for (var i = 0; i < userDetails.courses.length; i++) {
      let totalDurationInSeconds = 0;
      SubSectionLength = 0;
      for (var j = 0; j < userDetails.courses[i].courseContent.length; j++) {
        totalDurationInSeconds += userDetails.courses[i].courseContent[
          j
        ].SubSection.reduce(
          (acc, curr) => acc + parseInt(curr.timeDuration),
          0
        );

        userDetails.courses[i].totalDuration = convertSecondsToDuration(
          totalDurationInSeconds
        );
        SubSectionLength +=
          userDetails.courses[i].courseContent[j].SubSection.length;
      }

      let courseProgressCount = await CourseProgress.findOne({
        courseID: userDetails.courses[i]._id,
        userId: userId,
      });

      courseProgressCount = courseProgressCount?.completedVideos.length;

      if (SubSectionLength === 0) {
        userDetails.courses[i].progressPercentage = 100;
      } else {
        // To make it up to 2 decimal point
        const multiplier = Math.pow(10, 2);
        userDetails.courses[i].progressPercentage =
          Math.round(
            (courseProgressCount / SubSectionLength) * 100 * multiplier
          ) / multiplier;
      }
    }

    if (!userDetails) {
      return res.status(400).json({
        success: false,
        message: `Could not find user with id: ${userDetails}`,
      });
    }

    return res.status(200).json({
      success: true,
      data: userDetails.courses,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================ instructor Dashboard ================
exports.instructorDashboard = async (req, res) => {
  try {
    const courseDetails = await Course.find({ instructor: req.user.id });

    const courseData = courseDetails.map((course) => {
      const totalStudentsEnrolled = course.studentsEnrolled.length;
      const totalAmountGenerated = totalStudentsEnrolled * course.price;

      // Create a new object with the additional fields
      const courseDataWithStats = {
        _id: course._id,
        courseName: course.courseName,
        courseDescription: course.courseDescription,
        // Include other course properties as needed
        totalStudentsEnrolled,
        totalAmountGenerated,
      };

      return courseDataWithStats;
    });

    res.status(200).json({
      courses: courseData,
      message: "Instructor Dashboard Data fetched successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

// ================ get All Students ================
exports.getAllStudents = async (req, res) => {
  try {
    const allStudentsDetails = await User.find({
      accountType: "Student",
    })
      .populate("additionalDetails")
      .populate("courses")
      .sort({ createdAt: -1 });

    const studentsCount = await User.countDocuments({
      accountType: "Student",
    });

    res.status(200).json({
      allStudentsDetails,
      studentsCount,
      message: "All Students Data fetched successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error while fetching all students",
      error: error.message,
    });
  }
};

// ================ get All Instructors ================
exports.getAllInstructors = async (req, res) => {
  try {
    const allInstructorsDetails = await User.find({
      accountType: "Instructor",
    })
      .populate("additionalDetails")
      .populate("courses")
      .sort({ createdAt: -1 });

    const instructorsCount = await User.countDocuments({
      accountType: "Instructor",
    });

    res.status(200).json({
      allInstructorsDetails,
      instructorsCount,
      message: "All Instructors Data fetched successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error while fetching all Instructors",
      error: error.message,
    });
  }
};
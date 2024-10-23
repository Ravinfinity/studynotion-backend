const Course = require("../models/Course");
const Category = require("../models/Category");
const User = require("../models/User");
const Section = require("../models/Section");
const SubSection = require("../models/SubSection");
const CourseProgress = require("../models/CourseProgress");

const {
  uploadImageToCloudinary,
  deleteResourceFromCloudinary,
} = require("../utils/imageUploader");
const { convertSecondsToDuration } = require("../utils/secToDuration");

// ================ create new course ================
exports.createCourse = async (req, res) => {
  try {
    //fetch data
    let {
      courseName,
      courseDescription,
      whatYouWillLearn,
      price,
      category,
      instructions: _instructions,
      // instructions,
      status,
      tag: _tag,
      // tag,
    } = req.body;

    // Convert the tag and instructions from stringified Array to Array
    const tag = JSON.parse(_tag);
    const instructions = JSON.parse(_instructions);

    // // let tag, instructions;
    // try {
    //   tag = Array.isArray(_tag) ? _tag : JSON.parse(_tag);
    //   instructions = Array.isArray(_instructions)
    //     ? _instructions
    //     : JSON.parse(_instructions);
    // } catch (err) {
    //   return res.status(400).json({
    //     success: false,
    //     message: "Invalid format for tag or instructions",
    //     error: err.message,
    //   });
    // }

    // console.log("hi there");

    // console.log("tag = ", tag)
    // console.log("instructions = ", instructions)

    //get thumbnail of course
    const thumbnail = req.files?.thumbnailImage;

    //validation
    if (
      !courseName ||
      !courseDescription ||
      !whatYouWillLearn ||
      !price ||
      !category ||
      !thumbnail ||
      !instructions.length ||
      !tag.length
    ) {
      return res.status(400).json({
        success: false,
        message: "All Fileds are required",
      });
    }

    if (!status || status === undefined) {
      status = "Draft";
    }

    // //check for instructor
    // const userId = req.user.id;
    // const instructorDetails = await User.findById(userId);
    // console.log("Instructor Details: ", instructorDetails);
    // //todo: verify that userId and instructorDetails._id are same or different?

    // if (!instructorDetails) {
    //   return res.status(404).json({
    //     success: false,
    //     message: "Instructor Details not found",
    //   });
    // }

    // check current user is instructor or not , bcoz only instructor can create
    // we have insert user id in req.user , (payload , while auth )
    const instructorId = req.user.id;

    // check given category is valid or not
    const categoryDetails = await Category.findById(category);
    if (!categoryDetails) {
      return res.status(401).json({
        success: false,
        message: "Category Details not found",
      });
    }

    //Upload thumbnail image to cloudinary
    const thumbnailDetails = await uploadImageToCloudinary(
      thumbnail,
      process.env.FOLDER_NAME
    );

    //create an entry for new course in DB
    const newCourse = await Course.create({
      courseName,
      courseDescription,
      instructor: instructorId,
      whatYouWillLearn,
      price,
      category: categoryDetails._id,
      tag,
      status,
      instructions,
      thumbnail: thumbnailDetails.secure_url,
      createdAt: Date.now(),
    });

    // add course id to instructor courses list, this is bcoz - it will show all created courses by instructor
    await User.findByIdAndUpdate(
      instructorId,
      {
        $push: {
          courses: newCourse._id,
        },
      },
      { new: true }
    );

    // Add the new course to the Categories
    await Category.findByIdAndUpdate(
      { _id: category },
      {
        $push: {
          courses: newCourse._id,
        },
      },
      { new: true }
    );

    //return response
    return res.status(200).json({
      success: true,
      message: "New Course Created Successfully",
      data: newCourse,
    });
  } catch (error) {
    console.log("Error while creating new course");
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Failed to create new Course",
      error: error.message,
    });
  }
};

//handler function of getAllCourses
exports.getAllCourses = async (req, res) => {
  try {
    const allCourses = await Course.find(
      {},
      {
        courseName: true,
        courseDescription: true,
        price: true,
        thumbnail: true,
        instructor: true,
        ratingAndReviews: true,
        studentsEnrolled: true,
      }
    )
      .populate({
        path: "instructor",
        select: "firstName lastName email image",
      })
      .exec();

    return res.status(200).json({
      success: true,
      message: "Data for all courses fetched successfully",
      data: allCourses,
    });
  } catch (error) {
    console.log("Error while fetching data of all courses");
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Cannot fetch all courses data",
      error: error.message,
    });
  }
};

//getCourseDetails
exports.getCourseDetails = async (req, res) => {
  try {
    //get course id
    const { courseId } = req.body;

    //find course details
    const courseDetails = await Course.findOne({ _id: courseId })
      .populate({
        path: "instructor",
        populate: {
          path: "additionalDetails",
        },
      })
      .populate("category")
      .populate("ratingAndReviews")
      .populate({
        path: "courseContent",
        populate: {
          path: "SubSection",
          select: "-videoUrl",
        },
      })
      .exec();

    //validation
    if (!courseDetails) {
      return res.status(400).json({
        success: false,
        message: `Could not find the course with course id ${courseId}`,
      });
    }

    // if (courseDetails.status === "Draft") {
    //   return res.status(403).json({
    //     success: false,
    //     message: `Accessing a draft course is forbidden`,
    //   });
    // }

    // console.log('courseDetails -> ', courseDetails)
    let totalDurationInSeconds = 0;
    courseDetails.courseContent.forEach((content) => {
      content.SubSection.forEach((subSection) => {
        const timeDurationInSeconds = parseInt(subSection.timeDuration);
        totalDurationInSeconds += timeDurationInSeconds;
      });
    });
    let totalDuration = convertSecondsToDuration(totalDurationInSeconds);
    courseDetails.totalDuration = convertSecondsToDuration(
      totalDurationInSeconds
    );

    //return response
    return res.status(200).json({
      success: true,
      message: "Course Details fetched Successfully",
      data: {
        courseDetails,
        totalDuration,
      },
    });
  } catch (error) {
    console.log("Error while fetching course details");
    console.log(error);
    return res.status(500).json({
      success: false,
      error: error.message,
      message: "Error while fetching course details",
    });
  }
};

// ================ Get Full Course Details ================
exports.getFullCourseDetails = async (req, res) => {
  try {
    const { courseId } = req.body;
    const userId = req.user.id;
    // console.log("courseId userId  = ", courseId, " userId == ", userId);

    const courseDetails = await Course.findOne({
      _id: courseId,
    })
      .populate({
        path: "instructor",
        populate: {
          path: "additionalDetails",
        },
      })
      .populate("category")
      .populate("ratingAndReviews")
      .populate({
        path: "courseContent",
        populate: {
          path: "SubSection",
        },
      })
      .exec();

    let courseProgressCount = await CourseProgress.findOne({
      courseID: courseId,
      userId: userId,
    });

    // console.log("courseProgressCount : ", courseProgressCount);

    if (!courseDetails) {
      return res.status(404).json({
        success: false,
        message: `Could not find course with course id: ${courseId}`,
      });
    }
    // if (courseDetails.status === "Draft") {
    //   return res.status(403).json({
    //     success: false,
    //     message: `Accessing a draft course is forbidden`,
    //   });
    // }

    //   count total time duration of course
    let totalDurationInSeconds = 0;
    courseDetails.courseContent.forEach((content) => {
      content.SubSection.forEach((subSection) => {
        const timeDurationInSeconds = parseInt(subSection.timeDuration);
        totalDurationInSeconds += timeDurationInSeconds;
      });
    });

    const totalDuration = convertSecondsToDuration(totalDurationInSeconds);

    return res.status(200).json({
      success: true,
      data: {
        courseDetails,
        totalDuration,
        completedVideos: courseProgressCount?.completedVideos
          ? courseProgressCount?.completedVideos
          : [],
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================ Edit Course Details ================
exports.editCourse = async (req, res) => {
  try {
    const { courseId } = req.body;
    const updates = req.body;
    // console.log("updates: ", updates);
    const course = await Course.findById(courseId);

    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    // If Thumbnail Image is found, update it
    if (req.files) {
      // console.log("thumbnail update")
      const thumbnail = req.files?.thumbnailImage;
      const thumbnailImage = await uploadImageToCloudinary(
        thumbnail,
        process.env.FOLDER_NAME
      );
      course.thumbnail = thumbnailImage.secure_url;
    }

    // Update only the fields that are present in the request body
    for (const key in updates) {
      if (updates.hasOwnProperty(key)) {
        if (key === "tag" || key === "instructions") {
          course[key] = JSON.parse(updates[key]);
        } else {
          course[key] = updates[key];
        }
      }
    }

    // updatedAt
    course.updatedAt = Date.now();

    //   save data
    await course.save();

    const updatedCourse = await Course.findOne({
      _id: courseId,
    })
      .populate({
        path: "instructor",
        populate: {
          path: "additionalDetails",
        },
      })
      .populate("category")
      .populate("ratingAndReviews")
      .populate({
        path: "courseContent",
        populate: {
          path: "SubSection",
        },
      })
      .exec();

    // success response
    res.status(200).json({
      success: true,
      message: "Course updated successfully",
      data: updatedCourse,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Error while updating course",
      error: error.message,
    });
  }
};

// ================ Get a list of Course for a given Instructor ================
exports.getInstructorCourses = async (req, res) => {
  try {
    // Get the instructor ID from the authenticated user or request body
    const instructorId = req.user.id;

    // Find all courses belonging to the instructor
    const instructorCourses = await Course.find({
      instructor: instructorId,
    }).sort({ createdAt: -1 });

    // Return the instructor's courses
    res.status(200).json({
      success: true,
      data: instructorCourses,
      // totalDurationInSeconds:totalDurationInSeconds,
      message: "Courses made by Instructor fetched successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve instructor courses",
      error: error.message,
    });
  }
};

// ================ Delete the Course ================
exports.deleteCourse = async (req, res) => {
  try {
    const { courseId } = req.body;

    // Find the course
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // Unenroll students from the course
    const studentsEnrolled = course.studentsEnrolled;
    for (const studentId of studentsEnrolled) {
      await User.findByIdAndUpdate(studentId, {
        $pull: { courses: courseId },
      });
    }

    // delete course thumbnail From Cloudinary
    await deleteResourceFromCloudinary(course?.thumbnail);

    // Delete sections and sub-sections
    const courseSections = course.courseContent;
    for (const sectionId of courseSections) {
      // Delete sub-sections of the section
      const section = await Section.findById(sectionId);
      if (section) {
        const subSections = section.SubSection;
        for (const subSectionId of subSections) {
          const subSection = await SubSection.findById(subSectionId);
          if (subSection) {
            await deleteResourceFromCloudinary(subSection.videoUrl); // delete course videos From Cloudinary
          }
          await SubSection.findByIdAndDelete(subSectionId);
        }
      }

      // Delete the section
      await Section.findByIdAndDelete(sectionId);
    }

    // Delete the course
    await Course.findByIdAndDelete(courseId);

    return res.status(200).json({
      success: true,
      message: "Course deleted successfully",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Error while Deleting course",
      error: error.message,
    });
  }
};

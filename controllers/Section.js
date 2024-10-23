const Section = require("../models/Section");
const Course = require("../models/Course");

//handler function for create section
exports.createSection = async (req, res) => {
  try {
    //fetch data
    const { sectionName, courseId } = req.body;
    // console.log('sectionName, courseId = ', sectionName, ",  = ", courseId);

    //data validation
    if (!sectionName || !courseId) {
      return res.status(400).json({
        success: false,
        message: "Missing Properties",
      });
    }

    //create section entry in DB
    const newSection = await Section.create({ sectionName });

    //update course with the section objectID
    const updatedCourse = await Course.findByIdAndUpdate(
      courseId,
      {
        $push: {
          courseContent: newSection._id,
        },
      },
      { new: true }
    );

    const updatedCourseDetails = await Course.findById(courseId).populate({
      path: "courseContent",
      populate: {
        path: "SubSection",
      },
    });

    // above -- populate remaining

    //return response
    return res.status(200).json({
      success: true,
      message: "Section Created Successfully",
      updatedCourseDetails,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Unable to create section, please try again",
      error: error.message,
    });
  }
};

//handler function for update section
exports.updateSection = async (req, res) => {
  try {
    //fetch data
    const { sectionName, sectionId, courseId } = req.body;

    //data validation
    if (!sectionName || !sectionId) {
      return res.status(400).json({
        success: false,
        message: "Missing Properties",
      });
    }

    // update section name in DB
    await Section.findByIdAndUpdate(sectionId, { sectionName }, { new: true });

    const updatedCourseDetails = await Course.findById(courseId).populate({
      path: "courseContent",
      populate: {
        path: "SubSection",
      },
    });

    //return response
    return res.status(200).json({
      success: true,
      data: updatedCourseDetails,
      message: "Section Updated Successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Unable to update section, please try again",
      error: error.message,
    });
  }
};

//handler function for delete section
exports.deleteSection = async (req, res) => {
  try {
    // //get ID - assuming that we are sending ID in params
    // const { sectionId } = req.params; //HW

    const { sectionId, courseId } = req.body;
    // console.log('sectionId = ', sectionId);

    //use findByIdandDelete
    await Section.findByIdAndDelete(sectionId);

    //todo[testing]: do we need to delete the entry from the course Schema?

    const updatedCourseDetails = await Course.findById(courseId).populate({
      path: "courseContent",
      populate: {
        path: "SubSection",
      },
    });

    //return response
    return res.status(200).json({
      success: true,
      data: updatedCourseDetails,
      message: "Section Deleted Successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Unable to delete section, please try again",
      error: error.message,
    });
  }
};

const SubSection = require("../models/SubSection");
const Section = require("../models/Section");
const { uploadImageToCloudinary } = require("../utils/imageUploader");

//create Subsection
exports.createSubSection = async (req, res) => {
  try {
    //fetch data from req body
    const { sectionId, title, description } = req.body;

    //extract file/video
    const videoFile = req.files?.videoFile;
    // console.log("videoFile ", videoFile);

    //validation
    if (!sectionId || !title || !description || !videoFile) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    //upload video to cloudinary
    const videoFileDetails = await uploadImageToCloudinary(
      videoFile,
      process.env.FOLDER_NAME
    );

    //create a subsection entry in DB
    const SubSectionDetails = await SubSection.create({
      title,
      timeDuration: videoFileDetails.duration,
      // timeDuration: timeDuration,
      // timeDuration,
      description,
      videoUrl: videoFileDetails.secure_url,
    });

    // update section with this subsection ObjectId
    const updatedSection = await Section.findByIdAndUpdate(
      sectionId,
      {
        $push: {
          SubSection: SubSectionDetails.id,
        },
      },
      { new: true }
    ).populate("SubSection");

    //return response
    return res.status(200).json({
      success: true,
      message: "Subsection created successfully",
      data: updatedSection,
    });
  } catch (error) {
    return res.status({
      success: false,
      message: "Error creating subsection",
      error: error.message,
    });
  }
};

// ================ Update SubSection ================
exports.updateSubSection = async (req, res) => {
  try {
    const { sectionId, subSectionId, title, description } = req.body;

    // validation
    if (!subSectionId) {
      return res.status(400).json({
        success: false,
        message: "subSection ID is required to update",
      });
    }

    // find in DB
    const subSection = await SubSection.findById(subSectionId);

    if (!subSection) {
      return res.status(404).json({
        success: false,
        message: "SubSection not found",
      });
    }

    // add data
    if (title) {
      subSection.title = title;
    }

    if (description) {
      subSection.description = description;
    }

    // upload video to cloudinary
    if (req.files && req.files.videoFile !== undefined) {
      const video = req.files.videoFile;
      const uploadDetails = await uploadImageToCloudinary(
        video,
        process.env.FOLDER_NAME
      );
      subSection.videoUrl = uploadDetails.secure_url;
      subSection.timeDuration = uploadDetails.duration;
    }

    // save data to DB
    await subSection.save();

    const updatedSection = await Section.findById(sectionId).populate(
      "SubSection"
    );

    return res.json({
      success: true,
      data: updatedSection,
      message: "Section updated successfully",
    });
  } catch (error) {
    console.error("Error while updating the section");
    console.error(error);
    return res.status(500).json({
      success: false,
      error: error.message,
      message: "Error while updating the section",
    });
  }
};

// ================ Delete SubSection ================
exports.deleteSubSection = async (req, res) => {
  try {
    const { subSectionId, sectionId } = req.body;
    await Section.findByIdAndUpdate(sectionId, {
      $pull: {
        SubSection: subSectionId,
      },
    });

    // delete from DB
    const subSection = await SubSection.findByIdAndDelete(subSectionId);

    // console.log(subSection);

    if (!subSection) {
      return res
        .status(404)
        .json({ success: false, message: "SubSection not found" });
    }

    const updatedSection = await Section.findById(sectionId).populate(
      "SubSection"
    );

    // In frontned we have to take care - when subsection is deleted we are sending ,
    // only section data not full course details as we do in others

    // success response
    return res.json({
      success: true,
      data: updatedSection,
      message: "SubSection deleted successfully",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      error: error.message,
      message: "An error occurred while deleting the SubSection",
    });
  }
};

const cloudinary = require("cloudinary").v2;
require("dotenv").config();

exports.uploadImageToCloudinary = async (file, folder, height, quality) => {
  try {
    const options = { folder };

    if (height) options.height = height;
    if (quality) options.quality = quality;

    options.resource_type = "auto";
    return await cloudinary.uploader.upload(file.tempFilePath, options);
  } catch (error) {
    console.log("Error while uploading image");
    console.log(error);
  }
};

// Function to delete a resource by public ID
exports.deleteResourceFromCloudinary = async (url) => {
  if (!url) return;

  try {
    const publicId = `${process.env.FOLDER_NAME}/${
      url.split("/").pop().split(".")[0]
    }`;
    const result = await cloudinary.uploader.destroy(publicId);
    // console.log(`Deleted resource with public ID: ${publicId} and url: ${url}`);
    console.log("Delete Resourse result = ", result);
    return result;
  } catch (error) {
    console.error(`Error deleting resource with public ID ${url}:`, error);
    throw error;
  }
};

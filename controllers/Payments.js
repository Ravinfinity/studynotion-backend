const { instance } = require("../config/razorpay");
const Course = require("../models/Course");
const User = require("../models/User");
const crypto = require("crypto");
const mailSender = require("../utils/mailSender");
const {
  courseEnrollmentEmail,
} = require("../mail/templates/courseEnrollmentEmail");
const CourseProgress = require("../models/CourseProgress");
const { default: mongoose } = require("mongoose");
const Razorpay = require("razorpay");
require("dotenv").config();

//capture the payment and initiate the Razorpay order
exports.capturePayment = async (req, res) => {
  // extract courseId & userId
  const coursesId = req.body;
  // console.log("coursesId = ", typeof coursesId);
  // console.log("coursesId = ", coursesId);

  const userId = req.user.id;
  // console.log("user id ->", userId);

  //validation
  //check valid courseId

  if (!coursesId) {
    return res.json({
      success: false,
      message: "Please provide valid course ID",
    });
  }
  //check valid courseDetail
  let totalAmount = 0;

  for (const course_id of coursesId) {
    let course;
    try {
      // valid course Details
      course = await Course.findById(course_id);
      if (!course) {
        return res
          .status(404)
          .json({ success: false, message: "Could not find the course" });
      }

      // check user already enrolled the course
      const uid = new mongoose.Types.ObjectId(userId);
      if (course.studentsEnrolled.includes(uid)) {
        return res
          .status(400)
          .json({ success: false, message: "Student is already Enrolled" });
      }

      totalAmount += course.price;
    } catch (error) {
      console.log(error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  // create order
  const currency = "INR";
  const options = {
    amount: totalAmount * 100,
    currency,
    receipt: Math.random(Date.now()).toString(),
  };

  // initiate payment using Razorpay
  try {
    // console.log("instance->", instance);
    const paymentResponse = await instance.orders.create(options);
    // return response
    res.status(200).json({
      success: true,
      message: paymentResponse,
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, mesage: "Could not Initiate Order" });
  }
};

// ================ verify the payment ================
exports.verifyPayment = async (req, res) => {
  const razorpay_order_id = req.body?.razorpay_order_id;
  const razorpay_payment_id = req.body?.razorpay_payment_id;
  const razorpay_signature = req.body?.razorpay_signature;
  const courses = req.body?.coursesId;
  const userId = req.user.id;
  // console.log(' req.body === ', req.body)

  if (
    !razorpay_order_id ||
    !razorpay_payment_id ||
    !razorpay_signature ||
    !courses ||
    !userId
  ) {
    return res
      .status(400)
      .json({ success: false, message: "Payment Failed, data not found" });
  }

  let body = razorpay_order_id + "|" + razorpay_payment_id;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_SECRET)
    .update(body.toString())
    .digest("hex");

  if (expectedSignature === razorpay_signature) {
    //enroll student
    await enrollStudents(courses, userId, res);
    //return res
    return res.status(200).json({ success: true, message: "Payment Verified" });
  }
  return res.status(200).json({ success: "false", message: "Payment Failed" });
};

// ================ enroll Students to course after payment ================
const enrollStudents = async (courses, userId, res) => {
  if (!courses || !userId) {
    return res.status(400).json({
      success: false,
      message: "Please Provide data for Courses or UserId",
    });
  }

  for (const courseId of courses) {
    try {
      //find the course and enroll the student in it
      const enrolledCourse = await Course.findOneAndUpdate(
        { _id: courseId },
        { $push: { studentsEnrolled: userId } },
        { new: true }
      );

      if (!enrolledCourse) {
        return res
          .status(500)
          .json({ success: false, message: "Course not Found" });
      }
      // console.log("Updated course: ", enrolledCourse);

      // Initialize course preogres with 0 percent
      const courseProgress = await CourseProgress.create({
        courseID: courseId,
        userId: userId,
        completedVideos: [],
      });

      // Find the student and add the course to their list of enrolled courses
      const enrolledStudent = await User.findByIdAndUpdate(
        userId,
        {
          $push: {
            courses: courseId,
            courseProgress: courseProgress._id,
          },
        },
        { new: true }
      );

      // console.log("Enrolled student: ", enrolledStudent)

      // Send an email notification to the enrolled student
      const emailResponse = await mailSender(
        enrolledStudent.email,
        `Successfully Enrolled into ${enrolledCourse.courseName}`,
        courseEnrollmentEmail(
          enrolledCourse.courseName,
          `${enrolledStudent.firstName}`
        )
      );
      // console.log("Email Sent Successfully ", emailResponse);
    } catch (error) {
      console.log(error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }
};

exports.sendPaymentSuccessEmail = async (req, res) => {
  const { orderId, paymentId, amount } = req.body;

  const userId = req.user.id;

  if (!orderId || !paymentId || !amount || !userId) {
    return res
      .status(400)
      .json({ success: false, message: "Please provide all the fields" });
  }

  try {
    // find student
    const enrolledStudent = await User.findById(userId);
    await mailSender(
      enrolledStudent.email,
      `Payment Recieved`,
      paymentSuccessEmail(
        `${enrolledStudent.firstName}`,
        amount / 100,
        orderId,
        paymentId
      )
    );
  } catch (error) {
    console.log("error in sending mail", error);
    return res
      .status(500)
      .json({ success: false, message: "Could not send email" });
  }
};

//handler function for verify signature of razorpay and server
// exports.verifySignature = async (req, res) => {
//   const webhookSecret = "12345678";

//   const signature = req.header["x-razorpay-signature"];

//   const shasum = crypto.createHmac("sha256", webhookSecret);
//   shasum.update(JSON.stringify(req.body));
//   const digest = shasum.digest("hex");
//   //what is checksum?

//   if (signature === digest) {
//     console.log("Payment is Authorised");

//     const { courseId, userId } = req.body.payload.payment.entity.notes;

//     try {
//       //fulfil the action
//       //find the course and enroll the student in it
//       const enrolledCourse = await Course.findOneAndUpdate(
//         { _id: courseId },
//         { $push: { studentsEnrolled: userId } },
//         { new: true }
//       );

//       if (!enrolledCourse) {
//         return res.status(500).json({
//           success: false,
//           message: "Course not found",
//         });
//       }

//       console.log(enrolledCourse);

//       //find the student and the course to his list of enrolled courses
//       const enrolledStudent = await user.findOneAndUpdate(
//         { _id: userId },
//         { $push: { courses: courseId } },
//         { new: true }
//       );

//       console.log(enrolledStudent);

//       //send the confirmation mail
//       const emailResponse = await mailSender(
//         enrolledStudent.email,
//         "Congratulations from CodeHelp",
//         "Congratulations, you are onboarded into new CodeHelp Course"
//       );

//       console.log(emailResponse);
//       return res.status(200).json({
//         success: true,
//         message: "Signature Verified and Course Added",
//       });
//     } catch (error) {
//       console.log(error);
//       return res.status(500).json({
//         success: false,
//         message: "Error while verifing rajorpay signature",
//         error: error.message,
//       });
//     }
//   } else {
//     return res.status(400).json({
//       success: false,
//       message: "Invalid request",
//     });
//   }
// };

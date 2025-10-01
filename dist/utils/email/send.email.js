"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = void 0;
const nodemailer_1 = require("nodemailer");
const error_response_1 = require("../response/error.response");
const sendEmail = async (data) => {
    try {
        console.log(">>> Preparing to send email...");
        console.log(">>> Email data received:", {
            to: data.to,
            subject: data.subject,
            hasHtml: !!data.html,
            hasText: !!data.text,
            hasAttachments: !!data.attachments?.length,
        });
        if (!data.html && !data.attachments?.length && !data.text) {
            throw new error_response_1.BadRequestException("Missing Email Content");
        }
        console.log(">>> Creating transporter with Gmail service...");
        console.log("EMAIL:", process.env.EMAIL);
        console.log("EMAIL_PASSWORD exists?:", !!process.env.EMAIL_PASSWORD);
        const transporter = (0, nodemailer_1.createTransport)({
            service: "gmail",
            auth: {
                user: process.env.EMAIL,
                pass: process.env.EMAIL_PASSWORD,
            },
        });
        console.log(">>> Transporter created. Sending email now...");
        const info = await transporter.sendMail({
            ...data,
            from: `"Route ${process.env.APPLICATION_NAME}❤🚀" <${process.env.EMAIL}>`,
        });
        console.log(">>> Email sent successfully!");
        console.log("Message ID:", info.messageId);
        console.log("Response:", info.response);
        console.log("Accepted:", info.accepted);
        console.log("Rejected:", info.rejected);
    }
    catch (error) {
        console.error(">>> Full Email Error:", error);
        throw error;
    }
};
exports.sendEmail = sendEmail;

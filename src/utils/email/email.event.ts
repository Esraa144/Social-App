import { EventEmitter } from "node:events";
import Mail from "nodemailer/lib/mailer";
import { sendEmail } from "../email/send.email";
import { verifyEmail } from "../email/verify.template.email";
export const emailEvent = new EventEmitter();

interface IEmail extends Mail.Options {
  otp: number;
}
emailEvent.on("ConfirmEmail", async (data: IEmail) => {
  try {
    console.log(">>> ConfirmEmail event triggered", data);

    data.subject = "Confirm-Email";
    data.html = verifyEmail({ otp: data.otp, title: "Email Confirmation" });
    await sendEmail(data);
    console.log(">>> Email sent successfully");
  } catch (error) {
    console.log(`Fail to send email`, error);
  }
});

emailEvent.on("resetPassword", async (data: IEmail) => {
  try {
    data.subject = "Reset-Password";
    data.html = verifyEmail({ otp: data.otp, title: "Reset Code" });
    await sendEmail(data);
  } catch (error) {
    console.log(`Fail to send email`, error);
  }
});

emailEvent.on("TagNotification", async (data) => {
  try {
    await sendEmail(data);
    console.log("Tag email sent to:", data.to);
  } catch (error) {
    console.error("Failed to send tag email:", error);
  }
});


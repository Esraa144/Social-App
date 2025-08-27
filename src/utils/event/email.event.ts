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
    data.subject = "Confirm-Email";
    data.html = verifyEmail({ otp: data.otp, title: "Email Confirmation" });
    await sendEmail(data);
  } catch (error) {
    console.log(`Fail to send email`, error);
  }
});

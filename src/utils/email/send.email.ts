import { createTransport, Transporter } from "nodemailer";
import Mail from "nodemailer/lib/mailer";
import SMTPTransport from "nodemailer/lib/smtp-transport";
import { BadRequestException } from "../response/error.response";

export const sendEmail = async (data: Mail.Options): Promise<void> => {
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
      throw new BadRequestException("Missing Email Content");
    }

    console.log(">>> Creating transporter with Gmail service...");
    console.log("EMAIL:", process.env.EMAIL);
    console.log("EMAIL_PASSWORD exists?:", !!process.env.EMAIL_PASSWORD);

    const transporter: Transporter<
      SMTPTransport.SentMessageInfo,
      SMTPTransport.Options
    > = createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL as string,
        pass: process.env.EMAIL_PASSWORD as string,
      },
    });

    console.log(">>> Transporter created. Sending email now...");

    const info = await transporter.sendMail({
      ...data,
      from: `"Route ${process.env.APPLICATION_NAME}❤🚀" <${
        process.env.EMAIL as string
      }>`,
    });

    console.log(">>> Email sent successfully!");
    console.log("Message ID:", info.messageId);
    console.log("Response:", info.response);
    console.log("Accepted:", info.accepted);
    console.log("Rejected:", info.rejected);
  } catch (error) {
    console.error(">>> Full Email Error:", error);
    throw error;
  }
};

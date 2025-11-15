import sgMail from "@sendgrid/mail";
import dotenv from "dotenv";
dotenv.config();
// Set your SendGrid API Key
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Set up the email
const msg = {
  to: "mohamedhoarra@gmail.com", // Recipient's email address
  from: "mohamedhoarra1@gmail.com", // Your verified sender email address
  subject: "Hello from SendGrid",
  text: "This is a test email sent from SendGrid!",
  html: "<strong>This is a test email sent from SendGrid!</strong>",
};

// Send the email
sgMail
  .send(msg)
  .then(() => {
    console.log("Email sent successfully");
  })
  .catch((error) => {
    console.error("Error sending email:", error);
  });

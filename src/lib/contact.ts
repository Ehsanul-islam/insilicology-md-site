import { createHmac } from "node:crypto";

export type ContactInput = { name: string; email: string; subject: string; message: string; pdb: string };
export type ContactErrors = Partial<Record<keyof ContactInput, string>>;

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PDB = /^[0-9][A-Za-z0-9]{3}$/;

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

/** Read and validate the contact form. The database enforces the same limits again. */
export function parseContact(form: FormData): { values: ContactInput; errors: ContactErrors } {
  const values: ContactInput = {
    name: str(form.get("name")),
    email: str(form.get("email")),
    subject: str(form.get("subject")),
    message: str(form.get("message")),
    pdb: str(form.get("pdb")).toUpperCase(),
  };
  const errors: ContactErrors = {};
  if (!values.name) errors.name = "Enter your name.";
  else if (values.name.length > 120) errors.name = "Keep your name under 120 characters.";
  if (!EMAIL.test(values.email) || values.email.length > 254) errors.email = "Enter a valid email address.";
  if (values.subject.length > 200) errors.subject = "Keep the subject under 200 characters.";
  if (values.message.length < 10) errors.message = "Write at least 10 characters.";
  else if (values.message.length > 5000) errors.message = "Keep the message under 5000 characters.";
  if (values.pdb && !PDB.test(values.pdb)) errors.pdb = "A PDB ID has 4 characters and starts with a digit, such as 1AFS.";
  return { values, errors };
}

/** HMAC of the sender's IP, so the rate limiter never stores the address itself. */
export function hashIp(ip: string, secret: string) {
  return createHmac("sha256", secret).update(ip).digest("hex");
}

/** First address of an x-forwarded-for header. */
export function clientIp(forwardedFor: string | null) {
  return forwardedFor?.split(",")[0]?.trim() || "unknown";
}

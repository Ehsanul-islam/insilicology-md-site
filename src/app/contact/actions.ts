"use server";

import { headers } from "next/headers";
import { clientIp, hashIp, parseContact, type ContactErrors, type ContactInput } from "../../lib/contact";
import { createAdminSupabase } from "../../lib/supabase/admin";

export type ContactState = { ok?: boolean; error?: string; errors?: ContactErrors; values?: ContactInput };

async function verifyTurnstile(token: string, ip: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // captcha is optional until a key is set
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    });
    return ((await res.json()) as { success?: boolean }).success === true;
  } catch {
    return false;
  }
}

/** Best-effort email to the site owner. Only runs if the owner configured Resend. */
async function notifyOwner(v: ContactInput) {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_NOTIFY_EMAIL;
  const from = process.env.CONTACT_FROM_EMAIL;
  if (!key || !to || !from) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to,
        reply_to: v.email,
        subject: `Website message${v.pdb ? ` (${v.pdb})` : ""}: ${v.subject || v.name}`,
        text: `From: ${v.name} <${v.email}>\n${v.pdb ? `PDB ID: ${v.pdb}\n` : ""}\n${v.message}`,
      }),
    });
  } catch {
    // the message is already stored; a failed notification must not fail the visitor's request
  }
}

export async function sendMessage(_prev: ContactState, form: FormData): Promise<ContactState> {
  // honeypot: real visitors never see or fill this field
  if (String(form.get("website") ?? "") !== "") return { ok: true };

  const { values, errors } = parseContact(form);
  if (Object.keys(errors).length) return { errors, values };

  const admin = createAdminSupabase();
  if (!admin) return { error: "Messages cannot be sent right now. Please try again later.", values };

  const ip = clientIp((await headers()).get("x-forwarded-for"));
  if (!(await verifyTurnstile(String(form.get("cf-turnstile-response") ?? ""), ip))) {
    return { error: "We could not verify that you are human. Please try again.", values };
  }

  const secret = process.env.CONTACT_HASH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const { error } = await admin.rpc("submit_contact_message", {
    p_name: values.name,
    p_email: values.email,
    p_subject: values.subject,
    p_message: values.message,
    p_pdb: values.pdb,
    p_ip_hash: hashIp(ip, secret),
  });
  if (error) {
    if (error.code === "54000") return { error: "You have sent several messages recently. Please try again in an hour.", values };
    return { error: "Your message could not be sent. Please try again.", values };
  }
  await notifyOwner(values);
  return { ok: true };
}

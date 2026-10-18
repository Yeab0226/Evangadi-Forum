import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { safeExecute } from "../../../../db/config.js";
import {
  BadRequestError,
  UnauthenticatedError,
} from "../../../utils/errors/index.js";
import { OAuth2Client } from "google-auth-library";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

if (!GOOGLE_CLIENT_ID) {
  throw new Error("GOOGLE_CLIENT_ID environment variable is required");
}

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1d";

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}

const normalizeEmail = (email) => email.trim().toLowerCase();

/**
 * Checks if a user exists by email.
 *
 * @param {string} email - The email to check.
 * @returns {Promise<boolean>} True if the user exists, false otherwise.
 */
export const checkUserExists = async (email) => {
  const normalizedEmail = normalizeEmail(email);
  const sql = "SELECT user_id FROM users WHERE email = ? LIMIT 1";
  const rows = await safeExecute(sql, [normalizedEmail]);
  return rows.length > 0; //if user exists row.length willbe > 0 and checkUserExists returns true
};

/**
 * Registers a new user in the database.
 *
 * @param {Object} userData - The user data.
 * @param {string} userData.firstName - The first name.
 * @param {string} userData.lastName - The last name.
 * @param {string} userData.email - The email address.
 * @param {string} userData.password - The plain text password.
 * @returns {Promise<Object>} The created user object (without password).
 */
export const registerService = async ({
  firstName,
  lastName,
  email,
  password,
}) => {
  // Call normalizeEmail to trim whitespace and convert the email to lowercase
  // so that email comparisons are consistent
  const normalizedEmail = normalizeEmail(email);

  // Check if a user already exists with this email to prevent duplicate accounts.
  // This provides an application-level check before attempting the database insert.
  const userExists = await checkUserExists(normalizedEmail);
  // if the user already exists, it throws an error, and the registration won't continue
  if (userExists) {
    throw new BadRequestError("User already exists with this email.");
  }

  // Generate a new random salt for this password.
  // The salt is different each time bcrypt.genSalt() is called.
  const salt = await bcrypt.genSalt(10);

  // Hash the user's password using the generated salt.
  // The original password is never stored directly in the database.
  const hashedPassword = await bcrypt.hash(password, salt);

  //  insert the new user's data into the database
  const sql =
    "INSERT INTO users (first_name, last_name, email, password_hash) VALUES (?, ?, ?, ?)";

  let result;

  try {
    // Execute the INSERT query with the user's data
    result = await safeExecute(sql, [
      firstName,
      lastName,
      normalizedEmail,
      hashedPassword,
    ]);
  } catch (error) {
    // If the database detects a duplicate email, return error
    // This protects against duplicates even if two requests pass the checkUserExists() check at the same time
    //ER_DUP_ENTRY: is mtsql error that tells us we're trying to insert a value that already exists in colunm that is set to be unique
    if (error?.code === "ER_DUP_ENTRY") {
      throw new BadRequestError("User already exists with this email.");
    }

    // Pass any other database error to the error-handling middleware
    throw error;
  }

  // Return the newly created user's information.
  // The password/hash is intentionally not included in the response.
  return {
    id: result.insertId,
    firstName,
    lastName,
    email: normalizedEmail,
  };
};

/**
 * Authenticates a user and generates a JWT token.
 *
 * @param {Object} credentials - The login credentials.
 * @param {string} credentials.email - The user's email.
 * @param {string} credentials.password - The user's plain text password.
 * @returns {Promise<Object>} An object containing the user and token.
 * @throws {UnauthenticatedError} If authentication fails.
 */
export const loginService = async ({ email, password }) => {
  const normalizedEmail = normalizeEmail(email);
  const sql =
    "SELECT user_id, first_name, last_name, email, password_hash, avatar FROM users WHERE email = ? LIMIT 1";
  const rows = await safeExecute(sql, [normalizedEmail]); //protecting against SQL injection by using parameterized queries

  if (rows.length === 0) {
    throw new UnauthenticatedError("Invalid email or password");
  }

  const user = rows[0];
  const isMatch = await bcrypt.compare(password, user.password_hash);

  if (!isMatch) {
    throw new UnauthenticatedError("Invalid email or password");
    //we should not specify which one is incorrect for security reasons, so we use a generic message
  }

  const payload = {
    id: user.user_id,
    firstName: user.first_name,
    lastName: user.last_name,
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN }); // Generate a JWT token with the user's ID and name, signed with the secret key, and set to expire in the given time

  return {
    user: {
      id: user.user_id,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      avatar: user.avatar,
    },
    token,
  };
};

const RESET_TOKEN_EXPIRES_IN = "15m";

export const forgotPasswordService = async (email) => {
  const normalizedEmail = normalizeEmail(email);
  const sql =
    "SELECT user_id, first_name, email FROM users WHERE email = ? LIMIT 1";
  const rows = await safeExecute(sql, [normalizedEmail]);

  // Do not reveal whether the email exists.
  if (rows.length === 0) {
    return;
  }

  const user = rows[0];
  const resetToken = jwt.sign(
    { id: user.user_id, type: "password-reset" },
    JWT_SECRET,
    { expiresIn: RESET_TOKEN_EXPIRES_IN },
  );

  const resetLink = `${process.env.FRONTEND_URL || "http://localhost:5173"}/reset-password?token=${resetToken}`;

  const apiKey = process.env.RESEND_API_KEY;
  const sender = process.env.EMAIL_FROM;

  if (!apiKey || !sender) {
    throw new Error("Password-reset email is not configured");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(15000),
    // body: JSON.stringify({
    //   from: sender,
    //   to: [user.email],
    //   subject: "Reset your Evangadi Forum password",
    //   text:
    //     `Hello ${user.first_name},\n\n` +
    //     `Reset your password: ${resetLink}\n\n` +
    //     "This link expires in 15 minutes.",
    // }),

    body: JSON.stringify({
      from: sender,
      to: [user.email],
      subject: "Reset your Evangadi Forum password",
      text:
        `Reset your Evangadi Forum password:\n\n${resetLink}\n\n` +
        "This link expires in 15 minutes.\n" +
        "If you didn't request this, you can ignore this email.",
      html: `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Reset your password</title>
      </head>
      <body style="margin:0;padding:0;background:#f3f5f9;
        font-family:Arial,Helvetica,sans-serif;color:#253047;">

        <div style="display:none;max-height:0;overflow:hidden;
          opacity:0;mso-hide:all;">
          Your secure password reset link expires in 15 minutes.
        </div>

        <table role="presentation" width="100%" cellspacing="0"
          cellpadding="0" style="background:#f3f5f9;">
          <tr>
            <td align="center" style="padding:40px 16px;">
              <table role="presentation" width="100%" cellspacing="0"
                cellpadding="0" style="max-width:560px;background:#ffffff;
                border:1px solid #e4e8ef;border-radius:16px;">

                <tr>
                  <td style="padding:30px 32px 24px;
                    border-bottom:1px solid #edf0f5;">
                    <span style="font-size:23px;font-weight:700;
                      color:#182b4d;">Evangadi</span>
                    <span style="font-size:23px;font-weight:700;
                      color:#ed7d31;"> Forum</span>
                    <p style="margin:8px 0 0;font-size:13px;color:#738097;">
                      A community to learn, ask, and grow.
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style="padding:32px;">
                    <h1 style="margin:0 0 18px;font-size:27px;
                      line-height:1.3;color:#182b4d;">
                      Let's get you back in.
                    </h1>

                    <p style="margin:0 0 24px;font-size:16px;
                      line-height:1.7;color:#596579;">
                      We received a request to reset your password.
                      Click the button below to choose a new one.
                    </p>

                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td bgcolor="#ed7d31" style="border-radius:8px;
                          mso-padding-alt:16px 28px;">
                          <a href="${resetLink}"
                            style="display:inline-block;padding:16px 28px;
                            font-size:16px;font-weight:700;color:#ffffff;
                            text-decoration:none;border-radius:8px;">
                            Reset my password
                          </a>
                        </td>
                      </tr>
                    </table>

                    <p style="margin:24px 0;font-size:14px;
                      line-height:1.6;color:#596579;">
                      For your security, this link expires in
                      <strong>15 minutes</strong>.
                      Please don't share it with anyone.
                    </p>

                    <div style="padding:16px;background:#f6f8fb;
                      border-radius:8px;">
                      <p style="margin:0;font-size:13px;
                        line-height:1.7;color:#738097;">
                        Didn't request a password reset?
                        You can safely ignore this email.
                        Your password will stay the same.
                      </p>
                    </div>

                    <p style="margin:26px 0 8px;font-size:12px;
                      line-height:1.6;color:#738097;">
                      Button not working? Copy this link into your browser:
                    </p>
                    <a href="${resetLink}"
                      style="font-size:12px;line-height:1.7;
                      color:#b64d0c;word-break:break-all;">
                      ${resetLink}
                    </a>
                  </td>
                </tr>

                <tr>
                  <td style="padding:20px 32px;border-top:1px solid #edf0f5;
                    font-size:12px;line-height:1.6;color:#8a94a6;">
                    Evangadi Forum &middot; Account security<br>
                    This is an automated message.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `,
    }),
  });

  if (!response.ok) {
    console.error("Reset email rejected:", response.status);
    throw new Error("Unable to send password-reset email");
  }
};

export const resetPasswordService = async ({ token, password }) => {
  let decoded;

  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new UnauthenticatedError("Invalid or expired reset link.");
  }

  if (decoded.type !== "password-reset") {
    throw new UnauthenticatedError("Invalid or expired reset link.");
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const result = await safeExecute(
    "UPDATE users SET password_hash = ? WHERE user_id = ?",
    [hashedPassword, decoded.id],
  );

  if (result.affectedRows === 0) {
    throw new UnauthenticatedError("Invalid or expired reset link.");
  }
};

export const googleLoginService = async (credential) => {
  if (!credential) {
    throw new UnauthenticatedError("Google credential is required.");
  }

  let ticket;

  try {
    ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });
  } catch (error) {
    throw new UnauthenticatedError("Invalid Google credential.");
  }

  const payload = ticket.getPayload();

  if (!payload) {
    throw new UnauthenticatedError("Invalid Google credential.");
  }

  const {
    sub: googleId,
    email,
    given_name: firstName,
    family_name: lastName,
    email_verified: emailVerified,
  } = payload;

  if (!email || !emailVerified || !googleId) {
    throw new UnauthenticatedError("Unable to verify Google account.");
  }

  const normalizedEmail = normalizeEmail(email);

  const rows = await safeExecute(
    `SELECT user_id, first_name, last_name, email, password_hash, avatar,
            google_id, auth_provider
     FROM users
     WHERE email = ?
     LIMIT 1`,
    [normalizedEmail],
  );

  let user;

  if (rows.length > 0) {
    user = rows[0];

    if (user.google_id && user.google_id !== googleId) {
      throw new BadRequestError(
        "This email is already connected to another Google account.",
      );
    }

    if (!user.google_id) {
      await safeExecute(
        `UPDATE users
         SET google_id = ?, auth_provider = 'google'
         WHERE user_id = ?`,
        [googleId, user.user_id],
      );
    }
  } else {
    const result = await safeExecute(
      `INSERT INTO users
       (first_name, last_name, email, password_hash, google_id, auth_provider)
       VALUES (?, ?, ?, NULL, ?, 'google')`,
      [firstName || "", lastName || "", normalizedEmail, googleId],
    );

    user = {
      user_id: result.insertId,
      first_name: firstName || "",
      last_name: lastName || "",
      email: normalizedEmail,
    };
  }

  const jwtPayload = {
    id: user.user_id,
    firstName: user.first_name,
    lastName: user.last_name,
  };

  const token = jwt.sign(jwtPayload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });

  return {
    user: {
      id: user.user_id,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      avatar: user.avatar,
    },
    token,
  };
};

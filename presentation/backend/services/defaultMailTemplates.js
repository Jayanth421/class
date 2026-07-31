module.exports = [
  {
    key: "WELCOME_EMAIL",
    name: "Welcome Email",
    description: "Sent after account verification.",
    subject: "Welcome to {{appName}}, {{name}}!",
    text:
      "Hi {{name}},\n\nWelcome to {{appName}}.\n\nOpen the portal: {{portalUrl}}\n\nThanks,\n{{appName}} Team",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.4;">
        <h2>Welcome, {{name}}!</h2>
        <p>Your account has been verified on <strong>{{appName}}</strong>.</p>
        <p>
          <a href="{{portalUrl}}" target="_blank" rel="noreferrer">Open Portal</a>
        </p>
        <p style="color:#64748b; font-size:12px;">{{appName}} Team</p>
      </div>
    `.trim()
  },
  {
    key: "OTP_VERIFICATION",
    name: "OTP Verification",
    description: "Used for registration OTP and generic OTP flows.",
    subject: "{{appName}} OTP Verification",
    text:
      "Hi {{name}},\n\nYour OTP is {{otp}}.\nIt expires in {{expiryMinutes}} minutes.\n\nOpen: {{actionUrl}}\n\nIf you did not request this, ignore this email.",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.4;">
        <h3>{{appName}} OTP Verification</h3>
        <p>Hi {{name}},</p>
        <p>Your OTP is:</p>
        <p style="font-size: 26px; font-weight: bold; letter-spacing: 4px;">{{otp}}</p>
        <p>This OTP expires in <strong>{{expiryMinutes}}</strong> minutes.</p>
        <p><a href="{{actionUrl}}" target="_blank" rel="noreferrer">Open verification page</a></p>
        <p style="color:#64748b; font-size:12px;">If you did not request this, ignore this email.</p>
      </div>
    `.trim()
  },
  {
    key: "PASSWORD_RESET_OTP",
    name: "Reset Password OTP",
    description: "Sent when user requests password reset.",
    subject: "Reset your {{appName}} password",
    text:
      "Hi {{name}},\n\nUse OTP {{otp}} to reset your password.\nIt expires in {{expiryMinutes}} minutes.\n\nReset here: {{actionUrl}}",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.4;">
        <h3>Reset Password</h3>
        <p>Hi {{name}},</p>
        <p>Use this OTP to reset your password:</p>
        <p style="font-size: 26px; font-weight: bold; letter-spacing: 4px;">{{otp}}</p>
        <p>Expires in <strong>{{expiryMinutes}}</strong> minutes.</p>
        <p><a href="{{actionUrl}}" target="_blank" rel="noreferrer">Reset password</a></p>
      </div>
    `.trim()
  },
  {
    key: "VERIFIED_BADGE",
    name: "Verified Badge",
    description: "Confirmation that account is verified (blue check).",
    subject: "You're verified on {{appName}}",
    text: "Hi {{name}},\n\nYour account is verified on {{appName}}.\n\nPortal: {{portalUrl}}",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.4;">
        <h3>Verified</h3>
        <p>Hi {{name}},</p>
        <p>Your account is now verified on <strong>{{appName}}</strong>.</p>
        <p style="display:inline-block;padding:8px 12px;border-radius:999px;background:#2563eb;color:#fff;font-weight:700;">✔ Verified</p>
        <p style="margin-top:14px;"><a href="{{portalUrl}}" target="_blank" rel="noreferrer">Open Portal</a></p>
      </div>
    `.trim()
  },
  {
    key: "BETA_ACCESS_INVITE",
    name: "Beta Access Invite",
    description: "Invite user to beta features.",
    subject: "Beta access invitation — {{appName}}",
    text:
      "Hi {{name}},\n\nYou've been invited to beta access on {{appName}}.\n\nOpen: {{ctaUrl}}\n\nMessage: {{message}}",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.4;">
        <h3>Beta Access Invite</h3>
        <p>Hi {{name}},</p>
        <p>You've been invited to beta access on <strong>{{appName}}</strong>.</p>
        <p>{{message}}</p>
        <p><a href="{{ctaUrl}}" target="_blank" rel="noreferrer">Open Invite</a></p>
      </div>
    `.trim()
  },
  {
    key: "PRODUCT_UPDATE",
    name: "Product Update",
    description: "Product update / announcement email.",
    subject: "{{title}} — {{appName}} update",
    text: "Hi {{name}},\n\n{{message}}\n\nRead more: {{ctaUrl}}",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.4;">
        <h3>{{title}}</h3>
        <p>Hi {{name}},</p>
        <p>{{message}}</p>
        <p><a href="{{ctaUrl}}" target="_blank" rel="noreferrer">Read more</a></p>
      </div>
    `.trim()
  },
  {
    key: "ANNOUNCEMENT",
    name: "Announcement",
    description: "General announcement email template.",
    subject: "Announcement: {{title}}",
    text: "Hi {{name}},\n\n{{message}}\n\nPortal: {{portalUrl}}",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.4;">
        <h3>Announcement</h3>
        <h4 style="margin:0;">{{title}}</h4>
        <p>Hi {{name}},</p>
        <p>{{message}}</p>
        <p><a href="{{portalUrl}}" target="_blank" rel="noreferrer">Open Portal</a></p>
      </div>
    `.trim()
  }
];


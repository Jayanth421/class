# AWS Account + S3 Setup (CMR Smart Presentation Portal)

This project uses **Amazon S3** for PPT/file storage via the backend (`presentation/backend/services/s3Service.js`). You can optionally put **CloudFront** in front of S3 by setting `CLOUDFRONT_URL`.

## 0) One-time AWS account setup (recommended)
1. Create the AWS account (root user).
2. Enable MFA on the root user.
3. Create an IAM admin user/role for daily use (avoid using root).
4. (Optional) Set up a billing alarm/budget.

## 1) Create the S3 bucket
1. AWS Console → **S3** → **Create bucket**
2. Choose a **Region** (example: `ap-south-1`) and a unique bucket name (example: `cmr-smart-portal-ppt-prod`).
3. Keep **Block all public access** enabled (recommended).
4. (Recommended) Enable **Versioning**.

## 2) Add S3 CORS (only if using browser direct upload)
By default the backend can return **presigned PUT URLs**, meaning the browser uploads directly to S3 (`S3_UPLOAD_MODE=presigned`).

S3 → your bucket → **Permissions** → **CORS configuration**:
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedOrigins": [
      "http://localhost:5173",
      "https://your-frontend-domain.com"
    ],
    "ExposeHeaders": ["ETag"]
  }
]
```

If you don’t want to deal with S3 CORS, set `S3_UPLOAD_MODE=proxy` (uploads go through the backend instead of the browser).

## 3) Create IAM permissions for the app
You need credentials that can do `PutObject`, `GetObject`, `HeadObject` on the bucket.

### Option A (local dev): IAM user + access keys
1. IAM → **Users** → Create user (programmatic access / access keys).
2. Attach a policy like this (replace bucket name and optionally add a prefix like `uploads/*`):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "BucketList",
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": ["arn:aws:s3:::YOUR_BUCKET_NAME"]
    },
    {
      "Sid": "ObjectRW",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject"],
      "Resource": ["arn:aws:s3:::YOUR_BUCKET_NAME/*"]
    }
  ]
}
```

### Option B (production on EC2): IAM role (recommended)
1. IAM → **Roles** → Create role → **EC2**.
2. Attach the same S3 policy as above.
3. Attach the role to the EC2 instance running the backend.
4. Do **not** set `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` on the server; the AWS SDK will use the instance role automatically.

## 4) Configure the backend env vars
Put these in `presentation/backend/.env` (or create `presentation/backend/.env.aws` and start with `ENV_FILE=.env.aws`):

- `AWS_REGION=ap-south-1` (or your region)
- `AWS_S3_BUCKET=YOUR_BUCKET_NAME`
- Local dev (only if not using AWS CLI credentials): `AWS_ACCESS_KEY_ID=...`, `AWS_SECRET_ACCESS_KEY=...`
- Optional CDN: `CLOUDFRONT_URL=https://<your-distribution>.cloudfront.net`
- Upload mode:
  - `S3_UPLOAD_MODE=presigned` (needs S3 CORS for your frontend origin), or
  - `S3_UPLOAD_MODE=proxy` (no browser S3 CORS)

### Start backend using a specific env file (PowerShell)
```powershell
cd presentation/backend
$env:ENV_FILE = ".env.aws"
npm run dev
```

## 5) (Optional) CloudFront for downloads (recommended if bucket is private)
If your bucket is private, students/faculty need a public URL for viewing (Office embed). The simplest production setup is:
1. Create a CloudFront distribution with the S3 bucket as origin.
2. Use **Origin Access Control (OAC)** so S3 stays private and CloudFront serves files publicly.
3. Set `CLOUDFRONT_URL` in the backend env.

## Common errors
- **“AWS_REGION is not configured”** → set `AWS_REGION`.
- **Upload blocked / CORS error in browser** → fix S3 CORS or set `S3_UPLOAD_MODE=proxy`.
- **AccessDenied from S3** → IAM policy/role doesn’t allow `s3:PutObject` / `s3:GetObject` for your bucket.


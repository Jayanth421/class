-- Demo accounts for pre-login testing.
-- Passwords (plain text):
--   admin@cmrcet.ac.in -> Admin@123
--   faculty.demo@cmrcet.ac.in -> Faculty@123
--   22h51a0501@cmrcet.ac.in -> Student@123

INSERT INTO users
  (name, email, password_hash, role, branch, year, section, mobile, class_id, is_verified)
VALUES
  (
    'Demo Admin',
    'admin@cmrcet.ac.in',
    '$2b$12$s9bHXvbr5s95Z5.ReE5F/etJqPWQnapPeY98AM8RXJMy/4Au1MvLa',
    'ADMIN',
    'Administration',
    NULL,
    NULL,
    '9000000001',
    NULL,
    1
  ),
  (
    'Demo Faculty',
    'faculty.demo@cmrcet.ac.in',
    '$2b$12$iyEXFRL4OMIsA8Yx8ijbb.BCKoEjX9Me/R8LQhzOzHB3hIqIHyDIO',
    'FACULTY',
    'CSE',
    NULL,
    NULL,
    '9000000002',
    NULL,
    1
  ),
  (
    'Demo Student',
    '22h51a0501@cmrcet.ac.in',
    '$2b$12$88pWdJMn.Bw3uvr/.9Cx/OF.wzH2Lqh.PcPQla/zs7LiPb7PGNTby',
    'STUDENT',
    'CSE',
    3,
    'A',
    '9000000003',
    NULL,
    1
  )
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  password_hash = VALUES(password_hash),
  role = VALUES(role),
  branch = VALUES(branch),
  year = VALUES(year),
  section = VALUES(section),
  mobile = VALUES(mobile),
  class_id = VALUES(class_id),
  is_verified = VALUES(is_verified),
  updated_at = CURRENT_TIMESTAMP;

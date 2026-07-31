require("dotenv").config();

const mongoose = require("mongoose");
const { connectMongo } = require("../config/mongo");
const Class = require("../mongoModels/Class");
const Department = require("../mongoModels/Department");
const FacultyClass = require("../mongoModels/FacultyClass");
const Subject = require("../mongoModels/Subject");
const User = require("../mongoModels/User");

const DEMO_PASSWORD_HASHES = {
  admin: "$2b$12$s9bHXvbr5s95Z5.ReE5F/etJqPWQnapPeY98AM8RXJMy/4Au1MvLa",
  faculty: "$2b$12$iyEXFRL4OMIsA8Yx8ijbb.BCKoEjX9Me/R8LQhzOzHB3hIqIHyDIO",
  student: "$2b$12$88pWdJMn.Bw3uvr/.9Cx/OF.wzH2Lqh.PcPQla/zs7LiPb7PGNTby"
};

async function upsertUserByEmail(filterEmail, data) {
  return User.findOneAndUpdate(
    { email: filterEmail },
    { $set: data },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );
}

async function run() {
  await connectMongo();

  const department = await Department.findOneAndUpdate(
    { code: "CSE" },
    { $set: { name: "Computer Science and Engineering", code: "CSE" } },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );

  const classDoc = await Class.findOneAndUpdate(
    { departmentId: department._id, year: 3, section: "CSE-A" },
    {
      $set: {
        departmentId: department._id,
        year: 3,
        section: "CSE-A",
        name: "CSE 3rd Year - A"
      }
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );

  const adminUser = await upsertUserByEmail("admin@cmrcet.ac.in", {
    name: "Demo Admin",
    email: "admin@cmrcet.ac.in",
    passwordHash: DEMO_PASSWORD_HASHES.admin,
    role: "ADMIN",
    branch: "Administration",
    year: null,
    section: null,
    mobile: "9000000001",
    classId: null,
    isVerified: true
  });

  const facultyUser = await upsertUserByEmail("faculty.demo@cmrcet.ac.in", {
    name: "Demo Faculty",
    email: "faculty.demo@cmrcet.ac.in",
    passwordHash: DEMO_PASSWORD_HASHES.faculty,
    role: "FACULTY",
    branch: "CSE",
    year: null,
    section: null,
    mobile: "9000000002",
    classId: null,
    isVerified: true
  });

  const studentUser = await upsertUserByEmail("22h51a0501@cmrcet.ac.in", {
    name: "Demo Student",
    email: "22h51a0501@cmrcet.ac.in",
    passwordHash: DEMO_PASSWORD_HASHES.student,
    role: "STUDENT",
    branch: "CSE",
    year: 3,
    section: "CSE-A",
    mobile: "9000000003",
    classId: classDoc._id,
    isVerified: true
  });

  await FacultyClass.deleteMany({ facultyId: facultyUser._id });
  await FacultyClass.create({
    facultyId: facultyUser._id,
    classId: classDoc._id
  });

  const subjectSeeds = [
    { name: "Data Structures", code: "CS301" },
    { name: "Database Management Systems", code: "CS302" }
  ];

  for (const subjectSeed of subjectSeeds) {
    await Subject.findOneAndUpdate(
      { classId: classDoc._id, code: subjectSeed.code },
      {
        $set: {
          classId: classDoc._id,
          facultyId: facultyUser._id,
          name: subjectSeed.name,
          code: subjectSeed.code
      }
    },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
  }

  console.log("Mongo demo seed completed.");
  console.log("Admin  : admin@cmrcet.ac.in / Admin@123");
  console.log("Faculty: faculty.demo@cmrcet.ac.in / Faculty@123");
  console.log("Student: 22h51a0501@cmrcet.ac.in / Student@123");
  console.log(`Department ID: ${department.id}`);
  console.log(`Class ID     : ${classDoc.id}`);
  console.log(`Faculty ID   : ${facultyUser.id}`);
  console.log(`Student ID   : ${studentUser.id}`);

  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error("Mongo demo seed failed:", error.message);
  await mongoose.disconnect();
  process.exit(1);
});

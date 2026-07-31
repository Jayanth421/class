const SmartboardSession = require("../mongoModels/SmartboardSession");
const { SMARTBOARD_SESSION_STATUS } = require("../config/constants");

function mapSession(sessionDoc) {
  if (!sessionDoc) return null;
  return {
    id: sessionDoc.id,
    sessionToken: sessionDoc.sessionToken,
    smartboardName: sessionDoc.smartboardName,
    authorizedBy: sessionDoc.authorizedBy ? String(sessionDoc.authorizedBy) : null,
    status: sessionDoc.status,
    expiresAt: sessionDoc.expiresAt,
    authorizedAt: sessionDoc.authorizedAt,
    createdAt: sessionDoc.createdAt
  };
}

async function createSession({ sessionToken, smartboardName = null, expiresAt }) {
  return SmartboardSession.create({
    sessionToken,
    smartboardName,
    status: SMARTBOARD_SESSION_STATUS.PENDING,
    expiresAt
  });
}

async function getSessionByToken(sessionToken) {
  const sessionDoc = await SmartboardSession.findOne({ sessionToken }).exec();
  return mapSession(sessionDoc);
}

async function authorizeSession(sessionToken, facultyId) {
  return SmartboardSession.updateOne(
    {
      sessionToken,
      status: SMARTBOARD_SESSION_STATUS.PENDING
    },
    {
      $set: {
        status: SMARTBOARD_SESSION_STATUS.AUTHORIZED,
        authorizedBy: facultyId,
        authorizedAt: new Date()
      }
    }
  );
}

async function expireSession(sessionToken) {
  return SmartboardSession.updateOne(
    { sessionToken },
    { $set: { status: SMARTBOARD_SESSION_STATUS.EXPIRED } }
  );
}

async function consumeSession(sessionToken) {
  return SmartboardSession.updateOne(
    {
      sessionToken,
      status: SMARTBOARD_SESSION_STATUS.AUTHORIZED
    },
    { $set: { status: SMARTBOARD_SESSION_STATUS.EXPIRED } }
  );
}

module.exports = {
  authorizeSession,
  consumeSession,
  createSession,
  expireSession,
  getSessionByToken
};

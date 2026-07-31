const QRCode = require("qrcode");

async function generateQrDataUrl(content) {
  return QRCode.toDataURL(content, {
    errorCorrectionLevel: "H",
    margin: 1,
    width: 360
  });
}

module.exports = {
  generateQrDataUrl
};

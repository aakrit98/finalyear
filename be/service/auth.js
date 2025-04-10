const jwt = require("jsonwebtoken");
const secret = "Manchesterunited@100";
function setUser(user) {
  return jwt.sign(
    {
      _id: user.id,
      email: user.email,
      role: user.role // Add the role to the JWT payload
    },
    secret
  );
}


function getUser(token) {
  if (!token) return null;
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    return null;
  }
}
module.exports = {
  setUser,
  getUser,
};
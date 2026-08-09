import { encode } from "@auth/core/jwt";
const token = await encode({
  token: { id: "cmskzllb300006xwowqrxewk3", sub: "cmskzllb300006xwowqrxewk3", email: "jason.mund@gmx.de", color: "#888", firstName: "Jason", lastName: "Mund" },
  secret: process.env.AUTH_SECRET!, salt: "authjs.session-token", maxAge: 3600,
});
console.log(token);

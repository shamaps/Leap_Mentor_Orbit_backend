// controllers/register.controller.js
const registerService = require("../services/register.service");

const register = async (req, res) => {
  try {
    // res is passed through because issueTokens sets a cookie on it
    const data = await registerService.register(res, req.body);
    return res.status(201).json(data);
  } catch (err) {
    return res.status(err.statusCode || 500).json({ message: err.message });
  }
};

module.exports = { register };
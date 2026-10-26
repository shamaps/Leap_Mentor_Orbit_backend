// utils/requestContext.js
const { AsyncLocalStorage } = require("node:async_hooks");

const asyncLocalStorage = new AsyncLocalStorage();

const getTraceId = () => asyncLocalStorage.getStore()?.traceId ?? "no-trace";

const runWithTraceId = (traceId, fn) => asyncLocalStorage.run({ traceId }, fn);

module.exports = { getTraceId, runWithTraceId };
// Mock logger — stops console noise during tests
const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
};
module.exports = logger;
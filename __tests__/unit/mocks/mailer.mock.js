// Prevents real emails during tests
const mailer = {
    sendMail: jest.fn().mockResolvedValue({ messageId: 'mock-id' }),
};
module.exports = mailer;
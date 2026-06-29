const cloudinary = {
    uploader: {
        upload: jest.fn().mockResolvedValue({ secure_url: 'https://mock.cloudinary.com/img.jpg', public_id: 'mock_id' }),
        destroy: jest.fn().mockResolvedValue({ result: 'ok' }),
    },
};
module.exports = cloudinary;
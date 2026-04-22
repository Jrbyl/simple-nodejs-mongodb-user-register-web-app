jest.mock('../../models/users', () => {
    const User = jest.fn();
    User.find = jest.fn();
    User.findOne = jest.fn();
    User.findById = jest.fn();
    User.findByIdAndUpdate = jest.fn();
    User.findByIdAndDelete = jest.fn();
    User.countDocuments = jest.fn();
    return User;
});

const fs = require('fs');
const User = require('../../models/users');
const { handlers } = require('../../routes/routes');

describe('routes handlers', () => {
    beforeEach(() => {
        User.mockReset();
        User.find.mockReset();
        User.findOne.mockReset();
        User.findById.mockReset();
        User.findByIdAndUpdate.mockReset();
        User.findByIdAndDelete.mockReset();
        User.countDocuments.mockReset();
        jest.restoreAllMocks();
    });

    describe('registerUser', () => {
        let req;
        let res;

        beforeEach(() => {
            req = {
                body: {
                    name: 'Jane Doe',
                    email: 'jane@example.com',
                    phone: '515-555-1212'
                },
                file: undefined,
                session: {}
            };

            res = {
                redirect: jest.fn()
            };
        });

        test('creates a new user when the request is valid', async () => {
            const save = jest.fn().mockResolvedValue(undefined);

            User.findOne.mockResolvedValue(null);
            User.mockImplementation((payload) => ({
                ...payload,
                save
            }));

            await handlers.registerUser(req, res);

            expect(User.findOne).toHaveBeenCalledWith({ email: 'jane@example.com' });
            expect(User).toHaveBeenCalledWith({
                name: 'Jane Doe',
                email: 'jane@example.com',
                phone: '515-555-1212',
                image: 'user_unknown.png'
            });
            expect(save).toHaveBeenCalledTimes(1);
            expect(req.session.message).toEqual({
                type: 'success',
                message: 'User added successfully'
            });
            expect(res.redirect).toHaveBeenCalledWith('/');
        });

        test('rejects requests with missing required form fields', async () => {
            req.body.phone = '';

            await handlers.registerUser(req, res);

            expect(User.findOne).not.toHaveBeenCalled();
            expect(User).not.toHaveBeenCalled();
            expect(req.session.message).toEqual({
                type: 'danger',
                message: 'Name, email, and phone are required'
            });
            expect(res.redirect).toHaveBeenCalledWith('/');
        });

        test('rejects requests when a user with the same email already exists', async () => {
            User.findOne.mockResolvedValue({ _id: 'existing-user-id' });

            await handlers.registerUser(req, res);

            expect(User.findOne).toHaveBeenCalledWith({ email: 'jane@example.com' });
            expect(User).not.toHaveBeenCalled();
            expect(req.session.message).toEqual({
                type: 'danger',
                message: 'User already exists'
            });
            expect(res.redirect).toHaveBeenCalledWith('/');
        });

        test('surfaces persistence errors from the mocked User model', async () => {
            const saveError = new Error('database unavailable');

            User.findOne.mockResolvedValue(null);
            User.mockImplementation(() => ({
                save: jest.fn().mockRejectedValue(saveError)
            }));

            await handlers.registerUser(req, res);

            expect(User.findOne).toHaveBeenCalledWith({ email: 'jane@example.com' });
            expect(req.session.message).toEqual({
                type: 'danger',
                message: 'database unavailable'
            });
            expect(res.redirect).toHaveBeenCalledWith('/');
        });
    });

    describe('listUsers', () => {
        test('renders paginated user data', async () => {
            const sort = jest.fn().mockResolvedValue([{ name: 'Jane Doe' }]);
            const limit = jest.fn().mockReturnValue({ sort });
            const skip = jest.fn().mockReturnValue({ limit });
            const res = {
                render: jest.fn(),
                json: jest.fn()
            };
            const req = {
                query: {
                    page: '2',
                    limit: '5',
                    sort: 'email',
                    order: 'desc',
                    search: 'jane'
                }
            };

            User.find.mockReturnValue({ skip });
            User.countDocuments.mockResolvedValue(11);

            await handlers.listUsers(req, res);

            expect(User.find).toHaveBeenCalledWith({
                name: { $regex: 'jane', $options: 'i' }
            });
            expect(skip).toHaveBeenCalledWith(5);
            expect(limit).toHaveBeenCalledWith(5);
            expect(sort).toHaveBeenCalledWith({ email: -1 });
            expect(User.countDocuments).toHaveBeenCalledWith({
                name: { $regex: 'jane', $options: 'i' }
            });
            expect(res.render).toHaveBeenCalledWith('index', expect.objectContaining({
                title: 'Home Page',
                users: [{ name: 'Jane Doe' }],
                currentPage: 2,
                totalPages: 3,
                limit: 5,
                sortField: 'email',
                sortOrder: -1,
                search: 'jane'
            }));
        });
    });

    describe('editUser', () => {
        test('renders the edit page when a user exists', async () => {
            const res = {
                render: jest.fn(),
                redirect: jest.fn()
            };
            const req = {
                params: { id: 'abc123' },
                session: {}
            };

            User.findById.mockResolvedValue({ _id: 'abc123', name: 'Jane Doe' });

            await handlers.editUser(req, res);

            expect(User.findById).toHaveBeenCalledWith('abc123');
            expect(res.render).toHaveBeenCalledWith('edit_user', {
                title: 'Edit User',
                user: { _id: 'abc123', name: 'Jane Doe' }
            });
        });
    });

    describe('updateUser', () => {
        test('updates a user and sets a success message', async () => {
            const req = {
                params: { id: 'abc123' },
                body: {
                    name: 'Jane Doe',
                    email: 'jane@example.com',
                    phone: '515-555-1212',
                    old_image: 'old.png'
                },
                file: undefined,
                session: {}
            };
            const res = {
                redirect: jest.fn()
            };

            User.findByIdAndUpdate.mockResolvedValue({ _id: 'abc123' });

            await handlers.updateUser(req, res);

            expect(User.findByIdAndUpdate).toHaveBeenCalledWith('abc123', {
                name: 'Jane Doe',
                email: 'jane@example.com',
                phone: '515-555-1212',
                image: 'old.png'
            }, { new: true });
            expect(req.session.message).toEqual({
                type: 'success',
                message: 'User updated successfully!'
            });
            expect(res.redirect).toHaveBeenCalledWith('/');
        });

        test('removes the old image when a replacement upload is provided', async () => {
            const unlinkSpy = jest.spyOn(fs, 'unlinkSync').mockImplementation(() => {});
            const req = {
                params: { id: 'abc123' },
                body: {
                    name: 'Jane Doe',
                    email: 'jane@example.com',
                    phone: '515-555-1212',
                    old_image: 'old.png'
                },
                file: { filename: 'new.png' },
                session: {}
            };
            const res = {
                redirect: jest.fn()
            };

            User.findByIdAndUpdate.mockResolvedValue({ _id: 'abc123' });

            await handlers.updateUser(req, res);

            expect(unlinkSpy).toHaveBeenCalledWith('./uploads/old.png');
            expect(User.findByIdAndUpdate).toHaveBeenCalledWith('abc123', expect.objectContaining({
                image: 'new.png'
            }), { new: true });
        });
    });

    describe('deleteUser', () => {
        test('deletes a user and removes the stored image', async () => {
            const unlinkSpy = jest.spyOn(fs, 'unlinkSync').mockImplementation(() => {});
            const req = {
                params: { id: 'abc123' },
                session: {}
            };
            const res = {
                redirect: jest.fn()
            };

            User.findByIdAndDelete.mockResolvedValue({
                _id: 'abc123',
                image: 'avatar.png'
            });

            await handlers.deleteUser(req, res);

            expect(User.findByIdAndDelete).toHaveBeenCalledWith('abc123');
            expect(unlinkSpy).toHaveBeenCalledWith('./uploads/avatar.png');
            expect(req.session.message).toEqual({
                type: 'info',
                message: 'User deleted!'
            });
            expect(res.redirect).toHaveBeenCalledWith('/');
        });
    });
});

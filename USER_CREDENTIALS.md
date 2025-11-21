# Smart LMS - User Credentials

## ✅ 3 User Profiles Created

All users have been successfully registered in the system.

---

## 👨‍🎓 Student Profile

```
Role: Student
Name: Student User
Email: student@lms.com
Password: student123
```

**Permissions:**
- ✅ View all videos
- ✅ Watch videos with HLS streaming
- ✅ View AI-generated notes
- ✅ Real-time updates
- ❌ Cannot upload videos
- ❌ Cannot record videos

---

## 👨‍🏫 Teacher Profile

```
Role: Teacher
Name: Teacher User
Email: teacher@lms.com
Password: teacher123
```

**Permissions:**
- ✅ View all videos
- ✅ Watch videos with HLS streaming
- ✅ View AI-generated notes
- ✅ Upload pre-recorded videos
- ✅ Record new videos
- ✅ Delete own videos
- ✅ Real-time updates

---

## 👨‍💼 Admin Profile

```
Role: Admin
Name: Admin User
Email: admin@lms.com
Password: admin123
```

**Permissions:**
- ✅ View all videos
- ✅ Watch videos with HLS streaming
- ✅ View AI-generated notes
- ✅ Upload videos
- ✅ Record videos
- ✅ Delete any video
- ✅ Manage all users
- ✅ Full system access
- ✅ Real-time updates

---

## 🔐 Quick Login Commands

### Test Student Login
```bash
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "student@lms.com",
    "password": "student123"
  }'
```

### Test Teacher Login
```bash
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teacher@lms.com",
    "password": "teacher123"
  }'
```

### Test Admin Login
```bash
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@lms.com",
    "password": "admin123"
  }'
```

---

## 📱 Using in the App

### Web Browser
1. Open: http://localhost:8081
2. Press `w` for web browser
3. Use any of the credentials above to login

### Mobile Device
1. Install "Expo Go" app
2. Scan QR code from terminal
3. Login with any credentials above

---

## 🔑 User IDs

For reference, the MongoDB user IDs are:

- **Student**: `690b7e216e84053940024942`
- **Teacher**: `690b7e2a6e84053940024945`
- **Admin**: `690b7e306e84053940024948`

---

## 📊 View All Users in Database

```bash
# Access MongoDB
docker exec -it smart-lms-mongodb mongosh

# Switch to database
use smart_lms

# View all users
db.users.find().pretty()

# Count users by role
db.users.countDocuments({role: "student"})
db.users.countDocuments({role: "teacher"})
db.users.countDocuments({role: "admin"})
```

---

## 🔄 Reset Password (if needed)

To change a password later, you'll need to:

1. Hash the new password with bcrypt
2. Update in MongoDB

Or simply delete the user and re-register:

```bash
# Delete a user
docker exec -it smart-lms-mongodb mongosh
use smart_lms
db.users.deleteOne({email: "student@lms.com"})

# Then re-register with new password
curl -X POST http://localhost:5001/api/auth/register ...
```

---

## 🎯 Quick Test

Login as each user and test their permissions:

1. **Student**: Can only view, cannot upload
2. **Teacher**: Can view and upload videos
3. **Admin**: Full access to everything

---

**All users are ready to use! 🚀**

*Created: 2025-11-05*

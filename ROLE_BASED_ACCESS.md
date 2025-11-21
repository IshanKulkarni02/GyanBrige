# Role-Based Access Control - GyanBrige

## ✅ Implemented Features

### 1. **Student Profile** - Limited Access
- ✅ Can **ONLY** see Home tab (Videos)
- ✅ Can watch videos with HLS streaming
- ✅ Can view AI-generated notes
- ❌ **CANNOT** see Upload tab
- ❌ **CANNOT** see Record tab
- ❌ **CANNOT** see Admin tab

### 2. **Teacher Profile** - Content Creation
- ✅ Can see Home tab (Videos)
- ✅ Can see **Upload tab** - Upload pre-recorded videos
- ✅ Can see **Record tab** - Record new videos with camera
- ✅ Can watch videos and view notes
- ❌ **CANNOT** see Admin tab

### 3. **Admin Profile** - Full Control
- ✅ Can see all tabs: Home, Upload, Record, **Admin**
- ✅ **Admin Panel** with three sections:
  - **Overview**: System statistics
  - **Users**: Manage all users and assign roles
  - **Subjects**: Create and manage subjects

## 🎯 Admin Features

### User Management
- View all users in a table
- See user roles with color-coded chips:
  - 🟢 **Student** - Green
  - 🟠 **Teacher** - Orange
  - 🔴 **Admin** - Red
- **Change user roles** with one click
- Delete users (if needed)

### Subject Management
- Create subjects with:
  - Name
  - Code (e.g., MATH101)
  - Description
  - Color coding
  - Icon
- Assign teachers to subjects
- View all active subjects
- Activate/deactivate subjects

### System Statistics
- Total users count
- Total videos count
- Active subjects count
- Ready vs processing videos

## 🔐 How It Works

### Frontend
1. **AuthContext** - Manages user state globally
2. **Role-based navigation** - Tabs shown based on user role
3. **Conditional rendering** - UI elements hidden/shown per role

### Backend
1. **Admin middleware** - Checks `x-user-role` header
2. **Admin routes** - `/api/admin/*` endpoints
3. **Subject model** - MongoDB model for subjects
4. **User management APIs** - CRUD operations for users

## 📋 API Endpoints Added

### User Management
```
GET    /api/admin/users                 - List all users
GET    /api/admin/users/:userId         - Get single user
PATCH  /api/admin/users/:userId/role    - Update user role
DELETE /api/admin/users/:userId         - Delete user
GET    /api/admin/stats/users           - User statistics
```

### Subject Management
```
GET    /api/admin/subjects                    - List all subjects
POST   /api/admin/subjects                    - Create subject
PATCH  /api/admin/subjects/:subjectId         - Update subject
DELETE /api/admin/subjects/:subjectId         - Delete subject
PATCH  /api/admin/subjects/:subjectId/teachers - Assign teachers
```

### System Stats
```
GET    /api/admin/stats/overview        - System overview
```

## 🧪 Testing the Features

### Test as Student
```bash
# Login
Email: student@lms.com
Password: student123

# Expected UI:
- Only "Videos" tab visible
- No Upload/Record/Admin tabs
```

### Test as Teacher
```bash
# Login
Email: teacher@lms.com
Password: teacher123

# Expected UI:
- Videos, Upload, Record tabs visible
- Can upload and record videos
- No Admin tab
```

### Test as Admin
```bash
# Login
Email: admin@lms.com
Password: admin123

# Expected UI:
- All tabs visible: Videos, Upload, Record, Admin
- Admin tab has Overview/Users/Subjects sections
- Can change any user's role
- Can create subjects
```

## 🔄 Changing User Roles

### Via Admin Panel (UI)
1. Login as **admin@lms.com**
2. Go to **Admin** tab
3. Click **Users** section
4. Find user and click **Edit**
5. Select new role (Student/Teacher/Admin)
6. Role updates immediately!

### Via API (Terminal)
```bash
# Change user role
curl -X PATCH http://localhost:5001/api/admin/users/USER_ID/role \
  -H "Content-Type: application/json" \
  -H "x-user-role: admin" \
  -d '{"role": "teacher"}'
```

## 📊 Example: Create a Subject

```bash
curl -X POST http://localhost:5001/api/admin/subjects \
  -H "Content-Type: application/json" \
  -H "x-user-role: admin" \
  -d '{
    "name": "Mathematics",
    "code": "MATH101",
    "description": "Introduction to Mathematics",
    "color": "#4CAF50",
    "icon": "calculator"
  }'
```

## 🎨 UI Changes

### Navigation Tabs
- **Before**: All users saw all 3 tabs (Home, Upload, Record)
- **After**: Tabs shown based on role
  - Student: 1 tab (Home)
  - Teacher: 3 tabs (Home, Upload, Record)
  - Admin: 4 tabs (Home, Upload, Record, Admin)

### Admin Panel UI
- **Overview Tab**: Statistics cards with large numbers
- **Users Tab**: Data table with role chips and edit buttons
- **Subjects Tab**: Cards for each subject with color coding

## 🔧 Files Modified/Created

### Backend
- ✅ `src/models/Subject.js` - Subject database model
- ✅ `src/routes/adminRoutes.js` - Admin API endpoints
- ✅ `src/server.js` - Registered admin routes

### Frontend
- ✅ `src/context/AuthContext.js` - User authentication context
- ✅ `src/screens/AdminScreen.js` - Admin panel UI
- ✅ `src/screens/LoginScreen.js` - Save user data on login
- ✅ `App.js` - Role-based tab navigation

## 🚀 Next Steps (Optional Enhancements)

1. **Subject Filtering**: Filter videos by subject
2. **Teacher Assignments**: Teachers only see their subjects
3. **Student Enrollment**: Assign students to specific subjects
4. **Progress Tracking**: Track student video watch progress
5. **Permissions**: Fine-grained permissions beyond roles
6. **Bulk Operations**: Bulk role changes, subject assignments

## 📝 Notes

- **Security**: In production, use JWT tokens instead of header-based auth
- **Validation**: Add more input validation on admin endpoints
- **Audit Log**: Consider adding audit logs for role changes
- **Email Notifications**: Notify users when their role changes

---

**All features are implemented and ready to use! 🎉**

*Test the different user roles to see the access control in action.*

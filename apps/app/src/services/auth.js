/**
 * Mock Authentication Service
 * Simulates authentication with role-based access
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@GyanBrige:auth';

// Mock user database
const MOCK_USERS = [
  { id: '1', email: 'student@gyan.com', password: 'student123', role: 'student', name: 'Arjun Kumar' },
  { id: '2', email: 'teacher@gyan.com', password: 'teacher123', role: 'teacher', name: 'Dr. Priya Sharma' },
  { id: '3', email: 'admin@gyan.com', password: 'admin123', role: 'admin', name: 'Rahul Singh' },
];

export const ROLES = {
  STUDENT: 'student',
  TEACHER: 'teacher',
  ADMIN: 'admin',
};

/**
 * Authenticate user with email and password
 * @returns {Promise<{user: object, token: string} | null>}
 */
export const login = async (email, password) => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 800));
  
  const user = MOCK_USERS.find(
    u => u.email.toLowerCase() === email.toLowerCase() && u.password === password
  );
  
  if (!user) {
    throw new Error('Invalid email or password');
  }
  
  const { password: _, ...userWithoutPassword } = user;
  const token = `mock_token_${user.id}_${Date.now()}`;
  
  const authData = { user: userWithoutPassword, token };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(authData));
  
  return authData;
};

/**
 * Register a new user (mock)
 */
export const register = async (email, password, name, role = ROLES.STUDENT) => {
  await new Promise(resolve => setTimeout(resolve, 800));
  
  const exists = MOCK_USERS.some(u => u.email.toLowerCase() === email.toLowerCase());
  if (exists) {
    throw new Error('User already exists');
  }
  
  const newUser = {
    id: String(MOCK_USERS.length + 1),
    email,
    password,
    role,
    name,
  };
  
  MOCK_USERS.push(newUser);
  
  const { password: _, ...userWithoutPassword } = newUser;
  const token = `mock_token_${newUser.id}_${Date.now()}`;
  
  const authData = { user: userWithoutPassword, token };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(authData));
  
  return authData;
};

/**
 * Logout user
 */
export const logout = async () => {
  await AsyncStorage.removeItem(STORAGE_KEY);
};

/**
 * Get stored auth data
 */
export const getStoredAuth = async () => {
  const data = await AsyncStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : null;
};

/**
 * Check if user has specific role
 */
export const hasRole = (user, role) => {
  return user?.role === role;
};

export default {
  login,
  register,
  logout,
  getStoredAuth,
  hasRole,
  ROLES,
};

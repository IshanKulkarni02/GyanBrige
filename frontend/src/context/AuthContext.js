import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        setUser(JSON.parse(userData));
      }
    } catch (error) {
      console.error('Error loading user:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (userData) => {
    await AsyncStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = async () => {
    await AsyncStorage.removeItem('user');
    await AsyncStorage.removeItem('authToken');
    setUser(null);
  };

  const value = {
    user,
    loading,
    login,
    logout,
    isStudent: user?.role === 'student',
    isTeacher: user?.role === 'teacher',
    isAdmin: user?.role === 'admin',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

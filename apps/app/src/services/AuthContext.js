/**
 * Authentication Context
 * Provides global auth state and actions
 */

import React, { createContext, useContext, useReducer, useEffect } from 'react';
import * as authService from './auth';

const AuthContext = createContext(null);

const initialState = {
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,
};

const authReducer = (state, action) => {
  switch (action.type) {
    case 'RESTORE_TOKEN':
      return {
        ...state,
        user: action.user,
        token: action.token,
        isLoading: false,
        isAuthenticated: !!action.token,
      };
    case 'SIGN_IN':
      return {
        ...state,
        user: action.user,
        token: action.token,
        isLoading: false,
        isAuthenticated: true,
      };
    case 'SIGN_OUT':
      return {
        ...state,
        user: null,
        token: null,
        isLoading: false,
        isAuthenticated: false,
      };
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.isLoading,
      };
    default:
      return state;
  }
};

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Restore auth state on mount
  useEffect(() => {
    const restoreAuth = async () => {
      try {
        const authData = await authService.getStoredAuth();
        if (authData) {
          dispatch({
            type: 'RESTORE_TOKEN',
            user: authData.user,
            token: authData.token,
          });
        } else {
          dispatch({ type: 'RESTORE_TOKEN', user: null, token: null });
        }
      } catch (error) {
        console.error('Failed to restore auth:', error);
        dispatch({ type: 'RESTORE_TOKEN', user: null, token: null });
      }
    };

    restoreAuth();
  }, []);

  const authActions = {
    signIn: async (email, password) => {
      dispatch({ type: 'SET_LOADING', isLoading: true });
      try {
        const { user, token } = await authService.login(email, password);
        dispatch({ type: 'SIGN_IN', user, token });
        return { success: true };
      } catch (error) {
        dispatch({ type: 'SET_LOADING', isLoading: false });
        return { success: false, error: error.message };
      }
    },

    signUp: async (email, password, name, role) => {
      dispatch({ type: 'SET_LOADING', isLoading: true });
      try {
        const { user, token } = await authService.register(email, password, name, role);
        dispatch({ type: 'SIGN_IN', user, token });
        return { success: true };
      } catch (error) {
        dispatch({ type: 'SET_LOADING', isLoading: false });
        return { success: false, error: error.message };
      }
    },

    signOut: async () => {
      await authService.logout();
      dispatch({ type: 'SIGN_OUT' });
    },
  };

  return (
    <AuthContext.Provider value={{ ...state, ...authActions }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;

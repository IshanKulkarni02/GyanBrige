/**
 * App Navigator - Role-based Navigation
 * Routes users to different stacks based on their role
 */

import React from 'react';
import { ActivityIndicator, View, StyleSheet, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { useAuth } from '../services/AuthContext';
import { Colors, Gradients } from '../theme';

// Auth Screens
import LoginScreen from '../screens/auth/LoginScreen';

// Student Screens
import StudentHomeScreen from '../screens/student/HomeScreen';
import SubjectDetailScreen from '../screens/student/SubjectDetailScreen';
import LecturePlayerScreen from '../screens/student/LecturePlayerScreen';

// Teacher Screens
import TeacherDashboardScreen from '../screens/teacher/DashboardScreen';
import SubjectManagementScreen from '../screens/teacher/SubjectManagementScreen';
import AttendanceUploadScreen from '../screens/teacher/AttendanceUploadScreen';
import RecordLectureScreen from '../screens/teacher/RecordLectureScreen';
import UploadLectureScreen from '../screens/teacher/UploadLectureScreen';
import AttendanceScreen from '../screens/teacher/AttendanceScreen';

// Admin Screens
import UserManagementScreen from '../screens/admin/UserManagementScreen';
import ClassAssignmentScreen from '../screens/admin/ClassAssignmentScreen';
import ModelSwitcherScreen from '../screens/admin/ModelSwitcherScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Common screen options for glassmorphism theme
const screenOptions = {
  headerStyle: {
    backgroundColor: Colors.background.gradient1,
    elevation: 0,
    shadowOpacity: 0,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glass.border,
  },
  headerTintColor: Colors.text.primary,
  headerTitleStyle: {
    fontWeight: '600',
  },
  headerBackTitleVisible: false,
  cardStyle: {
    backgroundColor: Colors.background.dark,
  },
};

// Auth Stack
const AuthStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Login" component={LoginScreen} />
  </Stack.Navigator>
);

// Student Stack
const StudentStack = () => (
  <Stack.Navigator screenOptions={screenOptions}>
    <Stack.Screen 
      name="Home" 
      component={StudentHomeScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen 
      name="SubjectDetail" 
      component={SubjectDetailScreen}
      options={({ route }) => ({ 
        title: route.params?.subject?.name || 'Subject',
      })}
    />
    <Stack.Screen 
      name="LecturePlayer" 
      component={LecturePlayerScreen}
      options={({ route }) => ({ 
        title: route.params?.lecture?.title || 'Lecture',
      })}
    />
  </Stack.Navigator>
);

// Teacher Tab Icon Component
const TabIcon = ({ label, focused }) => {
  const icons = {
    Home: '🏠',
    Upload: '📤',
    Attendance: '📋',
    Record: '🎙️',
  };
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ fontSize: 20 }}>{icons[label] || '📱'}</Text>
      <Text style={{ 
        fontSize: 10, 
        color: focused ? Colors.emeraldLight : Colors.text.muted,
        marginTop: 2,
      }}>
        {label}
      </Text>
    </View>
  );
};

// Teacher Tab Navigator
const TeacherTabs = () => (
  <Tab.Navigator
    screenOptions={{
      headerShown: false,
      tabBarStyle: {
        backgroundColor: Colors.background.gradient1,
        borderTopColor: Colors.glass.border,
        borderTopWidth: 1,
        height: 70,
        paddingBottom: 10,
        paddingTop: 10,
      },
      tabBarShowLabel: false,
      tabBarActiveTintColor: Colors.emeraldLight,
      tabBarInactiveTintColor: Colors.text.muted,
    }}
  >
    <Tab.Screen
      name="HomeTab"
      component={TeacherDashboardScreen}
      options={{
        tabBarIcon: ({ focused }) => <TabIcon label="Home" focused={focused} />,
      }}
    />
    <Tab.Screen
      name="UploadTab"
      component={UploadLectureScreen}
      options={{
        tabBarIcon: ({ focused }) => <TabIcon label="Upload" focused={focused} />,
      }}
    />
    <Tab.Screen
      name="AttendanceTab"
      component={AttendanceScreen}
      options={{
        tabBarIcon: ({ focused }) => <TabIcon label="Attendance" focused={focused} />,
      }}
    />
  </Tab.Navigator>
);

// Teacher Stack (with tabs as home)
const TeacherStack = () => (
  <Stack.Navigator screenOptions={screenOptions}>
    <Stack.Screen 
      name="TeacherMain" 
      component={TeacherTabs}
      options={{ headerShown: false }}
    />
    <Stack.Screen 
      name="SubjectManagement" 
      component={SubjectManagementScreen}
      options={({ route }) => ({ 
        title: route.params?.subject?.name || 'Manage Subject',
      })}
    />
    <Stack.Screen 
      name="AttendanceUpload" 
      component={AttendanceUploadScreen}
      options={({ route }) => ({ 
        title: `${route.params?.subject?.name || 'Attendance'}`,
      })}
    />
    <Stack.Screen 
      name="RecordLecture" 
      component={RecordLectureScreen}
      options={({ route }) => ({ 
        title: 'Record Lecture',
      })}
    />
  </Stack.Navigator>
);

// Admin Stack
const AdminStack = () => (
  <Stack.Navigator screenOptions={screenOptions}>
    <Stack.Screen 
      name="UserManagement" 
      component={UserManagementScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen 
      name="ClassAssignment" 
      component={ClassAssignmentScreen}
      options={{ title: 'Class Assignment' }}
    />
    <Stack.Screen 
      name="ModelSwitcher" 
      component={ModelSwitcherScreen}
      options={{ title: 'AI Configuration' }}
    />
  </Stack.Navigator>
);

// Loading Screen
const LoadingScreen = () => (
  <View style={styles.loading}>
    <ActivityIndicator size="large" color={Colors.emeraldLight} />
  </View>
);

// Main App Navigator
const AppNavigator = () => {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  const getNavigatorForRole = () => {
    if (!isAuthenticated || !user) {
      return <AuthStack />;
    }

    switch (user.role) {
      case 'student':
        return <StudentStack />;
      case 'teacher':
        return <TeacherStack />;
      case 'admin':
        return <AdminStack />;
      default:
        return <AuthStack />;
    }
  };

  return (
    <NavigationContainer>
      {getNavigatorForRole()}
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background.dark,
  },
});

export default AppNavigator;

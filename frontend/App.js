import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Provider as PaperProvider } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { AuthProvider, useAuth } from './src/context/AuthContext';

// Screens
import HomeScreen from './src/screens/HomeScreen';
import SubjectsScreen from './src/screens/SubjectsScreen';
import SubjectVideosScreen from './src/screens/SubjectVideosScreen';
import VideoPlayerScreen from './src/screens/VideoPlayerScreen';
import UploadScreen from './src/screens/UploadScreen';
import RecordScreen from './src/screens/RecordScreen';
import NotesScreen from './src/screens/NotesScreen';
import LoginScreen from './src/screens/LoginScreen';
import AdminScreen from './src/screens/AdminScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  const { user, isStudent, isTeacher, isAdmin } = useAuth();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Subjects') {
            iconName = focused ? 'book' : 'book-outline';
          } else if (route.name === 'Upload') {
            iconName = focused ? 'cloud-upload' : 'cloud-upload-outline';
          } else if (route.name === 'Record') {
            iconName = focused ? 'videocam' : 'videocam-outline';
          } else if (route.name === 'Admin') {
            iconName = focused ? 'settings' : 'settings-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#2196F3',
        tabBarInactiveTintColor: 'gray',
      })}
    >
      {/* Students see Subjects tab, others see Home/Videos */}
      {isStudent ? (
        <Tab.Screen name="Subjects" component={SubjectsScreen} options={{ title: 'My Subjects' }} />
      ) : (
        <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Videos' }} />
      )}
      
      {/* Only show Upload/Record tabs for teachers and admins */}
      {(isTeacher || isAdmin) && (
        <>
          <Tab.Screen name="Upload" component={UploadScreen} options={{ title: 'Upload' }} />
          <Tab.Screen name="Record" component={RecordScreen} options={{ title: 'Record' }} />
        </>
      )}
      
      {/* Only show Admin tab for admins */}
      {isAdmin && (
        <Tab.Screen name="Admin" component={AdminScreen} options={{ title: 'Admin' }} />
      )}
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <PaperProvider>
        <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen 
            name="Login" 
            component={LoginScreen} 
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="Main" 
            component={MainTabs} 
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="SubjectVideos" 
            component={SubjectVideosScreen} 
            options={({ route }) => ({ title: route.params?.subject?.name || 'Videos' })}
          />
          <Stack.Screen 
            name="VideoPlayer" 
            component={VideoPlayerScreen} 
            options={{ title: 'Watch Video' }}
          />
          <Stack.Screen 
            name="Notes" 
            component={NotesScreen} 
            options={{ title: 'Video Notes' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </PaperProvider>
    </AuthProvider>
  );
}

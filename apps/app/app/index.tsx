import { Redirect } from 'expo-router';
import { useAuth } from '../lib/auth-store';
import { View, ActivityIndicator } from 'react-native';

export default function Index() {
  const { me, loading } = useAuth();
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }
  return me ? <Redirect href="/(app)/dashboard" /> : <Redirect href="/(auth)/login" />;
}

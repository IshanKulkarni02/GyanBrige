import { Redirect, useLocalSearchParams } from 'expo-router';

export default function InviteRedirect() {
  const { token } = useLocalSearchParams<{ token: string }>();
  return <Redirect href={{ pathname: '/(auth)/signup', params: { invite: token } }} />;
}

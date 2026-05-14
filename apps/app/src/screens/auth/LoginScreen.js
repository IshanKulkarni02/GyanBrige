/**
 * Login Screen
 * Glassmorphism styled login with role-based redirection
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassCard } from '../../components';
import {
  Colors,
  Gradients,
  TextStyles,
  GlassStyles,
  ButtonStyles,
  Spacing,
  BorderRadius,
  Typography,
} from '../../theme';
import { useAuth } from '../../services/AuthContext';

const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuth();

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    setIsLoading(true);
    const result = await signIn(email, password);
    setIsLoading(false);

    if (!result.success) {
      Alert.alert('Login Failed', result.error);
    }
  };

  const fillDemoCredentials = (role) => {
    const credentials = {
      student: { email: 'student@gyan.com', password: 'student123' },
      teacher: { email: 'teacher@gyan.com', password: 'teacher123' },
      admin: { email: 'admin@gyan.com', password: 'admin123' },
    };
    setEmail(credentials[role].email);
    setPassword(credentials[role].password);
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={Gradients.background.colors}
        start={Gradients.background.start}
        end={Gradients.background.end}
        style={StyleSheet.absoluteFill}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        {/* Logo */}
        <View style={styles.header}>
          <LinearGradient
            colors={Gradients.brand.colors}
            start={Gradients.brand.start}
            end={Gradients.brand.end}
            style={styles.logo}
          >
            <Text style={styles.logoText}>GB</Text>
          </LinearGradient>
          <Text style={TextStyles.h1}>GyanBrige</Text>
          <Text style={[TextStyles.body, styles.subtitle]}>
            Bridge to Knowledge
          </Text>
        </View>

        {/* Login Card */}
        <GlassCard style={styles.card}>
          <Text style={[TextStyles.h3, styles.cardTitle]}>Welcome Back</Text>

          <View style={styles.inputGroup}>
            <Text style={TextStyles.label}>Email</Text>
            <TextInput
              style={[GlassStyles.input, styles.input]}
              placeholder="Enter your email"
              placeholderTextColor={Colors.text.muted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={TextStyles.label}>Password</Text>
            <TextInput
              style={[GlassStyles.input, styles.input]}
              placeholder="Enter your password"
              placeholderTextColor={Colors.text.muted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            onPress={handleLogin}
            disabled={isLoading}
            style={styles.buttonWrapper}
          >
            <LinearGradient
              colors={Gradients.primary.colors}
              start={Gradients.primary.start}
              end={Gradients.primary.end}
              style={[ButtonStyles.primary, styles.loginButton]}
            >
              {isLoading ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={ButtonStyles.primaryText}>Sign In</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </GlassCard>

        {/* Demo Credentials */}
        <GlassCard style={styles.demoCard}>
          <Text style={[TextStyles.labelUppercase, styles.demoTitle]}>
            Quick Login (Demo)
          </Text>
          <View style={styles.demoButtons}>
            <TouchableOpacity
              style={styles.demoButton}
              onPress={() => fillDemoCredentials('student')}
            >
              <LinearGradient
                colors={['#059669', '#34d399']}
                style={styles.demoBtnGradient}
              >
                <Text style={styles.demoBtnText}>Student</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.demoButton}
              onPress={() => fillDemoCredentials('teacher')}
            >
              <LinearGradient
                colors={['#d4a574', '#e8c9a0']}
                style={styles.demoBtnGradient}
              >
                <Text style={styles.demoBtnText}>Teacher</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.demoButton}
              onPress={() => fillDemoCredentials('admin')}
            >
              <LinearGradient
                colors={['#e07a5f', '#b45309']}
                style={styles.demoBtnGradient}
              >
                <Text style={styles.demoBtnText}>Admin</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </GlassCard>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.dark,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.xxl,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xxxl,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.xxl,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  logoText: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.white,
  },
  subtitle: {
    marginTop: Spacing.xs,
  },
  card: {
    marginBottom: Spacing.xl,
  },
  cardTitle: {
    textAlign: 'center',
    marginBottom: Spacing.xxl,
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  input: {
    marginTop: Spacing.sm,
  },
  buttonWrapper: {
    marginTop: Spacing.lg,
  },
  loginButton: {
    width: '100%',
  },
  demoCard: {
    padding: Spacing.lg,
  },
  demoTitle: {
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  demoButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  demoButton: {
    flex: 1,
  },
  demoBtnGradient: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
  },
  demoBtnText: {
    color: Colors.white,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
  },
});

export default LoginScreen;

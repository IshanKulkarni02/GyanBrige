/**
 * GlassCard Component - Glassmorphism Card with Blur Effect
 * Works across iOS, Android, and Web
 */

import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { 
  Colors, 
  BorderRadius, 
  Spacing, 
  Shadows, 
  BlurIntensity 
} from '../theme/Theme';

const GlassCard = ({ 
  children, 
  style, 
  intensity = BlurIntensity.medium,
  tint = 'dark',
  noPadding = false,
}) => {
  // BlurView works best on iOS, fallback to semi-transparent background on other platforms
  const useBlur = Platform.OS === 'ios';

  if (useBlur) {
    return (
      <View style={[styles.container, style]}>
        <BlurView 
          intensity={intensity} 
          tint={tint}
          style={[styles.blurView, noPadding && styles.noPadding]}
        >
          <View style={styles.innerBorder}>
            {children}
          </View>
        </BlurView>
      </View>
    );
  }

  // Fallback for Android and Web
  return (
    <View style={[styles.fallbackCard, noPadding && styles.noPadding, style]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.xxl,
    overflow: 'hidden',
    ...Shadows.card,
  },
  blurView: {
    padding: Spacing.cardPadding,
  },
  innerBorder: {
    borderRadius: BorderRadius.xxl - 1,
  },
  fallbackCard: {
    backgroundColor: Colors.glass.background,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    borderRadius: BorderRadius.xxl,
    padding: Spacing.cardPadding,
    ...Shadows.card,
  },
  noPadding: {
    padding: 0,
  },
});

export default GlassCard;
